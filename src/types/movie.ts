export interface CarouselItem {
  id: string;
  title: string;
  posterUrl?: string;
  /** Wide/backdrop image for hero and carousel cards */
  backdropUrl?: string;
  /** Title treatment / logo image (e.g. for hero) */
  titleLogoUrl?: string;
  /** YouTube video ID for trailer (hover card plays this instead of static image) */
  trailerYouTubeId?: string;
}

export interface MovieDetail {
  id: string;
  title: string;
  posterUrl?: string;
  /** Large image for the top of the detail card */
  backdropUrl?: string;
  /** Title treatment / logo image */
  titleLogoUrl?: string;
  description?: string;
  year?: string;
  contentRating?: string;
  tagline?: string;
  cast?: string;
  genres?: string;
  tags?: string; // e.g. "Steamy, Suspenseful"
  /** Runtime e.g. "145m" for hover card */
  duration?: string;
  /** Progress 0–1 for progress bar */
  progress?: number;
  /** True if a .vtt or .srt file exists next to the video (same name) */
  hasSubtitles?: boolean;
  /** Language codes for available subtitle files (e.g. ["en", "el"]) */
  subtitleLanguages?: string[];
  /** From IMDb: "movie" or "series" (tvSeries, tvMiniSeries, etc.) */
  mediaType?: 'movie' | 'series';
  /** YouTube video ID for trailer (hover card preview) */
  trailerYouTubeId?: string;
}

/** Single episode for series detail and playback */
export interface SeriesEpisode {
  id?: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  durationMinutes?: number;
  description?: string;
  /** Episode still/thumbnail URL (from TMDB or placeholder) */
  posterUrl?: string;
  /** Language codes for available subtitles (e.g. ['en', 'el']) */
  subtitleLanguages?: string[];
  /** True if a local file exists for this episode; false = show "not in library" on play */
  hasFile?: boolean;
}

/** One season with its episodes */
export interface SeriesSeason {
  number: number;
  episodes: SeriesEpisode[];
}
