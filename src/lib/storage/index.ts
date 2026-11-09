/**
 * One set of file operations for every place media can live.
 *
 * Local paths (including mounted NAS shares and UNC paths) go straight to `fs`, exactly as
 * before; a UNC path whose SMB source has a login is signed in to first (smbSession.ts). `nyx://<sourceId>/<key>` paths go to the configured remote backend. Callers never
 * need to know which one they have.
 */

import { createReadStream as fsCreateReadStream, existsSync } from 'fs';
import { readdir, readFile as fsReadFile, stat as fsStat } from 'fs/promises';
import { basename as pBasename, dirname as pDirname, join as pJoin } from 'path';
import { posix } from 'path';
import type { Readable } from 'stream';
import { getSource, onSourceChanged } from './sources';
import { ensureSmbSession } from './smbSession';
import { isRemotePath, parseRemotePath, formatRemotePath } from './mediaUri';
import type { MediaDirEntry, MediaStat, ByteRange, StorageBackend, RemoteSourceConfig } from './types';

export { isRemotePath, parseRemotePath, formatRemotePath } from './mediaUri';
export type { MediaDirEntry, MediaStat } from './types';

// ---------------------------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------------------------

const backendsKey = Symbol.for('nyetflix-storage-backends');
function backendCache(): Map<string, StorageBackend> {
  const g = globalThis as unknown as Record<symbol, Map<string, StorageBackend>>;
  if (!g[backendsKey]) {
    g[backendsKey] = new Map();
    onSourceChanged((id) => {
      g[backendsKey]!.delete(id);
      clearStatCache(id);
    });
  }
  return g[backendsKey];
}

/**
 * Backends are imported on first use, so a library that only uses local folders never loads
 * the AWS SDK, the WebDAV client or ssh2.
 */
export async function createBackend(cfg: RemoteSourceConfig): Promise<StorageBackend> {
  switch (cfg.type) {
    case 's3':
      return (await import('./s3Backend')).createS3Backend(cfg);
    case 'webdav':
      return (await import('./webdavBackend')).createWebDavBackend(cfg);
    case 'sftp':
      return (await import('./sftpBackend')).createSftpBackend(cfg);
    case 'cloud': {
      const m = await import('./cloudBackends');
      if (cfg.provider === 'google') return m.createGoogleDriveBackend(cfg);
      if (cfg.provider === 'microsoft') return m.createOneDriveBackend(cfg);
      return m.createDropboxBackend(cfg);
    }
    case 'smb':
      // On Windows SMB sources are read as UNC paths and never get here.
      throw new Error(
        'Shared folders need Nyetflix running on Windows. On Linux, macOS or Docker, mount the share and add it as "Folder on this computer".',
      );
  }
}

async function resolveRemote(p: string): Promise<{ backend: StorageBackend; key: string; sourceId: string }> {
  const parsed = parseRemotePath(p);
  if (!parsed) throw new Error(`Invalid remote path: ${p}`);
  const cache = backendCache();
  let backend = cache.get(parsed.sourceId);
  if (!backend) {
    const cfg = getSource(parsed.sourceId);
    if (!cfg || cfg.type === 'local') throw new Error('This media source no longer exists. Check the profile\'s media sources.');
    backend = await createBackend(cfg);
    cache.set(parsed.sourceId, backend);
  }
  return { backend, key: parsed.key, sourceId: parsed.sourceId };
}

// ---------------------------------------------------------------------------------------------
// Stat cache. Playback sends a range request every few seconds and each would otherwise be a
// HEAD round-trip to the bucket; directory listings already tell us every file's size.
// ---------------------------------------------------------------------------------------------

const STAT_TTL_MS = 5 * 60 * 1000;
const statKey = Symbol.for('nyetflix-storage-stat-cache');
function statCache(): Map<string, { stat: MediaStat | null; at: number }> {
  const g = globalThis as unknown as Record<symbol, Map<string, { stat: MediaStat | null; at: number }>>;
  if (!g[statKey]) g[statKey] = new Map();
  return g[statKey];
}

function clearStatCache(sourceId: string): void {
  const prefix = formatRemotePath(sourceId, '');
  for (const k of statCache().keys()) if (k.startsWith(prefix)) statCache().delete(k);
}

function rememberStat(p: string, stat: MediaStat | null): void {
  const cache = statCache();
  if (cache.size > 20000) cache.clear();
  cache.set(p, { stat, at: Date.now() });
}

// ---------------------------------------------------------------------------------------------
// Path helpers that work for both kinds of path
// ---------------------------------------------------------------------------------------------

