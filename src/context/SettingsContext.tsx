/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useProfile } from '@/context/ProfileContext';

export type AppLanguage = 'en' | 'el';

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

async function fetchSettings(profileId: number): Promise<{ language: AppLanguage; subtitleLanguage: AppLanguage; moviesFolderPath: string } | null> {
  try {
    const res = await fetch('/api/settings', { headers: { 'X-Profile-Id': String(profileId) } });
    if (!res.ok) return null;
    const data = (await res.json()) as { language: AppLanguage; subtitleLanguage: AppLanguage; moviesFolderPath: string };
    return data;
  } catch {
    return null;
  }
}

async function saveSettings(profileId: number, partial: { language?: AppLanguage; subtitleLanguage?: AppLanguage; moviesFolderPath?: string }) {
  try {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(profileId) },
      body: JSON.stringify(partial),
    });
    if (!res.ok) return null;
    return (await res.json()) as SettingsState;
  } catch {
    return null;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { currentProfileId, profiles, updateProfile, deleteProfile: deleteProfileFromApi } = useProfile();
  const currentProfile = useMemo(() => profiles.find((p) => p.id === currentProfileId), [profiles, currentProfileId]);

  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [subtitleLanguage, setSubtitleLanguageState] = useState<AppLanguage>('en');
  const [moviesFolderPath, setMoviesFolderPathState] = useState<string>('');

  useEffect(() => {
    if (currentProfileId == null) return;
    fetchSettings(currentProfileId).then((data) => {
      if (data) {
        setLanguageState(data.language ?? 'en');
        setSubtitleLanguageState(data.subtitleLanguage ?? 'en');
        setMoviesFolderPathState(data.moviesFolderPath ?? '');
      }
    });
  }, [currentProfileId]);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    if (currentProfileId != null) saveSettings(currentProfileId, { language: lang });
  }, [currentProfileId]);

  const setSubtitleLanguage = useCallback((lang: AppLanguage) => {
    setSubtitleLanguageState(lang);
    if (currentProfileId != null) saveSettings(currentProfileId, { subtitleLanguage: lang });
  }, [currentProfileId]);

  const setMoviesFolderPath = useCallback((path: string) => {
    setMoviesFolderPathState(path);
    if (currentProfileId != null) saveSettings(currentProfileId, { moviesFolderPath: path });
  }, [currentProfileId]);

  const clearMoviesFolderPath = useCallback(() => {
    setMoviesFolderPathState('');
    if (currentProfileId != null) saveSettings(currentProfileId, { moviesFolderPath: '' });
  }, [currentProfileId]);

  const setProfileName = useCallback((name: string) => {
    if (currentProfileId != null) updateProfile(currentProfileId, { name: name.trim() || 'Profile' });
  }, [currentProfileId, updateProfile]);

  const setProfileIsKid = useCallback((isKid: boolean) => {
    if (currentProfileId != null) updateProfile(currentProfileId, { isKid });
  }, [currentProfileId, updateProfile]);

  const deleteProfile = useCallback(() => {
    if (currentProfileId != null) deleteProfileFromApi(currentProfileId);
  }, [currentProfileId, deleteProfileFromApi]);

  const profileName = currentProfile?.name ?? 'Profile';
  const profileIsKid = currentProfile?.isKid ?? false;

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
