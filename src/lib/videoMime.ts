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

export function getVideoExt(path: string): string {
  return path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
}

export function getVideoMimeType(path: string): string {
  return MIME_BY_EXT[getVideoExt(path)] ?? DEFAULT_VIDEO_MIME;
}
