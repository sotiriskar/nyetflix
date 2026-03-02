import { NextRequest, NextResponse } from 'next/server';
import { registry, ensureHydrated } from '@/lib/streamRegistry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** episode-{seriesId}-S{s}-E{e} */
const EPISODE_ID_REGEX = /^episode-(.+)-S(\d+)-E(\d+)$/;

/**
 * GET ?id=episode-xxx-S1-E2
 * Returns the next episode in the series (same season then next season), or null.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const m = id.match(EPISODE_ID_REGEX);
  if (!m) {
    return NextResponse.json({ nextId: null, nextTitle: 'Next episode' });
  }

  ensureHydrated();
  const [, seriesId, currentS, currentE] = m;
  const currentSeason = parseInt(currentS!, 10);
  const currentEpisode = parseInt(currentE!, 10);

  const prefix = `episode-${seriesId}-`;
  const episodeIds: string[] = [];
  for (const key of registry.episodeIdToPath.keys()) {
    if (key.startsWith(prefix)) episodeIds.push(key);
  }

  const parsed = episodeIds
    .map((epId) => {
      const match = epId.match(EPISODE_ID_REGEX);
      return match ? { epId, s: parseInt(match[2], 10), e: parseInt(match[3], 10) } : null;
    })
    .filter((x): x is { epId: string; s: number; e: number } => x != null);

  parsed.sort((a, b) => (a.s !== b.s ? a.s - b.s : a.e - b.e));

  const currentIndex = parsed.findIndex(
    (p) => p.s === currentSeason && p.e === currentEpisode
  );
  const next = currentIndex >= 0 && currentIndex < parsed.length - 1 ? parsed[currentIndex + 1] : null;

  if (!next) {
    return NextResponse.json({ nextId: null, nextTitle: 'Next episode' });
  }

  const subtitleLanguages = registry.episodeIdToSubtitlePath.get(next.epId);
  const nextTitle = `S${next.s} E${next.e}`;

  return NextResponse.json({
    nextId: next.epId,
    nextTitle,
    subtitleLanguages: subtitleLanguages ? Object.keys(subtitleLanguages).sort() : undefined,
  });
}
