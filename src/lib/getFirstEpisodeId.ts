/**
 * Resolve the first episode id for a series (S1E1) so we can open the watch page
 * with an episode id and show the episode list. Use when user clicks Play on a series
 * and we don't have a resume episode yet.
 */
export async function getFirstEpisodeId(
  seriesId: string,
  seriesTitle?: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const origin = window.location.origin;
  const titleParam = seriesTitle?.trim()
    ? `&title=${encodeURIComponent(seriesTitle.trim())}`
    : '';
  const res = await fetch(
    `${origin}/api/series-episodes?id=${encodeURIComponent(seriesId)}${titleParam}`,
    { credentials: 'same-origin' }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    seasons?: Array<{ number: number; episodes?: Array<{ id?: string }> }>;
  };
  const seasons = data?.seasons;
  if (!Array.isArray(seasons) || seasons.length === 0) return null;
  const firstSeason = seasons[0];
  const episodes = firstSeason?.episodes;
  if (!Array.isArray(episodes) || episodes.length === 0) return null;
  const firstEp = episodes[0];
  return firstEp?.id ?? null;
}
