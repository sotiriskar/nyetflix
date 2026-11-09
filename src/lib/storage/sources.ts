/**
 * Media sources, persisted to data/storage-sources.json. Each source belongs to one profile,
 * and each profile picks one of its own sources as its library.
 *
 * Credentials live only on the server. The API hands the UI a masked copy, and a masked
 * value coming back from the UI means "keep what is stored".
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import type {
  StorageSourceConfig,
  LocalSourceConfig,
  S3SourceConfig,
  WebDavSourceConfig,
  SmbSourceConfig,
  SftpSourceConfig,
  CloudSourceConfig,
  CloudProvider,
  OAuthTokens,
} from './types';
import { peekSignIn } from './oauthPending';

const PROVIDER_NAMES: Record<CloudProvider, string> = {
  google: 'Google Drive',
  microsoft: 'OneDrive',
  dropbox: 'Dropbox',
};
import { formatRemotePath, normalizeRemoteKey } from './mediaUri';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'storage-sources.json');
const globalKey = Symbol.for('nyetflix-storage-sources');

export const SECRET_MASK = '••••••••';

type Store = { sources: StorageSourceConfig[] };

function load(): Store {
  try {
    if (!existsSync(FILE)) return { sources: [] };
    const raw = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<Store>;
    const sources = Array.isArray(raw.sources) ? raw.sources : [];
    // Sources from before they were per-profile have no owner; nothing can reach them.
    return { sources: sources.filter((s) => typeof s.profileId === 'number').map(upgradeLegacyShare) };
  } catch {
    return { sources: [] };
  }
}

/** "Another PC" used to be a local source holding a UNC path; it is an SMB source now. */
function upgradeLegacyShare(s: StorageSourceConfig): StorageSourceConfig {
  if (s.type !== 'local' || s.variant !== 'share') return s;
  const parts = parseUnc(s.path);
  if (!parts) return { ...s, variant: 'folder' };
  return { id: s.id, profileId: s.profileId, name: s.name, type: 'smb', ...parts };
}

/** `\\PC\Movies\Films` or `//PC/Movies/Films` -> host, share, folder. */
export function parseUnc(path: string): { host: string; share: string; folder: string } | null {
  const m = /^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)(?:[\\/]+(.*))?$/.exec(path.trim());
  if (!m) return null;
  return { host: m[1]!, share: m[2]!, folder: normalizeRemoteKey(m[3] ?? '') };
}

/**
 * On a Windows server an SMB share is opened as a plain UNC path, exactly like File Explorer
 * does. With a login, smbSession.ts signs in to the share (`net use`) before it is read.
 * Elsewhere there is no built-in SMB client, so this returns null.
 */
export function smbUncPath(s: SmbSourceConfig): string | null {
  if (process.platform !== 'win32') return null;
  const tail = [s.share, ...(s.folder ? s.folder.split('/') : [])].join('\\');
  return `\\\\${s.host}\\${tail}`;
}

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store>;
  if (!g[globalKey]) g[globalKey] = load();
  return g[globalKey];
}

function persist(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(store(), null, 2), 'utf-8');
}

/** Listeners (backend client caches) that need to drop state when a source changes. */
const changeListeners = new Set<(id: string) => void>();
export function onSourceChanged(cb: (id: string) => void): void {
  changeListeners.add(cb);
}

export function listSources(profileId: number): StorageSourceConfig[] {
  return store().sources.filter((s) => s.profileId === profileId).map((s) => ({ ...s }));
}

/** Every profile's sources (server-side lookups like the SMB sign-in). */
export function listAllSources(): StorageSourceConfig[] {
  return store().sources.map((s) => ({ ...s }));
}

/** Any profile's source, by id. Media paths (`nyx://<id>/…`) are resolved through this. */
export function getSource(id: string): StorageSourceConfig | undefined {
  const s = store().sources.find((x) => x.id === id);
  return s ? { ...s } : undefined;
}

export function getProfileSource(profileId: number, id: string): StorageSourceConfig | undefined {
  const s = getSource(id);
  return s && s.profileId === profileId ? s : undefined;
}

