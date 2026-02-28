/**
 * TMDB (The Movie Database) for poster + backdrop images.
 * Get a free API key at https://www.themoviedb.org/settings/api
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const BACKDROP_SIZE = 'w1280';
const POSTER_SIZE = 'w500';

export interface TmdbMultiResult {
  id?: number;
  backdrop_path?: string | null;
  poster_path?: string | null;
  title?: string;
  name?: string;
  media_type?: string;
}

export interface TmdbImagesResponse {
  logos?: Array<{ file_path?: string }>;
}

export interface TmdbSearchMultiResponse {
  results?: TmdbMultiResult[];
}

function buildImageUrl(path: string | null | undefined, size: string): string | null {
  if (!path || typeof path !== 'string') return null;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE}/${size}${p}`;
}

export interface TmdbCreditsResponse {
  cast?: Array<{ name?: string }>;
}

export interface TmdbDetailsResponse {
  genres?: Array<{ name?: string }>;
}

export interface TmdbImages {
  posterUrl: string | null;
  backdropUrl: string | null;
  titleLogoUrl: string | null;
  cast: string | null;
  genres: string | null;
  /** YouTube video ID for a trailer/teaser (for hover card preview). */
  trailerYouTubeId: string | null;
}

/** Fetch credits (cast) and details (genres) for a movie or TV show. */
async function fetchCreditsAndGenres(
  apiKey: string,
  tmdbId: number,
  mediaType: string
): Promise<{ cast: string | null; genres: string | null }> {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const [creditsRes, detailsRes] = await Promise.all([
    fetch(`${TMDB_BASE}/${type}/${tmdbId}/credits?api_key=${encodeURIComponent(apiKey)}`),
    fetch(`${TMDB_BASE}/${type}/${tmdbId}?api_key=${encodeURIComponent(apiKey)}`),
  ]);
  let cast: string | null = null;
  let genres: string | null = null;
  if (creditsRes.ok) {
    const data = (await creditsRes.json()) as TmdbCreditsResponse;
    const names = data.cast?.slice(0, 6).map((c) => c.name).filter(Boolean) ?? [];
    if (names.length) cast = names.join(', ');
  }
  if (detailsRes.ok) {
    const data = (await detailsRes.json()) as TmdbDetailsResponse;
    const names = data.genres?.slice(0, 5).map((g) => g.name).filter(Boolean) ?? [];
    if (names.length) genres = names.join(', ');
  }
  return { cast, genres };
}

/** Fetch logo (title treatment) for a movie or TV show. */
async function fetchTitleLogo(
  apiKey: string,
  tmdbId: number,
  mediaType: string
): Promise<string | null> {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const url = `${TMDB_BASE}/${type}/${tmdbId}/images?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as TmdbImagesResponse;
  const first = data.logos?.[0];
  const path = first?.file_path;
  if (!path) return null;
  return buildImageUrl(path, 'w500');
}

export interface TmdbVideoResult {
  key?: string;
  site?: string;
  type?: string;
  name?: string;
  size?: number;
}

export interface TmdbVideosResponse {
  results?: TmdbVideoResult[];
}

/** Words in video name that suggest mobile/vertical – skip these so we only use wide videos. */
const VERTICAL_INDICATORS = /mobile|vertical|portrait|phone|instagram|tiktok|story|reel|shorts|9:16|1:1|square/i;

/** Exported for unit tests. */
export function isWideFriendly(v: TmdbVideoResult): boolean {
  const name = (v.name ?? '').trim();
  if (VERTICAL_INDICATORS.test(name)) return false;
  return true;
}

/** Type preference: Trailer > Teaser > Clip (trailers are usually the main wide promo). */
const TYPE_ORDER: Record<string, number> = { Trailer: 3, Teaser: 2, Clip: 1 };

/** Prefer wide videos: higher TMDB size (720/1080), then type (Trailer > Teaser > Clip), then name hints like "official"/"theatrical". Exported for unit tests. */
export function trailerScore(v: TmdbVideoResult): number {
  const size = v.size ?? 0;
  const name = (v.name ?? '').toLowerCase();
  let score = 0;
  // Size is the strongest signal for landscape (TMDB typically gives 720/1080 for wide).
  if (size >= 1080) score += 100;
  else if (size >= 720) score += 80;
  else if (size >= 480) score += 40;
  else if (size > 0) score += 10;
  // Prefer Trailer > Teaser > Clip when size is missing or equal.
  score += TYPE_ORDER[v.type ?? ''] ?? 0;
  // Slight bonus for names that usually indicate main/wide promo.
  if (/official|theatrical|main\s*trailer|trailer\s*1\b/i.test(name)) score += 5;
  return score;
}

/** Fetch best YouTube key for hover preview: prefers wide (excludes mobile/vertical by name, prefers higher size). Uses Trailer, Teaser, or Clip. */
async function fetchTrailerKey(
  apiKey: string,
  tmdbId: number,
  mediaType: string
): Promise<string | null> {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const url = `${TMDB_BASE}/${type}/${tmdbId}/videos?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as TmdbVideosResponse;
  const results = data.results ?? [];
  const candidates = results.filter(
    (v) =>
      (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip') &&
      v.site === 'YouTube' &&
      typeof v.key === 'string' &&
      v.key.length > 0 &&
      isWideFriendly(v)
  );
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => (trailerScore(b) > trailerScore(a) ? b : a));
  return best.key ?? null;
}

