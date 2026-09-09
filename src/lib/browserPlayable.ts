import { statSync } from 'fs';
import { probeMediaStreams, needsBrowserConversion, type ProbedStreams } from './ffprobeStreams';

type CacheEntry = { mtimeMs: number; size: number; needs: boolean; probedAt: number };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Whether this file needs convert-before-play (HEVC, AC3/DTS, multi-audio, …).
 * Moov-at-end MP4s are NOT converted — stream-video supports suffix byte ranges so
 * browsers can fetch the index from EOF without rewriting a multi‑GB file.
 * Cached briefly by path + mtime so opening a title doesn't re-ffprobe every time.
 */
export async function fileNeedsBrowserConversion(filePath: string): Promise<boolean> {
  try {
    const st = statSync(filePath);
    const hit = cache.get(filePath);
    if (
      hit &&
      hit.mtimeMs === st.mtimeMs &&
      hit.size === st.size &&
      Date.now() - hit.probedAt < CACHE_TTL_MS
    ) {
      return hit.needs;
    }
    const probed: ProbedStreams = await probeMediaStreams(filePath);
    const needs = needsBrowserConversion(probed);
    cache.set(filePath, {
      mtimeMs: st.mtimeMs,
      size: st.size,
      needs,
      probedAt: Date.now(),
    });
    return needs;
  } catch {
    return false;
  }
}
