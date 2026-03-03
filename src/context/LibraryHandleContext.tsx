'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useProfile } from '@/context/ProfileContext';
import { getLibraryHandle, getFileFromHandle } from '@/lib/libraryHandleStorage';

/** Sentinel value when using "Choose folder" instead of path. */
export const LIBRARY_HANDLE_MODE = '__handle__';

export interface LibraryHandleContextValue {
  /** True when moviesFolderPath is __handle__ and we have a valid handle or files. */
  isHandleMode: boolean;
  /** Get a blob URL for playback. Returns null if not handle mode or item unknown. */
  getPlaybackUrl: (itemId: string) => Promise<string | null>;
  /** Map itemId -> relativePath for handle mode (populated by useLibrary). */
  setItemIdToRelativePath: (map: Map<string, string>) => void;
  /** Map episodeId -> relativePath for handle mode. */
  setEpisodeIdToRelativePath: (map: Map<string, string>) => void;
  /** Map itemId -> File for webkitdirectory mode (in-memory, session only). */
  setItemIdToFile: (map: Map<string, File>) => void;
}

const defaultValue: LibraryHandleContextValue = {
  isHandleMode: false,
  getPlaybackUrl: async () => null,
  setItemIdToRelativePath: () => {},
  setEpisodeIdToRelativePath: () => {},
  setItemIdToFile: () => {},
};

const Context = createContext<LibraryHandleContextValue>(defaultValue);

export function LibraryHandleProvider({ children }: { children: React.ReactNode }) {
  const { currentProfileId } = useProfile();
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [handleReady, setHandleReady] = useState(false);
  const itemIdToRelativePath = useRef(new Map<string, string>());
  const episodeIdToRelativePath = useRef(new Map<string, string>());
  const itemIdToFile = useRef(new Map<string, File>());

  useEffect(() => {
    if (typeof window === 'undefined' || currentProfileId == null) {
      setHandle(null);
      setHandleReady(true);
      return;
    }
    getLibraryHandle(currentProfileId).then((h) => {
      setHandle(h);
      setHandleReady(true);
    });
  }, [currentProfileId]);

  const getPlaybackUrl = useCallback(
    async (itemId: string): Promise<string | null> => {
      const file = itemIdToFile.current.get(itemId);
      if (file) return URL.createObjectURL(file);
      if (!handle) return null;
      const relativePath =
        itemIdToRelativePath.current.get(itemId) ??
        episodeIdToRelativePath.current.get(itemId);
      if (!relativePath) return null;
      try {
        const f = await getFileFromHandle(handle, relativePath);
        return URL.createObjectURL(f);
      } catch {
        return null;
      }
    },
    [handle]
  );

  const setItemIdToRelativePath = useCallback((map: Map<string, string>) => {
    itemIdToRelativePath.current.clear();
    map.forEach((v, k) => itemIdToRelativePath.current.set(k, v));
  }, []);

  const setEpisodeIdToRelativePath = useCallback((map: Map<string, string>) => {
    episodeIdToRelativePath.current.clear();
    map.forEach((v, k) => episodeIdToRelativePath.current.set(k, v));
  }, []);

  const setItemIdToFile = useCallback((map: Map<string, File>) => {
    itemIdToFile.current.clear();
    map.forEach((v, k) => itemIdToFile.current.set(k, v));
  }, []);

  const value = useMemo<LibraryHandleContextValue>(
    () => ({
      isHandleMode: handleReady && !!handle,
      getPlaybackUrl,
      setItemIdToRelativePath,
      setEpisodeIdToRelativePath,
      setItemIdToFile,
    }),
    [handleReady, handle, getPlaybackUrl, setItemIdToRelativePath, setEpisodeIdToRelativePath, setItemIdToFile]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLibraryHandle() {
  const ctx = useContext(Context);
  return ctx ?? defaultValue;
}
