'use client';

import { useState, useCallback, useEffect } from 'react';

async function fetchLiked(): Promise<string[]> {
  const res = await fetch('/api/liked');
  if (!res.ok) throw new Error('Failed to load');
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
}

export function useLiked() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    fetchLiked().then(setIds).catch(() => {});
  }, []);

  const add = useCallback(async (id: string) => {
    const res = await fetch('/api/liked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/liked?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return;
    setIds((prev) => prev.filter((x) => x !== id));
  }, []);

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
