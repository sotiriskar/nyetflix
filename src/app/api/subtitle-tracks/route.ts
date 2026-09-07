import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { dirname, basename, join } from 'path';
import { registry, ensureHydrated, persistRegistry } from '@/lib/streamRegistry';
import { extractEmbeddedSubtitlesToSidecar } from '@/lib/extractEmbeddedSubtitles';
import { findSidecarSubtitles } from '@/lib/sidecarSubtitles';
import { labelForSubtitleKey, parseSubtitleKey } from '@/lib/subtitleTrackKeys';
import { isHlsMarkerPath } from '@/lib/hlsPackage';
import { getConvertedPath } from '@/lib/convertedMkvStore';

export interface SubtitleTrackResponse {
  tracks: Array<{ key: string; lang: string; label: string; src: string }>;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** On-demand extraction blocks the response, so keep it far shorter than a conversion's budget. */
const ON_DEMAND_EXTRACT_TIMEOUT_MS = 90_000;

function isEpisodeId(id: string): boolean {
  return /^episode-.+-S\d+-E\d+$/.test(id);
}

function storeTracks(id: string, tracks: Record<string, string>): void {
  if (isEpisodeId(id)) registry.episodeIdToSubtitlePath.set(id, tracks);
  else registry.itemIdToSubtitlePath.set(id, tracks);
  persistRegistry();
}

/** Keep only sidecar paths that still exist on disk. */
function existingOnly(tracks: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, path] of Object.entries(tracks)) {
    if (path && existsSync(path)) out[key] = path;
  }
  return out;
}

/**
 * Path to scan for sidecar .vtt files / embedded streams.
 * Prefers a still-present video file; if the registry points at a deleted HLS marker,
 * fall back to a sibling .mkv with the same base name (common after a re-copy).
 */
function resolveMediaPath(id: string): string | null {
  const registered = registry.itemIdToPath.get(id) ?? registry.episodeIdToPath.get(id);
  const converted = getConvertedPath(id);
  for (const candidate of [registered, converted]) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  if (registered && isHlsMarkerPath(registered)) {
    const mkv = join(dirname(registered), basename(registered).replace(/\.m3u8$/i, '.mkv'));
    if (existsSync(mkv)) return mkv;
  }
  return registered ?? converted ?? null;
}

/** Full dialogue tracks first, then Forced / SDH / numbered alts. */
function trackSortKey(key: string): string {
  const { lang, variant } = parseSubtitleKey(key);
  if (!variant) return `0-${lang}`;
  if (variant === 'forced') return `2-${lang}-forced`;
  if (variant === 'sdh') return `1-${lang}-sdh`;
  return `1-${lang}-${variant}`;
}

/**
 * GET ?id=… — subtitle tracks for an item, as sidecar files.
 *
 * Files on disk are the source of truth: a library rescan rebuilds the registry from
 * filename patterns alone and would otherwise drop the extra tracks (forced, SDH, a second
 * language) written during conversion. Embedded streams are extracted on demand for files
 * that were never converted, and never shown as embedded streams.
 */
export async function GET(request: NextRequest) {
  let id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is
  }

  ensureHydrated();
  const registered = registry.itemIdToSubtitlePath.get(id) ?? registry.episodeIdToSubtitlePath.get(id);
  const mediaPath = resolveMediaPath(id);

  let byKey: Record<string, string> = existingOnly(
    typeof registered === 'object' && registered ? { ...registered } : {},
  );
  if (mediaPath) {
    const onDisk = existingOnly(await findSidecarSubtitles(mediaPath));
    if (Object.keys(onDisk).length > 0) {
      byKey = { ...byKey, ...onDisk };
      storeTracks(id, byKey);
    }
  }

  // Nothing beside the file: this one was never converted, so read its embedded streams now.
  if (Object.keys(byKey).length === 0 && mediaPath && /\.(mkv|mp4|m4v|mov|webm)$/i.test(mediaPath)) {
    try {
      const dir = dirname(mediaPath);
      const base = basename(mediaPath).replace(/\.[^/.]+$/i, '');
      const extracted = await extractEmbeddedSubtitlesToSidecar(mediaPath, dir, base, {
        timeoutMs: ON_DEMAND_EXTRACT_TIMEOUT_MS,
      });
      if (Object.keys(extracted).length > 0) {
        byKey = existingOnly({ ...byKey, ...extracted });
        storeTracks(id, byKey);
      }
    } catch {
      // ignore extraction errors
    }
  } else if (Object.keys(byKey).length > 0) {
    // Drop stale registry entries that point at deleted files.
    storeTracks(id, byKey);
  }

  const tracks = Object.keys(byKey)
    .sort((a, b) => trackSortKey(a).localeCompare(trackSortKey(b)))
    .map((key) => ({
      key,
      lang: parseSubtitleKey(key).lang,
      label: labelForSubtitleKey(key),
      src: `/api/subtitles?id=${encodeURIComponent(id)}&lang=${encodeURIComponent(key)}`,
    }));

  return NextResponse.json({ tracks } satisfies SubtitleTrackResponse);
}
