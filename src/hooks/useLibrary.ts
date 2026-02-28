'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CarouselItem } from '@/types/movie';
import type { MovieDetail } from '@/types/movie';

const CACHE_KEY_PREFIX = 'nyetflix-library-';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
  setError: (error: string | null) => void;
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
  const [carousels, setCarousels] = useState<LibraryCarousel[]>(() => {
    const p = folderPath?.trim() ?? '';
    return getInitialCache(p)?.carousels ?? [];
  });
  const [detailsMap, setDetailsMap] = useState<Record<string, MovieDetail>>(() => {
    const p = folderPath?.trim() ?? '';
    return getInitialCache(p)?.detailsMap ?? {};
  });
  const [loading, setLoading] = useState(() => {
    const p = folderPath?.trim() ?? '';
    return p ? !getInitialCache(p) : false;
  });
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = useCallback(async (forceRefresh = false) => {
    const path = folderPath?.trim() ?? '';
    if (!path) {
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
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const url = `/api/scan-library?path=${encodeURIComponent(path)}${forceRefresh ? '&refresh=1' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Scan failed: ${res.status}`);
      }
      const data = await res.json();
      const nextCarousels = data.carousels ?? [];
      const nextDetailsMap = data.detailsMap ?? {};
      setCarousels(nextCarousels);
      setDetailsMap(nextDetailsMap);
      writeCache(path, nextCarousels, nextDetailsMap);
    } catch (e) {
      if (!cached) {
        setCarousels([]);
        setDetailsMap({});
        setError(e instanceof Error ? e.message : 'Failed to load library');
      }
    } finally {
      setLoading(false);
    }
  }, [folderPath]);

  useEffect(() => {
    fetchLibrary(false);
  }, [fetchLibrary]);

  const refresh = useCallback(() => fetchLibrary(true), [fetchLibrary]);
  const clearError = useCallback(() => setError(null), []);

  return { carousels, detailsMap, loading, error, refresh, clearError, setError };
}
