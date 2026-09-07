/**
 * Extract embedded subtitle streams from a video file to sidecar .vtt files.
 * Used during MKV→MP4/HLS conversion so subtitles survive: the source file is deleted
 * afterwards, so anything not extracted here is lost for good.
 *
 * Every text-based stream is extracted, including several tracks of the same language
 * (full / forced / SDH). Bitmap streams (PGS, VobSub, DVB) are skipped because there is
 * no way to turn pictures into WebVTT. Extraction only counts as successful when the
 * resulting file actually holds cues — an empty file used to pass, which is why captions
 * could show up in the menu and then display nothing.
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { readFile, stat, unlink } from 'fs/promises';
import { probeMediaStreams, isTextSubtitleCodec, type StreamInfo } from './ffprobeStreams';
import { nameSubtitleStreams } from './subtitleTrackKeys';
import { getFfmpegPath } from './ffmpegPath';

/** One full pass over a large MKV takes a while; it reads every packet in the file. */
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

export interface PlannedSubtitleTrack {
  key: string;
  path: string;
  streamIndex: number;
}

export interface SubtitleExtractionOptions {
  /** Ceiling for the single combined pass. Per-stream retries get a quarter of it. */
  timeoutMs?: number;
  /** Streams from an earlier probe of the same file, to avoid probing twice. */
  streams?: StreamInfo[];
  /** When true, rewrite sidecar files even if they already have cues (used during MKV conversion). */
  overwrite?: boolean;
}

/** Sidecar path for a track key: `Movie.en.vtt`, `Movie.en.forced.vtt`. */
function sidecarPath(outputDir: string, baseName: string, key: string): string {
  return join(outputDir, `${baseName}.${key}.vtt`);
}

/** True when the file holds at least one cue. Guards against ffmpeg writing a header and nothing else. */
async function hasCues(path: string): Promise<boolean> {
  try {
    const st = await stat(path);
    if (!st.isFile() || st.size < 24) return false;
    const content = await readFile(path, 'utf-8');
    return content.includes('-->');
  } catch {
    return false;
  }
}

/** Which subtitle streams are worth extracting, and where each one goes. */
export function planSubtitleExtraction(
  streams: StreamInfo[],
  outputDir: string,
  baseName: string,
): PlannedSubtitleTrack[] {
  const textStreams = streams.filter((s) => isTextSubtitleCodec(s.codec));
  const names = nameSubtitleStreams(textStreams);
  return textStreams.map((stream, i) => ({
    key: names[i]!.key,
    path: sidecarPath(outputDir, baseName, names[i]!.key),
    streamIndex: stream.index,
  }));
}

/** ffmpeg output arguments that write every planned track in one pass. */
function extractionArgs(tracks: PlannedSubtitleTrack[]): string[] {
  return tracks.flatMap((track) => [
    '-map',
    `0:${track.streamIndex}`,
    '-c:s',
    'webvtt',
    '-f',
    'webvtt',
    '-y',
    track.path,
  ]);
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const proc = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    proc.stderr?.on('data', () => {});
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      finish(false);
    }, timeoutMs);
    proc.on('close', (code) => finish(code === 0));
    proc.on('error', () => finish(false));
  });
}

/**
 * Runs the planned extraction and returns `{ trackKey: absolutePath }` for the tracks that
 * produced real cues. Tracks that already have a usable file on disk are reused as-is, so a
 * hand-placed subtitle file is never overwritten and a re-run costs nothing.
 */
export async function runSubtitleExtraction(
  videoPath: string,
  planned: PlannedSubtitleTrack[],
  options: SubtitleExtractionOptions = {},
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (planned.length === 0) return result;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const todo: PlannedSubtitleTrack[] = [];
  for (const track of planned) {
    if (!options.overwrite && (await hasCues(track.path))) result[track.key] = track.path;
    else todo.push(track);
  }
  if (todo.length === 0) return result;

  // One pass writes every track; a per-stream pass would re-read the whole file each time.
  await runFfmpeg(['-v', 'error', '-i', videoPath, ...extractionArgs(todo)], timeoutMs);

  const failed: PlannedSubtitleTrack[] = [];
  for (const track of todo) {
    if (await hasCues(track.path)) result[track.key] = track.path;
    else failed.push(track);
  }

  // A single unreadable stream aborts the combined pass, so retry the stragglers alone.
  for (const track of failed) {
    await unlink(track.path).catch(() => {});
    const ok = await runFfmpeg(
      ['-v', 'error', '-i', videoPath, ...extractionArgs([track])],
      Math.max(60000, Math.round(timeoutMs / 4)),
    );
    if (ok && (await hasCues(track.path))) result[track.key] = track.path;
    else await unlink(track.path).catch(() => {});
  }

  return result;
}

/**
 * Extract embedded subtitle streams to sidecar .vtt files.
 * Returns `{ trackKey: absolutePath }` for each stream that produced usable cues.
 */
export async function extractEmbeddedSubtitlesToSidecar(
  videoPath: string,
  outputDir: string,
  baseName: string,
  options: SubtitleExtractionOptions = {},
): Promise<Record<string, string>> {
  const streams = options.streams ?? (await probeMediaStreams(videoPath)).subtitles;
  const planned = planSubtitleExtraction(streams, outputDir, baseName);
  return runSubtitleExtraction(videoPath, planned, options);
}
