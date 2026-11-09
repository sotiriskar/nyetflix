/**
 * Google Drive, OneDrive and Dropbox, through their HTTP APIs. All three support HTTP Range on
 * downloads, so seeking works like any other source. Keys are forward-slash paths relative to
 * the drive's top level.
 */

import { Readable } from 'stream';
import type { ReadableStream as NodeWebStream } from 'stream/web';
import { posix } from 'path';
import type { ByteRange, CloudSourceConfig, MediaDirEntry, MediaStat, StorageBackend } from './types';
import { cloudFetch } from './oauth';

const CACHE_MS = 5 * 60 * 1000;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function ensureOk(res: Response, what: string): Promise<Response> {
  if (res.ok || res.status === 206) return res;
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 300);
  } catch {
    // ignore
  }
  throw new HttpError(res.status, `${what} failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
}

function toNodeStream(res: Response): Readable {
  if (!res.body) return Readable.from([]);
  return Readable.fromWeb(res.body as unknown as NodeWebStream<Uint8Array>);
}

function rangeHeader(range?: ByteRange): Record<string, string> {
  return range ? { Range: `bytes=${range.start}-${range.end ?? ''}` } : {};
}

function entry(name: string, dir: boolean, size?: number, mtimeMs?: number): MediaDirEntry {
  return { name, size, mtimeMs, isFile: () => !dir, isDirectory: () => dir };
}

function parseTime(v: unknown): number | undefined {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : undefined;
}

/** Shared small TTL cache. */
function ttlCache<V>() {
  const map = new Map<string, { v: V; at: number }>();
  return {
    get(k: string): V | undefined {
      const hit = map.get(k);
      if (hit && Date.now() - hit.at < CACHE_MS) return hit.v;
      map.delete(k);
      return undefined;
    },
    set(k: string, v: V) {
      if (map.size > 20000) map.clear();
      map.set(k, { v, at: Date.now() });
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Google Drive — files are addressed by id, so paths are resolved one folder at a time.
// ---------------------------------------------------------------------------------------------

const DRIVE = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
type DriveItem = { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string };

function driveQuoted(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function createGoogleDriveBackend(cfg: CloudSourceConfig): StorageBackend {
  const items = ttlCache<DriveItem | null>();
  const FIELDS = 'nextPageToken,files(id,name,mimeType,size,modifiedTime)';

  async function query(q: string, pageSize: number, pageToken?: string) {
    const params = new URLSearchParams({
      q,
      fields: FIELDS,
      pageSize: String(pageSize),
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await ensureOk(await cloudFetch(cfg, `${DRIVE}/files?${params}`), 'Google Drive listing');
    return (await res.json()) as { files?: DriveItem[]; nextPageToken?: string };
  }

  async function resolve(key: string): Promise<DriveItem | null> {
    if (!key) return { id: 'root', name: '', mimeType: FOLDER_MIME };
    const cached = items.get(key);
    if (cached !== undefined) return cached;
    const parent = await resolve(posix.dirname(key) === '.' ? '' : posix.dirname(key));
    let found: DriveItem | null = null;
    if (parent && parent.mimeType === FOLDER_MIME) {
      const name = posix.basename(key);
      const r = await query(`${driveQuoted(parent.id)} in parents and name = ${driveQuoted(name)} and trashed = false`, 10);
      found = r.files?.[0] ?? null;
    }
    items.set(key, found);
    return found;
  }

  function toStat(it: DriveItem): MediaStat {
    const dir = it.mimeType === FOLDER_MIME;
    return { isFile: !dir, isDirectory: dir, size: Number(it.size ?? 0), mtimeMs: parseTime(it.modifiedTime) };
  }

  async function fileOrThrow(key: string): Promise<DriveItem> {
    const it = await resolve(key);
    if (!it || it.mimeType === FOLDER_MIME) throw new HttpError(404, `Not found on Google Drive: ${key}`);
    return it;
  }

  return {
    async list(dirKey) {
      const dir = await resolve(dirKey);
      if (!dir || dir.mimeType !== FOLDER_MIME) throw new HttpError(404, `Folder not found on Google Drive: ${dirKey || '/'}`);
      const out: MediaDirEntry[] = [];
      let pageToken: string | undefined;
      do {
        const r = await query(`${driveQuoted(dir.id)} in parents and trashed = false`, 1000, pageToken);
        for (const it of r.files ?? []) {
          items.set(dirKey ? `${dirKey}/${it.name}` : it.name, it);
          const st = toStat(it);
          out.push(entry(it.name, st.isDirectory, st.size, st.mtimeMs));
        }
        pageToken = r.nextPageToken;
      } while (pageToken);
      return out;
    },
    async stat(key) {
      const it = await resolve(key);
      return it ? toStat(it) : null;
    },
    async createReadStream(key, range) {
      const it = await fileOrThrow(key);
      const res = await cloudFetch(cfg, `${DRIVE}/files/${encodeURIComponent(it.id)}?alt=media&supportsAllDrives=true`, {
        headers: rangeHeader(range),
      });
      return toNodeStream(await ensureOk(res, 'Google Drive download'));
    },
    async readFile(key) {
      const it = await fileOrThrow(key);
      const res = await cloudFetch(cfg, `${DRIVE}/files/${encodeURIComponent(it.id)}?alt=media&supportsAllDrives=true`);
      return Buffer.from(await (await ensureOk(res, 'Google Drive download')).arrayBuffer());
    },
    inputUrl: proxyInputUrl(cfg),
  };
}

// ---------------------------------------------------------------------------------------------
// OneDrive (Microsoft Graph) — addressable by path. Downloads go to a pre-signed URL.
// ---------------------------------------------------------------------------------------------

const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive';
type GraphItem = {
  name: string;
  size?: number;
  folder?: unknown;
  file?: unknown;
  lastModifiedDateTime?: string;
  '@microsoft.graph.downloadUrl'?: string;
};

function graphPath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

export function createOneDriveBackend(cfg: CloudSourceConfig): StorageBackend {
  const downloads = ttlCache<string>();

  function toStat(it: GraphItem): MediaStat {
    const dir = !!it.folder;
    return { isFile: !dir, isDirectory: dir, size: it.size ?? 0, mtimeMs: parseTime(it.lastModifiedDateTime) };
  }

  async function item(key: string): Promise<GraphItem | null> {
    const res = await cloudFetch(cfg, key ? `${GRAPH}/root:/${graphPath(key)}` : `${GRAPH}/root`);
    if (res.status === 404) return null;
    const it = (await (await ensureOk(res, 'OneDrive lookup')).json()) as GraphItem;
    if (it['@microsoft.graph.downloadUrl']) downloads.set(key, it['@microsoft.graph.downloadUrl']);
    return it;
  }

  /** Pre-signed download URLs last about an hour; refetch through the item when ours is old. */
  async function downloadUrl(key: string): Promise<string> {
    const cached = downloads.get(key);
    if (cached) return cached;
    const it = await item(key);
    const url = it?.['@microsoft.graph.downloadUrl'];
    if (!url) throw new HttpError(404, `Not found on OneDrive: ${key}`);
    return url;
  }

  async function download(key: string, range?: ByteRange): Promise<Response> {
    let res = await fetch(await downloadUrl(key), { headers: rangeHeader(range) });
    if (res.status === 401 || res.status === 403 || res.status === 410) {
      downloads.set(key, '');
      res = await fetch(await downloadUrl(key), { headers: rangeHeader(range) });
    }
    return ensureOk(res, 'OneDrive download');
  }

  return {
    async list(dirKey) {
      const out: MediaDirEntry[] = [];
      let url: string | undefined =
        (dirKey ? `${GRAPH}/root:/${graphPath(dirKey)}:/children` : `${GRAPH}/root/children`) + '?$top=1000';
      while (url) {
        const res = await cloudFetch(cfg, url);
        if (res.status === 404) throw new HttpError(404, `Folder not found on OneDrive: ${dirKey || '/'}`);
        const d = (await (await ensureOk(res, 'OneDrive listing')).json()) as { value?: GraphItem[]; '@odata.nextLink'?: string };
        for (const it of d.value ?? []) {
          const st = toStat(it);
          if (it['@microsoft.graph.downloadUrl']) downloads.set(dirKey ? `${dirKey}/${it.name}` : it.name, it['@microsoft.graph.downloadUrl']);
          out.push(entry(it.name, st.isDirectory, st.size, st.mtimeMs));
        }
        url = d['@odata.nextLink'];
      }
      return out;
    },
    async stat(key) {
      const it = await item(key);
      return it ? toStat(it) : null;
    },
    async createReadStream(key, range) {
      return toNodeStream(await download(key, range));
    },
    async readFile(key) {
      return Buffer.from(await (await download(key)).arrayBuffer());
    },
    inputUrl: proxyInputUrl(cfg),
  };
}

// ---------------------------------------------------------------------------------------------
// Dropbox
// ---------------------------------------------------------------------------------------------

const DBX_API = 'https://api.dropboxapi.com/2';
const DBX_CONTENT = 'https://content.dropboxapi.com/2';
type DbxEntry = { '.tag': 'file' | 'folder' | 'deleted'; name: string; size?: number; server_modified?: string };

/** Dropbox-API-Arg is an HTTP header, so non-ASCII characters must be escaped. */
function headerJson(v: unknown): string {
  return JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function dbxPath(key: string): string {
  return key ? `/${key}` : '';
}

export function createDropboxBackend(cfg: CloudSourceConfig): StorageBackend {
  async function rpc<T>(endpoint: string, body: unknown, what: string): Promise<T | null> {
    const res = await cloudFetch(cfg, `${DBX_API}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // 409 = "path/not_found" and friends.
    if (res.status === 409) {
      const text = await res.text();
      if (text.includes('not_found')) return null;
      throw new HttpError(409, `${what} failed: ${text.slice(0, 300)}`);
    }
    return (await (await ensureOk(res, what)).json()) as T;
  }

  function toStat(e: DbxEntry): MediaStat {
    const dir = e['.tag'] === 'folder';
    return { isFile: !dir, isDirectory: dir, size: e.size ?? 0, mtimeMs: parseTime(e.server_modified) };
  }

  async function download(key: string, range?: ByteRange): Promise<Response> {
    const res = await cloudFetch(cfg, `${DBX_CONTENT}/files/download`, {
      method: 'POST',
      headers: { 'Dropbox-API-Arg': headerJson({ path: dbxPath(key) }), ...rangeHeader(range) },
    });
    return ensureOk(res, 'Dropbox download');
  }

  return {
    async list(dirKey) {
      const out: MediaDirEntry[] = [];
      type Page = { entries: DbxEntry[]; cursor: string; has_more: boolean };
      let page = await rpc<Page>('files/list_folder', { path: dbxPath(dirKey), limit: 2000 }, 'Dropbox listing');
      if (!page) throw new HttpError(404, `Folder not found on Dropbox: ${dirKey || '/'}`);
      for (;;) {
        for (const e of page.entries) {
          if (e['.tag'] === 'deleted') continue;
          const st = toStat(e);
          out.push(entry(e.name, st.isDirectory, st.size, st.mtimeMs));
        }
        if (!page.has_more) break;
        const next: Page | null = await rpc<Page>('files/list_folder/continue', { cursor: page.cursor }, 'Dropbox listing');
        if (!next) break;
        page = next;
      }
      return out;
    },
    async stat(key) {
      if (!key) return { isFile: false, isDirectory: true, size: 0 };
      const e = await rpc<DbxEntry>('files/get_metadata', { path: dbxPath(key) }, 'Dropbox lookup');
      return e ? toStat(e) : null;
    },
    async createReadStream(key, range) {
      return toNodeStream(await download(key, range));
    },
    async readFile(key) {
      return Buffer.from(await (await download(key)).arrayBuffer());
    },
    inputUrl: proxyInputUrl(cfg),
  };
}

/** ffmpeg can't send these APIs' auth headers, so it reads through Nyetflix's loopback proxy. */
function proxyInputUrl(cfg: CloudSourceConfig): (key: string) => Promise<string> {
  return async (key) => (await import('./mediaProxy')).proxyUrlFor(cfg.id, key);
}
