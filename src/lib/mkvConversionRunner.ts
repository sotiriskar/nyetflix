/**
 * Runs MKV → MP4 conversion with progress tracking.
 * For re-encode (DTS/TrueHD → AAC): uses parallel segment encoding to use all CPU cores.
 */

import { spawn } from 'child_process';
import { join, dirname, basename } from 'path';
import { unlink, writeFileSync } from 'fs';
import { cpus } from 'os';
import { getFfmpegPath } from './ffmpegPath';
import {
  setConvertedPath,
  isConversionInProgress,
  hasAnyConversionInProgress,
  markConversionStarted,
  markConversionFinished,
} from './convertedMkvStore';

export type ConversionProgress = {
  progress: number; // 0–1
  currentTime: number; // seconds
  durationSeconds: number;
  etaSeconds?: number; // estimated time remaining
};

const progressMap = new Map<string, ConversionProgress>();
const listeners = new Map<string, Set<(p: ConversionProgress) => void>>();

/** Parse last "time=00:01:23.45" from ffmpeg stderr (ffmpeg uses \\r to overwrite same line). */
function parseLastTime(stderr: string): number | null {
  const regex = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/g;
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((m = regex.exec(stderr)) !== null) last = m;
  if (!last) return null;
  const [, h, min, sec, cent] = last;
  return parseInt(h!, 10) * 3600 + parseInt(min!, 10) * 60 + parseInt(sec!, 10) + parseInt(cent!, 10) / 100;
}

export function getConversionProgress(itemId: string): ConversionProgress | undefined {
  return progressMap.get(itemId);
}

export function subscribeToProgress(itemId: string, cb: (p: ConversionProgress) => void): () => void {
  let set = listeners.get(itemId);
  if (!set) {
    set = new Set();
    listeners.set(itemId, set);
  }
  set.add(cb);
  const p = progressMap.get(itemId);
  if (p) cb(p);
  return () => {
    set?.delete(cb);
    if (set?.size === 0) listeners.delete(itemId);
  };
}

function notifyProgress(itemId: string, p: ConversionProgress): void {
  progressMap.set(itemId, p);
  listeners.get(itemId)?.forEach((cb) => cb(p));
}

/** Get first audio stream codec (e.g. 'aac', 'dts') so we can copy if already AAC. */
function getFirstAudioCodec(ffmpegBin: string, mkvPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegBin, ['-i', mkvPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.setEncoding('utf-8');
    proc.stderr?.on('data', (chunk: string) => { stderr += chunk; });
    proc.on('close', () => {
      const m = stderr.match(/Stream\s+#?\d+:\d+.*?Audio:\s+(\w+)/);
      resolve(m ? m[1].toLowerCase() : null);
    });
    proc.on('error', () => resolve(null));
    setTimeout(() => { proc.kill('SIGKILL'); resolve(null); }, 8000);
  });
}

/** True if ffmpeg has libfdk_aac (faster AAC encoder when re-encoding). */
function hasLibfdkAac(ffmpegBin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegBin, ['-encoders'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout?.setEncoding('utf-8');
    proc.stdout?.on('data', (chunk: string) => { out += chunk; });
    proc.stderr?.setEncoding('utf-8');
    proc.stderr?.on('data', (chunk: string) => { out += chunk; });
    proc.on('close', () => resolve(/libfdk_aac/.test(out)));
    proc.on('error', () => resolve(false));
    setTimeout(() => { proc.kill('SIGKILL'); resolve(false); }, 3000);
  });
}

/** Run one segment: -ss start -t duration, output to segmentPath. */
function runSegment(
  ffmpegBin: string,
  mkvPath: string,
  startSec: number,
  durationSec: number,
  segmentPath: string,
  audioArgs: string[],
  abortSignal?: AbortSignal | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegBin, [
      '-ss', String(startSec),
      '-t', String(durationSec),
      '-i', mkvPath,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'copy',
      ...audioArgs,
      '-movflags', '+faststart',
      '-y', segmentPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    const onAbort = (): void => {
      ffmpeg.kill('SIGKILL');
      unlink(segmentPath, () => {});
      reject(new Error('Cancelled'));
    };
    if (abortSignal?.aborted) {
      onAbort();
      return;
    }
    abortSignal?.addEventListener('abort', onAbort);

    ffmpeg.on('error', () => reject(new Error('ffmpeg error')));
    ffmpeg.on('close', (code) => {
      abortSignal?.removeEventListener('abort', onAbort);
      if (code === 0) resolve();
      else {
        unlink(segmentPath, () => {});
        reject(new Error(`Segment failed with code ${code}`));
      }
    });
  });
}

