'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ConversionStatusEntry = {
  itemId: string;
  status: 'converting' | 'incomplete' | 'ready' | 'needs_conversion';
  progress?: number;
  currentTime?: number;
  durationSeconds?: number;
  etaSeconds?: number;
  canRestoreOriginal?: boolean;
};

type ConversionStatusContextValue = {
  byId: Record<string, ConversionStatusEntry>;
  keepSourceMkv: boolean;
  setKeepSourceMkv: (v: boolean) => Promise<void>;
  /** One-shot fetch (mount, settings, restore). Does not start a poll loop. */
  refresh: (ids?: string[]) => Promise<void>;
  /** Live progress from the convert EventSource — updates card badges without polling. */
  reportProgress: (itemId: string, progress: number, extra?: Partial<ConversionStatusEntry>) => void;
  clearProgress: (itemId: string) => void;
  restoreOriginal: (id: string) => Promise<{ ok: boolean; error?: string }>;
  cleanupIncomplete: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

const Context = createContext<ConversionStatusContextValue | null>(null);

async function fetchStatus(ids?: string[]) {
  const q = ids?.length ? `?ids=${ids.map(encodeURIComponent).join(',')}` : '';
  const res = await fetch(`/api/conversion-status${q}`, { credentials: 'same-origin' });
  if (!res.ok) return null;
  return res.json() as Promise<{
    conversions: Record<string, ConversionStatusEntry>;
    keepSourceMkv: boolean;
  }>;
}

export function ConversionStatusProvider({ children }: { children: React.ReactNode }) {
  const [byId, setById] = useState<Record<string, ConversionStatusEntry>>({});
  const [keepSourceMkv, setKeepSourceState] = useState(true);

  const refresh = useCallback(async (ids?: string[]) => {
    const data = await fetchStatus(ids);
    if (!data) return;
    setKeepSourceState(data.keepSourceMkv !== false);
    setById((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id]?.status === 'converting' && data.conversions[id]?.status !== 'converting') {
          delete next[id];
        }
      }
      Object.assign(next, data.conversions);
      return next;
    });
  }, []);

  // Settings + any leftover in-flight after a full page reload. No interval.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reportProgress = useCallback((itemId: string, progress: number, extra?: Partial<ConversionStatusEntry>) => {
    setById((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        ...extra,
        itemId,
        status: 'converting',
        progress,
      },
    }));
  }, []);

  const clearProgress = useCallback((itemId: string) => {
    setById((prev) => {
      if (!prev[itemId]) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const setKeepSourceMkv = useCallback(async (v: boolean) => {
    setKeepSourceState(v);
    await fetch('/api/conversion-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepSourceMkv: v }),
    });
  }, []);

  const restoreOriginal = useCallback(async (id: string) => {
    const res = await fetch('/api/conversion-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'restore' }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; status?: ConversionStatusEntry };
    if (!res.ok) return { ok: false, error: data.error ?? 'Restore failed' };
    if (data.status) setById((prev) => ({ ...prev, [id]: data.status! }));
    else await refresh([id]);
    return { ok: true };
  }, [refresh]);

  const cleanupIncomplete = useCallback(async (id: string) => {
    const res = await fetch('/api/conversion-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'cleanup' }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; status?: ConversionStatusEntry };
    if (!res.ok) return { ok: false, error: data.error ?? 'Cleanup failed' };
    if (data.status) setById((prev) => ({ ...prev, [id]: data.status! }));
    else await refresh([id]);
    return { ok: true };
  }, [refresh]);

  const value = useMemo(
    () => ({
      byId,
      keepSourceMkv,
      setKeepSourceMkv,
      refresh,
      reportProgress,
      clearProgress,
      restoreOriginal,
      cleanupIncomplete,
    }),
    [byId, keepSourceMkv, setKeepSourceMkv, refresh, reportProgress, clearProgress, restoreOriginal, cleanupIncomplete]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useConversionStatus() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useConversionStatus must be used within ConversionStatusProvider');
  return ctx;
}

export function useItemConversionStatus(itemId: string | null | undefined): ConversionStatusEntry | null {
  const { byId } = useConversionStatus();
  if (!itemId) return null;
  return byId[itemId] ?? null;
}
