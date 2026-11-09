/** Shapes the settings UI works with (secrets arrive masked). No server imports. */

/** r2 / b2 / wasabi are older presets; they now show as "Other S3-compatible". */
export type S3Provider = 'aws' | 'minio' | 'gcs' | 'r2' | 'b2' | 'wasabi' | 'other';
export type CloudProvider = 'google' | 'microsoft' | 'dropbox';

export interface StorageSourceView {
  id: string;
  name: string;
  type: 'local' | 'smb' | 'sftp' | 'cloud' | 's3' | 'webdav';
  /** Local */
  /** `google` / `microsoft` / `dropbox`: that provider's desktop-app folder on this computer. */
  variant?: 'folder' | 'share' | CloudProvider;
  path?: string;
  /** Library folder inside a remote source. */
  folder?: string;
  /** S3 preset, or the cloud drive's provider. */
  provider?: S3Provider | CloudProvider;
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  /** WebDAV */
  url?: string;
  /** WebDAV / SMB / SFTP */
  username?: string;
  password?: string;
  /** SMB / SFTP */
  host?: string;
  /** SMB */
  share?: string;
  domain?: string;
  /** SFTP */
  port?: number;
  keyFile?: string;
  /** Cloud: signed-in account, and the sign-in to attach when saving. */
  account?: string;
  oauthState?: string;
}

export interface BrowseResult {
  ok: boolean;
  error?: string;
  path?: string;
  folders?: string[];
  truncated?: boolean;
  files?: number;
}

/** GET /api/oauth/providers */
export type CloudProvidersStatus = Record<CloudProvider, { configured: boolean; env: string }>;

export const S3_PROVIDERS: {
  value: 'aws' | 'minio' | 'gcs' | 'other';
  label: string;
  endpoint: string;
  region: string;
  pathStyle: boolean;
  help: string;
}[] = [
  {
    value: 'aws',
    label: 'Amazon S3',
    endpoint: '',
    region: 'us-east-1',
    pathStyle: false,
    help: 'Use an IAM key that can s3:ListBucket and s3:GetObject on the bucket.',
  },
  {
    value: 'minio',
    label: 'MinIO',
    endpoint: 'http://192.168.1.10:9000',
    region: 'us-east-1',
    pathStyle: true,
    help: 'Use the MinIO API port (usually 9000, not the 9001 console). Path-style stays on.',
  },
  {
    value: 'gcs',
    label: 'Google Cloud Storage',
    endpoint: 'https://storage.googleapis.com',
    region: 'auto',
    pathStyle: true,
    help: 'Create an HMAC key in Cloud Storage → Settings → Interoperability and use its access ID and secret.',
  },
  {
    value: 'other',
    label: 'Other S3-compatible',
    endpoint: 'https://s3.example.com',
    region: 'us-east-1',
    pathStyle: true,
    help:
      'Cloudflare R2 (https://<account-id>.r2.cloudflarestorage.com, region auto), Backblaze B2 (https://s3.<region>.backblazeb2.com), ' +
      'Wasabi (https://s3.<region>.wasabisys.com), or any server that speaks the S3 API.',
  },
];

/** Every choice in the source form's Type menu, in display order. */
export type SourceKind = 'local' | 'smb' | CloudProvider | 'webdav' | 'sftp' | 'aws' | 'minio' | 'gcs' | 'other';

export const SOURCE_KINDS: SourceKind[] = [
  'local',
  'smb',
  'google',
  'microsoft',
  'dropbox',
  'webdav',
  'sftp',
  'aws',
  'minio',
  'gcs',
  'other',
];

export const CLOUD_PROVIDERS: CloudProvider[] = ['google', 'microsoft', 'dropbox'];

export function isCloudKind(kind: SourceKind): kind is CloudProvider {
  return (CLOUD_PROVIDERS as string[]).includes(kind);
}

export function kindOf(s: StorageSourceView): SourceKind {
  if (s.type === 'local') return s.variant && isCloudKind(s.variant as SourceKind) ? (s.variant as CloudProvider) : 'local';
  if (s.type === 'smb') return 'smb';
  if (s.type === 'sftp') return 'sftp';
  if (s.type === 'cloud') return (s.provider as CloudProvider) ?? 'google';
  if (s.type === 'webdav') return 'webdav';
  return S3_PROVIDERS.some((p) => p.value === s.provider) ? (s.provider as SourceKind) : 'other';
}

export function kindLabel(kind: SourceKind): string {
  switch (kind) {
    case 'local':
      return 'Folder on this computer';
    case 'smb':
      return 'Another PC (shared folder)';
    case 'google':
      return 'Google Drive';
    case 'microsoft':
      return 'OneDrive';
    case 'dropbox':
      return 'Dropbox';
    case 'webdav':
      return 'NAS (WebDAV)';
    case 'sftp':
      return 'SFTP / seedbox';
    default:
      return S3_PROVIDERS.find((p) => p.value === kind)?.label ?? 'S3';
  }
}

export function describeSource(s: StorageSourceView): string {
  const kind = kindLabel(kindOf(s));
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join('/');
  switch (s.type) {
    case 'local':
      return `${kind} · ${s.path ?? ''}`;
    case 'smb':
      return `${kind} · \\\\${s.host ?? ''}\\${join(s.share, s.folder).replace(/\//g, '\\')}`;
    case 'sftp':
      return `${kind} · ${s.username ?? ''}@${s.host ?? ''}${s.folder ? `:${s.folder}` : ''}`;
    case 'cloud':
      return `${kind} · ${s.account ?? ''}${s.folder ? ` · ${s.folder}` : ''}`;
    case 'webdav':
      return `${kind} · ${join(s.url, s.folder)}`;
    default:
      return `${kind} · ${join(s.bucket, s.folder)}`;
  }
}
