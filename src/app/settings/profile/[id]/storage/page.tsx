'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArrowBack from '@mui/icons-material/ArrowBack';
import CloudOutlined from '@mui/icons-material/CloudOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import ComputerOutlined from '@mui/icons-material/ComputerOutlined';
import TerminalOutlined from '@mui/icons-material/TerminalOutlined';
import { useProfile } from '@/context/ProfileContext';
import { useSettings } from '@/context/SettingsContext';
import {
  S3_PROVIDERS,
  SOURCE_KINDS,
  describeSource,
  isCloudKind,
  kindLabel,
  kindOf,
  type CloudProvider,
  type CloudProvidersStatus,
  type SourceKind,
  type StorageSourceView,
} from '@/lib/storage/clientTypes';
import { RemoteFolderBrowser, browseRemote } from '@/components/RemoteFolderBrowser';

const INPUT =
  'w-full px-3 py-2 rounded border border-white/20 bg-white/5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/30';
const BUTTON =
  'px-4 py-2 rounded border border-white/30 text-white text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50 disabled:pointer-events-none';
const PRIMARY =
  'px-4 py-2 rounded bg-[#e50914] text-white text-sm font-medium hover:bg-[#f6121d] disabled:opacity-50 disabled:pointer-events-none';

function blankSource(kind: SourceKind): StorageSourceView {
  switch (kind) {
    case 'local':
      return { id: '', name: 'My movies', type: 'local', variant: 'folder', path: '' };
    case 'smb':
      return { id: '', name: 'Other PC', type: 'smb', host: '', share: '', username: '', password: '', folder: '' };
    case 'google':
    case 'microsoft':
    case 'dropbox':
      return { id: '', name: kindLabel(kind), type: 'cloud', provider: kind, folder: '' };
    case 'webdav':
      return { id: '', name: 'NAS', type: 'webdav', url: '', username: '', password: '', folder: '' };
    case 'sftp':
      return { id: '', name: 'Seedbox', type: 'sftp', host: '', port: 22, username: '', password: '', keyFile: '', folder: '' };
    default: {
      const p = S3_PROVIDERS.find((x) => x.value === kind)!;
      return {
        id: '',
        name: p.label,
        type: 's3',
        provider: p.value,
        endpoint: '',
        region: p.region,
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: p.pathStyle,
        folder: '',
      };
    }
  }
}

/** Names Nyetflix gives a source on its own; anything else was typed by the user and is kept. */
const DEFAULT_NAMES = new Set([
  ...SOURCE_KINDS.map((k) => blankSource(k).name),
  'Local folder',
  'Shared folder',
  'Cloud bucket',
  'Cloudflare R2',
  'Backblaze B2',
  'Wasabi',
]);

/**
 * Changes an existing (or new) source's type. It keeps its id, so a source in use stays the
 * profile's library, and carries over whatever still applies to the new type.
 */
function switchKind(prev: StorageSourceView, kind: SourceKind): StorageSourceView {
  const next = blankSource(kind);
  next.id = prev.id;
  if (!DEFAULT_NAMES.has(prev.name.trim())) next.name = prev.name;
  if (prev.type === 's3' && next.type === 's3') {
    next.bucket = prev.bucket;
    next.accessKeyId = prev.accessKeyId;
    next.secretAccessKey = prev.secretAccessKey;
  }
  // Host and login mean the same thing for SMB and SFTP (same machine, often).
  if ((prev.type === 'smb' || prev.type === 'sftp') && (next.type === 'smb' || next.type === 'sftp')) {
    next.host = prev.host;
    next.username = prev.username;
  }
  if (prev.type !== 'local' && next.type !== 'local') next.folder = prev.folder;
  return next;
}

function SourceIcon({ s }: { s: StorageSourceView }) {
  const sx = { fontSize: 24, color: 'rgba(255,255,255,0.6)' };
  if (s.type === 'local') return isCloudKind(kindOf(s)) ? <CloudOutlined sx={sx} /> : <FolderOutlined sx={sx} />;
  if (s.type === 'smb') return <ComputerOutlined sx={sx} />;
  if (s.type === 'sftp') return <TerminalOutlined sx={sx} />;
  if (s.type === 'webdav') return <StorageOutlined sx={sx} />;
  return <CloudOutlined sx={sx} />;
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-white/70 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-white/40 mt-1">{hint}</span>}
    </label>
  );
}