export function mediaJoin(dir: string, ...parts: string[]): string {
  if (!isRemotePath(dir)) return pJoin(dir, ...parts);
  const parsed = parseRemotePath(dir)!;
  return formatRemotePath(parsed.sourceId, posix.join(parsed.key || '.', ...parts));
}

export function mediaDirname(p: string): string {
  if (!isRemotePath(p)) return pDirname(p);
  const parsed = parseRemotePath(p)!;
  const dir = posix.dirname(parsed.key);
  return formatRemotePath(parsed.sourceId, dir === '.' ? '' : dir);
}

export function mediaBasename(p: string, ext?: string): string {
  if (!isRemotePath(p)) return pBasename(p, ext);
  return posix.basename(parseRemotePath(p)!.key, ext);
}

// ---------------------------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------------------------

/** Like `readdir(dir, { withFileTypes: true })`. Throws when the folder can't be read. */
export async function listDir(dir: string): Promise<MediaDirEntry[]> {
  if (!isRemotePath(dir)) {
    await ensureSmbSession(dir);
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isFile: () => e.isFile(), isDirectory: () => e.isDirectory() }));
  }
  const { backend, key } = await resolveRemote(dir);
  const entries = await backend.list(key);
  for (const e of entries) {
    if (e.isFile()) {
      rememberStat(mediaJoin(dir, e.name), {
        isFile: true,
        isDirectory: false,
        size: e.size ?? 0,
        mtimeMs: e.mtimeMs,
      });
    }
  }
  return entries;
}

/** `null` when the path does not exist or can't be reached. */
export async function mediaStat(p: string): Promise<MediaStat | null> {
  if (!isRemotePath(p)) {
    try {
      await ensureSmbSession(p);
      const st = await fsStat(p);
      return { isFile: st.isFile(), isDirectory: st.isDirectory(), size: st.size, mtimeMs: st.mtimeMs };
    } catch {
      return null;
    }
  }
  const hit = statCache().get(p);
  if (hit && Date.now() - hit.at < STAT_TTL_MS) return hit.stat;
  try {
    const { backend, key } = await resolveRemote(p);
    const st = await backend.stat(key);
    rememberStat(p, st);
    return st;
  } catch {
    return null;
  }
}

export async function mediaExists(p: string): Promise<boolean> {
  return (await mediaStat(p)) != null;
}

/**
 * Synchronous existence check for code paths that can't await. Remote paths are assumed to
 * exist (a missing object surfaces as a 404 when it is actually read).
 */
export function mediaExistsSync(p: string): boolean {
  return isRemotePath(p) || existsSync(p);
}

export async function readMediaFile(p: string): Promise<Buffer> {
  if (!isRemotePath(p)) {
    await ensureSmbSession(p);
    return fsReadFile(p);
  }
  const { backend, key } = await resolveRemote(p);
  return backend.readFile(key);
}

export async function openMediaStream(p: string, range?: ByteRange): Promise<Readable> {
  if (!isRemotePath(p)) {
    await ensureSmbSession(p);
    return range ? fsCreateReadStream(p, { start: range.start, end: range.end }) : fsCreateReadStream(p);
  }
  const { backend, key } = await resolveRemote(p);
  return backend.createReadStream(key, range);
}

/** What to pass to ffmpeg/ffprobe `-i`: the path itself, or a URL ffmpeg can stream from. */
export async function ffmpegInput(p: string): Promise<string> {
  if (!isRemotePath(p)) {
    await ensureSmbSession(p);
    return p;
  }
  const { backend, key } = await resolveRemote(p);
  return backend.inputUrl(key);
}

// ---------------------------------------------------------------------------------------------
// Where generated files go
// ---------------------------------------------------------------------------------------------

export const REMOTE_CACHE_DIR = pJoin(process.cwd(), 'data', 'remote-cache');

/** Folder names from a bucket can hold characters Windows won't accept. */
function safeSegment(seg: string): string {
  const cleaned = Array.from(seg, (ch) => (ch.charCodeAt(0) < 32 || '<>:"|?*'.includes(ch) ? '_' : ch))
    .join('')
    .replace(/[. ]+$/, '_');
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? '_' : cleaned;
}

/**
 * Local folder that holds files generated for a video: converted MP4 / HLS packages and
 * extracted subtitles. For a local video that is its own folder, as it always was. A remote
 * source can't be written to, so its outputs go to a mirrored folder under
 * data/remote-cache/<sourceId>/.
 */
export function writableDirFor(videoPath: string): string {
  if (!isRemotePath(videoPath)) return pDirname(videoPath);
  const parsed = parseRemotePath(videoPath)!;
  const dirSegments = parsed.key.split('/').slice(0, -1).map(safeSegment);
  return pJoin(REMOTE_CACHE_DIR, safeSegment(parsed.sourceId), ...dirSegments);
}
