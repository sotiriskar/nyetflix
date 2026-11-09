/**
 * Finds subtitle files sitting next to a video: `Movie.vtt`, `Movie.en.srt`,
 * `Movie.en.forced.vtt`, plus a `Subs` subfolder when there is one.
 *
 * Reading the folder rather than trusting the registry matters because a library rescan
 * rebuilds the registry from filename patterns only, which would drop the extra tracks
 * written during conversion (and any file the viewer drops in by hand).
 */

import { join } from 'path';
import {
  listDir,
  mediaBasename,
  mediaDirname,
  mediaJoin,
  isRemotePath,
  writableDirFor,
} from './storage';

const SUBTITLE_EXTS = ['.vtt', '.srt'];
const LANG_CODE = /^[a-z]{2,3}$/;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Turns the part between the base name and the extension into a track key. */
function keyFromSuffix(suffix: string): string {
  const tokens = suffix.split('.').filter(Boolean);
  // `Movie.srt` with no language in the name: treated as English, as it always has been.
  if (tokens.length === 0) return 'en';
  const first = tokens[0]!.toLowerCase();
  if (LANG_CODE.test(first)) {
    return tokens.length === 1 ? first : `${first}.${tokens.slice(1).join('.').toLowerCase()}`;
  }
  return `und.${tokens.join('.').toLowerCase()}`;
}

function collect(
  folder: string,
  fileNames: string[],
  baseName: string,
  into: Map<string, string>,
  joinPath: (dir: string, name: string) => string = mediaJoin,
): void {
  const prefix = `${baseName.toLowerCase()}.`;
  for (const name of fileNames) {
    const ext = extensionOf(name);
    if (!SUBTITLE_EXTS.includes(ext)) continue;
    const lower = name.toLowerCase();
    if (!lower.startsWith(prefix)) continue;
    const key = keyFromSuffix(stripExtension(name).slice(baseName.length + 1));
    const existing = into.get(key);
    // A .vtt needs no conversion on the way out, so it wins over a same-key .srt.
    if (existing && !(ext === '.vtt' && extensionOf(existing) === '.srt')) continue;
    into.set(key, joinPath(folder, name));
  }
}

/**
 * Subtitle files for a video, as `{ trackKey: absolutePath }`.
 * `videoPath` may be a video file or an HLS marker playlist — both share the base name.
 * For a remote video this also looks in its local cache folder, where subtitles extracted
 * from embedded streams are written.
 */
export async function findSidecarSubtitles(videoPath: string): Promise<Record<string, string>> {
  const folder = mediaDirname(videoPath);
  const baseName = stripExtension(mediaBasename(videoPath));
  const found = new Map<string, string>();

  let entries: string[];
  try {
    entries = (await listDir(folder)).map((e) => e.name);
  } catch {
    entries = [];
  }
  collect(folder, entries, baseName, found);

  const subsFolder = entries.find((name) => name.toLowerCase() === 'subs');
  if (subsFolder) {
    const subsPath = mediaJoin(folder, subsFolder);
    try {
      collect(subsPath, (await listDir(subsPath)).map((e) => e.name), baseName, found);
    } catch {
      // no readable Subs folder
    }
  }

  if (isRemotePath(videoPath)) {
    const cacheDir = writableDirFor(videoPath);
    try {
      const cached = (await listDir(cacheDir)).filter((e) => e.isFile()).map((e) => e.name);
      // Extracted .vtt files only fill gaps; a subtitle file in the bucket wins.
      const extra = new Map<string, string>();
      collect(cacheDir, cached, baseName, extra, join);
      for (const [key, p] of extra) if (!found.has(key)) found.set(key, p);
    } catch {
      // nothing extracted yet
    }
  }

  return Object.fromEntries(found);
}