/** Parallel segment conversion: N segments in parallel, then concat. Uses all CPU cores. */
function runParallelConversion(
  itemId: string,
  ffmpegBin: string,
  mkvPath: string,
  mp4Path: string,
  durationSeconds: number,
  audioArgs: string[],
  abortSignal?: AbortSignal | null
): Promise<void> {
  const numCpus = Math.max(1, cpus().length);
  const numSegments = Math.min(24, Math.max(8, numCpus * 3));
  const segmentDuration = durationSeconds / numSegments;
  const dir = dirname(mkvPath);
  const base = basename(mkvPath, '.mkv');
  const segmentPaths: string[] = [];
  for (let i = 0; i < numSegments; i++) {
    segmentPaths.push(join(dir, `${base}.seg${i}.mp4`));
  }

  // Show we're working right away (no more 0% while splitting / starting encodes)
  const SEGMENT_START = 0.03;
  const SEGMENT_END = 0.95;
  notifyProgress(itemId, { progress: SEGMENT_START, currentTime: 0, durationSeconds });

  let completedCount = 0;
  const allSegmentsDone = (): void => {
    completedCount += 1;
    const p = Math.min(SEGMENT_END, SEGMENT_START + (completedCount / numSegments) * (SEGMENT_END - SEGMENT_START));
    notifyProgress(itemId, {
      progress: p,
      currentTime: p * durationSeconds,
      durationSeconds,
    });
  };

  return Promise.all(
    segmentPaths.map((segPath, i) => {
      const start = i * segmentDuration;
      const duration = i === numSegments - 1 ? durationSeconds - start : segmentDuration;
      return runSegment(ffmpegBin, mkvPath, start, duration, segPath, audioArgs, abortSignal)
        .then(() => allSegmentsDone());
    })
  ).then(() => {
    notifyProgress(itemId, { progress: 0.96, currentTime: durationSeconds * 0.96, durationSeconds });
    const listPath = join(dir, `${base}.concat.txt`);
    // Use forward slashes in list so ffmpeg concat works on Windows
    const listContent = segmentPaths
      .map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
      .join('\n');
    writeFileSync(listPath, listContent, 'utf-8');

    return new Promise<void>((resolve, reject) => {
      const tempMp4 = join(dir, `${base}.temp.mp4`);
      const concat = spawn(ffmpegBin, [
        '-f', 'concat', '-safe', '0', '-i', listPath,
        '-c', 'copy',
        '-y', tempMp4,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });

      // Drain stderr so the process doesn't block when pipe buffer fills (e.g. on Windows)
      concat.stderr?.on('data', () => {});

      const onAbort = (): void => {
        concat.kill('SIGKILL');
        segmentPaths.forEach((p) => unlink(p, () => {}));
        unlink(listPath, () => {});
        unlink(tempMp4, () => {});
        reject(new Error('Cancelled'));
      };
      if (abortSignal?.aborted) {
        onAbort();
        return;
      }
      abortSignal?.addEventListener('abort', onAbort);

      concat.on('close', (code) => {
        abortSignal?.removeEventListener('abort', onAbort);
        segmentPaths.forEach((p) => unlink(p, () => {}));
        unlink(listPath, () => {});
        if (code !== 0) {
          unlink(tempMp4, () => {});
          reject(new Error(`Concat failed ${code}`));
          return;
        }
        const faststart = spawn(ffmpegBin, [
          '-i', tempMp4, '-c', 'copy', '-movflags', '+faststart', '-y', mp4Path,
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
        faststart.stderr?.on('data', () => {});
        faststart.on('close', (c) => {
          unlink(tempMp4, () => {});
          if (c === 0) resolve();
          else reject(new Error(`Faststart failed ${c}`));
        });
        faststart.on('error', () => reject(new Error('ffmpeg error')));
      });
      concat.on('error', () => reject(new Error('ffmpeg error')));
    });
  }).catch((err) => {
    segmentPaths.forEach((p) => unlink(p, () => {}));
    throw err;
  });
}

export function runMkvConversion(
  itemId: string,
  mkvPath: string,
  durationSeconds: number,
  abortSignal?: AbortSignal | null
): Promise<string> {
  if (isConversionInProgress(itemId)) {
    const p = progressMap.get(itemId);
    if (p && p.progress >= 1) {
      const converted = join(dirname(mkvPath), basename(mkvPath, '.mkv') + '.mp4');
      return Promise.resolve(converted);
    }
    return new Promise((resolve, reject) => {
      const unsub = subscribeToProgress(itemId, (prog) => {
        if (prog.progress >= 1) {
          unsub();
          const converted = join(dirname(mkvPath), basename(mkvPath, '.mkv') + '.mp4');
          resolve(converted);
        }
      });
      setTimeout(() => {
        unsub();
        reject(new Error('Conversion timeout'));
      }, 3600000);
    });
  }

  const dir = dirname(mkvPath);
  const base = basename(mkvPath, '.mkv');
  const mp4Path = join(dir, base + '.mp4');
  const ffmpegBin = getFfmpegPath();

  if (!/[\\/]/.test(ffmpegBin)) {
    return Promise.reject(new Error('ffmpeg not found'));
  }

  if (hasAnyConversionInProgress()) {
    return Promise.reject(new Error('Another conversion is already in progress. Please wait for it to finish.'));
  }

  markConversionStarted(itemId);
  notifyProgress(itemId, { progress: 0, currentTime: 0, durationSeconds });

  return Promise.all([
    getFirstAudioCodec(ffmpegBin, mkvPath),
    hasLibfdkAac(ffmpegBin),
  ]).then(([audioCodec, useFdk]) => {
    const copyAudio = audioCodec === 'aac';
    const audioArgs = copyAudio
      ? ['-c:a', 'copy']
      : ['-ac', '2', '-c:a', useFdk ? 'libfdk_aac' : 'aac', '-b:a', '192k'];

    // Re-encode (DTS/TrueHD etc.): use parallel segments for long files to use all CPU cores
    const useParallel = !copyAudio && durationSeconds >= 120;
    if (useParallel) {
      return runParallelConversion(
        itemId,
        ffmpegBin,
        mkvPath,
        mp4Path,
        durationSeconds,
        audioArgs,
        abortSignal
      )
        .then(() => {
          setConvertedPath(itemId, mp4Path);
          notifyProgress(itemId, { progress: 1, currentTime: durationSeconds, durationSeconds });
          unlink(mkvPath, () => {});
          progressMap.delete(itemId);
          listeners.delete(itemId);
          markConversionFinished(itemId);
          return mp4Path;
        })
        .catch((err) => {
          markConversionFinished(itemId);
          progressMap.delete(itemId);
          listeners.delete(itemId);
          return Promise.reject(err);
        });
    }

    return new Promise<string>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegBin, [
        '-threads', '0',
        '-i', mkvPath,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-stats_period', '1',
        '-c:v', 'copy',
        ...audioArgs,
        '-movflags', '+faststart',
        '-y', mp4Path,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });

      const cleanupAbort = (): void => {
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
      };
      const onAbort = (): void => {
        cleanupAbort();
        ffmpeg.kill('SIGKILL');
        markConversionFinished(itemId);
        progressMap.delete(itemId);
        listeners.delete(itemId);
        reject(new Error('Conversion cancelled (page closed or navigated away)'));
        // Partial file is deleted in ffmpeg 'close' handler once process exits
      };
      if (abortSignal?.aborted) {
        onAbort();
        return;
      }
      abortSignal?.addEventListener('abort', onAbort);

    let stderrBuf = '';
    const maxBuf = 65536;
    ffmpeg.stderr?.setEncoding('utf-8');
    ffmpeg.stderr?.on('data', (chunk: string) => {
      stderrBuf += chunk;
      if (stderrBuf.length > maxBuf) stderrBuf = stderrBuf.slice(-maxBuf);
      const t = parseLastTime(stderrBuf);
      if (t != null && durationSeconds > 0) {
        const progress = Math.min(1, t / durationSeconds);
        const eta = progress > 0.01 ? (t / progress) * (1 - progress) : undefined;
        notifyProgress(itemId, {
          progress,
          currentTime: t,
          durationSeconds,
          etaSeconds: eta,
        });
      }
    });

    ffmpeg.on('error', () => {
      markConversionFinished(itemId);
      progressMap.delete(itemId);
      unlink(mp4Path, () => {});
      reject(new Error('ffmpeg error'));
    });

    ffmpeg.on('close', (code) => {
      cleanupAbort();
      markConversionFinished(itemId);
      if (code === 0) {
        setConvertedPath(itemId, mp4Path);
        notifyProgress(itemId, { progress: 1, currentTime: durationSeconds, durationSeconds });
        unlink(mkvPath, () => {}); // Remove original MKV now that MP4 plays
        resolve(mp4Path);
      } else {
        const deletePartial = (): void => {
          unlink(mp4Path, (err) => {
            if (err && (err as NodeJS.ErrnoException).code === 'EBUSY') {
              setTimeout(deletePartial, 200);
            }
          });
        };
        setTimeout(deletePartial, 100);
        const errSnippet = stderrBuf.trim().slice(-600).replace(/\s+/g, ' ') || '';
        const errMsg = errSnippet
          ? `Conversion failed (code ${code}): ${errSnippet}`
          : `ffmpeg exited with code ${code}`;
        reject(new Error(errMsg));
      }
      progressMap.delete(itemId);
      listeners.delete(itemId);
    });
  });
  });
}
