import { NextRequest, NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Dirent } from 'fs';
import { titleFromPath } from '@/lib/titleFromPath';
import {
  searchTitles,
  getTitle,
  titleToMovieDetail,
  type ImdbTitle,
} from '@/lib/imdbapi';
import { getImagesForTitle } from '@/lib/tmdb';
import type { CarouselItem, MovieDetail } from '@/types/movie';
import { registry } from '@/lib/streamRegistry';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const scanCache = new Map<
  string,
  {
    carousels: { title: string; items: CarouselItem[] }[];
    detailsMap: Record<string, MovieDetail>;
    pathByItemId: Record<string, string>;
    folderPathByItemId: Record<string, string>;
    /** itemId -> { langCode: filePath } */
    subtitlePathByItemId: Record<string, Record<string, string>>;
    cachedAt: number;
  }
>();

const itemIdToPath = registry.itemIdToPath;
const itemIdToSubtitlePath = registry.itemIdToSubtitlePath;
const folderPathByItemId = registry.folderPathByItemId;

const VIDEO_EXT = new Set(
  ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v'].map((e) => e.toLowerCase())
);

function isVideoFile(name: string): boolean {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  return VIDEO_EXT.has(ext);
}

/** Resolve path: expand ~ and /Documents/... (etc.) to homedir. Other paths (e.g. /Volumes/MyDrive) are left as-is for external drives. */
function resolveFolderPath(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('~')) {
    return join(homedir(), trimmed.slice(1).replace(/^\//, '') || '');
  }
  const home = homedir();
  const homeLike = ['Documents', 'Desktop', 'Downloads', 'Movies'];
  if (trimmed.startsWith('/') && homeLike.some((dir) => trimmed === `/${dir}` || trimmed.startsWith(`/${dir}/`))) {
    return join(home, trimmed.slice(1)); // "/Documents/movies" -> home + "Documents/movies"
  }
  return trimmed;
}

export async function GET(request: NextRequest) {
  const pathParam = request.nextUrl.searchParams.get('path');
  if (!pathParam || pathParam.trim() === '') {
    return NextResponse.json(
      { error: 'Missing or empty path. Set a folder in App Settings.' },
      { status: 400 }
    );
  }

  const resolvedPath = resolveFolderPath(pathParam);
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1' || request.nextUrl.searchParams.get('refresh') === 'true';

  try {
  if (!forceRefresh) {
    const cached = scanCache.get(resolvedPath);
    const hasPathMap = cached?.pathByItemId && Object.keys(cached.pathByItemId).length > 0;
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS && hasPathMap) {
      itemIdToPath.clear();
      itemIdToSubtitlePath.clear();
      folderPathByItemId.clear();
      Object.entries(cached.pathByItemId).forEach(([k, v]) => itemIdToPath.set(k, v));
      if (cached.folderPathByItemId) {
        Object.entries(cached.folderPathByItemId).forEach(([k, v]) => folderPathByItemId.set(k, v));
      }
      if (cached.subtitlePathByItemId) {
        Object.entries(cached.subtitlePathByItemId).forEach(([k, v]) => itemIdToSubtitlePath.set(k, v));
      }
      return NextResponse.json({ carousels: cached.carousels, detailsMap: cached.detailsMap });
    }
  }

  let entries: Dirent[];
  try {
    entries = await readdir(resolvedPath, { withFileTypes: true });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
    let message: string;
    if (code === 'ENOENT') {
      message = 'Folder not found. Check the path, or if it’s on an external drive make sure the drive is connected and mounted.';
    } else if (code === 'EACCES') {
      message = 'Access denied to this folder. Check permissions.';
    } else if (code === 'ENOTDIR') {
      message = 'The path is not a folder. Please choose a directory.';
    } else {
      const raw = err instanceof Error ? err.message : 'Failed to read folder';
      message = `Cannot read folder: ${raw}`;
    }
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }

  const subtitleExts = ['.vtt', '.srt'];
  /** Match optional language before extension: e.g. ".en.srt" -> "en", ".el.vtt" -> "el" */
  const langSuffix = /\.([a-z]{2,3})\.(vtt|srt)$/i;

  /** Collect subtitle paths for a video in a folder: same basename + .srt/.vtt or basename.lang.srt */
  function findSubtitlesForVideo(
    folderPath: string,
    fileNames: Set<string>,
    videoBaseName: string
  ): Record<string, string> {
    const subtitlePaths: Record<string, string> = {};
    for (const ext of subtitleExts) {
      const plainName = videoBaseName + ext;
      if (fileNames.has(plainName)) {
        subtitlePaths.en = join(folderPath, plainName);
        break;
      }
    }
    for (const fileName of fileNames) {
      if (!subtitleExts.some((e) => fileName.toLowerCase().endsWith(e))) continue;
      if (!fileName.toLowerCase().startsWith(videoBaseName.toLowerCase())) continue;
      const match = fileName.match(langSuffix);
      const lang = match ? match[1].toLowerCase() : null;
      if (lang && lang !== 'en') {
        subtitlePaths[lang] = join(folderPath, fileName);
      }
    }
    return subtitlePaths;
  }

  type MovieCandidate = {
    videoPath: string;
    videoName: string;
    folderPath: string;
    fileNamesInFolder: Set<string>;
    source: 'folder' | 'root';
    folderName?: string;
  };

  const candidates: MovieCandidate[] = [];

  // 1) Subfolders: each folder that contains at least one video = one movie (pick one video per folder)
  const subdirs = entries.filter((e) => e.isDirectory());
  for (const dir of subdirs) {
    const folderPath = join(resolvedPath, dir.name);
    let subEntries: Dirent[];
    try {
      subEntries = await readdir(folderPath, { withFileTypes: true });
    } catch {
      continue;
    }
    const subFiles = subEntries.filter((e) => e.isFile());
    const subVideoFiles = subFiles.filter((f) => isVideoFile(f.name)).map((f) => ({ name: f.name, path: join(folderPath, f.name) }));
    if (subVideoFiles.length === 0) continue;
    // Prefer .mp4, then first alphabetically
    subVideoFiles.sort((a, b) => {
      const aExt = a.name.slice(a.name.lastIndexOf('.')).toLowerCase();
      const bExt = b.name.slice(b.name.lastIndexOf('.')).toLowerCase();
      if (aExt === '.mp4' && bExt !== '.mp4') return -1;
      if (aExt !== '.mp4' && bExt === '.mp4') return 1;
      return a.name.localeCompare(b.name);
    });
    const chosen = subVideoFiles[0];
    const fileNamesInFolder = new Set(subFiles.map((f) => f.name));
    candidates.push({
      videoPath: chosen.path,
      videoName: chosen.name,
      folderPath,
      fileNamesInFolder,
      source: 'folder',
      folderName: dir.name,
    });
  }

  // 2) Flat files in root: videos directly in the library folder
  const rootFiles = entries.filter((e) => e.isFile());
  const rootVideoFiles = rootFiles.filter((f) => isVideoFile(f.name));
  const rootFileNames = new Set(rootFiles.map((f) => f.name));
  for (const f of rootVideoFiles) {
    candidates.push({
      videoPath: join(resolvedPath, f.name),
      videoName: f.name,
      folderPath: resolvedPath,
      fileNamesInFolder: rootFileNames,
      source: 'root',
    });
  }

  const items: CarouselItem[] = [];
  const detailsMap: Record<string, MovieDetail> = {};
  const pathByItemId: Record<string, string> = {};
  const folderPathByItemIdRecord: Record<string, string> = {};
  const subtitlePathByItemId: Record<string, Record<string, string>> = {};
  const seenTitles = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    try {
      const { videoPath, videoName, folderPath, fileNamesInFolder, source } = candidates[i];
      const nameForTitle = typeof videoName === 'string' && videoName.trim()
        ? videoName
        : (source === 'folder' && candidates[i].folderName ? String(candidates[i].folderName) : null);
      if (!nameForTitle) continue;

      const searchTitle = titleFromPath(source === 'folder' && candidates[i].folderName ? String(candidates[i].folderName) : videoName);
      if (!searchTitle || seenTitles.has(searchTitle.toLowerCase())) continue;
      seenTitles.add(searchTitle.toLowerCase());

      const safePathPart = String(videoPath).replace(/[/\\]/g, '_').slice(0, 120);
      const localId = `${source}-${i}-${safePathPart}`;
      let imdbTitle: ImdbTitle | null = null;

      try {
        const searchResults = await searchTitles(searchTitle, 3);
        if (searchResults.length > 0) {
          const first = searchResults[0];
          const titleId = first.id ?? '';
          imdbTitle = titleId ? await getTitle(titleId) : first;
          if (!imdbTitle) imdbTitle = first;
        }
      } catch {
        // use filename-only detail
      }

      const title = imdbTitle?.primaryTitle ?? imdbTitle?.originalTitle ?? searchTitle;
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
        const tmdb = await getImagesForTitle(title || searchTitle);
        if (tmdb.posterUrl) detail.posterUrl = tmdb.posterUrl;
        if (tmdb.backdropUrl) detail.backdropUrl = tmdb.backdropUrl;
        if (tmdb.titleLogoUrl) detail.titleLogoUrl = tmdb.titleLogoUrl;
        if (tmdb.cast) detail.cast = tmdb.cast;
        if (tmdb.genres) detail.genres = tmdb.genres;
        if (tmdb.trailerYouTubeId) detail.trailerYouTubeId = tmdb.trailerYouTubeId;
      } catch {
        // no TMDB key or request failed
      }
      if (!detail.posterUrl) detail.posterUrl = imdbPosterUrl;
      pathByItemId[localId] = videoPath;
      folderPathByItemIdRecord[localId] = folderPath;
      const dotIdx = String(videoName).lastIndexOf('.');
      const baseName = dotIdx >= 0 ? videoName.slice(0, dotIdx) : videoName;
      const subtitlePaths = findSubtitlesForVideo(folderPath, fileNamesInFolder, baseName);
      if (Object.keys(subtitlePaths).length > 0) {
        subtitlePathByItemId[localId] = subtitlePaths;
        detail.subtitleLanguages = Object.keys(subtitlePaths).sort();
        detail.hasSubtitles = true;
      }
      detailsMap[localId] = detail;
      items.push({
        id: localId,
        title,
        posterUrl: detail.posterUrl,
        backdropUrl: detail.backdropUrl,
        titleLogoUrl: detail.titleLogoUrl,
        trailerYouTubeId: detail.trailerYouTubeId,
      });
    } catch (itemErr) {
      console.warn('[scan-library] Skip candidate', i, itemErr);
      // continue with next candidate
    }

    if (i < candidates.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const carousels = [
    { title: 'Your Library', items },
  ];

  scanCache.set(resolvedPath, {
    carousels,
    detailsMap,
    pathByItemId,
    folderPathByItemId: folderPathByItemIdRecord,
    subtitlePathByItemId,
    cachedAt: Date.now(),
  });
  itemIdToPath.clear();
  itemIdToSubtitlePath.clear();
  folderPathByItemId.clear();
  Object.entries(pathByItemId).forEach(([k, v]) => itemIdToPath.set(k, v));
  Object.entries(folderPathByItemIdRecord).forEach(([k, v]) => folderPathByItemId.set(k, v));
  Object.entries(subtitlePathByItemId).forEach(([k, v]) => itemIdToSubtitlePath.set(k, v));

  return NextResponse.json({
    carousels,
    detailsMap,
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed';
    console.error('[scan-library]', err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
