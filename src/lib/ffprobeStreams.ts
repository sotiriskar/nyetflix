/**
 * Lists the audio and subtitle streams inside a video file.
 *
 * Conversion needs this to keep every track a file has: which audio streams exist (and
 * whether they can be copied or must be re-encoded), and which subtitle streams are
 * text-based, since bitmap subtitles (PGS/VobSub) can never become WebVTT.
 */

import { spawn } from 'child_process';
import { getFfmpegPath } from './ffmpegPath';

export interface StreamInfo {
  /** Absolute ffmpeg stream index — use with `-map 0:<index>`. */
  index: number;
  /** Index within its own type — use with `-map 0:a:<typeIndex>`. */
  typeIndex: number;
  codec: string;
  /** ISO 639 code from stream tags, or 'und' when the file doesn't say. */
  lang: string;
  title?: string;
  channels?: number;
  isDefault: boolean;
  isForced: boolean;
  isHearingImpaired: boolean;
  isVisualImpaired: boolean;
  isCommentary: boolean;
}

export interface ProbedStreams {
  audio: StreamInfo[];
  subtitles: StreamInfo[];
  /** False when neither ffprobe nor ffmpeg could read the file, so callers can fall back. */
  ok: boolean;
}

/** Subtitle codecs that can be converted to WebVTT. Everything else is bitmap (PGS, VobSub, DVB). */
const TEXT_SUBTITLE_CODECS = new Set([
  'subrip',
  'srt',
  'ass',
  'ssa',
  'mov_text',
  'webvtt',
  'text',
  'subviewer',
  'subviewer1',
  'microdvd',
  'jacosub',
  'sami',
  'realtext',
  'stl',
  'pjs',
  'mpl2',
  'vplayer',
]);

/** Audio codecs an MP4/fMP4 container takes as-is and browsers can decode. */
const COPYABLE_AUDIO_CODECS = new Set(['aac']);

export function isTextSubtitleCodec(codec: string): boolean {
  return TEXT_SUBTITLE_CODECS.has(codec.toLowerCase());
}

export function canCopyAudioCodec(codec: string): boolean {
  return COPYABLE_AUDIO_CODECS.has(codec.toLowerCase());
}

function getFfprobePath(): string {
  return getFfmpegPath().replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
}

type RawStream = {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  channels?: number;
  tags?: Record<string, string>;
  disposition?: Record<string, number>;
};

function normalizeLang(raw: string | undefined): string {
  const lang = (raw ?? '').trim().toLowerCase().slice(0, 3);
  return lang || 'und';
}

function toStreamInfo(raw: RawStream, typeIndex: number): StreamInfo {
  const tags = raw.tags ?? {};
  const disposition = raw.disposition ?? {};
  const title = (tags.title ?? tags.TITLE ?? '').trim();
  return {
    index: raw.index ?? 0,
    typeIndex,
    codec: (raw.codec_name ?? '').toLowerCase(),
    lang: normalizeLang(tags.language ?? tags.LANGUAGE),
    title: title || undefined,
    channels: raw.channels,
    isDefault: disposition.default === 1,
    isForced: disposition.forced === 1,
    isHearingImpaired: disposition.hearing_impaired === 1,
    isVisualImpaired: disposition.visual_impaired === 1,
    isCommentary: disposition.comment === 1,
  };
}

function parseProbeJson(json: string): ProbedStreams | null {
  try {
    const data = JSON.parse(json) as { streams?: RawStream[] };
    const streams = data.streams ?? [];
    if (streams.length === 0) return null;
    const audio: StreamInfo[] = [];
    const subtitles: StreamInfo[] = [];
    for (const raw of streams) {
      if (raw.codec_type === 'audio') audio.push(toStreamInfo(raw, audio.length));
      else if (raw.codec_type === 'subtitle') subtitles.push(toStreamInfo(raw, subtitles.length));
    }
    return { audio, subtitles, ok: true };
  } catch {
    return null;
  }
}

/** `Stream #0:1(eng): Audio: ac3, ...` — fallback for installs that ship ffmpeg without ffprobe. */
function parseFfmpegStderr(stderr: string): ProbedStreams {
  const audio: StreamInfo[] = [];
  const subtitles: StreamInfo[] = [];
  const regex = /Stream #0:(\d+)(?:\[[^\]]*\])?(?:\(([^)]+)\))?: (Audio|Subtitle): (\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stderr)) !== null) {
    const [, indexRaw, langRaw, kind, codec] = match;
    const list = kind === 'Audio' ? audio : subtitles;
    list.push({
      index: parseInt(indexRaw!, 10),
      typeIndex: list.length,
      codec: codec!.toLowerCase(),
      lang: normalizeLang(langRaw),
      isDefault: list.length === 0,
      isForced: false,
      isHearingImpaired: false,
      isVisualImpaired: false,
      isCommentary: false,
    });
  }
  return { audio, subtitles, ok: audio.length > 0 || subtitles.length > 0 };
}

function run(bin: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (stdout: string, stderr: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr });
    };
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: string[] = [];
    const err: string[] = [];
    proc.stdout?.setEncoding('utf-8');
    proc.stdout?.on('data', (chunk: string) => out.push(chunk));
    proc.stderr?.setEncoding('utf-8');
    proc.stderr?.on('data', (chunk: string) => err.push(chunk));
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      finish(out.join(''), err.join(''));
    }, timeoutMs);
    proc.on('close', () => finish(out.join(''), err.join('')));
    proc.on('error', () => finish('', ''));
  });
}

/** Audio and subtitle streams of a file. Falls back to parsing `ffmpeg -i` when ffprobe is unavailable. */
export async function probeMediaStreams(filePath: string, timeoutMs = 20000): Promise<ProbedStreams> {
  const probe = await run(
    getFfprobePath(),
    ['-v', 'quiet', '-print_format', 'json', '-show_streams', filePath],
    timeoutMs,
  );
  const parsed = parseProbeJson(probe.stdout);
  if (parsed) return parsed;

  const fallback = await run(getFfmpegPath(), ['-i', filePath], timeoutMs);
  return parseFfmpegStderr(fallback.stderr);
}
