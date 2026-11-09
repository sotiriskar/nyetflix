/**
 * Media locations are either a plain local path (`C:\Movies\Film.mkv`, `/media/Film.mkv`,
 * a UNC path or a mounted NAS share) or a remote location written as
 *
 *   nyx://<sourceId>/<key>
 *
 * where `sourceId` names a storage source configured in Settings → Storage (S3, MinIO,
 * Google Cloud Storage, WebDAV, …) and `key` is a forward-slash path inside it.
 *
 * Everything that used to be a path string — the stream registry, the library folder
 * setting, converted-file bookkeeping — keeps working unchanged for local files. This
 * module has no Node dependencies so the settings UI can use it too.
 */

export const REMOTE_SCHEME = 'nyx://';

export function isRemotePath(p: string | null | undefined): p is string {
  return typeof p === 'string' && p.startsWith(REMOTE_SCHEME);
}

/** Collapses a remote key: forward slashes, no empty / `.` / `..` segments, no leading slash. */
export function normalizeRemoteKey(key: string): string {
  return key
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg.length > 0 && seg !== '.' && seg !== '..')
    .join('/');
}

export function formatRemotePath(sourceId: string, key: string): string {
  return `${REMOTE_SCHEME}${sourceId}/${normalizeRemoteKey(key)}`;
}

export function parseRemotePath(p: string): { sourceId: string; key: string } | null {
  if (!isRemotePath(p)) return null;
  const rest = p.slice(REMOTE_SCHEME.length);
  const slash = rest.indexOf('/');
  const sourceId = slash < 0 ? rest : rest.slice(0, slash);
  if (!/^[A-Za-z0-9_-]+$/.test(sourceId)) return null;
  const key = slash < 0 ? '' : normalizeRemoteKey(rest.slice(slash + 1));
  return { sourceId, key };
}
