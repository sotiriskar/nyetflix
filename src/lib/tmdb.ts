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
  release_date?: string;
  first_air_date?: string;
}

export interface TmdbImagesResponse {
  logos?: Array<{ file_path?: string; iso_639_1?: string | null }>;
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
  /** English title/name from TMDB (for carousel display when we want English). */
  englishTitle: string | null;
  /** For TV: number of seasons (for hover card "X Seasons"). */
  seasonsCount?: number;
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

/** Fetch logo (title treatment) for a movie or TV show. Prefers English logo when available. */
async function fetchTitleLogo(
  apiKey: string,
  tmdbId: number,
  mediaType: string
): Promise<string | null> {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const url = `${TMDB_BASE}/${type}/${tmdbId}/images?api_key=${encodeURIComponent(apiKey)}&language=en-US&include_image_language=en,null`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as TmdbImagesResponse;
  const logos = data.logos ?? [];
  const enLogo = logos.find((l) => l.iso_639_1 === 'en');
  const first = enLogo ?? logos[0];
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
  /** ISO 639-1 language code (e.g. en, de). Prefer en for trailers. */
  iso_639_1?: string;
}

export interface TmdbVideosResponse {
  results?: TmdbVideoResult[];
}

/** Words in video name that suggest mobile/vertical – skip these so we only use wide videos. */
const VERTICAL_INDICATORS = /mobile|vertical|portrait|phone|instagram|tiktok|story|reel|shorts|9:16|1:1|square/i;

function isWideFriendly(v: TmdbVideoResult): boolean {
  const name = (v.name ?? '').trim();
  if (VERTICAL_INDICATORS.test(name)) return false;
  return true;
}

/** Type preference: Trailer > Teaser > Clip (trailers are usually the main wide promo). */
const TYPE_ORDER: Record<string, number> = { Trailer: 3, Teaser: 2, Clip: 1 };

/** Known non-English language codes we want to rank below English/unspecified. */
const NON_ENGLISH_LANG = /^(ko|kr|ja|jp|zh|cn|es|de|fr|pt|ru|ar|hi|th|vi|it|pl|tr)$/i;

/** Prefer English (by iso_639_1 or name), then unspecified; penalize known other languages. */
function trailerScore(v: TmdbVideoResult): number {
  const size = v.size ?? 0;
  const name = (v.name ?? '').toLowerCase();
  const lang = (v.iso_639_1 ?? '').toLowerCase();
  let score = 0;
  // Language: prefer English (code or "english" in name), then unspecified; penalize other languages.
  if (lang === 'en' || lang === 'en-us') score += 300;
  else if (lang === '') score += 120;
  else if (NON_ENGLISH_LANG.test(lang)) score -= 150;
  else score += 20;
  if (/english|en\s*trailer|official\s*trailer|theatrical\s*trailer/i.test(name)) score += 80;
  if (/korean|korea\s*sub|spanish|japanese|japan\s*sub|chinese|dubbed|subbed\s*in\s*(?!english)/i.test(name)) score -= 100;
  // Size for landscape (720/1080).
  if (size >= 1080) score += 100;
  else if (size >= 720) score += 80;
  else if (size >= 480) score += 40;
  else if (size > 0) score += 10;
  score += TYPE_ORDER[v.type ?? ''] ?? 0;
  if (/official|theatrical|main\s*trailer|trailer\s*1\b/i.test(name)) score += 5;
  return score;
}

/** Fetch best YouTube key for hover preview: get all videos then pick English (or best) by scoring. */
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

const YEAR_IN_QUERY = /\(\s*(\d{4})\s*\)|\.(\d{4})\.|\s(\d{4})\s*$/;

/** Extract 4-digit year from query (e.g. "Zootopia (2016)" -> 2016). */
function yearFromQuery(query: string): number | null {
  const m = query.trim().match(YEAR_IN_QUERY);
  if (!m) return null;
  const y = parseInt(m[1] ?? m[2] ?? m[3] ?? '', 10);
  return y >= 1900 && y <= 2100 ? y : null;
}

/** Check if title suggests a sequel (2, II, two, sequel, part 2) using word checks to avoid ReDoS. */
function titleSuggestsSequel(title: string): boolean {
  const words = title.split(/\s+/).filter(Boolean);
  const sequelWords = new Set(['2', 'ii', 'two', 'sequel']);
  for (const w of words) {
    const norm = w.toLowerCase().replace(/\s/g, '');
    if (sequelWords.has(norm) || norm === 'part2') return true;
    if (norm.startsWith('part') && norm.slice(4).replace(/\s/g, '') === '2') return true;
  }
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i]!.toLowerCase() === 'part' && (words[i + 1] ?? '').trim() === '2') return true;
  }
  return false;
}

