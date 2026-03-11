import { NextRequest, NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join, dirname, sep } from 'path';
import type { Dirent } from 'fs';
import { registry, persistRegistry, ensureHydrated } from '@/lib/streamRegistry';
import {
  getTvShowIdByTitle,
  getTvShowSeasonNumbers,
  getTvSeasonEpisodes,
  buildStillUrl,
  type TmdbTvSeasonEpisode,
} from '@/lib/tmdb';
import type { SeriesSeason, SeriesEpisode } from '@/types/movie';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VIDEO_EXT = new Set(
  ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v'].map((e) => e.toLowerCase())
);
const SUBTITLE_EXT = ['.vtt', '.srt'];
const LANG_SUFFIX = /\.([a-z]{2,3})\.(vtt|srt)$/i;

function isVideoFile(name: string): boolean {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  return VIDEO_EXT.has(ext);
}

/** Match "Season 1", "Season 01", "season 2" */
const SEASON_DIR = /^season\s*(\d+)$/i;
/** Match "S01", "S1", "s02" */
const S_NUM = /^s(\d+)$/i;

/** Match S01E01, S1E1, 1x01, etc. */
const SXXEXX = /[sS](\d+)[eE](\d+)|(\d+)[xX](\d+)/;

function parseSeasonFromDirName(name: string): number | null {
  const m = name.match(SEASON_DIR);
  if (m) return parseInt(m[1], 10);
  const s = name.match(S_NUM);
  return s ? parseInt(s[1], 10) : null;
}

function parseSxxExx(name: string): { season: number; episode: number } | null {
  const m = name.match(SXXEXX);
  if (!m) return null;
  const s = m[1] ?? m[3];
  const e = m[2] ?? m[4];
  return s && e ? { season: parseInt(s, 10), episode: parseInt(e, 10) } : null;
}

function findSubtitlesForVideo(
  folderPath: string,
  fileNames: Set<string>,
  videoBaseName: string,
  subsFolderFiles?: Set<string>
): Record<string, string> {
  const subtitlePaths: Record<string, string> = {};
  const checkFolder = (folder: string, names: Set<string>) => {
    for (const ext of SUBTITLE_EXT) {
      const plainName = videoBaseName + ext;
      if (names.has(plainName) && !subtitlePaths.en) {
        subtitlePaths.en = join(folder, plainName);
        break;
      }
    }
    for (const fileName of names) {
      if (!SUBTITLE_EXT.some((e) => fileName.toLowerCase().endsWith(e))) continue;
      if (!fileName.toLowerCase().startsWith(videoBaseName.toLowerCase())) continue;
      const match = fileName.match(LANG_SUFFIX);
      const lang = match ? match[1].toLowerCase() : null;
      if (lang && lang !== 'en' && !subtitlePaths[lang]) {
        subtitlePaths[lang] = join(folder, fileName);
      }
    }
  };
  checkFolder(folderPath, fileNames);
  if (subsFolderFiles && subsFolderFiles.size > 0) {
    const subsPath = join(folderPath, 'Subs');
    checkFolder(subsPath, subsFolderFiles);
  }
  return subtitlePaths;
}

