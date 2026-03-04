import { NextRequest, NextResponse } from 'next/server';
import {
  searchTitles,
  getTitle,
  titleToMovieDetail,
  type ImdbTitle,
} from '@/lib/imdbapi';
import { getImagesForTitle } from '@/lib/tmdb';
import { titleFromPath } from '@/lib/titleFromPath';
import type { CarouselItem, MovieDetail } from '@/types/movie';

const SUBTITLE_EXTS = ['.vtt', '.srt'];
const LANG_SUFFIX = /\.([a-z]{2,3})\.(vtt|srt)$/i;

interface MetadataCandidate {
  folderName?: string;
  videoName: string;
  relativePath: string;
  folderRelativePath: string;
  fileNamesInFolder: string[];
  source: 'folder' | 'root';
  index: number;
}

function findSubtitlesForVideo(
  folderRelativePath: string,
  fileNames: string[],
  videoBaseName: string
): Record<string, string> {
  const fileSet = new Set(fileNames);
  const subtitlePaths: Record<string, string> = {};
  const prefix = folderRelativePath ? folderRelativePath + '/' : '';
  for (const ext of SUBTITLE_EXTS) {
    const plainName = videoBaseName + ext;
    if (fileSet.has(plainName)) {
      subtitlePaths.en = prefix + plainName;
      break;
    }
  }
  for (const fileName of fileNames) {
    if (!SUBTITLE_EXTS.some((e) => fileName.toLowerCase().endsWith(e))) continue;
    if (!fileName.toLowerCase().startsWith(videoBaseName.toLowerCase())) continue;
    const match = fileName.match(LANG_SUFFIX);
    const lang = match ? match[1].toLowerCase() : null;
    if (lang && lang !== 'en') {
      subtitlePaths[lang] = prefix + fileName;
    }
  }
  return subtitlePaths;
}

export async function POST(request: NextRequest) {
  let body: { candidates?: MetadataCandidate[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const candidates = body.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty candidates array' },
      { status: 400 }
    );
  }

  const items: CarouselItem[] = [];
  const detailsMap: Record<string, MovieDetail> = {};
  const itemIdToRelativePath: Record<string, string> = {};
  const folderPathByItemId: Record<string, string> = {};
  const seenTitles = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    try {
      const c = candidates[i]!;
      const { videoName, folderName, relativePath, folderRelativePath, fileNamesInFolder, source } = c;
      const nameForTitle =
        typeof videoName === 'string' && videoName.trim()
          ? videoName
          : source === 'folder' && folderName
            ? String(folderName)
            : null;
      if (!nameForTitle) continue;

      const searchTitle = titleFromPath(
        source === 'folder' && folderName ? String(folderName) : videoName
      );
      if (!searchTitle || seenTitles.has(searchTitle.toLowerCase())) continue;
      seenTitles.add(searchTitle.toLowerCase());

      const safePathPart = String(relativePath).replace(/[/\\]/g, '_').slice(0, 120);
      const localId = `handle-${i}-${safePathPart}`;

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
        // use filename-only detail
      }

      const title =
        imdbTitle?.primaryTitle ?? imdbTitle?.originalTitle ?? searchTitle;
      const imdbPosterUrl = imdbTitle?.primaryImage?.url;

      let detail: MovieDetail;
      try {
        detail = imdbTitle
          ? titleToMovieDetail(imdbTitle, localId, searchTitle)
          : {
              id: localId,
              title,
              posterUrl: imdbPosterUrl,
              description: 'No description available.',
              mediaType: 'movie' as const,
            };
      } catch {
        detail = {
          id: localId,
          title,
          posterUrl: imdbPosterUrl,
          description: 'No description available.',
          mediaType: 'movie' as const,
        };
      }

      try {
        const tmdb = await getImagesForTitle(searchTitle);
        if (tmdb.posterUrl) detail.posterUrl = tmdb.posterUrl;
        if (tmdb.backdropUrl) detail.backdropUrl = tmdb.backdropUrl;
        if (tmdb.titleLogoUrl) detail.titleLogoUrl = tmdb.titleLogoUrl;
        if (tmdb.cast) detail.cast = tmdb.cast;
        if (tmdb.genres) detail.genres = tmdb.genres;
        if (tmdb.trailerYouTubeId) detail.trailerYouTubeId = tmdb.trailerYouTubeId;
        if (tmdb.englishTitle?.trim()) detail.title = tmdb.englishTitle.trim();
        if (tmdb.seasonsCount != null) detail.seasonsCount = tmdb.seasonsCount;
        if (tmdb.overview && (!detail.description || detail.description === 'No description available.')) detail.description = tmdb.overview;
        if (tmdb.tagline) detail.tagline = tmdb.tagline;
        if (tmdb.contentRating) detail.contentRating = tmdb.contentRating;
      } catch {
        // no TMDB key or request failed
      }
      if (!detail.posterUrl) detail.posterUrl = imdbPosterUrl;

      itemIdToRelativePath[localId] = relativePath;
      folderPathByItemId[localId] = folderRelativePath;

      const dotIdx = String(videoName).lastIndexOf('.');
      const baseName = dotIdx >= 0 ? videoName.slice(0, dotIdx) : videoName;
      const subtitlePaths = findSubtitlesForVideo(
        folderRelativePath,
        fileNamesInFolder,
        baseName
      );
      if (Object.keys(subtitlePaths).length > 0) {
        detail.subtitleLanguages = Object.keys(subtitlePaths).sort();
        detail.hasSubtitles = true;
      }

      detailsMap[localId] = detail;
      items.push({
        id: localId,
        title: detail.title,
        posterUrl: detail.posterUrl,
        backdropUrl: detail.backdropUrl,
        titleLogoUrl: detail.titleLogoUrl,
        trailerYouTubeId: detail.trailerYouTubeId,
      });
    } catch (itemErr) {
      console.warn('[library-metadata] Skip candidate', i, itemErr);
    }

    if (i < candidates.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const carousels = [{ title: 'Your Library', items }];

  return NextResponse.json({
    carousels,
    detailsMap,
    itemIdToRelativePath,
    folderPathByItemId,
  });
}
