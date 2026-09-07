/**
 * Finds subtitle files sitting next to a video: `Movie.vtt`, `Movie.en.srt`,
 * `Movie.en.forced.vtt`, plus a `Subs` subfolder when there is one.
 *
 * Reading the folder rather than trusting the registry matters because a library rescan
 * rebuilds the registry from filename patterns only, which would drop the extra tracks
 * written during conversion (and any file the viewer drops in by hand).
 */

import { readdir } from 'fs/promises';
import { basename, dirname, join } from 'path';

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
    into.set(key, join(folder, name));
  }
}

/**
 * Subtitle files for a video, as `{ trackKey: absolutePath }`.
 * `videoPath` may be a video file or an HLS marker playlist — both share the base name.
 */
export async function findSidecarSubtitles(videoPath: string): Promise<Record<string, string>> {
  const folder = dirname(videoPath);
  const baseName = stripExtension(basename(videoPath));
  const found = new Map<string, string>();

  let entries: string[];
  try {
    entries = await readdir(folder);
  } catch {
    return {};
  }
  collect(folder, entries, baseName, found);

  const subsFolder = entries.find((name) => name.toLowerCase() === 'subs');
  if (subsFolder) {
    const subsPath = join(folder, subsFolder);
    try {
      collect(subsPath, await readdir(subsPath), baseName, found);
    } catch {
      // no readable Subs folder
    }
  }

  return Object.fromEntries(found);
}
