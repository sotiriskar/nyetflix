'use client';

import { useState, useCallback, useEffect } from 'react';
import { useProfile } from '@/context/ProfileContext';

async function fetchLiked(profileId: number): Promise<string[]> {
  const res = await fetch('/api/liked', { headers: { 'X-Profile-Id': String(profileId) } });
  if (!res.ok) throw new Error('Failed to load');
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
}

export function useLiked() {
  const { currentProfileId } = useProfile();
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (currentProfileId == null) {
      setIds([]);
      return;
    }
    fetchLiked(currentProfileId).then(setIds).catch(() => {});
  }, [currentProfileId]);

  const add = useCallback(async (id: string) => {
    if (currentProfileId == null) return;
    const res = await fetch('/api/liked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(currentProfileId) },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, [currentProfileId]);

  const remove = useCallback(async (id: string) => {
    if (currentProfileId == null) return;
    const res = await fetch(`/api/liked?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Profile-Id': String(currentProfileId) },
    });
    if (!res.ok) return;
    setIds((prev) => prev.filter((x) => x !== id));
  }, [currentProfileId]);

  const toggle = useCallback(
    async (id: string) => {
      if (ids.includes(id)) await remove(id);
      else await add(id);
    },
    [ids, add, remove]
  );

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, add, remove, toggle, has };
}
