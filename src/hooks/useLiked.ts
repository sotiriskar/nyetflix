'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProfile } from '@/context/ProfileContext';

type LikedValue = {
  ids: string[];
  add: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  has: (id: string) => boolean;
};

const LikedContext = createContext<LikedValue | null>(null);

async function fetchLiked(profileId: number): Promise<string[]> {
  const res = await fetch('/api/liked', { headers: { 'X-Profile-Id': String(profileId) } });
  if (!res.ok) throw new Error('Failed to load');
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
}

export function LikedProvider({ children }: { children: ReactNode }) {
  const { currentProfileId } = useProfile();
  const [ids, setIds] = useState<string[]>([]);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    if (currentProfileId == null) {
      setIds([]);
      return;
    }
    fetchLiked(currentProfileId).then(setIds).catch(() => {});
  }, [currentProfileId]);

  const add = useCallback(async (id: string) => {
    if (currentProfileId == null) return;
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    const res = await fetch('/api/liked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(currentProfileId) },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setIds((prev) => prev.filter((x) => x !== id));
    }
  }, [currentProfileId]);

  const remove = useCallback(async (id: string) => {
    if (currentProfileId == null) return;
    setIds((prev) => prev.filter((x) => x !== id));
    await fetch(`/api/liked?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Profile-Id': String(currentProfileId) },
    });
  }, [currentProfileId]);

  const toggle = useCallback(
    async (id: string) => {
      if (idsRef.current.includes(id)) await remove(id);
      else await add(id);
    },
    [add, remove]
  );

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const value = useMemo(
    () => ({ ids, add, remove, toggle, has }),
    [ids, add, remove, toggle, has],
  );

  return createElement(LikedContext.Provider, { value }, children);
}

export function useLiked() {
  const ctx = useContext(LikedContext);
  if (!ctx) {
    return {
      ids: [],
      add: async () => {},
      remove: async () => {},
      toggle: async () => {},
      has: () => false,
    };
  }
  return ctx;
}
