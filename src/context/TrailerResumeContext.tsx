'use client';

import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';

type TrailerResume = { videoId: string; currentTime: number } | null;

type TrailerResumeContextValue = {
  setResume: (videoId: string, currentTime: number) => void;
  getAndClearResume: () => TrailerResume;
};

const TrailerResumeContext = createContext<TrailerResumeContextValue | null>(null);

export function TrailerResumeProvider({ children }: { children: ReactNode }) {
  const resumeRef = useRef<TrailerResume>(null);

  const setResume = useCallback((videoId: string, currentTime: number) => {
    resumeRef.current = { videoId, currentTime };
  }, []);

  const getAndClearResume = useCallback((): TrailerResume => {
    const v = resumeRef.current;
    resumeRef.current = null;
    return v;
  }, []);

  return (
    <TrailerResumeContext.Provider value={{ setResume, getAndClearResume }}>
      {children}
    </TrailerResumeContext.Provider>
  );
}

export function useTrailerResume() {
  const ctx = useContext(TrailerResumeContext);
  if (!ctx) {
    return { setResume: () => {}, getAndClearResume: () => null };
  }
  return ctx;
}
