/**
 * Extract embedded subtitle streams from a video file to sidecar .vtt files.
 * Used during MKV→MP4 conversion so subtitles are preserved as external files.
 * After conversion we show only these files – never embedded streams.
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { getEmbeddedSubtitleStreams } from './ffprobeSubtitles';
import { getFfmpegPath } from './ffmpegPath';

/**
 * Extract embedded subtitle streams to sidecar .vtt files.
 * Returns { lang: absolutePath } for each successfully extracted stream.
 * Skips bitmap (PGS) streams; text-based (SRT, ASS, etc.) are extracted.
 */
export async function extractEmbeddedSubtitlesToSidecar(
  mkvPath: string,
  outputDir: string,
  baseName: string
): Promise<Record<string, string>> {
  const embedded = await getEmbeddedSubtitleStreams(mkvPath);
  if (embedded.length === 0) return {};

  const ffmpegBin = getFfmpegPath();
  const result: Record<string, string> = {};

  for (const { index, lang } of embedded) {
    const safeLang = (lang || 'und').toLowerCase().slice(0, 3);
    if (result[safeLang]) continue; // keep first per language
    const ext = `.${safeLang}.vtt`;
    const outPath = join(outputDir, baseName + ext);

    const ok = await extractOneStream(ffmpegBin, mkvPath, index, outPath);
    if (ok) {
      result[safeLang] = outPath;
    }
  }

  return result;
}

function extractOneStream(
  ffmpegBin: string,
  mkvPath: string,
  streamIndex: number,
  outPath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(
      ffmpegBin,
      [
        '-v', 'quiet', '-y',
        '-i', mkvPath,
        '-map', `0:${streamIndex}`,
        '-c:s', 'webvtt',
        outPath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const chunks: Buffer[] = [];
    proc.stdout?.on('data', (c: Buffer) => chunks.push(c));
    proc.stderr?.on('data', () => {});

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve(false);
    }, 60000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
    proc.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
