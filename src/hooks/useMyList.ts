'use client';

import { useState, useCallback, useEffect } from 'react';
import { useProfile } from '@/context/ProfileContext';

export interface MyListEntry {
  id: string;
  addedAt: number;
}

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

export function useMyList() {
  const { currentProfileId } = useProfile();
  const [list, setList] = useState<MyListEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

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
    if (list.some((e) => e.id === id)) return;
    const res = await fetch('/api/my-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(currentProfileId) },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    const addedAt = Date.now();
    setList((prev) => [...prev, { id, addedAt }]);
  }, [list, currentProfileId]);

  const remove = useCallback(async (id: string) => {
    if (currentProfileId == null) return;
    const res = await fetch(`/api/my-list?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Profile-Id': String(currentProfileId) },
    });
    if (!res.ok) return;
    setList((prev) => prev.filter((e) => e.id !== id));
  }, [currentProfileId]);

  const toggle = useCallback(
    async (id: string) => {
      if (list.some((e) => e.id === id)) await remove(id);
      else await add(id);
    },
    [list, add, remove]
  );

  const has = useCallback(
    (id: string) => list.some((e) => e.id === id),
    [list]
  );

  const getAddedAt = useCallback(
    (id: string) => list.find((e) => e.id === id)?.addedAt,
    [list]
  );

  return { list, add, remove, toggle, has, getAddedAt, loaded };
}
