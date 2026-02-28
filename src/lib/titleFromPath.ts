/**
 * Derive a clean searchable title from a file or folder name.
 * Strips year, resolution, codec, source tags, and normalizes separators.
 */
const YEAR_PATTERN = /\(\s*(\d{4})\s*\)|\.(\d{4})\.|\s(\d{4})\s*$/;
const RESOLUTION = /\b(720p|1080p|2160p|4k|4K|UHD|HD)\b/i;
const CODEC = /\b(x264|x265|h\.?264|h\.?265|hevc|avc|mkv|mp4|avi|webm)\b/i;
const SOURCE = /\b(bluray|web-?dl|webrip|hdtv|dvdrip|brrip)\b/i;
const SEPARATORS = /[.\-_]+/g;

export function titleFromPath(name: string): string {
  let base = name;
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
  if (ext && /^\.(mp4|mkv|avi|webm|mov|m4v)$/i.test(ext)) {
    base = base.slice(0, -ext.length);
  }
  base = base.replace(YEAR_PATTERN, ' ');
  base = base.replace(RESOLUTION, ' ');
  base = base.replace(CODEC, ' ');
  base = base.replace(SOURCE, ' ');
  base = base.replace(SEPARATORS, ' ');
  base = base.replace(/\s+/g, ' ').trim();
  return base || name;
}