/** Search TMDB by title and return poster, backdrop, title logo, cast, genres, and trailer YouTube id from the first result. */
export async function getImagesForTitle(title: string): Promise<TmdbImages> {
  const out: TmdbImages = { posterUrl: null, backdropUrl: null, titleLogoUrl: null, cast: null, genres: null, trailerYouTubeId: null };
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey?.trim()) return out;

  const query = title.trim();
  if (!query) return out;

  const url = `${TMDB_BASE}/search/multi?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return out;

  const data = (await res.json()) as TmdbSearchMultiResponse;
  const results = data.results ?? [];
  const first = results.find((r) => r.poster_path || r.backdrop_path) ?? results[0];
  if (!first) return out;

  out.posterUrl = buildImageUrl(first.poster_path, POSTER_SIZE);
  out.backdropUrl = buildImageUrl(first.backdrop_path, BACKDROP_SIZE);
  if (first.id != null && first.media_type) {
    try {
      const [logo, creditsAndGenres, trailerKey] = await Promise.all([
        fetchTitleLogo(apiKey, first.id, first.media_type),
        fetchCreditsAndGenres(apiKey, first.id, first.media_type),
        fetchTrailerKey(apiKey, first.id, first.media_type),
      ]);
      out.titleLogoUrl = logo;
      out.cast = creditsAndGenres.cast;
      out.genres = creditsAndGenres.genres;
      out.trailerYouTubeId = trailerKey;
    } catch {
      // ignore
    }
  }
  return out;
}

// --- TV show seasons & episodes (for series detail) ---

const STILL_SIZE = 'w300';

export interface TmdbTvSeasonEpisode {
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number | null;
}

export interface TmdbTvSeasonResponse {
  episodes?: TmdbTvSeasonEpisode[];
}

export interface TmdbTvShowResult {
  id?: number;
  name?: string;
}

export interface TmdbTvSearchResponse {
  results?: TmdbTvShowResult[];
}

export interface TmdbTvDetailsResponse {
  number_of_seasons?: number;
  seasons?: Array<{ season_number: number }>;
}

/** Search TMDB for a TV show by title; returns first result id and name. */
export async function getTvShowIdByTitle(title: string): Promise<{ id: number; name: string } | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey?.trim()) return null;
  const query = title.trim();
  if (!query) return null;
  const url = `${TMDB_BASE}/search/tv?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as TmdbTvSearchResponse;
  const first = data.results?.[0];
  if (!first?.id) return null;
  return { id: first.id, name: first.name ?? title };
}

/** Get season numbers for a TV show (1..N). */
export async function getTvShowSeasonNumbers(tmdbTvId: number): Promise<number[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey?.trim()) return [];
  const url = `${TMDB_BASE}/tv/${tmdbTvId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as TmdbTvDetailsResponse;
  const n = data.number_of_seasons ?? 0;
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** Get episodes for one season with name, overview, still_path, runtime. */
export async function getTvSeasonEpisodes(
  tmdbTvId: number,
  seasonNumber: number
): Promise<TmdbTvSeasonEpisode[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey?.trim()) return [];
  const url = `${TMDB_BASE}/tv/${tmdbTvId}/season/${seasonNumber}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as TmdbTvSeasonResponse;
  const list = data.episodes ?? [];
  return list.filter((e) => e.episode_number != null);
}

export function buildStillUrl(stillPath: string | null | undefined): string | null {
  return buildImageUrl(stillPath, STILL_SIZE);
}
