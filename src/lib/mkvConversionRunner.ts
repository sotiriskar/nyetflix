/**
 * Runs MKV → MP4/HLS conversion with progress tracking.
 *
 * Files with a single audio track become one MP4 (re-encoding DTS/TrueHD to AAC in parallel
 * segments so every CPU core is used). Files with more than one audio track are packaged as
 * HLS instead, because a browser cannot switch between audio tracks inside an MP4 — see
 * hlsPackage.ts. Either way, embedded text subtitles are extracted to sidecar .vtt files
 * before the original is deleted.
 */

import { spawn } from 'child_process';
import { join, dirname, basename } from 'path';
import { unlink, writeFileSync, existsSync } from 'fs';
import { cpus } from 'os';
import { getFfmpegPath } from './ffmpegPath';
import { setConvertedPathAndFlush } from './convertedMkvStore';
import { getAppConfig } from './appConfig';
import { planSubtitleExtraction, runSubtitleExtraction } from './extractEmbeddedSubtitles';
import { probeMediaStreams, canCopyAudioCodec, type StreamInfo } from './ffprobeStreams';
import {
  planHlsPackage,
  prepareHlsDataDir,
  removeHlsPackage,
  writeHlsInfo,
  writeHlsMarker,
  isHlsMarkerPath,
  isHlsPackageComplete,
  type HlsBuildPlan,
} from './hlsPackage';
import { registry, persistRegistry } from './streamRegistry';

export type ConversionProgress = {
  progress: number; // 0–1
  currentTime: number; // seconds
  durationSeconds: number;
  etaSeconds?: number; // estimated time remaining
};

/**
 * Survives Next.js HMR. Module-level Maps were wiped on every save, which orphaned a still-
 * running ffmpeg and made the next play hit "already in progress" / a frozen 0% bar.
 */
type InFlightConversion = { promise: Promise<string> };
type ConversionRuntime = {
  progress: Map<string, ConversionProgress>;
  listeners: Map<string, Set<(p: ConversionProgress) => void>>;
  inFlight: Map<string, InFlightConversion>;
};
const runtimeKey = Symbol.for('nyetflix-mkv-conversion-runtime');
function runtime(): ConversionRuntime {
  const g = globalThis as unknown as Record<symbol, ConversionRuntime>;
  if (!g[runtimeKey]) {
    g[runtimeKey] = {
      progress: new Map(),
      listeners: new Map(),
      inFlight: new Map(),
    };
  }
  return g[runtimeKey];
}

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
  return runtime().progress.get(itemId);
}

/** Snapshot of every in-flight encode (for card badges / status polling). */
export function listInFlightConversions(): { itemId: string; progress: ConversionProgress }[] {
  const { inFlight, progress } = runtime();
  const out: { itemId: string; progress: ConversionProgress }[] = [];
  for (const itemId of inFlight.keys()) {
    out.push({
      itemId,
      progress: progress.get(itemId) ?? { progress: 0, currentTime: 0, durationSeconds: 0 },
    });
  }
  return out;
}

export function isItemConversionInFlight(itemId: string): boolean {
  return runtime().inFlight.has(itemId);
}

export function subscribeToProgress(itemId: string, cb: (p: ConversionProgress) => void): () => void {
  const { listeners, progress } = runtime();
  let set = listeners.get(itemId);
  if (!set) {
    set = new Set();
    listeners.set(itemId, set);
  }
  set.add(cb);
  const p = progress.get(itemId);
  if (p) cb(p);
  return () => {
    set?.delete(cb);
    if (set?.size === 0) listeners.delete(itemId);
  };
}

