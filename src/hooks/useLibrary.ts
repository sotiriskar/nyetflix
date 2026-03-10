'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CarouselItem } from '@/types/movie';
import type { MovieDetail } from '@/types/movie';
import { useProfile } from '@/context/ProfileContext';
import { useSettings } from '@/context/SettingsContext';
import { useLibraryHandle } from '@/context/LibraryHandleContext';
import { LIBRARY_HANDLE_MODE } from '@/context/LibraryHandleContext';
import { getLibraryHandle } from '@/lib/libraryHandleStorage';
import { scanFolderHandle } from '@/lib/scanFolderHandle';

const CACHE_KEY_PREFIX = 'nyetflix-library-';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours – library rarely changes
/** Abort library scan after this time so the UI doesn't load forever. */
const SCAN_TIMEOUT_MS = 120_000; // 2 minutes

export interface LibraryCarousel {
  title: string;
  items: CarouselItem[];
}

export interface UseLibraryResult {
  carousels: LibraryCarousel[];
  detailsMap: Record<string, MovieDetail>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  clearError: () => void;
  /** Merge metadata for one item (e.g. after fetching description for hero). Updates state and cache. */
  updateItemDetail: (id: string, patch: Partial<MovieDetail>) => void;
}

function getCacheKey(path: string): string {
  return CACHE_KEY_PREFIX + path.trim();
}

function readCache(path: string): { carousels: LibraryCarousel[]; detailsMap: Record<string, MovieDetail> } | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getCacheKey(path);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { carousels, detailsMap, cachedAt } = JSON.parse(raw);
    if (cachedAt && Date.now() - cachedAt < CACHE_TTL_MS && Array.isArray(carousels) && detailsMap && typeof detailsMap === 'object') {
      return { carousels, detailsMap };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeCache(path: string, carousels: LibraryCarousel[], detailsMap: Record<string, MovieDetail>): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getCacheKey(path);
    localStorage.setItem(key, JSON.stringify({ carousels, detailsMap, cachedAt: Date.now() }));
  } catch {
    // ignore
  }
}

function getInitialCache(path: string): { carousels: LibraryCarousel[]; detailsMap: Record<string, MovieDetail> } | null {
  if (typeof window === 'undefined' || !path) return null;
  return readCache(path);
}

export function useLibrary(folderPath: string | undefined): UseLibraryResult {
  const { currentProfileId } = useProfile();
  const { setMoviesFolderPath } = useSettings();
  const { setItemIdToRelativePath } = useLibraryHandle();
  const path = folderPath?.trim() ?? '';
  const isHandleMode = path === LIBRARY_HANDLE_MODE;

  const [carousels, setCarousels] = useState<LibraryCarousel[]>(() => {
    return getInitialCache(path)?.carousels ?? [];
  });
  const [detailsMap, setDetailsMap] = useState<Record<string, MovieDetail>>(() => {
    return getInitialCache(path)?.detailsMap ?? {};
  });
  const [loading, setLoading] = useState(() => {
    return path ? !getInitialCache(path) : false;
  });
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = useCallback(async (forceRefresh = false) => {
    if (!path) {
      setCarousels([]);
      setDetailsMap({});
      setError(null);
      return;
    }

    if (isHandleMode) {
      if (currentProfileId == null) {
        setCarousels([]);
        setDetailsMap({});
        setError(null);
        return;
      }
      const cached = !forceRefresh ? readCache(path) : null;
      if (cached) {
        setCarousels(cached.carousels);
        setDetailsMap(cached.detailsMap);
        setLoading(false);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const handle = await getLibraryHandle(currentProfileId);
        if (!handle) {
          setCarousels([]);
          setDetailsMap({});
          setError('Folder access lost. Choose the folder again in Settings.');
          return;
        }
        const candidates = await scanFolderHandle(handle);
        if (candidates.length === 0) {
          setCarousels([]);
          setDetailsMap({});
          writeCache(path, [], {});
          setItemIdToRelativePath(new Map());
          return;
        }
        const res = await fetch('/api/library-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidates }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Metadata failed: ${res.status}`);
        }
        const data = await res.json();
        const nextCarousels = data.carousels ?? [];
        const nextDetailsMap = data.detailsMap ?? {};
        const itemIdToRelativePathMap = new Map<string, string>(
          Object.entries(data.itemIdToRelativePath ?? {})
        );
        setCarousels(nextCarousels);
        setDetailsMap(nextDetailsMap);
        setItemIdToRelativePath(itemIdToRelativePathMap);
        writeCache(path, nextCarousels, nextDetailsMap);
      } catch (e) {
        const wasCached = !forceRefresh ? !!readCache(path) : false;
        if (!wasCached) {
          setCarousels([]);
          setDetailsMap({});
          setError(e instanceof Error ? e.message : 'Failed to load library');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    const cached = !forceRefresh ? readCache(path) : null;
    if (cached) {
      setCarousels(cached.carousels);
      setDetailsMap(cached.detailsMap);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }

    let pathToUse = path;
    if (forceRefresh && currentProfileId != null) {
      try {
        const settingsRes = await fetch('/api/settings', {
          headers: { 'X-Profile-Id': String(currentProfileId) },
        });
        if (settingsRes.ok) {
          const settings = (await settingsRes.json()) as { moviesFolderPath?: string };
          const saved = (settings.moviesFolderPath ?? '').trim();
          if (saved) {
            pathToUse = saved;
            if (saved !== path) setMoviesFolderPath(saved);
          }
        }
      } catch {
        // use path from context if fetch fails
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

    try {
      const url = `/api/scan-library?path=${encodeURIComponent(pathToUse)}${forceRefresh ? '&refresh=1' : ''}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data && data.error) || `Scan failed: ${res.status}`;
        const attempted = data?.attemptedPath as string | undefined;
        throw new Error(attempted ? `${msg} (Path used: ${attempted})` : msg);
      }
      const data = await res.json().catch(() => null);
      if (data == null) {
        throw new Error('Scan returned invalid response. Try again.');
      }
      const nextCarousels = data.carousels ?? [];
      const nextDetailsMap = data.detailsMap ?? {};
      setCarousels(nextCarousels);
      setDetailsMap(nextDetailsMap);
      writeCache(pathToUse, nextCarousels, nextDetailsMap);
    } catch (e) {
      clearTimeout(timeoutId);
      if (!cached) {
        setCarousels([]);
        setDetailsMap({});
        const isAbort = e instanceof Error && e.name === 'AbortError';
        setError(isAbort
          ? 'Scan is taking too long. Try a smaller folder, or refresh later.'
          : (e instanceof Error ? e.message : 'Failed to load library'));
      }
    } finally {
      setLoading(false);
    }
  }, [path, isHandleMode, currentProfileId, setItemIdToRelativePath, setMoviesFolderPath]);

  useEffect(() => {
    fetchLibrary(false);
  }, [fetchLibrary]);

  const refresh = useCallback(() => fetchLibrary(true), [fetchLibrary]);
  const clearError = useCallback(() => setError(null), []);

  const updateItemDetail = useCallback((id: string, patch: Partial<MovieDetail>) => {
    setDetailsMap((prev) => {
      const existing = prev[id];
      const next = { ...prev, [id]: { ...(existing ?? { id, title: '' }), ...patch } };
      if (path) writeCache(path, carousels, next);
      return next;
    });
  }, [path, carousels]);

  return { carousels, detailsMap, loading, error, refresh, clearError, updateItemDetail };
}
