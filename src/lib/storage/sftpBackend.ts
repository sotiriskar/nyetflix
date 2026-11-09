/**
 * SFTP through the `ssh2` library (pure JavaScript). One SSH connection per source is kept open
 * and reopened on demand if it drops.
 */

import { readFileSync } from 'fs';
import { Client, type SFTPWrapper, type Stats } from 'ssh2';
import type { Readable } from 'stream';
import type { ByteRange, MediaDirEntry, MediaStat, SftpSourceConfig, StorageBackend } from './types';

const S_IFMT = 0o170000;
const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const S_IFLNK = 0o120000;

function kind(mode: number): 'dir' | 'file' | 'link' | 'other' {
  const t = mode & S_IFMT;
  if (t === S_IFDIR) return 'dir';
  if (t === S_IFREG) return 'file';
  if (t === S_IFLNK) return 'link';
  return 'other';
}

function toStat(attrs: Stats): MediaStat {
  const k = kind(attrs.mode);
  return { isFile: k === 'file', isDirectory: k === 'dir', size: attrs.size, mtimeMs: attrs.mtime * 1000 };
}

function sftpError(err: unknown): Error {
  const e = err as { code?: number | string; message?: string; level?: string };
  // ssh2 SFTP status codes: 2 = no such file, 3 = permission denied.
  if (e?.code === 2) return Object.assign(new Error('Not found on the SFTP server'), { code: 'ENOENT' });
  if (e?.code === 3) return Object.assign(new Error('Permission denied on the SFTP server'), { code: 'EACCES' });
  if (e?.level === 'client-authentication') return new Error('SFTP login failed. Check the username, password or key file.');
  if (e?.level === 'client-timeout') return new Error('Timed out connecting to the SFTP server.');
  return err instanceof Error ? err : new Error(String(err));
}

export function createSftpBackend(cfg: SftpSourceConfig): StorageBackend {
  // Absolute library folder (`/mnt/media`) means keys are relative to `/`; otherwise to home.
  const absolute = !!cfg.folder?.startsWith('/');
  const remote = (key: string) => (absolute ? '/' + key : key || '.');
  let session: Promise<SFTPWrapper> | null = null;

  function connect(): Promise<SFTPWrapper> {
    if (session) return session;
    session = new Promise<SFTPWrapper>((resolve, reject) => {
      const client = new Client();
      const drop = () => {
        session = null;
      };
      client
        .on('ready', () => {
          client.sftp((err, sftp) => {
            if (err) {
              client.end();
              reject(sftpError(err));
              return;
            }
            resolve(sftp);
          });
        })
        .on('error', (err) => {
          drop();
          reject(sftpError(err));
        })
        .on('close', drop)
        .on('end', drop);
      try {
        client.connect({
          host: cfg.host,
          port: cfg.port || 22,
          username: cfg.username,
          password: cfg.password,
          privateKey: cfg.keyFile ? readFileSync(cfg.keyFile) : undefined,
          readyTimeout: 20000,
          keepaliveInterval: 15000,
        });
      } catch (e) {
        drop();
        reject(sftpError(e));
      }
    });
    session.catch(() => {
      session = null;
    });
    return session;
  }

  const call = <T>(fn: (sftp: SFTPWrapper, done: (err: unknown, v?: T) => void) => void): Promise<T> =>
    connect().then(
      (sftp) =>
        new Promise<T>((resolve, reject) => fn(sftp, (err, v) => (err ? reject(sftpError(err)) : resolve(v as T)))),
    );

  async function stat(key: string): Promise<MediaStat | null> {
    try {
      // stat() follows symlinks, which seedboxes use a lot.
      return toStat(await call<Stats>((s, done) => s.stat(remote(key), done)));
    } catch (e) {
      if ((e as { code?: string }).code === 'ENOENT') return null;
      throw e;
    }
  }

  return {
    async list(dirKey) {
      const items = await call<{ filename: string; attrs: Stats }[]>((s, done) => s.readdir(remote(dirKey), done));
      const out: MediaDirEntry[] = [];
      for (const it of items) {
        if (it.filename === '.' || it.filename === '..') continue;
        let st = toStat(it.attrs);
        if (kind(it.attrs.mode) === 'link') {
          const target = await stat(dirKey ? `${dirKey}/${it.filename}` : it.filename).catch(() => null);
          if (!target) continue;
          st = target;
        }
        out.push({ name: it.filename, size: st.size, mtimeMs: st.mtimeMs, isFile: () => st.isFile, isDirectory: () => st.isDirectory });
      }
      return out;
    },
    stat,
    async createReadStream(key: string, range?: ByteRange): Promise<Readable> {
      const sftp = await connect();
      return sftp.createReadStream(remote(key), range ? { start: range.start, end: range.end } : {});
    },
    async readFile(key) {
      return call<Buffer>((s, done) => s.readFile(remote(key), done));
    },
    async inputUrl(key) {
      return (await import('./mediaProxy')).proxyUrlFor(cfg.id, key);
    },
  };
}
