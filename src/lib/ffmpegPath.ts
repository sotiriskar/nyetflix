import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

let cachedFfmpegPath: string | null = null;

/** Resolve ffmpeg executable (env, then where/which, then search PATH). Cached after first success. */
export function getFfmpegPath(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;
  if (cachedFfmpegPath) return cachedFfmpegPath;

  if (process.platform === 'win32') {
    try {
      const out = execSync('where ffmpeg', {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      });
      const first = out.split(/[\r\n]+/)[0]?.trim();
      if (first && (first.endsWith('.exe') || existsSync(first))) {
        cachedFfmpegPath = first;
        return first;
      }
    } catch {
      // ignore
    }
    const pathEnv = process.env.PATH ?? '';
    for (const dir of pathEnv.split(';')) {
      const trimmed = dir.trim();
      if (!trimmed) continue;
      const exe = join(trimmed, 'ffmpeg.exe');
      if (existsSync(exe)) {
        cachedFfmpegPath = exe;
        return exe;
      }
    }
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const candidates = [
        join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.0.1-full_build', 'bin', 'ffmpeg.exe'),
        join(localAppData, 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
      ];
      for (const exe of candidates) {
        if (existsSync(exe)) {
          cachedFfmpegPath = exe;
          return exe;
        }
      }
    }
  } else {
    try {
      const out = execSync('which ffmpeg', { encoding: 'utf-8', timeout: 3000 });
      const first = out.split(/[\r\n]+/)[0]?.trim();
      if (first) {
        cachedFfmpegPath = first;
        return first;
      }
    } catch {
      // ignore
    }
  }
  return 'ffmpeg';
}
