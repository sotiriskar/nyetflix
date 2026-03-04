'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ProfileId } from '@/lib/profiles';
import { MAX_PROFILES } from '@/lib/profiles';

const STORAGE_KEY = 'nyetflix-current-profile-id';
/** sessionStorage: remembered while tab/window is open; forgotten when browser is closed or tab is closed (e.g. after closing npm and opening a new tab). */
function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : sessionStorage;
}

function getStoredProfileId(): ProfileId | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const v = storage.getItem(STORAGE_KEY);
    if (v == null || v === '') return null;
    const n = parseInt(v, 10);
    if (n >= 1 && n <= MAX_PROFILES) return n as ProfileId;
  } catch {
    // ignore
  }
  return null;
}

function setStoredProfileId(id: ProfileId | null) {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (id == null) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, String(id));
  } catch {
    // ignore
  }
}

export interface Profile {
  id: number;
  name: string;
  avatarPath: string;
  isKid: boolean;
}

export interface ProfileContextValue {
  currentProfileId: ProfileId | null;
  setCurrentProfileId: (id: ProfileId | null) => void;
  /** Call when user picks a profile on "Who's watching?" – remembered until browser/tab is closed. */
  confirmProfileChoice: (id: ProfileId) => void;
  /** Clear profile and cache so Who's watching? is shown again. */
  signOut: () => void;
  profiles: Profile[];
  /** True after the first refetch has completed (used to avoid showing create-profile screen). */
  profilesLoaded: boolean;
  refetchProfiles: () => Promise<void>;
  updateProfile: (id: ProfileId, data: { name?: string; avatarPath?: string; isKid?: boolean }) => Promise<void>;
  createProfile: (data: { name?: string; avatarPath?: string; isKid?: boolean }) => Promise<Profile | null>;
  deleteProfile: (id: ProfileId) => Promise<void>;
  canAddProfile: boolean;
}

const defaultValue: ProfileContextValue = {
  currentProfileId: null,
  setCurrentProfileId: () => {},
  confirmProfileChoice: () => {},
  signOut: () => {},
  profiles: [],
  profilesLoaded: false,
  refetchProfiles: async () => {},
  updateProfile: async () => {},
  createProfile: async () => null,
  deleteProfile: async () => {},
  canAddProfile: true,
};

const ProfileContext = createContext<ProfileContextValue>(defaultValue);

/** True if a profile was chosen this session (sessionStorage) and that profile still exists. */
export function hasValidCachedProfile(profileIds: number[]): boolean {
  const id = getStoredProfileId();
  return id != null && profileIds.includes(id);
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentProfileId, setCurrentProfileIdState] = useState<ProfileId | null>(getStoredProfileId);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);

  const refetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/profiles');
      if (!res.ok) return;
      const data = (await res.json()) as Profile[];
      const list = Array.isArray(data) ? data : [];
      setProfiles(list);
      setCurrentProfileIdState((prev) => {
        if (list.length === 0) {
          setStoredProfileId(null);
          return null;
        }
        const ids = new Set(list.map((p) => p.id));
        if (prev != null && ids.has(prev)) return prev;
        if (prev != null) setStoredProfileId(null);
        return null;
      });
    } catch {
      setProfiles([]);
      setCurrentProfileIdState(null);
      setStoredProfileId(null);
    } finally {
      setProfilesLoaded(true);
    }
  }, []);

  useEffect(() => {
    refetchProfiles();
  }, [refetchProfiles]);

  const setCurrentProfileId = useCallback((id: ProfileId | null) => {
    setCurrentProfileIdState(id);
    setStoredProfileId(id);
  }, []);

  const confirmProfileChoice = useCallback((id: ProfileId) => {
    setCurrentProfileIdState(id);
    setStoredProfileId(id);
  }, []);

  const signOut = useCallback(() => {
    setCurrentProfileIdState(null);
    setStoredProfileId(null);
  }, []);

  const updateProfile = useCallback(async (id: ProfileId, data: { name?: string; avatarPath?: string; isKid?: boolean }) => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      });
      if (!res.ok) return;
      await refetchProfiles();
    } catch {
      // ignore
    }
  }, [refetchProfiles]);

  const createProfile = useCallback(async (data: { name?: string; avatarPath?: string; isKid?: boolean }) => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const created = (await res.json()) as Profile;
      await refetchProfiles();
      if (profiles.length === 0) {
        setCurrentProfileIdState(created.id as ProfileId);
        setStoredProfileId(created.id as ProfileId);
      }
      return created;
    } catch {
      return null;
    }
  }, [profiles.length, refetchProfiles]);

  const deleteProfile = useCallback(async (id: ProfileId) => {
    const res = await fetch(`/api/profiles?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? 'Failed to delete profile');
    }
    await refetchProfiles();
  }, [refetchProfiles]);

  const canAddProfile = profiles.length < MAX_PROFILES;

  const value = useMemo(
    () => ({
      currentProfileId,
      setCurrentProfileId,
      confirmProfileChoice,
      signOut,
      profiles,
      profilesLoaded,
      refetchProfiles,
      updateProfile,
      createProfile,
      deleteProfile,
      canAddProfile,
    }),
    [currentProfileId, setCurrentProfileId, confirmProfileChoice, signOut, profiles, profilesLoaded, refetchProfiles, updateProfile, createProfile, deleteProfile, canAddProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  return ctx ?? defaultValue;
}
