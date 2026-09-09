import { yearFromPath } from './titleFromPath';

/**
 * Prefer the folder year when present (e.g. "Hercules (1997)/…2014….mkv"),
 * otherwise fall back to the filename year.
 */
export function resolveSearchYear(folderName: string | null | undefined, videoName: string): number | null {
  const fromFolder = folderName ? yearFromPath(folderName) : null;
  if (fromFolder != null) return fromFolder;
  return yearFromPath(videoName);
}
