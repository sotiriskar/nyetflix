'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type TrailerMuteContextValue = {
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
};

const TrailerMuteContext = createContext<TrailerMuteContextValue | null>(null);

export function TrailerMuteProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState(true);
  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
  }, []);
  return (
    <TrailerMuteContext.Provider value={{ isMuted, setMuted }}>
      {children}
    </TrailerMuteContext.Provider>
  );
}

export function useTrailerMute() {
  const ctx = useContext(TrailerMuteContext);
  if (!ctx) {
    return { isMuted: true, setMuted: () => {} };
  }
  return ctx;
}
