/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'en' | 'el';

const STORAGE_KEYS = {
  language: 'nyetflix-language',
  subtitleLanguage: 'nyetflix-subtitle-language',
  moviesFolderPath: 'nyetflix-movies-folder-path',
  profileName: 'nyetflix-profile-name',
  profileIsKid: 'nyetflix-profile-is-kid',
} as const;

function getStored<K>(key: string, parse: (s: string) => K, fallback: K): K {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v != null ? parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function setStored(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    if (value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export interface SettingsState {
  language: AppLanguage;
  subtitleLanguage: AppLanguage;
  moviesFolderPath: string;
  profileName: string;
  profileIsKid: boolean;
}

export interface SettingsContextValue extends SettingsState {
  setLanguage: (lang: AppLanguage) => void;
  setSubtitleLanguage: (lang: AppLanguage) => void;
  setMoviesFolderPath: (path: string) => void;
  clearMoviesFolderPath: () => void;
  setProfileName: (name: string) => void;
  setProfileIsKid: (isKid: boolean) => void;
  deleteProfile: () => void;
}

const defaultValue: SettingsContextValue = {
  language: 'en',
  subtitleLanguage: 'en',
  moviesFolderPath: '',
  profileName: 'Profile',
  profileIsKid: false,
  setLanguage: () => {},
  setSubtitleLanguage: () => {},
  setMoviesFolderPath: () => {},
  clearMoviesFolderPath: () => {},
  setProfileName: () => {},
  setProfileIsKid: () => {},
  deleteProfile: () => {},
};

const Context = createContext<SettingsContextValue>(defaultValue);

async function fetchSettings(): Promise<SettingsState | null> {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return null;
    const data = (await res.json()) as SettingsState;
    return data;
  } catch {
    return null;
  }
}

async function saveSettings(partial: Partial<SettingsState>) {
  try {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!res.ok) return null;
    return (await res.json()) as SettingsState;
  } catch {
    return null;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    getStored(STORAGE_KEYS.language, (v) => (v === 'el' ? 'el' : 'en'), 'en')
  );
  const [subtitleLanguage, setSubtitleLanguageState] = useState<AppLanguage>(() =>
    getStored(STORAGE_KEYS.subtitleLanguage, (v) => (v === 'el' ? 'el' : 'en'), 'en')
  );
  const [moviesFolderPath, setMoviesFolderPathState] = useState<string>(() =>
    getStored(STORAGE_KEYS.moviesFolderPath, (v) => v, '')
  );
  const [profileName, setProfileNameState] = useState<string>(() =>
    getStored(STORAGE_KEYS.profileName, (v) => v, 'Profile')
  );
  const [profileIsKid, setProfileIsKidState] = useState<boolean>(() =>
    getStored(STORAGE_KEYS.profileIsKid, (v) => v === 'true', false)
  );

  useEffect(() => {
    fetchSettings().then((data) => {
      if (data && (data as { saved?: boolean }).saved) {
        const s = data as SettingsState;
        setLanguageState(s.language);
        setSubtitleLanguageState(s.subtitleLanguage);
        setMoviesFolderPathState(s.moviesFolderPath);
        setProfileNameState(s.profileName);
        setProfileIsKidState(s.profileIsKid);
        setStored(STORAGE_KEYS.language, s.language);
        setStored(STORAGE_KEYS.subtitleLanguage, s.subtitleLanguage);
        setStored(STORAGE_KEYS.moviesFolderPath, s.moviesFolderPath);
        setStored(STORAGE_KEYS.profileName, s.profileName);
        setStored(STORAGE_KEYS.profileIsKid, s.profileIsKid ? 'true' : 'false');
      }
    });
  }, []);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    setStored(STORAGE_KEYS.language, lang);
    saveSettings({ language: lang });
  }, []);

  const setSubtitleLanguage = useCallback((lang: AppLanguage) => {
    setSubtitleLanguageState(lang);
    setStored(STORAGE_KEYS.subtitleLanguage, lang);
    saveSettings({ subtitleLanguage: lang });
  }, []);

  const setMoviesFolderPath = useCallback((path: string) => {
    setMoviesFolderPathState(path);
    setStored(STORAGE_KEYS.moviesFolderPath, path);
    saveSettings({ moviesFolderPath: path });
  }, []);

  const clearMoviesFolderPath = useCallback(() => {
    setMoviesFolderPathState('');
    setStored(STORAGE_KEYS.moviesFolderPath, '');
    saveSettings({ moviesFolderPath: '' });
  }, []);

  const setProfileName = useCallback((name: string) => {
    setProfileNameState(name);
    setStored(STORAGE_KEYS.profileName, name);
    saveSettings({ profileName: name });
  }, []);

  const setProfileIsKid = useCallback((isKid: boolean) => {
    setProfileIsKidState(isKid);
    setStored(STORAGE_KEYS.profileIsKid, isKid ? 'true' : 'false');
    saveSettings({ profileIsKid: isKid });
  }, []);

  const deleteProfile = useCallback(() => {
    setProfileNameState('Profile');
    setProfileIsKidState(false);
    setStored(STORAGE_KEYS.profileName, 'Profile');
    setStored(STORAGE_KEYS.profileIsKid, 'false');
    saveSettings({ profileName: 'Profile', profileIsKid: false });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      language,
      subtitleLanguage,
      moviesFolderPath,
      profileName,
      profileIsKid,
      setLanguage,
      setSubtitleLanguage,
      setMoviesFolderPath,
      clearMoviesFolderPath,
      setProfileName,
      setProfileIsKid,
      deleteProfile,
    }),
    [
      language,
      subtitleLanguage,
      moviesFolderPath,
      profileName,
      profileIsKid,
      setLanguage,
      setSubtitleLanguage,
      setMoviesFolderPath,
      clearMoviesFolderPath,
      setProfileName,
      setProfileIsKid,
      deleteProfile,
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSettings() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
