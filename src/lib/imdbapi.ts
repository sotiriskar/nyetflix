const BASE = 'https://api.imdbapi.dev';

export interface ImdbImage {
  url?: string;
  width?: number;
  height?: number;
  type?: string;
}

export interface ImdbTitle {
  id?: string;
  type?: string;
  primaryTitle?: string;
  originalTitle?: string;
  primaryImage?: ImdbImage;
  startYear?: number;
  endYear?: number;
  runtimeSeconds?: number;
  genres?: string[];
  plot?: string;
  stars?: Array<{ primaryName?: string }>;
  rating?: { aggregateRating?: number; voteCount?: number };
}

export interface ImdbSearchResponse {
  titles?: ImdbTitle[];
}

export async function searchTitles(query: string, limit = 5): Promise<ImdbTitle[]> {
  const url = new URL(`${BASE}/search/titles`);
  url.searchParams.set('query', query.trim());
  url.searchParams.set('limit', String(Math.min(limit, 50)));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`imdbapi search failed: ${res.status}`);
  const data = (await res.json()) as ImdbSearchResponse;
  return data.titles ?? [];
}

export async function getTitle(titleId: string): Promise<ImdbTitle | null> {
  const url = `${BASE}/titles/${encodeURIComponent(titleId)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as ImdbTitle;
}

export interface ListTitleImagesResponse {
  images?: ImdbImage[];
}

const PREFERRED_WIDTH = 1280;
const PREFERRED_HEIGHT = 720;
/** Only accept clearly landscape (e.g. 16:9 ≈ 1.78). Rejects portrait and near-square. */
const MIN_ASPECT_RATIO = 1.3;

function is1280x720(img: ImdbImage): boolean {
  return !!(img.url && img.width === PREFERRED_WIDTH && img.height === PREFERRED_HEIGHT);
}

function isLandscape(img: ImdbImage): boolean {
  if (!img.url || img.width == null || img.height == null || img.height <= 0) return false;
  const ratio = img.width / img.height;
  return ratio >= MIN_ASPECT_RATIO;
}

/** Use the poster endpoint so we only get poster images; prefer 1280×720, then other landscape. */
const IMAGES_POSTER_ENDPOINT = 'images?pageSize=50&types=poster';

/** Fetch wide poster URL. Prefers 1280×720, then any image with landscape aspect (width/height ≥ 1.3). Never returns portrait. */
export async function getTitleBackdropUrl(titleId: string): Promise<string | null> {
  const url = `${BASE}/titles/${encodeURIComponent(titleId)}/${IMAGES_POSTER_ENDPOINT}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as ListTitleImagesResponse;
  const images = data.images ?? [];
  const exact = images.find(is1280x720);
  if (exact?.url) return exact.url;
  const landscape = images.filter(isLandscape);
  const best = landscape.length > 0
    ? landscape.reduce((a, b) => ((a.width ?? 0) >= (b.width ?? 0) ? a : b))
    : null;
  return best?.url ?? null;
}

export function toRuntime(runtimeSeconds?: number): string | undefined {
  if (runtimeSeconds == null) return undefined;
  const m = Math.round(runtimeSeconds / 60);
  return `${m}m`;
}

/** IMDb type to our mediaType: series vs movie */
function toMediaType(imdbType?: string): 'movie' | 'series' {
  const v = (imdbType ?? '').toLowerCase();
  if (v === 'tvseries' || v === 'tvminiseries' || v === 'tvepisode') return 'series';
  return 'movie';
}

export function titleToMovieDetail(
  t: ImdbTitle,
  localId: string,
  localTitle: string
): {
  id: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  description?: string;
  year?: string;
  contentRating?: string;
  cast?: string;
  genres?: string;
  duration?: string;
  progress?: number;
  mediaType?: 'movie' | 'series';
} {
  const title = t.primaryTitle ?? t.originalTitle ?? localTitle;
  const year = t.startYear != null ? String(t.startYear) : undefined;
  const cast = t.stars?.slice(0, 4).map((s) => s.primaryName).filter(Boolean).join(', ');
  const genres = t.genres?.slice(0, 5).join(', ');
  return {
    id: localId,
    title,
    posterUrl: t.primaryImage?.url,
    backdropUrl: undefined,
    description: t.plot,
    year,
    contentRating: undefined,
    cast: cast || undefined,
    genres: genres || undefined,
    duration: toRuntime(t.runtimeSeconds),
    progress: 0,
    mediaType: toMediaType(t.type),
  };
}
