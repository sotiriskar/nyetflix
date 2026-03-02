import { spawn } from 'child_process';
import { getFfmpegPath } from './ffmpegPath';

/** Parse "Duration: 01:23:45.67" from ffmpeg/ffprobe stderr into seconds. */
export function parseDuration(stderr: string): number | null {
  const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!m) return null;
  const [, h, min, sec, cent] = m;
  return parseInt(h!, 10) * 3600 + parseInt(min!, 10) * 60 + parseInt(sec!, 10) + parseInt(cent!, 10) / 100;
}

/** Get duration in seconds via ffprobe. Returns null on error. */
export async function getDurationSeconds(filePath: string): Promise<number | null> {
  const ffmpegBin = getFfmpegPath();
  const ffprobeBin = ffmpegBin.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const proc = spawn(ffprobeBin, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      const chunks: string[] = [];
      proc.stdout?.setEncoding('utf-8');
      proc.stdout?.on('data', (chunk: string) => chunks.push(chunk));
      proc.on('close', () => resolve(chunks.join('')));
      proc.on('error', reject);
      setTimeout(() => {
        proc.kill('SIGKILL');
        resolve(chunks.join(''));
      }, 15000);
    });
    const d = parseFloat(stdout.trim());
    if (Number.isFinite(d) && d > 0) return d;
  } catch {
    // ignore, try fallback
  }
  try {
    const stderr = await new Promise<string>((resolve, reject) => {
      const proc = spawn(ffmpegBin, ['-i', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
      const chunks: string[] = [];
      proc.stderr?.setEncoding('utf-8');
      proc.stderr?.on('data', (chunk: string) => chunks.push(chunk));
      proc.on('close', () => resolve(chunks.join('')));
      proc.on('error', reject);
      setTimeout(() => {
        proc.kill('SIGKILL');
        resolve(chunks.join(''));
      }, 15000);
    });
    return parseDuration(stderr);
  } catch {
    return null;
  }
}
