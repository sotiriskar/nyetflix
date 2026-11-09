/**
 * SMB shares that need a username/password, on Windows: before Nyetflix reads
 * `\\host\share\…`, it signs in to that share with Windows' own `net use` (for this Windows
 * session only, not persisted). After that every normal file API — and ffmpeg — can read it.
 */

import { execFile } from 'child_process';
import { listAllSources } from './sources';
import type { SmbSourceConfig } from './types';

const connected = new Map<string, Promise<void>>();

function shareOf(path: string): { host: string; share: string } | null {
  const m = /^\\\\([^\\/]+)\\([^\\/]+)/.exec(path);
  return m ? { host: m[1]!, share: m[2]! } : null;
}

function netUse(args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    execFile('net', ['use', ...args], { windowsHide: true, timeout: 30000 }, (err, stdout, stderr) => {
      const code = err && typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : err ? 1 : 0;
      resolve({ code, output: `${stdout}\n${stderr}` });
    });
  });
}

/** Signs in to the share holding `path` if a saved SMB source has a login for it. */
export async function ensureSmbSession(path: string): Promise<void> {
  if (process.platform !== 'win32' || !path.startsWith('\\\\')) return;
  const target = shareOf(path);
  if (!target) return;
  const source = listAllSources().find(
    (s) =>
      s.type === 'smb' &&
      !!s.username &&
      s.host.toLowerCase() === target.host.toLowerCase() &&
      s.share.toLowerCase() === target.share.toLowerCase(),
  );
  if (!source || source.type !== 'smb' || !source.username) return;
  await connectSmbSource(source);
}

/** Signs in to a source's share with its login (also for an unsaved source being tested). */
export async function connectSmbSource(source: SmbSourceConfig): Promise<void> {
  if (process.platform !== 'win32' || !source.username) return;
  const unc = `\\\\${source.host}\\${source.share}`;
  const cacheKey = `${unc.toLowerCase()}|${source.username}|${source.password ?? ''}`;
  let pending = connected.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const user = source.domain ? `${source.domain}\\${source.username}` : source.username!;
      const r = await netUse([unc, source.password ?? '', `/user:${user}`, '/persistent:no']);
      if (r.code === 0) return;
      // 1219: this PC is already connected to that server with other credentials. If the
      // existing connection can read the share, that is good enough.
      if (/\b1219\b/.test(r.output)) return;
      if (/\b(1326|86)\b/.test(r.output)) throw new Error('Windows rejected the username or password for this shared folder.');
      if (/\b(53|67)\b/.test(r.output)) throw new Error(`Couldn't find ${unc}. Check the PC name and share name.`);
      throw new Error(`Couldn't sign in to ${unc}: ${r.output.trim().split(/\r?\n/).filter(Boolean).pop() ?? 'net use failed'}`);
    })();
    connected.set(cacheKey, pending);
    pending.catch(() => connected.delete(cacheKey));
  }
  await pending;
}
