import { NextRequest, NextResponse } from 'next/server';
import { searchTitles, getTitle, titleToMovieDetail, type ImdbTitle } from '@/lib/imdbapi';
import { getImagesForTitle } from '@/lib/tmdb';
import { getDurationSecondsForItem } from '@/lib/videoDuration';
import type { MovieDetail } from '@/types/movie';

/**
 * Fetch metadata for a single item by title (e.g. hero with "No description available").
 * Returns a partial MovieDetail to merge client-side. Does not rescan the library.
 */
export async function POST(request: NextRequest) {
  let body: { id: string; title: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { id, title } = body;
  if (!id || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Missing id or title' }, { status: 400 });
  }

  const searchTitle = title.trim();
  const patch: Partial<MovieDetail> = { id };

  let imdbTitle: ImdbTitle | null = null;
  try {
    const searchResults = await searchTitles(searchTitle, 3);
    if (searchResults.length > 0) {
      const first = searchResults[0]!;
      const titleId = first.id ?? '';
      imdbTitle = titleId ? await getTitle(titleId) : first;
      if (!imdbTitle) imdbTitle = first;
    }
  } catch {
    // continue without IMDb
  }

  if (imdbTitle) {
    try {
      const d = titleToMovieDetail(imdbTitle, id, searchTitle);
      if (d.description && d.description !== 'No description available.') patch.description = d.description;
      if (d.cast) patch.cast = d.cast;
      if (d.genres) patch.genres = d.genres;
      if (d.duration) patch.duration = d.duration;
      if (d.year) patch.year = d.year;
      if (d.mediaType) patch.mediaType = d.mediaType;
    } catch {
      // ignore
    }
  }

  try {
    const tmdb = await getImagesForTitle(searchTitle);
    if (tmdb.overview && !patch.description) patch.description = tmdb.overview;
    if (tmdb.tagline) patch.tagline = tmdb.tagline;
    if (tmdb.contentRating) patch.contentRating = tmdb.contentRating;
    if (tmdb.posterUrl) patch.posterUrl = tmdb.posterUrl;
    if (tmdb.backdropUrl) patch.backdropUrl = tmdb.backdropUrl;
    if (tmdb.titleLogoUrl) patch.titleLogoUrl = tmdb.titleLogoUrl;
    if (tmdb.cast) patch.cast = patch.cast ?? tmdb.cast;
    if (tmdb.director) patch.director = tmdb.director;
    if (tmdb.writer) patch.writer = tmdb.writer;
    if (tmdb.genres) patch.genres = patch.genres ?? tmdb.genres;
    if (tmdb.trailerYouTubeId) patch.trailerYouTubeId = tmdb.trailerYouTubeId;
    if (tmdb.englishTitle?.trim()) patch.title = tmdb.englishTitle.trim();
    if (tmdb.seasonsCount != null) patch.seasonsCount = tmdb.seasonsCount;
    if (!patch.duration && tmdb.runtimeMinutes != null && tmdb.runtimeMinutes > 0) patch.duration = `${tmdb.runtimeMinutes}m`;
  } catch {
    // no TMDB key or request failed
  }

  // Fallback: if still no duration (e.g. IMDb/TMDB missed it), get from local file
  if (!patch.duration && id) {
    try {
      const sec = await getDurationSecondsForItem(id);
      if (typeof sec === 'number' && sec > 0) {
        const minutes = Math.round(sec / 60);
        patch.duration = `${minutes}m`;
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json(patch);
}
