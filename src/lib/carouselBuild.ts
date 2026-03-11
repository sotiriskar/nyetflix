import type { CarouselItem } from '@/types/movie';

const MAX_ITEMS_PER_ROW = 12;
const MAX_GENRE_ROWS = 8;
/** Minimum genre category rows to show when we have enough genres (Home, Series, Films). */
const MIN_GENRE_ROWS = 5;
/** When we have at least this many genre categories, only show genres with at least MIN_ITEMS_FOR_GENRE_WHEN_MANY items. */
const MIN_GENRE_COUNT_FOR_THRESHOLD = 5;
const MIN_ITEMS_FOR_GENRE_WHEN_MANY = 7;
/** First N items in each genre row are unique across rows. */
const TOP_UNIQUE_PER_ROW = 7;

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
  const primaryGenreById = new Map<string, string>();
  for (const item of items) {
    const genres = getGenres(item.id) ?? [];
    for (let index = 0; index < genres.length; index++) {
      const g = genres[index];
      if (index === 0 && !primaryGenreById.has(item.id)) {
        primaryGenreById.set(item.id, g);
      }
      if (!genreToItems.has(g)) genreToItems.set(g, []);
      genreToItems.get(g)!.push(item);
    }
  }
  const allGenresSorted = [...genreToItems.entries()]
    .filter(([, list]) => list.length >= 1)
    .sort((a, b) => b[1].length - a[1].length);

  // Prefer categories with the most movies: if we have enough "big" genres (with at least
  // MIN_ITEMS_FOR_GENRE_WHEN_MANY items), only use those. Otherwise, fall back to using
  // all genres (still sorted by size) so we don't end up with too few rows.
  const bigGenres = allGenresSorted.filter(([, list]) => list.length >= MIN_ITEMS_FOR_GENRE_WHEN_MANY);
  // If we have enough big genres, consider all of them; otherwise consider all genres.
  const baseGenres = bigGenres.length >= MIN_GENRE_COUNT_FOR_THRESHOLD ? bigGenres : allGenresSorted;

  const genreRows: { title: string; items: CarouselItem[] }[] = [];

  // Track which items have been used in the *first 7 slots* across all genre rows (same on Home, Series, Films).
  const usedInTopSlots = new Set<string>([heroId]);

  function buildGenreRow(_genre: string, genreItems: CarouselItem[]): CarouselItem[] {
    const row: CarouselItem[] = [];
    for (const item of genreItems) {
      if (row.length >= TOP_UNIQUE_PER_ROW) break;
      if (usedInTopSlots.has(item.id)) continue;
      row.push(item);
      usedInTopSlots.add(item.id);
    }
    for (const item of genreItems) {
      if (row.length >= MAX_ITEMS_PER_ROW) break;
      if (row.some((r) => r.id === item.id)) continue;
      row.push(item);
    }
    return row;
  }

  const usedGenreNames = new Set<string>();
  for (const [genre, genreItems] of baseGenres) {
    if (genreRows.length >= MAX_GENRE_ROWS) break;
    const row = buildGenreRow(genre, genreItems);
    if (row.length > 0) {
      genreRows.push({ title: genre, items: row });
      usedGenreNames.add(genre);
    }
  }

  // Same as Home: ensure at least MIN_GENRE_ROWS category rows when we have more genres to show (Series/Films too).
  if (genreRows.length < MIN_GENRE_ROWS) {
    const remainingGenres = allGenresSorted.filter(([g]) => !usedGenreNames.has(g));
    for (const [genre, genreItems] of remainingGenres) {
      if (genreRows.length >= MIN_GENRE_ROWS || genreRows.length >= MAX_GENRE_ROWS) break;
      const row = buildGenreRow(genre, genreItems);
      if (row.length > 0) {
        genreRows.push({ title: genre, items: row });
      }
    }
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