/** Build map of "season-episode" -> { path, subtitlePaths } from folder scan. */
async function buildLocalEpisodeMap(
  folderPath: string,
  id: string,
  episodeIdToPath: Map<string, string>,
  episodeIdToSubtitlePath: Map<string, Record<string, string>>
): Promise<Map<string, { path: string; subtitlePaths: Record<string, string>; episodeId: string }>> {
  const map = new Map<string, { path: string; subtitlePaths: Record<string, string>; episodeId: string }>();
  let entries: Dirent[];
  try {
    entries = await readdir(folderPath, { withFileTypes: true });
  } catch {
    return map;
  }

  const subdirs = entries.filter((e) => e.isDirectory());
  const seasonDirs = subdirs
    .map((d) => ({ name: d.name, number: parseSeasonFromDirName(d.name) }))
    .filter((x): x is { name: string; number: number } => x.number !== null)
    .sort((a, b) => a.number - b.number);

  if (seasonDirs.length > 0) {
    for (const { name: dirName, number: seasonNum } of seasonDirs) {
      const seasonPath = join(folderPath, dirName);
      let subEntries: Dirent[];
      try {
        subEntries = await readdir(seasonPath, { withFileTypes: true });
      } catch {
        continue;
      }
      const files = subEntries.filter((e) => e.isFile());
      const subDirs = subEntries.filter((e) => e.isDirectory());
      const subsDir = subDirs.find((d) => d.name.toLowerCase() === 'subs');
      let subsFileNames = new Set<string>();
      if (subsDir) {
        try {
          const subsEntries = await readdir(join(seasonPath, subsDir.name), { withFileTypes: true });
          subsFileNames = new Set(subsEntries.filter((e) => e.isFile()).map((f) => f.name));
        } catch {
          // ignore
        }
      }
      const videoFiles = files.filter((f) => isVideoFile(f.name)).map((f) => ({
        name: f.name,
        path: join(seasonPath, f.name),
      }));
      videoFiles.sort((a, b) => {
        const pa = parseSxxExx(a.name);
        const pb = parseSxxExx(b.name);
        if (pa && pb && pa.episode !== pb.episode) return pa.episode - pb.episode;
        return a.name.localeCompare(b.name);
      });
      const fileNamesInFolder = new Set(files.map((f) => f.name));
      for (let i = 0; i < videoFiles.length; i++) {
        const { name: videoName, path: videoPath } = videoFiles[i];
        const parsed = parseSxxExx(videoName);
        const s = parsed ? parsed.season : seasonNum;
        const e = parsed ? parsed.episode : i + 1;
        const key = `${s}-${e}`;
        const episodeId = `episode-${id}-S${s}-E${e}`;
        const baseName = videoName.includes('.') ? videoName.slice(0, videoName.lastIndexOf('.')) : videoName;
        const subtitlePaths = findSubtitlesForVideo(seasonPath, fileNamesInFolder, baseName, subsFileNames);
        episodeIdToPath.set(episodeId, videoPath);
        if (Object.keys(subtitlePaths).length > 0) {
          episodeIdToSubtitlePath.set(episodeId, subtitlePaths);
        }
        map.set(key, { path: videoPath, subtitlePaths, episodeId });
      }
    }
  } else {
    const rootFiles = entries.filter((e) => e.isFile());
    const rootDirs = entries.filter((e) => e.isDirectory());
    const subsDir = rootDirs.find((d) => d.name.toLowerCase() === 'subs');
    let subsFileNames = new Set<string>();
    if (subsDir) {
      try {
        const subsEntries = await readdir(join(folderPath, subsDir.name), { withFileTypes: true });
        subsFileNames = new Set(subsEntries.filter((e) => e.isFile()).map((f) => f.name));
      } catch {
        // ignore
      }
    }
    const videoFiles = rootFiles.filter((f) => isVideoFile(f.name)).map((f) => ({
      name: f.name,
      path: join(folderPath, f.name),
    }));
    videoFiles.sort((a, b) => {
      const pa = parseSxxExx(a.name);
      const pb = parseSxxExx(b.name);
      if (pa && pb) {
        if (pa.season !== pb.season) return pa.season - pb.season;
        if (pa.episode !== pb.episode) return pa.episode - pb.episode;
      }
      return a.name.localeCompare(b.name);
    });
    const fileNamesInFolder = new Set(rootFiles.map((f) => f.name));
    for (let i = 0; i < videoFiles.length; i++) {
      const { name: videoName, path: videoPath } = videoFiles[i];
      const parsed = parseSxxExx(videoName);
      const s = parsed ? parsed.season : 1;
      const e = parsed ? parsed.episode : i + 1;
      const key = `${s}-${e}`;
      const episodeId = `episode-${id}-S${s}-E${e}`;
      const baseName = videoName.includes('.') ? videoName.slice(0, videoName.lastIndexOf('.')) : videoName;
      const subtitlePaths = findSubtitlesForVideo(folderPath, fileNamesInFolder, baseName, subsFileNames);
      episodeIdToPath.set(episodeId, videoPath);
      if (Object.keys(subtitlePaths).length > 0) {
        episodeIdToSubtitlePath.set(episodeId, subtitlePaths);
      }
      map.set(key, { path: videoPath, subtitlePaths, episodeId });
    }
  }
  return map;
}

