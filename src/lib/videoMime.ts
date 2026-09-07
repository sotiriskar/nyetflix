/**
 * MIME types we advertise for streamed video. MOV/M4V are reported as `video/mp4`
 * because they share the MP4 container and both Chrome and Google Cast receivers
 * reject the vendor-specific names.
 */
const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
};

export const DEFAULT_VIDEO_MIME = 'video/mp4';

/** Marker playlist of a converted multi-audio title (see hlsPackage.ts). */
export const HLS_MARKER_EXT = '.m3u8' as const;
export const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl' as const;
/** Google Cast's own spelling of the HLS content type. */
export const HLS_CAST_MIME_TYPE = 'application/x-mpegurl' as const;

export function isHlsMimeType(mimeType: string | undefined): boolean {
  const value = mimeType?.toLowerCase();
  return value === HLS_MIME_TYPE || value === HLS_CAST_MIME_TYPE;
}

export function getVideoExt(path: string): string {
  return path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
}

export function getVideoMimeType(path: string): string {
  return MIME_BY_EXT[getVideoExt(path)] ?? DEFAULT_VIDEO_MIME;
}