/** The folder a profile's library scan starts from. */
export function sourceLibraryPath(s: StorageSourceConfig): string {
  if (s.type === 'local') return s.path;
  if (s.type === 'smb') {
    const unc = smbUncPath(s);
    if (unc) return unc;
  }
  return formatRemotePath(s.id, s.folder ?? '');
}

/** Copy that is safe to send to the browser. Cloud tokens are left out entirely. */
export function maskSource(s: StorageSourceConfig): Record<string, unknown> {
  if (s.type === 's3') return { ...s, secretAccessKey: s.secretAccessKey ? SECRET_MASK : '' };
  if (s.type === 'webdav' || s.type === 'smb' || s.type === 'sftp') return { ...s, password: s.password ? SECRET_MASK : '' };
  if (s.type === 'cloud') {
    const { tokens: _tokens, ...rest } = s;
    void _tokens;
    return rest;
  }
  return { ...s };
}

/** Saves refreshed OAuth tokens without resetting backends the way a user edit does. */
export function updateSourceTokens(id: string, tokens: OAuthTokens): void {
  const s = store().sources.find((x) => x.id === id);
  if (!s || s.type !== 'cloud') return;
  s.tokens = tokens;
  persist();
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function newId(): string {
  return randomBytes(5).toString('hex');
}

/**
 * Validates untrusted input into a source config owned by `profileId`. `existing` supplies
 * secrets the UI sent back masked. Throws an Error with a user-facing message when something
 * required is missing.
 */
export function sourceFromInput(
  input: Record<string, unknown>,
  profileId: number,
  existing?: StorageSourceConfig,
): StorageSourceConfig {
  const id = existing?.id ?? newId();
  const type = input.type;
  const folder = normalizeRemoteKey(str(input.folder));

  if (type === 'local') {
    const path = str(input.path);
    if (!path) throw new Error('Enter the folder path');
    const synced = (['google', 'microsoft', 'dropbox'] as const).find((p) => p === input.variant);
    const cfg: LocalSourceConfig = {
      id,
      profileId,
      name: str(input.name) || 'Local folder',
      type: 'local',
      variant: synced ?? 'folder',
      path,
    };
    return cfg;
  }

  if (type === 'smb') {
    const prev = existing?.type === 'smb' ? existing : undefined;
    // Accept a pasted `\\PC\Share\Folder` in the host field.
    const unc = parseUnc(str(input.host));
    const host = unc?.host ?? str(input.host).replace(/^[\\/]+/, '');
    const share = unc?.share ?? str(input.share).replace(/^[\\/]+|[\\/]+$/g, '');
    if (!host) throw new Error('Enter the PC or NAS name (or its IP address)');
    if (!share) throw new Error('Enter the shared folder name');
    const passwordIn = typeof input.password === 'string' ? input.password : '';
    const cfg: SmbSourceConfig = {
      id,
      profileId,
      name: str(input.name) || host,
      type: 'smb',
      host,
      share,
      username: str(input.username) || undefined,
      password: (passwordIn === SECRET_MASK ? prev?.password : passwordIn) || undefined,
      domain: str(input.domain) || undefined,
      folder: unc ? unc.folder || folder : folder,
    };
    return cfg;
  }

  if (type === 'sftp') {
    const prev = existing?.type === 'sftp' ? existing : undefined;
    const host = str(input.host);
    const username = str(input.username);
    const port = Number(input.port) || 22;
    if (!host) throw new Error('Enter the server address');
    if (!username) throw new Error('Enter the username');
    if (port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535');
    const passwordIn = typeof input.password === 'string' ? input.password : '';
    const cfg: SftpSourceConfig = {
      id,
      profileId,
      name: str(input.name) || host,
      type: 'sftp',
      host,
      port,
      username,
      password: (passwordIn === SECRET_MASK ? prev?.password : passwordIn) || undefined,
      keyFile: str(input.keyFile) || undefined,
      // SFTP paths may be absolute (`/mnt/media`); keep the leading slash.
      folder: (str(input.folder).startsWith('/') ? '/' : '') + folder,
    };
    if (!cfg.password && !cfg.keyFile) throw new Error('Enter a password or a private key file');
    return cfg;
  }

  if (type === 'cloud') {
    const providers = ['google', 'microsoft', 'dropbox'] as const;
    const provider = providers.find((p) => p === input.provider);
    if (!provider) throw new Error('Unknown cloud provider');
    const prev = existing?.type === 'cloud' && existing.provider === provider ? existing : undefined;
    // A fresh sign-in wins; otherwise keep the account this source already had.
    const signIn = typeof input.oauthState === 'string' && input.oauthState
      ? peekSignIn(input.oauthState, profileId, provider)
      : undefined;
    const tokens = signIn?.tokens ?? prev?.tokens;
    const account = signIn?.account ?? prev?.account;
    if (!tokens || !account) throw new Error('Sign in first');
    const cfg: CloudSourceConfig = {
      id,
      profileId,
      name: str(input.name) || PROVIDER_NAMES[provider],
      type: 'cloud',
      provider,
      account,
      tokens,
      folder,
    };
    return cfg;
  }

  if (type === 's3') {
    const prev = existing?.type === 's3' ? existing : undefined;
    const secretIn = str(input.secretAccessKey);
    const endpoint = str(input.endpoint).replace(/\/+$/, '');
    if (endpoint && !/^https?:\/\//i.test(endpoint)) {
      throw new Error('Endpoint must start with http:// or https://');
    }
    const providers = ['aws', 'minio', 'gcs', 'r2', 'b2', 'wasabi', 'other'] as const;
    const provider = providers.find((p) => p === input.provider) ?? 'other';
    const cfg: S3SourceConfig = {
      id,
      profileId,
      name: str(input.name) || 'Cloud bucket',
      type: 's3',
      provider,
      endpoint: endpoint || undefined,
      region: str(input.region) || (provider === 'gcs' || provider === 'r2' ? 'auto' : 'us-east-1'),
      bucket: str(input.bucket),
      accessKeyId: str(input.accessKeyId),
      secretAccessKey: secretIn === SECRET_MASK ? (prev?.secretAccessKey ?? '') : secretIn,
      forcePathStyle: input.forcePathStyle === true,
      folder,
    };
    if (!cfg.bucket) throw new Error('Bucket is required');
    if (!cfg.accessKeyId || !cfg.secretAccessKey) throw new Error('Access key and secret key are required');
    return cfg;
  }

  if (type === 'webdav') {
    const prev = existing?.type === 'webdav' ? existing : undefined;
    const url = str(input.url).replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(url)) throw new Error('WebDAV URL must start with http:// or https://');
    const passwordIn = typeof input.password === 'string' ? input.password : '';
    const cfg: WebDavSourceConfig = {
      id,
      profileId,
      name: str(input.name) || 'NAS',
      type: 'webdav',
      url,
      username: str(input.username) || undefined,
      password: (passwordIn === SECRET_MASK ? prev?.password : passwordIn) || undefined,
      folder,
    };
    return cfg;
  }

  throw new Error('Unknown source type');
}

export function saveSource(cfg: StorageSourceConfig): StorageSourceConfig {
  const s = store();
  const i = s.sources.findIndex((x) => x.id === cfg.id);
  if (i >= 0) s.sources[i] = cfg;
  else s.sources.push(cfg);
  persist();
  changeListeners.forEach((cb) => cb(cfg.id));
  return { ...cfg };
}

export function deleteSource(profileId: number, id: string): boolean {
  const s = store();
  const before = s.sources.length;
  s.sources = s.sources.filter((x) => !(x.id === id && x.profileId === profileId));
  if (s.sources.length === before) return false;
  persist();
  changeListeners.forEach((cb) => cb(id));
  return true;
}

export function deleteSourcesForProfile(profileId: number): void {
  const s = store();
  const removed = s.sources.filter((x) => x.profileId === profileId);
  if (removed.length === 0) return;
  s.sources = s.sources.filter((x) => x.profileId !== profileId);
  persist();
  removed.forEach((r) => changeListeners.forEach((cb) => cb(r.id)));
}
