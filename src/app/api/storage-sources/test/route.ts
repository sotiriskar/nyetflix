import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { getProfileSource, smbUncPath, sourceFromInput } from '@/lib/storage/sources';
import { createBackend, listDir } from '@/lib/storage';
import { connectSmbSource } from '@/lib/storage/smbSession';
import { normalizeRemoteKey } from '@/lib/storage/mediaUri';
import type { MediaDirEntry } from '@/lib/storage/types';
import { getProfileIdFromRequest } from '@/lib/profileIdFromRequest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_LISTED = 200;

function describeError(e: unknown): string {
  const err = e as {
    name?: string;
    code?: string;
    message?: string;
    status?: number;
    $metadata?: { httpStatusCode?: number };
  };
  // Windows reports an unreachable `\\PC\Share` as UNKNOWN / EHOSTUNREACH / ENOENT.
  if (/scandir '\\\\/.test(err.message ?? '') && err.code !== 'EACCES' && err.code !== 'EPERM') {
    return 'Couldn\'t reach the shared folder. Check the PC name (or use its IP address), that the folder is shared, that the PC is on, and that both PCs are on the same network.';
  }
  if (err.code === 'ENOENT') return 'Folder not found. Check the path, and that the drive or shared folder is reachable from this computer.';
  if (err.code === 'EACCES' || err.code === 'EPERM') return 'Access denied. For another PC\'s shared folder, open it once in File Explorer and sign in, then try again.';
  if (err.code === 'ENOTDIR') return 'That path is a file, not a folder.';
  const status = err.$metadata?.httpStatusCode ?? err.status;
  const hint =
    status === 403 || err.name === 'AccessDenied' || err.name === 'InvalidAccessKeyId' || err.name === 'SignatureDoesNotMatch'
      ? ' Check the access key / secret and that the key may list this bucket.'
      : status === 401
        ? ' Check the username and password.'
        : status === 404 || err.name === 'NoSuchBucket'
          ? ' The bucket or folder was not found.'
          : '';
  const detail = (err.message ?? String(e)).replace(/\.+$/, '');
  return `${err.name && err.name !== 'Error' ? `${err.name}: ` : ''}${detail}.${hint}`;
}

/**
 * POST { source, path? } — connects with the given settings (saved or not) and lists one
 * folder. The source form uses it for "Test connection" and to browse for the library folder.
 * For remote sources `path` is a folder inside the source; local sources list their own path.
 */
export async function POST(request: NextRequest) {
  const profileId = getProfileIdFromRequest(request);
  let body: { source?: Record<string, unknown>; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  let list: () => Promise<MediaDirEntry[]>;
  let path = '';
  try {
    const input = body.source ?? {};
    const existing = typeof input.id === 'string' && input.id ? getProfileSource(profileId, input.id) : undefined;
    const cfg = sourceFromInput(input, profileId, existing);
    const uncRoot = cfg.type === 'smb' ? smbUncPath({ ...cfg, folder: '' }) : null;
    if (cfg.type === 'local') {
      // `path` (optional) is a subfolder, used to browse inside a synced cloud folder.
      path = normalizeRemoteKey(typeof body.path === 'string' ? body.path : '');
      list = () => listDir(path ? join(cfg.path, ...path.split('/')) : cfg.path);
    } else if (uncRoot && cfg.type === 'smb') {
      await connectSmbSource(cfg);
      // A pasted `\\PC\Share\Folder` carries its folder in the parsed config.
      path = normalizeRemoteKey(typeof body.path === 'string' && body.path ? body.path : (cfg.type === 'smb' ? cfg.folder ?? '' : ''));
      list = () => listDir(path ? join(uncRoot, ...path.split('/')) : uncRoot);
    } else {
      path = normalizeRemoteKey(typeof body.path === 'string' ? body.path : '');
      const backend = await createBackend(cfg);
      list = () => backend.list(path);
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }

  try {
    const entries = await list();
    const folders = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
    const files = entries.filter((e) => e.isFile()).length;
    return NextResponse.json({
      ok: true,
      path,
      folders: folders.slice(0, MAX_LISTED),
      truncated: folders.length > MAX_LISTED,
      files,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: describeError(e) });
  }
}
