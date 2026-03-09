import { NextRequest, NextResponse } from 'next/server';
import { readdir, realpath } from 'fs/promises';
import { join, resolve, sep, isAbsolute } from 'path';
import { homedir, platform } from 'os';
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
import { registry, persistRegistry, getOrCreateShortId } from '@/lib/streamRegistry';

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

/**
 * Allowed roots for library path. No user input is ever passed to path/fs APIs;
 * we only use these fixed roots + a sanitized (..-stripped) relative part.
 */
function getAllowedRoots(): string[] {
  const home = homedir();
  if (platform() === 'win32') {
    const drives = Array.from({ length: 26 }, (_, i) => `${String.fromCharCode(65 + i)}:\\`);
    return [home, ...drives].sort((a, b) => b.length - a.length);
  }
  return [home, '/'];
}

type SafePathResult = { rootPath: string; relative: string };

/**
 * Maps user path to { rootPath, relative } using only string ops. rootPath is from
 * getAllowedRoots(); relative is sanitized (no ..). No pathParam is passed to path/fs.
 */
function getSafePath(pathParam: string): SafePathResult | null {
  const trimmed = pathParam.trim();
  if (!trimmed) return null;
  const home = homedir();
  const isWin = platform() === 'win32';
  const expanded = trimmed.startsWith('~') ? home + trimmed.slice(1).replace(/^\//, sep) : trimmed;
  const normalizedInput = isWin ? expanded.replace(/\//g, sep) : expanded;
  const roots = getAllowedRoots();

  for (const root of roots) {
    const rootNorm = root.replace(/[/\\]+$/, '');
    const rootWithSep = rootNorm + sep;
    const inputLower = isWin ? normalizedInput.toLowerCase() : normalizedInput;
    const rootLower = isWin ? rootWithSep.toLowerCase() : rootWithSep;
    const rootExact = isWin ? rootNorm.toLowerCase() : rootNorm;
    if (inputLower === rootExact || inputLower.startsWith(rootLower)) {
      const prefixLen = inputLower === rootExact ? rootNorm.length : rootWithSep.length;
      const relative = normalizedInput.slice(prefixLen).replace(/^[/\\]+/, '');
      const segments = relative.split(sep).filter((s) => s.length > 0 && s !== '..');
      return { rootPath: rootNorm, relative: segments.join(sep) };
    }
  }

  if (!isAbsolute(trimmed)) {
    const segments = trimmed.split(/[/\\]/).filter((s) => s.length > 0 && s !== '..');
    if (segments.length > 0) {
      return { rootPath: homedir(), relative: segments.join(sep) };
    }
  }
  return null;
}

/** On Linux (e.g. WSL), rewrite Windows paths so C:\Movies → /mnt/c/Movies. */
function toLinuxPathIfNeeded(pathParam: string): string {
  const trimmed = pathParam.trim();
  if (platform() !== 'win32' && /^[a-zA-Z]:[\\/]/.test(trimmed)) {
    const drive = trimmed[0].toLowerCase();
    const rest = trimmed.slice(2).replace(/\\/g, '/').replace(/^\/+/, '');
    return `/mnt/${drive}/${rest}`;
  }
  return pathParam;
}

export async function GET(request: NextRequest) {
  const pathParam = request.nextUrl.searchParams.get('path');
  if (!pathParam || pathParam.trim() === '') {
    return NextResponse.json(
      { error: 'Missing or empty path. Set a folder in App Settings.' },
      { status: 400 }
    );
  }

  const pathToUse = toLinuxPathIfNeeded(pathParam);
  const safePath = getSafePath(pathToUse);
  if (safePath === null) {
    return NextResponse.json(
      { error: 'Invalid path. Enter a folder path (e.g. C:\\Movies, ~/Videos, or /media/movies).' },
      { status: 400 }
    );
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1' || request.nextUrl.searchParams.get('refresh') === 'true';

  const { rootPath, relative: safeRelative } = safePath;
  let canonicalRoot: string;
  let canonicalResolved: string;
  try {
    // On Windows, realpath("C:") resolves to the CWD on that drive, not the drive root. Use "C:\" so we get the actual root.
    const rootForResolve =
      platform() === 'win32' && /^[A-Z]:$/i.test(rootPath) ? rootPath + sep : rootPath;
    canonicalRoot = await realpath(rootForResolve);
    // Build absolute path relative to canonical root (resolve normalizes . and ..); then resolve symlinks.
    const absolutePath = safeRelative ? resolve(canonicalRoot, safeRelative) : canonicalRoot;
    canonicalResolved = await realpath(absolutePath);
    // Containment: canonical path must be exactly the root or under it (root + sep prefix). Avoids partial-prefix (e.g. /home vs /homefoo).
    const rootWithSep = canonicalRoot.endsWith(sep) ? canonicalRoot : canonicalRoot + sep;
    const resolvedLower = platform() === 'win32' ? canonicalResolved.toLowerCase() : canonicalResolved;
    const rootLower = platform() === 'win32' ? rootWithSep.toLowerCase() : rootWithSep;
    const rootExact = platform() === 'win32' ? canonicalRoot.toLowerCase() : canonicalRoot;
    const isUnderRoot = resolvedLower === rootExact || resolvedLower.startsWith(rootLower);
    if (!isUnderRoot) {
      return NextResponse.json(
        { error: 'Access denied. The library path must be under the chosen root.' },
        { status: 403 }
      );
    }
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
    const absolutePath = safeRelative ? resolve(rootPath, safeRelative) : rootPath;
    if (code === 'ENOENT') {
      const isWinPath = /^[a-z]:[\\/]/i.test(absolutePath);
      const winPathHint =
        platform() !== 'win32' && isWinPath
          ? ' On WSL/Linux use the path above or run the app on Windows.'
          : isWinPath
            ? ' Make sure the folder exists (e.g. create C:\\Movies) or use the path where your movies are stored.'
            : '';
      return NextResponse.json(
        {
          error:
            'Folder not found. Check the path, or if it’s on an external drive make sure the drive is connected and mounted.' + winPathHint,
          attemptedPath: absolutePath,
        },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : 'Invalid path';
    return NextResponse.json({ error: message, attemptedPath: absolutePath }, { status: 400 });
  }

  // All filesystem operations below use only the validated canonical path (canonicalResolved).
  try {
  if (!forceRefresh) {
    const cached = scanCache.get(canonicalResolved);
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
      persistRegistry();
      return NextResponse.json({ carousels: cached.carousels, detailsMap: cached.detailsMap });
    }
  }

  let entries: Dirent[];
  try {
    entries = await readdir(canonicalResolved, { withFileTypes: true });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
    let message: string;
    if (code === 'ENOENT') {
      const winPathHint = /^[a-z]:[\\/]/i.test(canonicalResolved)
        ? ' If the path is on Windows (e.g. C:\\...), run the app on Windows—not in WSL or Docker.'
        : '';
      message =
        'Folder not found. Check the path, or if it’s on an external drive make sure the drive is connected and mounted.' + winPathHint;
    } else if (code === 'EACCES') {
      message = 'Access denied to this folder. Check permissions.';
    } else if (code === 'ENOTDIR') {
      message = 'The path is not a folder. Please choose a directory.';
    } else {
      const raw = err instanceof Error ? err.message : 'Failed to read folder';
      message = `Cannot read folder: ${raw}`;
    }
    return NextResponse.json(
      { error: message, attemptedPath: canonicalResolved },
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

  /** Match "Season 1", "S01", "S1" for series season subdirs */
  const SEASON_DIR_REGEX = /^season\s*(\d+)$/i;
  const S_NUM_REGEX = /^s(\d+)$/i;
  function isSeasonDirName(name: string): boolean {
    return SEASON_DIR_REGEX.test(name) || S_NUM_REGEX.test(name);
  }

  // 1) Subfolders: each folder that contains at least one video = one title; or series (S01/S02/Season N subdirs with no direct videos)
  const subdirs = entries.filter((e) => e.isDirectory());
  for (const dir of subdirs) {
    const folderPath = join(canonicalResolved, dir.name);
    let subEntries: Dirent[];
    try {
      subEntries = await readdir(folderPath, { withFileTypes: true });
    } catch {
      continue;
    }
    const subFiles = subEntries.filter((e) => e.isFile());
    const subDirs = subEntries.filter((e) => e.isDirectory());
    const subVideoFiles = subFiles.filter((f) => isVideoFile(f.name)).map((f) => ({ name: f.name, path: join(folderPath, f.name) }));

    if (subVideoFiles.length > 0) {
      // Direct videos in folder: treat as movie (or flat series)
      subVideoFiles.sort((a, b) => {
        const aExt = a.name.slice(a.name.lastIndexOf('.')).toLowerCase();
        const bExt = b.name.slice(b.name.lastIndexOf('.')).toLowerCase();
        if (aExt === '.mp4' && bExt !== '.mp4') return -1;
        if (aExt !== '.mp4' && bExt === '.mp4') return 1;
        return a.name.localeCompare(b.name);
      });
      const chosen = subVideoFiles[0]!;
      const fileNamesInFolder = new Set(subFiles.map((f) => f.name));
      candidates.push({
        videoPath: chosen.path,
        videoName: chosen.name,
        folderPath,
        fileNamesInFolder,
        source: 'folder',
        folderName: dir.name,
      });
      continue;
    }

    // No direct videos: check for season subdirs (S01, S02, Season 1, etc.)
    const seasonDirs = subDirs
      .filter((d) => isSeasonDirName(d.name))
      .map((d) => ({
        name: d.name,
        num: (() => {
          const m = d.name.match(SEASON_DIR_REGEX);
          if (m) return parseInt(m[1], 10);
          const s = d.name.match(S_NUM_REGEX);
          return s ? parseInt(s[1], 10) : 0;
        })(),
      }))
      .filter((x) => x.num >= 1)
      .sort((a, b) => a.num - b.num);

    if (seasonDirs.length === 0) continue;

    // Pick first video from first season to represent the series (for streaming); folderPath = series root for episodes API
    let representativeVideo: { path: string; name: string } | null = null;
    let fileNamesInFolder = new Set<string>();
    for (const { name: seasonName } of seasonDirs) {
      const seasonPath = join(folderPath, seasonName);
      let seasonEntries: Dirent[];
      try {
        seasonEntries = await readdir(seasonPath, { withFileTypes: true });
      } catch {
        continue;
      }
      const seasonFiles = seasonEntries.filter((e) => e.isFile());
      const seasonVideos = seasonFiles.filter((f) => isVideoFile(f.name)).map((f) => ({ name: f.name, path: join(seasonPath, f.name) }));
      if (seasonVideos.length > 0) {
        seasonVideos.sort((a, b) => a.name.localeCompare(b.name));
        representativeVideo = seasonVideos[0]!;
        fileNamesInFolder = new Set(seasonFiles.map((f) => f.name));
        break;
      }
    }
    if (!representativeVideo) continue;

    candidates.push({
      videoPath: representativeVideo.path,
      videoName: representativeVideo.name,
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
      videoPath: join(canonicalResolved, f.name),
      videoName: f.name,
      folderPath: canonicalResolved,
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

      const localId = getOrCreateShortId(videoPath);
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
        const tmdb = await getImagesForTitle(searchTitle);
        if (tmdb.posterUrl) detail.posterUrl = tmdb.posterUrl;
        if (tmdb.backdropUrl) detail.backdropUrl = tmdb.backdropUrl;
        if (tmdb.titleLogoUrl) detail.titleLogoUrl = tmdb.titleLogoUrl;
        if (tmdb.cast) detail.cast = tmdb.cast;
        if (tmdb.director) detail.director = tmdb.director;
        if (tmdb.writer) detail.writer = tmdb.writer;
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
        title: detail.title,
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

  scanCache.set(canonicalResolved, {
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
  persistRegistry();

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
