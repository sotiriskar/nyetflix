'use client';

import { useCallback, useEffect, useState } from 'react';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import type { BrowseResult, StorageSourceView } from '@/lib/storage/clientTypes';

export async function browseRemote(profileId: number, source: StorageSourceView, path: string): Promise<BrowseResult> {
  try {
    const res = await fetch('/api/storage-sources/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(profileId) },
      body: JSON.stringify({ source, path }),
    });
    return (await res.json()) as BrowseResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
}

/** Absolute SFTP paths keep their leading slash while navigating. */
function lead(path: string): string {
  return path.startsWith('/') ? '/' : '';
}

function parentOf(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? lead(path) + parts.join('/') : '';
}

/**
 * Lists folders inside a remote source so the library folder can be picked instead of typed.
 * `value` is the folder path inside the source ('' = root).
 */
export function RemoteFolderBrowser({
  profileId,
  source,
  value,
  onChange,
}: {
  profileId: number;
  source: StorageSourceView;
  value: string;
  onChange: (path: string) => void;
}) {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (path: string) => {
      setLoading(true);
      setResult(await browseRemote(profileId, source, path));
      setLoading(false);
    },
    [profileId, source],
  );

  useEffect(() => {
    void load(value);
  }, [load, value]);

  const crumbs = value.split('/').filter(Boolean);

  return (
    <div className="rounded border border-white/15 bg-black/30 text-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 text-white/70 overflow-x-auto whitespace-nowrap">
        <button type="button" className="hover:text-white" onClick={() => onChange('')}>
          {source.name}
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-white/30">/</span>
            <button
              type="button"
              className="hover:text-white"
              onClick={() => onChange(lead(value) + crumbs.slice(0, i + 1).join('/'))}
            >
              {c}
            </button>
          </span>
        ))}
      </div>
      <div className="max-h-56 overflow-y-auto">
        {value && (
          <button
            type="button"
            onClick={() => onChange(parentOf(value))}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-white/70 hover:bg-white/5"
          >
            <ArrowUpward sx={{ fontSize: 18 }} /> Up
          </button>
        )}
        {loading && <p className="px-3 py-2 text-white/50">Loading…</p>}
        {!loading && result && !result.ok && <p className="px-3 py-2 text-red-400">{result.error}</p>}
        {!loading && result?.ok && (
          <>
            {result.folders!.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onChange(value ? `${value.replace(/\/$/, '')}/${name}` : name)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-white hover:bg-white/5"
              >
                <FolderOutlined sx={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }} />
                <span className="truncate">{name}</span>
              </button>
            ))}
            {result.folders!.length === 0 && (
              <p className="px-3 py-2 text-white/50">No subfolders here.</p>
            )}
            <p className="px-3 py-2 text-xs text-white/40 border-t border-white/10">
              {result.folders!.length} folder{result.folders!.length === 1 ? '' : 's'}
              {result.truncated ? ' (first 200 shown)' : ''}, {result.files} file{result.files === 1 ? '' : 's'} in this folder
            </p>
          </>
        )}
      </div>
    </div>
  );
}
