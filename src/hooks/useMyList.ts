'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProfile } from '@/context/ProfileContext';

export interface MyListEntry {
  id: string;
  addedAt: number;
}

type MyListValue = {
  list: MyListEntry[];
  add: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  has: (id: string) => boolean;
  getAddedAt: (id: string) => number | undefined;
  loaded: boolean;
};

const MyListContext = createContext<MyListValue | null>(null);

async function fetchList(profileId: number): Promise<MyListEntry[]> {
  const res = await fetch('/api/my-list', { headers: { 'X-Profile-Id': String(profileId) } });
  if (!res.ok) throw new Error('Failed to load list');
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (e): e is MyListEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as MyListEntry).id === 'string' &&
      typeof (e as MyListEntry).addedAt === 'number'
  );
}

export function MyListProvider({ children }: { children: ReactNode }) {
  const { currentProfileId } = useProfile();
  const [list, setList] = useState<MyListEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef(list);
  listRef.current = list;

  useEffect(() => {
    if (currentProfileId == null) {
      setList([]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    fetchList(currentProfileId)
      .then((entries) => {
        if (!cancelled) {
          setList(entries);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentProfileId]);

  const add = useCallback(async (id: string) => {
    if (currentProfileId == null) return;
    setList((prev) => {
      if (prev.some((e) => e.id === id)) return prev;
      return [...prev, { id, addedAt: Date.now() }];
    });
    const res = await fetch('/api/my-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(currentProfileId) },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setList((prev) => prev.filter((e) => e.id !== id));
    }
  }, [currentProfileId]);

  const remove = useCallback(async (id: string) => {
    if (currentProfileId == null) return;
    setList((prev) => prev.filter((e) => e.id !== id));
    const res = await fetch(`/api/my-list?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Profile-Id': String(currentProfileId) },
    });
    if (!res.ok) return;
  }, [currentProfileId]);

  const toggle = useCallback(
    async (id: string) => {
      if (listRef.current.some((e) => e.id === id)) await remove(id);
      else await add(id);
    },
    [add, remove]
  );

  const has = useCallback(
    (id: string) => list.some((e) => e.id === id),
    [list]
  );

  const getAddedAt = useCallback(
    (id: string) => list.find((e) => e.id === id)?.addedAt,
    [list]
  );

  const value = useMemo(
    () => ({ list, add, remove, toggle, has, getAddedAt, loaded }),
    [list, add, remove, toggle, has, getAddedAt, loaded],
  );

  return createElement(MyListContext.Provider, { value }, children);
}

export function useMyList() {
  const ctx = useContext(MyListContext);
  if (!ctx) {
    return {
      list: [],
      add: async () => {},
      remove: async () => {},
      toggle: async () => {},
      has: () => false,
      getAddedAt: () => undefined,
      loaded: true,
    };
  }
  return ctx;
}
