import type { Readable } from 'stream';

/** Fields every source has. Sources belong to one profile; profiles never see each other's. */
interface SourceBase {
  id: string;
  name: string;
  profileId: number;
}

/**
 * A folder the Nyetflix machine can open directly: a local drive, an external disk, a mounted
 * NAS share, or another PC's shared folder (`\\OTHER-PC\Movies`).
 */
export interface LocalSourceConfig extends SourceBase {
  type: 'local';
  /**
   * Only changes how the UI labels it. `google` / `microsoft` / `dropbox`: the folder that
   * provider's desktop app keeps in sync on this computer. (`share` is a legacy value.)
   */
  variant?: 'folder' | 'share' | CloudProvider;
  path: string;
}

/**
 * S3 API — AWS S3 itself, plus everything that speaks it: MinIO, Google Cloud Storage
 * (interoperability / HMAC keys), Cloudflare R2, Backblaze B2, Wasabi, a NAS's S3 server.
 */
export interface S3SourceConfig extends SourceBase {
  type: 's3';
  /** Only used to pre-fill sensible defaults in the UI. */
  provider?: 'aws' | 'minio' | 'gcs' | 'r2' | 'b2' | 'wasabi' | 'other';
  /** Empty for AWS. e.g. `http://192.168.1.10:9000` for MinIO, `https://storage.googleapis.com` for GCS. */
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO and most self-hosted servers need path-style URLs (`host/bucket/key`). */
  forcePathStyle?: boolean;
  /** Library folder inside the bucket ('' = bucket root). */
  folder?: string;
}

/** WebDAV — Synology, QNAP, TrueNAS, Nextcloud, Apache/nginx, or any other WebDAV server. */
export interface WebDavSourceConfig extends SourceBase {
  type: 'webdav';
  /** Base URL of the share, e.g. `https://nas.local:5006/video`. */
  url: string;
  username?: string;
  password?: string;
  /** Library folder inside the share ('' = share root). */
  folder?: string;
}

/**
 * Another PC's (or a NAS's) Windows/SMB share. Without a username on a Windows server it is read
 * as a plain `\\host\share` path; with a login, Nyetflix signs in to the
 * share with Windows' own `net use` first, then reads it the same way.
 */
export interface SmbSourceConfig extends SourceBase {
  type: 'smb';
  host: string;
  share: string;
  username?: string;
  password?: string;
  domain?: string;
  /** Library folder inside the share ('' = share root). */
  folder?: string;
}

/** SSH file access: seedboxes, Linux servers, Raspberry Pis, most NAS boxes. */
export interface SftpSourceConfig extends SourceBase {
  type: 'sftp';
  host: string;
  port?: number;
  username: string;
  password?: string;
  /** Private key file on the Nyetflix machine, instead of (or as well as) a password. */
  keyFile?: string;
  /** Library folder on the server, e.g. `/mnt/media/Movies` or `downloads` (relative to home). */
  folder?: string;
}

export type CloudProvider = 'google' | 'microsoft' | 'dropbox';

/** OAuth tokens from "Sign in with …". Server-only; never sent to the browser. */
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** ms since epoch */
  expiresAt: number;
}

/** Google Drive, OneDrive or Dropbox, connected with the provider's own sign-in. */
export interface CloudSourceConfig extends SourceBase {
  type: 'cloud';
  provider: CloudProvider;
  /** Email or display name of the signed-in account, for display. */
  account: string;
  tokens: OAuthTokens;
  /** Library folder inside the drive ('' = top level). */
  folder?: string;
}

export type StorageSourceConfig =
  | LocalSourceConfig
  | S3SourceConfig
  | WebDavSourceConfig
  | SmbSourceConfig
  | SftpSourceConfig
  | CloudSourceConfig;
export type RemoteSourceConfig = Exclude<StorageSourceConfig, LocalSourceConfig>;
export type StorageSourceType = StorageSourceConfig['type'];

/** Directory entry, shaped like `fs.Dirent` so the scanners can treat both the same. */
export interface MediaDirEntry {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
  size?: number;
  mtimeMs?: number;
}

export interface MediaStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  /** Missing for "folders" on object storage, which have no timestamp of their own. */
  mtimeMs?: number;
}

export interface ByteRange {
  start: number;
  /** Inclusive. */
  end?: number;
}

/** What a remote backend has to provide. Keys are forward-slash paths without a leading slash. */
export interface StorageBackend {
  list(dirKey: string): Promise<MediaDirEntry[]>;
  /** `null` when nothing exists at the key. */
  stat(key: string): Promise<MediaStat | null>;
  createReadStream(key: string, range?: ByteRange): Promise<Readable>;
  readFile(key: string): Promise<Buffer>;
  /** A URL ffmpeg/ffprobe can open directly (presigned, or with credentials in it). */
  inputUrl(key: string): Promise<string>;
}
