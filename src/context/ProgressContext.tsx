 
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { useProfile } from '@/context/ProfileContext';

const STORAGE_KEY_PREFIX = 'nyetflix-watch-progress';

/** Past this progress (0–1), treat as "watched" for Continue Watching (e.g. end credits). */
export const CONTINUE_WATCHING_MAX_PROGRESS = 0.9;

export interface ProgressEntry {
  progress: number;
  lastWatchedAt: number;
  /** For series: episode id to resume (e.g. episode-xxx-S1-E2). */
  lastEpisodeId?: string;
}

function storageKey(profileId: number): string {
  return `${STORAGE_KEY_PREFIX}-${profileId}`;
}

function loadProgressForProfile(profileId: number): Record<string, ProgressEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(profileId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { progress: number; lastWatchedAt: number; lastEpisodeId?: string }>;
    return parsed;
  } catch {
    return {};
  }
}

function saveProgress(profileId: number, data: Record<string, ProgressEntry>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(profileId), JSON.stringify(data));
  } catch {
    // ignore
  }
}

export interface ProgressContextValue {
  getProgress: (itemId: string) => ProgressEntry | undefined;
  setProgress: (itemId: string, progress: number) => void;
  /** Remove item (or series) from continue watching. */
  clearProgress: (itemId: string) => void;
  progressByItemId: Record<string, ProgressEntry>;
}

const defaultValue: ProgressContextValue = {
  getProgress: () => undefined,
  setProgress: () => {},
  clearProgress: () => {},
  progressByItemId: {},
};

const ProgressContext = createContext<ProgressContextValue>(defaultValue);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { currentProfileId } = useProfile();
  const [progressByItemId, setProgressByItemId] = useState<Record<string, ProgressEntry>>(() =>
    currentProfileId != null ? loadProgressForProfile(currentProfileId) : {}
  );
  const profileIdRef = useRef(currentProfileId);
  profileIdRef.current = currentProfileId;

  useEffect(() => {
    setProgressByItemId(currentProfileId != null ? loadProgressForProfile(currentProfileId) : {});
  }, [currentProfileId]);

  const setProgress = useCallback((itemId: string, progress: number) => {
    if (profileIdRef.current == null) return;
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
      saveProgress(profileIdRef.current!, next);
      return next;
    });
  }, []);

  const clearProgress = useCallback((itemId: string) => {
    if (profileIdRef.current == null) return;
    setProgressByItemId((prev) => {
      const next = { ...prev };
      delete next[itemId];
      saveProgress(profileIdRef.current!, next);
      return next;
    });
  }, []);

  const getProgress = useCallback(
    (itemId: string) => progressByItemId[itemId],
    [progressByItemId]
  );

  const value = useMemo(
    () => ({ getProgress, setProgress, clearProgress, progressByItemId }),
    [getProgress, setProgress, clearProgress, progressByItemId]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  return ctx ?? defaultValue;
}
