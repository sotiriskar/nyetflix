import type { CarouselItem } from '@/types/movie';

/**
 * Pick up to `limit` items for "More Like This", preferring same genres as the current title.
 * If there aren't enough with matching genres, the rest are filled from the rest of the list.
 */
export function pickMoreLikeThis(
  currentId: string,
  currentGenres: string[] | undefined,
  candidates: CarouselItem[],
  getGenres: (id: string) => string[] | undefined,
  limit: number = 6
): CarouselItem[] {
  const filtered = candidates.filter((item) => item.id !== currentId);
  if (filtered.length === 0) return [];
  if (!currentGenres?.length) return filtered.slice(0, limit);

  const currentSet = new Set(currentGenres.map((g) => g.trim().toLowerCase()).filter(Boolean));
  const withScore = filtered.map((item) => {
    const genres = getGenres(item.id);
    const matchCount = genres
      ? genres.filter((g) => currentSet.has(g.trim().toLowerCase())).length
      : 0;
    return { item, matchCount };
  });
  withScore.sort((a, b) => b.matchCount - a.matchCount);
  return withScore.map(({ item }) => item).slice(0, limit);
}
