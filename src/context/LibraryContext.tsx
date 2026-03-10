'use client';

import { createContext, useContext } from 'react';
import type { UseLibraryResult } from '@/hooks/useLibrary';

const LibraryContext = createContext<UseLibraryResult | null>(null);

export function useLibraryContext(): UseLibraryResult {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibraryContext must be used within LibraryProvider');
  return ctx;
}

export function useLibraryContextOrNull(): UseLibraryResult | null {
  return useContext(LibraryContext);
}

export { LibraryContext };