function notifyProgress(itemId: string, p: ConversionProgress): void {
  const { progress, listeners } = runtime();
  progress.set(itemId, p);
  listeners.get(itemId)?.forEach((cb) => cb(p));
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
  videoArgs: string[],
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
      ...videoArgs,
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
  sourcePath: string,
  mp4Path: string,
  durationSeconds: number,
  videoArgs: string[],
  audioArgs: string[],
  abortSignal?: AbortSignal | null
): Promise<void> {
  const numCpus = Math.max(1, cpus().length);
  const numSegments = Math.min(24, Math.max(8, numCpus * 3));
  const segmentDuration = durationSeconds / numSegments;
  const dir = dirname(sourcePath);
  const base = sourceStem(sourcePath);
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
      return runSegment(ffmpegBin, sourcePath, start, duration, segPath, videoArgs, audioArgs, abortSignal)
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

/** Runs ffmpeg once, reporting progress from its `time=` output. Rejects with ffmpeg's own error text. */
function runWithProgress(
  itemId: string,
  ffmpegBin: string,
  args: string[],
  durationSeconds: number,
  abortSignal?: AbortSignal | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });

    const onAbort = (): void => {
      abortSignal?.removeEventListener('abort', onAbort);
      ffmpeg.kill('SIGKILL');
      reject(new Error('Conversion cancelled (page closed or navigated away)'));
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
        const progress = Math.min(0.99, t / durationSeconds);
        const eta = progress > 0.01 ? (t / progress) * (1 - progress) : undefined;
        notifyProgress(itemId, { progress, currentTime: t, durationSeconds, etaSeconds: eta });
      }
    });

    ffmpeg.on('error', () => {
      abortSignal?.removeEventListener('abort', onAbort);
      reject(new Error('ffmpeg error'));
    });

    ffmpeg.on('close', (code) => {
      abortSignal?.removeEventListener('abort', onAbort);
      if (code === 0) {
        resolve();
        return;
      }
      const snippet = stderrBuf.trim().slice(-600).replace(/\s+/g, ' ');
      reject(new Error(snippet ? `Conversion failed (code ${code}): ${snippet}` : `ffmpeg exited with code ${code}`));
    });
  });
}

/** Audio arguments for the single-track MP4 path: copy AAC, otherwise downmix to stereo AAC. */
function singleTrackAudioArgs(stream: StreamInfo | undefined, useFdk: boolean): string[] {
  if (stream && canCopyAudioCodec(stream.codec)) return ['-c:a', 'copy'];
  return ['-ac', '2', '-c:a', useFdk ? 'libfdk_aac' : 'aac', '-b:a', '192k'];
}

function sourceStem(filePath: string): string {
  return basename(filePath).replace(/\.(mkv|mp4|m4v|mov)$/i, '');
}

/** Output next to the source. MKV → .mp4; already-MP4 → .nyetflix.mp4 so we don't overwrite. */
function outputMp4Path(sourcePath: string): string {
  const dir = dirname(sourcePath);
  const stem = sourceStem(sourcePath);
  const ext = sourcePath.includes('.') ? sourcePath.slice(sourcePath.lastIndexOf('.')).toLowerCase() : '';
  if (ext === '.mkv') return join(dir, stem + '.mp4');
  return join(dir, stem + '.nyetflix.mp4');
}

/**
 * One shared conversion per item. Extra EventSource clients (React Strict Mode remounts,
 * reconnects, a second tab) join the same promise instead of starting a rival encode.
 *
 * Intentionally NOT cancelled when the HTTP client disconnects: closing the watch page /
 * remounting the player used to abort ffmpeg immediately, which left the UI frozen at 0%.
 * The encode keeps running; the next subscriber picks up live progress.
 */