export async function GET(request: NextRequest) {
  let id = request.nextUrl.searchParams.get('id');
  const title = request.nextUrl.searchParams.get('title')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep as-is
  }

  ensureHydrated();
  const { itemIdToPath, folderPathByItemId, episodeIdToPath, episodeIdToSubtitlePath } = registry;
  let folderPath = folderPathByItemId.get(id);
  if (!folderPath) {
    const singlePath = itemIdToPath.get(id);
    if (!singlePath) {
      return NextResponse.json({ error: 'Unknown series. Rescan the library.' }, { status: 404 });
    }
    folderPath = dirname(singlePath);
    const lastSegment = folderPath.split(sep).filter(Boolean).pop() ?? '';
    if (parseSeasonFromDirName(lastSegment) !== null) {
      folderPath = dirname(folderPath);
    }
  }

  const localMap = await buildLocalEpisodeMap(folderPath, id, episodeIdToPath, episodeIdToSubtitlePath);
  persistRegistry();

  if (title) {
    const tv = await getTvShowIdByTitle(title);
    if (tv) {
      const localSeasonNumbers = [...new Set([...localMap.keys()].map((k) => parseInt(k.split('-')[0], 10)))].sort((a, b) => a - b);
      const tmdbSeasonNumbers = await getTvShowSeasonNumbers(tv.id);
      const seasonNumbers = [...new Set([...localSeasonNumbers, ...tmdbSeasonNumbers])].sort((a, b) => a - b);
      const seasons: SeriesSeason[] = [];
      for (const seasonNum of seasonNumbers) {
        const localKeysForSeason = [...localMap.keys()].filter((k) => parseInt(k.split('-')[0], 10) === seasonNum);
        const localEpNums = [...new Set(localKeysForSeason.map((k) => parseInt(k.split('-')[1], 10)))].sort((a, b) => a - b);
        let tmdbEpisodes: TmdbTvSeasonEpisode[] = [];
        try {
          tmdbEpisodes = await getTvSeasonEpisodes(tv.id, seasonNum);
        } catch {
          // use local only
        }
        const tmdbByEp = new Map(tmdbEpisodes.map((e) => [e.episode_number, e]));
        const epNumbers = [...new Set([...localEpNums, ...tmdbEpisodes.map((e) => e.episode_number)])].sort((a, b) => a - b);
        const episodes: SeriesEpisode[] = epNumbers.map((epNum) => {
          const key = `${seasonNum}-${epNum}`;
          const local = localMap.get(key);
          const tmdb = tmdbByEp.get(epNum);
          const episodeId = local?.episodeId;
          return {
            ...(episodeId ? { id: episodeId } : undefined),
            seasonNumber: seasonNum,
            episodeNumber: epNum,
            title: tmdb?.name?.trim() || `Episode ${epNum}`,
            durationMinutes: tmdb?.runtime ?? undefined,
            description: tmdb?.overview?.trim() || undefined,
            posterUrl: tmdb?.still_path ? buildStillUrl(tmdb.still_path) ?? undefined : undefined,
            subtitleLanguages: local && Object.keys(local.subtitlePaths).length > 0
              ? Object.keys(local.subtitlePaths).sort()
              : undefined,
            hasFile: !!local,
          };
        });
        if (episodes.length > 0) {
          seasons.push({ number: seasonNum, episodes });
        }
      }
      if (seasons.length > 0) {
        return NextResponse.json({ seasons, seriesId: id });
      }
    }
  }

  const bySeason = new Map<number, SeriesEpisode[]>();
  for (const [key, data] of localMap) {
    const [s, e] = key.split('-').map(Number);
    const seasonNum = s;
    const epNum = e;
    if (!bySeason.has(seasonNum)) bySeason.set(seasonNum, []);
    bySeason.get(seasonNum)!.push({
      id: data.episodeId,
      seasonNumber: seasonNum,
      episodeNumber: epNum,
      title: `Episode ${epNum}`,
      durationMinutes: undefined,
      description: undefined,
      subtitleLanguages: Object.keys(data.subtitlePaths).length > 0 ? Object.keys(data.subtitlePaths).sort() : undefined,
      hasFile: true,
    });
  }
  const outSeasons: SeriesSeason[] = [];
  for (const [num, eps] of [...bySeason.entries()].sort((a, b) => a[0] - b[0])) {
    eps.sort((a, b) => a.episodeNumber - b.episodeNumber);
    outSeasons.push({ number: num, episodes: eps });
  }
  return NextResponse.json({ seasons: outSeasons, seriesId: id });
}
