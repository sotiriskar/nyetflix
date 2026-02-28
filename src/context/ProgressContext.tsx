/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'nyetflix-watch-progress';

export interface ProgressEntry {
  progress: number;
  lastWatchedAt: number;
  /** For series: episode id to resume (e.g. episode-xxx-S1-E2). */
  lastEpisodeId?: string;
}

function loadProgress(): Record<string, ProgressEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { progress: number; lastWatchedAt: number; lastEpisodeId?: string }>;
    return parsed;
  } catch {
    return {};
  }
}

function saveProgress(data: Record<string, ProgressEntry>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export interface ProgressContextValue {
  getProgress: (itemId: string) => ProgressEntry | undefined;
  setProgress: (itemId: string, progress: number) => void;
  progressByItemId: Record<string, ProgressEntry>;
}

const defaultValue: ProgressContextValue = {
  getProgress: () => undefined,
  setProgress: () => {},
  progressByItemId: {},
};

const ProgressContext = createContext<ProgressContextValue>(defaultValue);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progressByItemId, setProgressByItemId] = useState<Record<string, ProgressEntry>>(loadProgress);

  const setProgress = useCallback((itemId: string, progress: number) => {
    const p = Math.min(1, Math.max(0, progress));
    const entry: ProgressEntry = {
      progress: p,
      lastWatchedAt: Date.now(),
      ...(itemId.startsWith('episode-') ? { lastEpisodeId: itemId } : undefined),
    };
    setProgressByItemId((prev) => {
      const next = { ...prev, [itemId]: entry };
      const seriesMatch = itemId.match(/^episode-(.+)-S\d+-E\d+$/);
      if (seriesMatch) {
        const seriesId = seriesMatch[1];
        next[seriesId] = { progress: p, lastWatchedAt: Date.now(), lastEpisodeId: itemId };
      }
      saveProgress(next);
      return next;
    });
  }, []);

  const getProgress = useCallback(
    (itemId: string) => progressByItemId[itemId],
    [progressByItemId]
  );

  const value = useMemo(
    () => ({ getProgress, setProgress, progressByItemId }),
    [getProgress, setProgress, progressByItemId]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  return ctx ?? defaultValue;
}
