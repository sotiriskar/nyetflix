'use client';

import { createContext, useContext } from 'react';
import { useLibrary, type UseLibraryResult } from '@/hooks/useLibrary';
import { useSettings } from '@/context/SettingsContext';

const LibraryContext = createContext<UseLibraryResult | null>(null);

/** One library instance for the whole app so Watch/Search don't rescan on every visit. */
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { moviesFolderPath } = useSettings();
  const library = useLibrary(moviesFolderPath ?? '');
  return <LibraryContext.Provider value={library}>{children}</LibraryContext.Provider>;
}

export function useLibraryContext(): UseLibraryResult {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibraryContext must be used within LibraryProvider');
  return ctx;
}

export function useLibraryContextOrNull(): UseLibraryResult | null {
  return useContext(LibraryContext);
}

export { LibraryContext };
