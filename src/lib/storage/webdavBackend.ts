import { createClient, type FileStat } from 'webdav';
import { Readable } from 'stream';
import type { WebDavSourceConfig, StorageBackend, MediaDirEntry, MediaStat, ByteRange } from './types';

function toDavPath(key: string): string {
  return '/' + key.split('/').filter(Boolean).join('/');
}

function isNotFound(err: unknown): boolean {
  const e = err as { status?: number; response?: { status?: number } };
  return e?.status === 404 || e?.response?.status === 404;
}

function toStat(s: FileStat): MediaStat {
  const mtime = Date.parse(s.lastmod);
  return {
    isFile: s.type === 'file',
    isDirectory: s.type === 'directory',
    size: s.size ?? 0,
    mtimeMs: Number.isFinite(mtime) ? mtime : undefined,
  };
}

export function createWebDavBackend(cfg: WebDavSourceConfig): StorageBackend {
  const client = createClient(cfg.url, {
    username: cfg.username,
    password: cfg.password,
  });

  async function list(dirKey: string): Promise<MediaDirEntry[]> {
    const items = (await client.getDirectoryContents(toDavPath(dirKey))) as FileStat[];
    return items.map((s) => {
      const st = toStat(s);
      return {
        name: s.basename,
        size: st.size,
        mtimeMs: st.mtimeMs,
        isFile: () => st.isFile,
        isDirectory: () => st.isDirectory,
      };
    });
  }

  async function stat(key: string): Promise<MediaStat | null> {
    try {
      return toStat((await client.stat(toDavPath(key))) as FileStat);
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async function createReadStream(key: string, range?: ByteRange): Promise<Readable> {
    const stream = client.createReadStream(
      toDavPath(key),
      range ? { range: { start: range.start, end: range.end } } : undefined,
    );
    return stream as unknown as Readable;
  }

  async function readFile(key: string): Promise<Buffer> {
    const data = await client.getFileContents(toDavPath(key), { format: 'binary' });
    return Buffer.from(data as ArrayBuffer);
  }

  /** ffmpeg's http protocol understands basic auth in the URL (`http://user:pass@host/…`). */
  async function inputUrl(key: string): Promise<string> {
    const u = new URL(cfg.url);
    const basePath = u.pathname.replace(/\/+$/, '');
    u.pathname = basePath + toDavPath(key).split('/').map(encodeURIComponent).join('/');
    if (cfg.username) {
      u.username = encodeURIComponent(cfg.username);
      u.password = encodeURIComponent(cfg.password ?? '');
    }
    return u.toString();
  }

  return { list, stat, createReadStream, readFile, inputUrl };
}
