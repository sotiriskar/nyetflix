'use client';

import { useSettings } from '@/context/SettingsContext';
import { useLibrary } from '@/hooks/useLibrary';
import { LibraryContext } from '@/context/LibraryContext';

export function BrowseLayout({ children }: { children: React.ReactNode }) {
  const { moviesFolderPath } = useSettings();
  const library = useLibrary(moviesFolderPath ?? '');

  return (
    <LibraryContext.Provider value={library}>
      {children}
    </LibraryContext.Provider>
  );
}