export function runMkvConversion(
  itemId: string,
  mkvPath: string,
  durationSeconds: number,
  _abortSignal?: AbortSignal | null
): Promise<string> {
  const { inFlight, progress, listeners } = runtime();
  const running = inFlight.get(itemId);
  if (running) return running.promise;

  const dir = dirname(mkvPath);
  const base = sourceStem(mkvPath);
  const mp4Path = outputMp4Path(mkvPath);
  const ffmpegBin = getFfmpegPath();

  if (!/[\\/]/.test(ffmpegBin)) {
    return Promise.reject(new Error('ffmpeg not found'));
  }

  if (inFlight.size > 0) {
    return Promise.reject(new Error('Another conversion is already in progress. Please wait for it to finish.'));
  }

  /**
   * Extract embedded text subtitles to sidecar .vtt and register them – we show files only,
   * never embedded streams. Runs before the source file is deleted.
   */
  async function extractAndRegisterSubtitles(subtitleStreams: StreamInfo[]): Promise<void> {
    const planned = planSubtitleExtraction(subtitleStreams, dir, base);
    if (planned.length === 0) return;
    const extracted = await runSubtitleExtraction(mkvPath, planned, { overwrite: true });
    if (Object.keys(extracted).length === 0) return;
    const r = registry;
    const isEpisode = /^episode-.+-S\d+-E\d+$/.test(itemId);
    const existing = isEpisode
      ? (r.episodeIdToSubtitlePath.get(itemId) ?? {})
      : (r.itemIdToSubtitlePath.get(itemId) ?? {});
    const merged = { ...existing, ...extracted };
    if (isEpisode) r.episodeIdToSubtitlePath.set(itemId, merged);
    else r.itemIdToSubtitlePath.set(itemId, merged);
    persistRegistry();
  }

  /** Shared tail for both paths: record the output, save subtitles, drop the source file. */
  async function finish(outputPath: string, subtitleStreams: StreamInfo[]): Promise<string> {
    // Never delete the source until the playable output is actually on disk. A cancelled or
    // half-written HLS package used to leave users with neither the MKV nor a working encode.
    const outputOk = isHlsMarkerPath(outputPath)
      ? isHlsPackageComplete(outputPath)
      : existsSync(outputPath);
    if (!outputOk) {
      return fail(new Error('Conversion finished but the output file is missing or incomplete'));
    }

    await setConvertedPathAndFlush(itemId, outputPath);
    // Point the registry at the playable file so a rescan isn't required after conversion.
    if (outputPath !== mkvPath) {
      if (registry.episodeIdToPath.has(itemId)) registry.episodeIdToPath.set(itemId, outputPath);
      else if (registry.itemIdToPath.has(itemId)) registry.itemIdToPath.set(itemId, outputPath);
      persistRegistry();
    }
    await extractAndRegisterSubtitles(subtitleStreams);
    notifyProgress(itemId, { progress: 1, currentTime: durationSeconds, durationSeconds });
    if (!getAppConfig().keepSourceMkv) {
      unlink(mkvPath, () => {}); // Remove original MKV only when the user opted to free disk space
    }
    progress.delete(itemId);
    listeners.delete(itemId);
    inFlight.delete(itemId);
    return outputPath;
  }

  function fail(err: unknown): Promise<never> {
    progress.delete(itemId);
    listeners.delete(itemId);
    inFlight.delete(itemId);
    return Promise.reject(err instanceof Error ? err : new Error(String(err)));
  }

  function convert(): Promise<string> {
    return Promise.all([probeMediaStreams(mkvPath), hasLibfdkAac(ffmpegBin)]).then(
      async ([probed, useFdk]) => {
        // More than one audio track: package as HLS so all of them stay selectable.
        if (probed.audio.length > 1) {
          const plan: HlsBuildPlan = planHlsPackage(mkvPath, base, probed.audio);
          try {
            await prepareHlsDataDir(plan.dataDir);
            // Leave 0% behind as soon as ffmpeg is about to start (probe can take a few seconds).
            notifyProgress(itemId, { progress: 0.01, currentTime: 0, durationSeconds });
            await runWithProgress(itemId, ffmpegBin, plan.args, durationSeconds, null);
            await writeHlsMarker(plan);
            await writeHlsInfo(plan, durationSeconds);
            return await finish(plan.markerPath, probed.subtitles);
          } catch (err) {
            await removeHlsPackage(plan.markerPath);
            return fail(err);
          }
        }

        const audioArgs = singleTrackAudioArgs(probed.audio[0], useFdk);
        const copyAudio = audioArgs[0] === '-c:a' && audioArgs[1] === 'copy';
        const languageArgs =
          probed.audio[0] && probed.audio[0].lang !== 'und'
            ? ['-metadata:s:a:0', `language=${probed.audio[0].lang}`]
            : [];

        // Re-encode DTS/TrueHD/AC3 to AAC in parallel segments so a movie finishes in about a minute.
        // Video is always stream-copied — a full H.264 encode is what made this take forever.
        if (!copyAudio && durationSeconds >= 120) {
          try {
            await runParallelConversion(
              itemId,
              ffmpegBin,
              mkvPath,
              mp4Path,
              durationSeconds,
              ['-c:v', 'copy'],
              audioArgs,
              null
            );
            return await finish(mp4Path, probed.subtitles);
          } catch (err) {
            return fail(err);
          }
        }

        try {
          notifyProgress(itemId, { progress: 0.01, currentTime: 0, durationSeconds });
          await runWithProgress(
            itemId,
            ffmpegBin,
            [
              '-threads', '0',
              '-i', mkvPath,
              '-map', '0:v:0',
              '-map', '0:a:0?',
              '-stats_period', '1',
              '-c:v', 'copy',
              ...audioArgs,
              ...languageArgs,
              '-movflags', '+faststart',
              '-y', mp4Path,
            ],
            durationSeconds,
            null
          );
          return await finish(mp4Path, probed.subtitles);
        } catch (err) {
          // Leave no half-written file behind; it can hold a lock for a moment on Windows.
          const deletePartial = (): void => {
            unlink(mp4Path, (e) => {
              if (e && (e as NodeJS.ErrnoException).code === 'EBUSY') setTimeout(deletePartial, 200);
            });
          };
          setTimeout(deletePartial, 100);
          return fail(err);
        }
      },
      // Never leave the item marked as converting if probing itself blows up.
      (err) => fail(err),
    );
  }

  notifyProgress(itemId, { progress: 0, currentTime: 0, durationSeconds });

  const entry: InFlightConversion = {
    promise: undefined as unknown as Promise<string>,
  };
  inFlight.set(itemId, entry);
  entry.promise = convert();
  return entry.promise;
}
