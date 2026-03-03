import type { CarouselItem } from '@/types/movie';

const MAX_ITEMS_PER_ROW = 10;
const MIN_ITEMS_PER_ROW = 4;
const MAX_GENRE_ROWS = 8;

export interface BuildCarouselsInput {
  items: CarouselItem[];
  getGenres: (id: string) => string[] | undefined;
  getProgress: (id: string) => { progress?: number; lastWatchedAt?: number } | undefined;
  isContinueWatching: (progress: number) => boolean;
  /** Hero = first, last, or second-last item in list. Home uses 'secondLast'; Films/Series use 'last' with excludeHeroId. */
  heroPosition?: 'first' | 'last' | 'secondLast';
  /** When set, hero is the latest/first that is not this id (so Films/Series can avoid repeating Home's hero). */
  excludeHeroId?: string;
}

export interface BuildCarouselsResult {
  heroItem: CarouselItem | null;
  carousels: { title: string; items: CarouselItem[] }[];
}

/**
 * Build hero + carousels: hero = latest addition (last in list).
 * First row = "Recently Added" (newest items excluding hero).
 * Then Continue Watching if any.
 * Then genre rows (titles = genre names, sorted by count), preferring not to repeat items across rows.
 */
export function buildCarousels(input: BuildCarouselsInput): BuildCarouselsResult {
  const { items, getGenres, getProgress, isContinueWatching, heroPosition = 'last', excludeHeroId } = input;
  if (items.length === 0) {
    return { heroItem: null, carousels: [] };
  }

  let heroItem: CarouselItem;
  if (heroPosition === 'secondLast') {
    heroItem = items.length >= 2 ? items[items.length - 2] : items[0];
  } else if (heroPosition === 'first') {
    heroItem = excludeHeroId ? (items.find((i) => i.id !== excludeHeroId) ?? items[0]) : items[0];
  } else {
    const fromEnd = [...items].reverse();
    heroItem = excludeHeroId ? (fromEnd.find((i) => i.id !== excludeHeroId) ?? items[items.length - 1]) : items[items.length - 1];
  }
  const heroId = heroItem.id;

  const continueWatching = items
    .filter((item) => {
      const p = getProgress(item.id)?.progress ?? 0;
      return isContinueWatching(p);
    })
    .sort((a, b) => (getProgress(b.id)?.lastWatchedAt ?? 0) - (getProgress(a.id)?.lastWatchedAt ?? 0))
    .slice(0, MAX_ITEMS_PER_ROW);

  const recentlyAdded = items
    .filter((i) => i.id !== heroId)
    .slice(-MAX_ITEMS_PER_ROW - 1)
    .reverse()
    .slice(0, MAX_ITEMS_PER_ROW);

  const genreToItems = new Map<string, CarouselItem[]>();
  for (const item of items) {
    const genres = getGenres(item.id) ?? [];
    for (const g of genres) {
      if (!genreToItems.has(g)) genreToItems.set(g, []);
      genreToItems.get(g)!.push(item);
    }
  }
  const sortedGenres = [...genreToItems.entries()]
    .filter(([, list]) => list.length >= 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_GENRE_ROWS);

  const usedIds = new Set<string>([heroId]);
  const genreRows: { title: string; items: CarouselItem[] }[] = [];

  for (const [genre, genreItems] of sortedGenres) {
    const notUsed = genreItems.filter((i) => !usedIds.has(i.id));
    const alreadyUsed = genreItems.filter((i) => usedIds.has(i.id));
    const row: CarouselItem[] = [];
    for (const item of notUsed) {
      if (row.length >= MAX_ITEMS_PER_ROW) break;
      row.push(item);
      usedIds.add(item.id);
    }
    if (row.length < MIN_ITEMS_PER_ROW && alreadyUsed.length > 0) {
      for (const item of alreadyUsed) {
        if (row.length >= MAX_ITEMS_PER_ROW) break;
        row.push(item);
      }
    }
    if (row.length > 0) genreRows.push({ title: genre, items: row });
  }

  const carousels: { title: string; items: CarouselItem[] }[] = [];
  if (recentlyAdded.length > 0) {
    carousels.push({ title: 'Recently Added', items: recentlyAdded });
  }
  if (continueWatching.length > 0) {
    carousels.push({ title: 'Continue Watching', items: continueWatching });
  }
  carousels.push(...genreRows);

  return { heroItem, carousels };
}