function SecretField({
  label,
  value,
  saved,
  onChange,
}: {
  label: string;
  value: string;
  saved: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} hint={saved ? 'Leave as is to keep the saved one.' : undefined}>
      <input
        className={INPUT}
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

const SIGN_IN_BRAND: Record<CloudProvider, string> = { google: 'Google', microsoft: 'Microsoft', dropbox: 'Dropbox' };

/** GET /api/storage-sources/sync-folders */
interface SyncFolders {
  sep: string;
  providers: Record<CloudProvider, { signIn: boolean; folder: string | null; installed: boolean }>;
}

const DESKTOP_APP: Record<CloudProvider, { name: string; url: string }> = {
  google: { name: 'Google Drive for desktop', url: 'https://www.google.com/drive/download/' },
  microsoft: { name: 'OneDrive', url: 'https://www.microsoft.com/microsoft-365/onedrive/download' },
  dropbox: { name: 'Dropbox', url: 'https://www.dropbox.com/install' },
};

/** A Google Drive / OneDrive / Dropbox source that reads the provider's desktop-app folder. */
function syncedSource(prev: StorageSourceView, provider: CloudProvider, folder: string | null): StorageSourceView {
  const next = switchKind(prev, 'local');
  if (DEFAULT_NAMES.has(next.name.trim())) next.name = kindLabel(provider);
  return { ...next, variant: provider, path: folder ?? '' };
}

/**
 * Google Drive / OneDrive / Dropbox through their desktop apps: the app signs in (its own
 * "Allow" pop-up) and keeps the files in a folder here, which streams them on demand.
 */
function SyncedFolder({
  profileId,
  provider,
  status,
  sep,
  path,
  onChange,
  onRecheck,
  checking,
}: {
  profileId: number;
  provider: CloudProvider;
  status?: { folder: string | null; installed: boolean };
  sep: string;
  path: string;
  onChange: (path: string) => void;
  onRecheck: () => void;
  checking: boolean;
}) {
  const [browsing, setBrowsing] = useState(false);
  const [manual, setManual] = useState(false);
  const app = DESKTOP_APP[provider];
  const label = kindLabel(provider);
  const root = status?.folder ?? null;
  const browseSource = useMemo<StorageSourceView>(() => ({ id: '', name: label, type: 'local', path: root ?? '' }), [label, root]);
  const inRoot = !!root && (path === root || path.toLowerCase().startsWith((root.replace(/[\\/]+$/, '') + sep).toLowerCase()));
  const sub = inRoot ? path.slice(root!.replace(/[\\/]+$/, '').length).replace(/^[\\/]+/, '').split(sep).filter(Boolean).join('/') : '';
  const setSub = (value: string) => {
    const parts = value.split('/').filter(Boolean);
    onChange(parts.length ? [root!.replace(/[\\/]+$/, ''), ...parts].join(sep) : root!);
  };

  if (!root || manual || (path && !inRoot)) {
    return (
      <div className="space-y-3">
        {!root && (
          <div className="rounded border border-white/15 bg-white/5 p-4 text-sm text-white/80 space-y-3">
            <p className="font-medium text-white">
              {status?.installed ? `Open ${app.name} and sign in` : `Connect ${label} in 3 steps`}
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-white/70">
              <li>
                {status?.installed ? (
                  <>{app.name} is installed on this computer, but its folder isn&apos;t showing yet.</>
                ) : (
                  <>
                    Install{' '}
                    <a href={app.url} target="_blank" rel="noreferrer" className="text-white underline">
                      {app.name}
                    </a>{' '}
                    on this computer.
                  </>
                )}
              </li>
              <li>Open it and sign in to your {SIGN_IN_BRAND[provider]} account (click Allow).</li>
              <li>Come back here and click Check again.</li>
            </ol>
            <div className="flex flex-wrap gap-3">
              {!status?.installed && (
                <a href={app.url} target="_blank" rel="noreferrer" className={PRIMARY}>
                  Get {app.name}
                </a>
              )}
              <button type="button" className={BUTTON} onClick={onRecheck} disabled={checking}>
                {checking ? 'Checking…' : 'Check again'}
              </button>
            </div>
          </div>
        )}
        {(root || manual || path) ? (
          <Field label="Folder" hint={`Where ${app.name} keeps your ${label} files on this computer.`}>
            <input className={INPUT} value={path} placeholder={root ?? 'G:\\My Drive\\Movies'} onChange={(e) => onChange(e.target.value)} />
          </Field>
        ) : (
          <button type="button" className="text-xs text-white/50 underline hover:text-white" onClick={() => setManual(true)}>
            The folder is somewhere else? Enter it yourself
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-white/70">
        <span className="text-green-400">✓</span> Found your {label} folder at <span className="text-white">{root}</span>. {app.name} keeps
        it signed in, and videos are fetched from {label} as you watch.
      </p>
      <Field label="Library folder" hint={`Folder in your ${label} that holds your movies and series. Empty = all of it.`}>
        <div className="flex gap-2">
          <input className={INPUT} value={sub} placeholder="Movies" onChange={(e) => setSub(e.target.value)} />
          <button type="button" className={BUTTON} onClick={() => setBrowsing((b) => !b)}>
            {browsing ? 'Hide' : 'Browse'}
          </button>
        </div>
      </Field>
      {browsing && (
        <RemoteFolderBrowser profileId={profileId} source={browseSource} value={sub} onChange={setSub} />
      )}
    </div>
  );
}

/**
 * "Sign in with Google / Microsoft / Dropbox". Opens the provider's sign-in in a popup, then
 * polls the server for the result by its `state` (Google's pages cut the popup off from this
 * window, so neither a message from the popup nor reading its URL can be relied on).
 */
function CloudSignIn({
  profileId,
  provider,
  account,
  onSignedIn,
}: {
  profileId: number;
  provider: CloudProvider;
  account?: string;
  onSignedIn: (account: string, oauthState: string) => void;
}) {
  const [providers, setProviders] = useState<CloudProvidersStatus | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = kindLabel(provider);
  const onLocalhost =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  useEffect(() => {
    fetch('/api/oauth/providers')
      .then((r) => r.json())
      .then((d: CloudProvidersStatus) => setProviders(d))
      .catch(() => setProviders(null));
  }, []);

  const timerRef = useRef<number | null>(null);
  const stopWaiting = useCallback(() => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setWaiting(false);
  }, []);
  useEffect(() => stopWaiting, [stopWaiting]);

  const signIn = async () => {
    setError(null);
    // Open the window during the click (pop-up blockers allow that), then point it at the provider.
    const popup = window.open('about:blank', 'nyetflix-sign-in', 'width=520,height=720');
    if (!popup) {
      setError('Your browser blocked the sign-in window. Allow pop-ups for Nyetflix and try again.');
      return;
    }
    let started: { url?: string; state?: string; error?: string };
    try {
      started = await fetch(`/api/oauth/start?provider=${provider}&profileId=${profileId}&json=1`).then((r) => r.json());
    } catch {
      started = { error: 'Could not reach Nyetflix.' };
    }
    if (!started.url || !started.state) {
      popup.close();
      setError(started.error ?? 'Could not start sign-in.');
      return;
    }
    popup.location.href = started.url;
    const state = started.state;
    setWaiting(true);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(async () => {
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        stopWaiting();
        return;
      }
      try {
        const r = (await fetch(`/api/oauth/result?state=${encodeURIComponent(state)}`, {
          headers: { 'X-Profile-Id': String(profileId) },
        }).then((x) => x.json())) as { status: string; account?: string; error?: string };
        if (r.status === 'done' && r.account) {
          stopWaiting();
          onSignedIn(r.account, state);
        } else if (r.status === 'error') {
          stopWaiting();
          setError(r.error ?? 'Sign-in failed');
        }
      } catch {
        // try again on the next tick
      }
    }, 1000);
  };

  if (!providers) return <p className="text-xs text-white/40">Loading…</p>;
  const cfg = providers[provider];
  if (!cfg.configured) {
    return (
      <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100/90">
        Signing in to {label} directly needs an app registration in .env.local. Pick the type again to use the {label} app&apos;s
        folder instead.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {account && <span className="text-sm text-white">Signed in as <span className="font-medium">{account}</span></span>}
        <button type="button" className={account ? BUTTON : PRIMARY} onClick={() => void signIn()} disabled={waiting || !onLocalhost}>
          {waiting ? 'Waiting for sign-in…' : account ? 'Use a different account' : `Sign in with ${SIGN_IN_BRAND[provider]}`}
        </button>
        {waiting && (
          <button type="button" className={BUTTON} onClick={stopWaiting}>
            Cancel
          </button>
        )}
      </div>
      {!onLocalhost && (
        <p className="text-xs text-white/50">
          Connect accounts from a browser on the computer that runs Nyetflix (open http://localhost:{window.location.port || '3000'} there).
          {label} only returns to &quot;localhost&quot; after sign-in. Once connected, it streams to every device.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function SourceForm({
  profileId,
  initial,
  onSaved,
  onCancel,
}: {
  profileId: number;
  initial: StorageSourceView;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [s, setS] = useState<StorageSourceView>(initial);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<StorageSourceView>) => setS((prev) => ({ ...prev, ...patch }));
  const kind = kindOf(s);
  const provider = S3_PROVIDERS.find((p) => p.value === kind) ?? S3_PROVIDERS[S3_PROVIDERS.length - 1]!;
  const saved = !!s.id;
  const [sync, setSync] = useState<SyncFolders | null>(null);
  const [checking, setChecking] = useState(false);

  const loadSync = useCallback(async () => {
    setChecking(true);
    try {
      const d = (await fetch('/api/storage-sources/sync-folders').then((r) => r.json())) as SyncFolders;
      setSync(d);
      // Fill in the folder the desktop app just showed up with.
      setS((prev) =>
        prev.type === 'local' && prev.variant && isCloudKind(prev.variant as SourceKind) && !prev.path
          ? { ...prev, path: d.providers[prev.variant as CloudProvider].folder ?? '' }
          : prev,
      );
    } catch {
      // keep what we had
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void loadSync();
  }, [loadSync]);

  /** Google Drive / OneDrive / Dropbox sign in directly when set up in .env.local, else use the desktop app's folder. */
  const chooseKind = (k: SourceKind) => {
    if (isCloudKind(k) && !sync?.providers[k].signIn) setS(syncedSource(s, k, sync?.providers[k].folder ?? null));
    else setS(switchKind(s, k));
  };

  /** The source as sent to the server: a synced folder left at "all of it" means the app's root folder. */
  const ready = (): StorageSourceView =>
    s.type === 'local' && isCloudKind(kind) && !s.path ? { ...s, path: sync?.providers[kind].folder ?? '' } : s;

  const test = async () => {
    setTesting(true);
    setMessage(null);
    const r = await browseRemote(profileId, ready(), s.folder ?? '');
    setMessage(
      r.ok
        ? { ok: true, text: `Connected. ${r.folders?.length ?? 0} folder(s) and ${r.files ?? 0} file(s) in the library folder.` }
        : { ok: false, text: r.error ?? 'Connection failed' },
    );
    setTesting(false);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/storage-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(profileId) },
        body: JSON.stringify(ready()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      onSaved();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  // A cloud drive can't be browsed, tested or saved until an account is connected.
  const needsSignIn = s.type === 'cloud' && !s.account;

  return (
    <div className="rounded-xl border border-white/10 bg-[#181818] p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <select
            className={INPUT}
            value={kind}
            onChange={(e) => {
              chooseKind(e.target.value as SourceKind);
              setBrowsing(false);
              setMessage(null);
            }}
          >
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k} className="bg-[#181818]">{kindLabel(k)}</option>
            ))}
          </select>
        </Field>
        <Field label="Name">
          <input className={INPUT} value={s.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
      </div>

      {s.type === 'local' && isCloudKind(kind) && (
        <SyncedFolder
          key={kind}
          profileId={profileId}
          provider={kind}
          status={sync?.providers[kind]}
          sep={sync?.sep ?? '\\'}
          path={s.path ?? ''}
          onChange={(path) => set({ path })}
          onRecheck={() => void loadSync()}
          checking={checking}
        />
      )}

      {s.type === 'local' && !isCloudKind(kind) && (
        <Field label="Folder" hint="A folder on this computer, an external drive, or a mounted NAS share.">
          <input className={INPUT} value={s.path ?? ''} placeholder="C:\Movies" onChange={(e) => set({ path: e.target.value })} />
        </Field>
      )}

      {s.type === 'smb' && (
        <>
          <p className="text-xs text-white/50">
            On the other PC, right-click the movies folder → Properties → Sharing → Share. Works for NAS boxes with SMB too. Both
            machines need to be on the same network (or on Tailscale).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="PC name or IP" hint="You can also paste a path like \\OTHER-PC\Movies">
              <input className={INPUT} value={s.host ?? ''} placeholder="OTHER-PC" onChange={(e) => set({ host: e.target.value })} />
            </Field>
            <Field label="Shared folder">
              <input className={INPUT} value={s.share ?? ''} placeholder="Movies" onChange={(e) => set({ share: e.target.value })} />
            </Field>
            <Field
              label="Username (optional)"
              hint="Leave empty to use this PC's saved Windows sign-in. Microsoft accounts: use the email address."
            >
              <input
                className={INPUT}
                autoComplete="off"
                value={s.username ?? ''}
                onChange={(e) => set({ username: e.target.value })}
              />
            </Field>
            <SecretField label="Password" value={s.password ?? ''} saved={saved} onChange={(password) => set({ password })} />
          </div>
        </>
      )}

      {s.type === 'sftp' && (
        <>
          <p className="text-xs text-white/50">
            Any machine you can SSH into: a seedbox, a Linux server, a Raspberry Pi, most NAS boxes.
          </p>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="Server">
              <input className={INPUT} value={s.host ?? ''} placeholder="seedbox.example.com" onChange={(e) => set({ host: e.target.value })} />
            </Field>
            <Field label="Port">
              <input
                className={INPUT}
                inputMode="numeric"
                value={s.port ?? 22}
                onChange={(e) => set({ port: Number(e.target.value.replace(/\D/g, '')) || 22 })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username">
              <input className={INPUT} autoComplete="off" value={s.username ?? ''} onChange={(e) => set({ username: e.target.value })} />
            </Field>
            <SecretField label="Password" value={s.password ?? ''} saved={saved} onChange={(password) => set({ password })} />
          </div>
          <Field label="Private key file (optional)" hint="Path on this computer, instead of a password, e.g. C:\Users\you\.ssh\id_ed25519">
            <input className={INPUT} value={s.keyFile ?? ''} onChange={(e) => set({ keyFile: e.target.value })} />
          </Field>
        </>
      )}

      {s.type === 'cloud' && (
        <CloudSignIn
          profileId={profileId}
          provider={kind as CloudProvider}
          account={s.account}
          onSignedIn={(account, oauthState) => {
            set({ account, oauthState });
            setMessage(null);
          }}
        />
      )}

      {s.type === 's3' && (
        <>
          <p className="text-xs text-white/50">{provider.help}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {kind !== 'aws' && (
              <Field label="Endpoint">
                <input
                  className={INPUT}
                  value={s.endpoint ?? ''}
                  placeholder={provider.endpoint}
                  onChange={(e) => set({ endpoint: e.target.value })}
                />
              </Field>
            )}
            <Field label="Region">
              <input className={INPUT} value={s.region ?? ''} onChange={(e) => set({ region: e.target.value })} />
            </Field>
            <Field label="Bucket">
              <input className={INPUT} value={s.bucket ?? ''} onChange={(e) => set({ bucket: e.target.value })} />
            </Field>
            <Field label="Access key ID">
              <input
                className={INPUT}
                autoComplete="off"
                value={s.accessKeyId ?? ''}
                onChange={(e) => set({ accessKeyId: e.target.value })}
              />
            </Field>
            <SecretField
              label="Secret access key"
              value={s.secretAccessKey ?? ''}
              saved={saved}
              onChange={(secretAccessKey) => set({ secretAccessKey })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              className="w-4 h-4 accent-red-600"
              checked={!!s.forcePathStyle}
              onChange={(e) => set({ forcePathStyle: e.target.checked })}
            />
            Path-style URLs (needed for MinIO and most self-hosted servers)
          </label>
        </>
      )}

      {s.type === 'webdav' && (
        <>
          <p className="text-xs text-white/50">
            Synology (WebDAV Server package), QNAP, TrueNAS, Nextcloud, or anything else that speaks WebDAV.
          </p>
          <Field label="WebDAV URL" hint="e.g. https://nas.local:5006/video">
            <input className={INPUT} value={s.url ?? ''} onChange={(e) => set({ url: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username">
              <input
                className={INPUT}
                autoComplete="off"
                value={s.username ?? ''}
                onChange={(e) => set({ username: e.target.value })}
              />
            </Field>
            <SecretField label="Password" value={s.password ?? ''} saved={saved} onChange={(password) => set({ password })} />
          </div>
        </>
      )}

      {s.type !== 'local' && !needsSignIn && (
        <div className="space-y-2">
          <Field
            label="Library folder"
            hint={
              s.type === 'sftp'
                ? 'Folder that holds your movies and series. Start with / for an absolute path; otherwise it is inside your home folder.'
                : 'Folder that holds your movies and series. Empty = the top level.'
            }
          >
            <div className="flex gap-2">
              <input
                className={INPUT}
                value={s.folder ?? ''}
                placeholder="Movies"
                onChange={(e) => set({ folder: e.target.value })}
              />
              <button type="button" className={BUTTON} onClick={() => setBrowsing((b) => !b)}>
                {browsing ? 'Hide' : 'Browse'}
              </button>
            </div>
          </Field>
          {browsing && (
            <RemoteFolderBrowser
              profileId={profileId}
              source={s}
              value={s.folder ?? ''}
              onChange={(folder) => set({ folder })}
            />
          )}
        </div>
      )}

      {message && (
        <p className={'text-sm ' + (message.ok ? 'text-green-400' : 'text-red-400')}>{message.text}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className={BUTTON} onClick={test} disabled={testing || saving || needsSignIn}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button type="button" className={PRIMARY} onClick={save} disabled={saving || needsSignIn}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={BUTTON} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ProfileMediaSourcesPage() {
  const params = useParams();
  const router = useRouter();
  const { currentProfileId } = useProfile();
  const { reloadSettings } = useSettings();
  const id = typeof params.id === 'string' ? parseInt(params.id, 10) : NaN;
  const profileId = id >= 1 && id <= 5 ? id : null;
  const backHref = profileId != null ? `/settings/profile/${profileId}` : '/settings/profiles';

  const [sources, setSources] = useState<StorageSourceView[] | null>(null);
  const [activeId, setActiveId] = useState('');
  const [editing, setEditing] = useState<StorageSourceView | null>(null);

  const load = useCallback(async () => {
    if (profileId == null) return;
    const headers = { 'X-Profile-Id': String(profileId) };
    try {
      const [srcRes, setRes] = await Promise.all([
        fetch('/api/storage-sources', { headers }),
        fetch('/api/settings', { headers }),
      ]);
      const list = ((await srcRes.json()) as { sources?: StorageSourceView[] }).sources ?? [];
      const settings = (await setRes.json()) as { librarySourceId?: string };
      setSources(list);
      setActiveId(settings.librarySourceId ?? '');
      // No sources yet: skip the list and go straight to adding one.
      if (list.length === 0) setEditing((e) => e ?? blankSource('local'));
    } catch {
      setSources([]);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const afterChange = useCallback(async () => {
    setEditing(null);
    await load();
    if (profileId === currentProfileId) await reloadSettings();
  }, [load, profileId, currentProfileId, reloadSettings]);

  const selectAsLibrary = async (s: StorageSourceView) => {
    if (profileId == null) return;
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(profileId) },
      body: JSON.stringify({ librarySourceId: s.id }),
    });
    await afterChange();
  };

  const remove = async (s: StorageSourceView) => {
    if (profileId == null) return;
    if (!window.confirm(`Remove "${s.name}"?`)) return;
    await fetch(`/api/storage-sources?id=${encodeURIComponent(s.id)}`, {
      method: 'DELETE',
      headers: { 'X-Profile-Id': String(profileId) },
    });
    await afterChange();
  };

  if (profileId == null) {
    return <p className="py-12 text-white/60">Profile not found.</p>;
  }

  return (
    <>
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-white/10">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="flex items-center justify-center w-9 h-9 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Back to Preferences"
        >
          <ArrowBack sx={{ fontSize: 22 }} />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Media library</h1>
      </div>

      <section className="max-w-2xl space-y-6">
        {sources === null && <p className="text-white/50">Loading…</p>}

        {sources && sources.length > 0 && (
          <ul className="rounded-xl border border-white/10 overflow-hidden bg-[#181818] divide-y divide-white/10">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <SourceIcon s={s} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{s.name}</p>
                  <p className="text-sm text-white/50 truncate">{describeSource(s)}</p>
                </div>
                {s.id === activeId ? (
                  <span className="text-xs font-medium text-white bg-[#54a3ff]/30 px-2.5 py-1 rounded">Library</span>
                ) : (
                  <button type="button" className={BUTTON} onClick={() => void selectAsLibrary(s)}>
                    Use as library
                  </button>
                )}
                <button type="button" className={BUTTON} onClick={() => setEditing(s)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded border border-red-600/50 text-red-500 text-sm hover:bg-red-500/10"
                  onClick={() => void remove(s)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {editing ? (
          <SourceForm
            key={editing.id || 'new'}
            profileId={profileId}
            initial={editing}
            onCancel={() => (sources && sources.length > 0 ? setEditing(null) : router.push(backHref))}
            onSaved={() => void afterChange()}
          />
        ) : (
          sources && (
            <button type="button" className={BUTTON} onClick={() => setEditing(blankSource('local'))}>
              Add source
            </button>
          )
        )}
      </section>
    </>
  );
}
