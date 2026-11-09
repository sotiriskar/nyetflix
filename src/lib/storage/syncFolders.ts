/**
 * Finds the folders the official Google Drive / OneDrive / Dropbox desktop apps keep on this
 * computer. Those apps do the sign-in (their own "Allow" pop-up) and show the cloud files as a
 * normal folder that downloads on demand, so Nyetflix can use it like any local folder without
 * any app registration or keys.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { CloudProvider } from './types';

export interface SyncFolderStatus {
  /** The app's root folder (e.g. `G:\My Drive`), or null when it isn't found. */
  folder: string | null;
  /** The app seems installed but its folder isn't there (not running / not signed in). */
  installed: boolean;
}

function isDir(p: string | undefined | null): p is string {
  if (!p) return false;
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function firstDir(...paths: (string | undefined | null)[]): string | null {
  for (const p of paths) if (isDir(p)) return p;
  return null;
}

/** `~/Library/CloudStorage/<prefix>*` on macOS (where all three apps live nowadays). */
function macCloudStorage(prefix: string): string[] {
  const base = join(homedir(), 'Library', 'CloudStorage');
  try {
    return readdirSync(base)
      .filter((n) => n.startsWith(prefix))
      .map((n) => join(base, n));
  } catch {
    return [];
  }
}

/**
 * Google Drive for desktop shows Drive as its own drive letter (G: by default). Its top
 * folder, "My Drive", is translated into the Windows language, so the drive is recognised by
 * the hidden `.shortcut-targets-by-id` folder it always has.
 */
function googleDrive(): SyncFolderStatus {
  const candidates: string[] = [];
  if (process.platform === 'win32') {
    for (let c = 'D'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
      const root = `${String.fromCharCode(c)}:\\`;
      if (isDir(join(root, 'My Drive'))) candidates.push(join(root, 'My Drive'));
      else if (isDir(join(root, '.shortcut-targets-by-id'))) candidates.push(root);
    }
    candidates.push(join(homedir(), 'My Drive'), join(homedir(), 'Google Drive'));
  } else if (process.platform === 'darwin') {
    for (const d of macCloudStorage('GoogleDrive-')) candidates.push(join(d, 'My Drive'), d);
    candidates.push('/Volumes/GoogleDrive/My Drive', join(homedir(), 'Google Drive'));
  } else {
    candidates.push(join(homedir(), 'Google Drive'));
  }
  const folder = firstDir(...candidates);
  const installed =
    !!folder ||
    (process.platform === 'win32' && isDir(join(process.env.LOCALAPPDATA ?? '', 'Google', 'DriveFS'))) ||
    (process.platform === 'darwin' && isDir(join(homedir(), 'Library', 'Application Support', 'Google', 'DriveFS')));
  return { folder, installed };
}

function oneDrive(): SyncFolderStatus {
  const folder = firstDir(
    process.env.OneDriveConsumer,
    process.env.OneDrive,
    process.env.OneDriveCommercial,
    ...(process.platform === 'darwin' ? macCloudStorage('OneDrive') : []),
    join(homedir(), 'OneDrive'),
  );
  return { folder, installed: !!folder || process.platform === 'win32' };
}

/** Dropbox writes its folder location to info.json. */
function dropbox(): SyncFolderStatus {
  const infoFiles =
    process.platform === 'win32'
      ? [join(process.env.APPDATA ?? '', 'Dropbox', 'info.json'), join(process.env.LOCALAPPDATA ?? '', 'Dropbox', 'info.json')]
      : [join(homedir(), '.dropbox', 'info.json')];
  const fromInfo: string[] = [];
  let installed = false;
  for (const f of infoFiles) {
    if (!existsSync(f)) continue;
    installed = true;
    try {
      const info = JSON.parse(readFileSync(f, 'utf-8')) as Record<string, { path?: string }>;
      for (const account of [info.personal, info.business]) if (account?.path) fromInfo.push(account.path);
    } catch {
      // unreadable: fall back to the usual places
    }
  }
  const folder = firstDir(
    ...fromInfo,
    ...(process.platform === 'darwin' ? macCloudStorage('Dropbox') : []),
    join(homedir(), 'Dropbox'),
  );
  return { folder, installed: installed || !!folder };
}

export function findSyncFolders(): Record<CloudProvider, SyncFolderStatus> {
  return { google: googleDrive(), microsoft: oneDrive(), dropbox: dropbox() };
}
