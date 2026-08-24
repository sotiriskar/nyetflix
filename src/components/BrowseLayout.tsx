'use client';

/** Browse routes share the app-level LibraryProvider; this is just the page chrome wrapper. */
export function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