/** Match sequel/part number from end of search query (e.g. "Zootopia 2" -> 2, "Zootopia II" -> 2). String-only checks to avoid ReDoS. */
function partNumberFromQuery(query: string): number | null {
  const lower = query.trim().toLowerCase();
  const suffix = lower.slice(-20);

  const beforeLast = (c: string) => suffix.slice(0, -c.length).trimEnd();
  const endsWithPartN = (n: string) =>
    suffix.endsWith(` ${n}`) || (suffix.endsWith(n) && beforeLast(n).endsWith(' part'));

  if (
    suffix.endsWith(' 2') ||
    suffix.endsWith(' 3') ||
    suffix.endsWith(' 4') ||
    suffix.endsWith(' 5') ||
    suffix.endsWith(' ii') ||
    suffix.endsWith(' iii') ||
    suffix.endsWith(' iv') ||
    suffix.endsWith(' v') ||
    endsWithPartN('2') ||
    endsWithPartN('3')
  )
    return 2;
  if (
    suffix.endsWith(' 1') ||
    suffix.endsWith(' i') ||
    suffix.endsWith(' one') ||
    endsWithPartN('1')
  )
    return 1;
  return null;
}

/** Year from TMDB result (release_date or first_air_date, e.g. "2016-03-04" -> 2016). */
function yearFromResult(r: TmdbMultiResult): number | null {
  const raw = r.release_date ?? r.first_air_date ?? '';
  if (!raw || typeof raw !== 'string') return null;
  const y = parseInt(raw.slice(0, 4), 10);
  return y >= 1900 && y <= 2100 ? y : null;
}

/** Score how well a TMDB result matches the search query (higher = better). */
function scoreResultMatch(
  query: string,
  resultTitle: string,
  resultYear: number | null,
  queryYear: number | null
): number {
  const q = query.trim().toLowerCase();
  const t = (resultTitle || '').trim().toLowerCase();
  let score = 0;
  if (!t) return 0;
  if (q === t) score = 100;
  else {
    const part = partNumberFromQuery(query);
    const has2 = titleSuggestsSequel(t);
    if (part === 2 && has2) score = 80;
    else if (part === 2 && !has2) score = 30;
    else if (part === 1 && !has2) score = 80;
    else if (part === 1 && has2) score = 10;
    else {
      const qWords = q.replace(YEAR_IN_QUERY, ' ').split(/\s+/).filter(Boolean);
      const allIn = qWords.length > 0 && qWords.every((w) => /^\d{4}$/.test(w) || t.includes(w));
      if (!allIn) return 0;
      if (part == null && !has2) score = 55;
      else if (part == null && has2) score = 45;
      else score = 50;
    }
  }
  if (queryYear != null && resultYear != null && queryYear === resultYear) score += 25;
  else if (queryYear != null && resultYear != null && Math.abs((queryYear ?? 0) - (resultYear ?? 0)) > 2) score -= 40;
  return score;
}

/** Search TMDB by title and return poster, backdrop, title logo, cast, genres, trailer YouTube id, English title, and (for TV) seasons count. Pass raw folder/video name (e.g. "Zootopia (2016)" or "Zootopia 2 (2025)") so year and part number are used to pick the right result. */
export async function getImagesForTitle(title: string): Promise<TmdbImages> {
  const out: TmdbImages = { posterUrl: null, backdropUrl: null, titleLogoUrl: null, cast: null, genres: null, trailerYouTubeId: null, englishTitle: null };
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey?.trim()) return out;

  const query = title.trim();
  if (!query) return out;

  const queryYear = yearFromQuery(query);
  const url = `${TMDB_BASE}/search/multi?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&language=en-US`;
  const res = await fetch(url);
  if (!res.ok) return out;

  const data = (await res.json()) as TmdbSearchMultiResponse;
  const results = data.results ?? [];
  const withImage = results.filter((r) => r.poster_path || r.backdrop_path);
  const candidates = withImage.length > 0 ? withImage : results;
  const first =
    candidates.length > 0
      ? candidates.reduce((best, r) => {
          const rTitle = r.title ?? r.name ?? '';
          const bestTitle = best.title ?? best.name ?? '';
          const scoreR = scoreResultMatch(query, rTitle, yearFromResult(r), queryYear);
          const scoreBest = scoreResultMatch(query, bestTitle, yearFromResult(best), queryYear);
          return scoreR > scoreBest ? r : best;
        }, candidates[0]!)
      : results[0];
  if (!first) return out;

  out.englishTitle = (first.title ?? first.name ?? null) || null;
  out.posterUrl = buildImageUrl(first.poster_path, POSTER_SIZE);
  out.backdropUrl = buildImageUrl(first.backdrop_path, BACKDROP_SIZE);
  if (first.id != null && first.media_type) {
    try {
      const extras: Promise<unknown>[] = [
        fetchTitleLogo(apiKey, first.id, first.media_type),
        fetchCreditsAndGenres(apiKey, first.id, first.media_type),
        fetchTrailerKey(apiKey, first.id, first.media_type),
      ];
      if (first.media_type === 'tv') {
        extras.push(getTvShowSeasonNumbers(first.id));
      }
      const [logo, creditsAndGenres, trailerKey, seasonNumbers] = await Promise.all(extras);
      out.titleLogoUrl = logo as string | null;
      out.cast = (creditsAndGenres as { cast: string | null; genres: string | null }).cast;
      out.genres = (creditsAndGenres as { cast: string | null; genres: string | null }).genres;
      out.trailerYouTubeId = trailerKey as string | null;
      if (Array.isArray(seasonNumbers) && seasonNumbers.length > 0) {
        out.seasonsCount = seasonNumbers.length;
      }
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
