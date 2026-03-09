import { spawn } from 'child_process';
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
