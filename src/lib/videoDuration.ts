import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { registry, ensureHydrated } from '@/lib/streamRegistry';
import { getConvertedPath } from '@/lib/convertedMkvStore';
import { getFfmpegPath } from '@/lib/ffmpegPath';

/** Parse "Duration: 01:23:45.67" from ffmpeg stderr into seconds. */
function parseDuration(stderr: string): number | null {
  const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!m) return null;
  const [, h, min, sec, cent] = m;
  return parseInt(h!, 10) * 3600 + parseInt(min!, 10) * 60 + parseInt(sec!, 10) + parseInt(cent!, 10) / 100;
}

/**
 * Get duration in seconds for a video file by running ffmpeg -i. Returns null if ffmpeg fails or duration cannot be parsed.
 */
export async function getDurationSecondsFromFile(filePath: string, timeoutMs = 12000): Promise<number | null> {
  const ffmpegBin = getFfmpegPath();
  let stderr: string;
  try {
    stderr = await new Promise<string>((resolve, reject) => {
      const proc = spawn(ffmpegBin, ['-i', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
      const chunks: string[] = [];
      proc.stderr?.setEncoding('utf-8');
      proc.stderr?.on('data', (chunk: string) => chunks.push(chunk));
      const done = (s: string) => {
        clearTimeout(t);
        resolve(s);
      };
      const t = setTimeout(() => {
        proc.kill('SIGKILL');
        done(chunks.join(''));
      }, timeoutMs);
      proc.on('close', () => done(chunks.join('')));
      proc.on('error', reject);
    });
  } catch {
    return null;
  }
  const sec = parseDuration(stderr);
  return sec != null && sec > 0 ? sec : null;
}

/**
 * Get duration in seconds for a library item by id. Resolves file path from registry (or converted MKV) then reads duration.
 * Returns null if the item is unknown or duration cannot be read.
 */
export async function getDurationSecondsForItem(id: string): Promise<number | null> {
  ensureHydrated();
  let filePath = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id) ?? null;
  if (!filePath) {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) filePath = converted;
  }
  if (!filePath) return null;
  const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : '';
  if (ext === '.mkv') {
    const converted = getConvertedPath(id);
    if (converted && existsSync(converted)) filePath = converted;
  }
  return getDurationSecondsFromFile(filePath);
}
