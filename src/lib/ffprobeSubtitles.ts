import { spawn } from 'child_process';
import { getFfmpegPath } from './ffmpegPath';

export interface SubtitleStreamInfo {
  /** FFmpeg stream index (use with -map 0:index) */
  index: number;
  /** ISO 639-2 or 639-1 language code from stream tags, or 'und' if missing */
  lang: string;
}

/**
 * List embedded subtitle streams in a video file via ffprobe.
 * Returns all subtitle streams; text-based ones will display, bitmap (PGS etc.) may not.
 */
export async function getEmbeddedSubtitleStreams(filePath: string): Promise<SubtitleStreamInfo[]> {
  const ffmpegBin = getFfmpegPath();
  const ffprobeBin = ffmpegBin.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');

  return new Promise((resolve) => {
    const proc = spawn(
      ffprobeBin,
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_streams',
        '-select_streams',
        's',
        filePath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const chunks: string[] = [];
    proc.stdout?.setEncoding('utf-8');
    proc.stdout?.on('data', (chunk: string) => chunks.push(chunk));

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve(parseStreams(chunks.join('')));
    }, 15000);

    proc.on('close', () => {
      clearTimeout(timeout);
      resolve(parseStreams(chunks.join('')));
    });
    proc.on('error', () => {
      clearTimeout(timeout);
      resolve([]);
    });
  });
}

function parseStreams(json: string): SubtitleStreamInfo[] {
  try {
    const data = JSON.parse(json) as {
      streams?: Array<{ index?: number; tags?: { language?: string } }>;
    };
    const streams = data.streams ?? [];
    return streams
      .filter((s) => typeof s.index === 'number')
      .map((s) => {
        const lang = (s.tags?.language ?? 'und').trim().toLowerCase().slice(0, 3);
        return { index: s.index!, lang: lang || 'und' };
      });
  } catch {
    return [];
  }
}
