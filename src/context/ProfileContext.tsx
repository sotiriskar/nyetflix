'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ProfileId } from '@/lib/profiles';
import { MAX_PROFILES } from '@/lib/profiles';

const STORAGE_KEY = 'nyetflix-current-profile-id';
const STORAGE_KEY_CHOSEN_AT = 'nyetflix-profile-chosen-at';
/** Cache "who's watching" choice for 24 hours. */
const CHOSEN_AT_TTL_MS = 24 * 60 * 60 * 1000;

export interface Profile {
  id: number;
  name: string;
  avatarPath: string;
  isKid: boolean;
}

export interface ProfileContextValue {
  currentProfileId: ProfileId | null;
  setCurrentProfileId: (id: ProfileId | null) => void;
  /** Call when user picks a profile on "Who's watching?" – sets profile and caches for ~24h. */
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

function getStoredProfileId(): ProfileId | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v == null || v === '') return null;
    const n = parseInt(v, 10);
    if (n >= 1 && n <= MAX_PROFILES) return n as ProfileId;
  } catch {
    // ignore
  }
  return null;
}

function setStoredProfileId(id: ProfileId | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // ignore
  }
}

function getStoredChosenAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY_CHOSEN_AT);
    if (v == null || v === '') return null;
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return null;
    return n;
  } catch {
    return null;
  }
}

function setStoredChosenAt(ts: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CHOSEN_AT, String(ts));
  } catch {
    // ignore
  }
}

function clearStoredChosenAt() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_CHOSEN_AT);
  } catch {
    // ignore
  }
}

/** True if a profile was chosen on "Who's watching?" within the last 24h and that profile still exists. */
export function hasValidCachedProfile(profileIds: number[]): boolean {
  const id = getStoredProfileId();
  if (id == null || !profileIds.includes(id)) return false;
  const at = getStoredChosenAt();
  if (at == null) return false;
  return Date.now() - at < CHOSEN_AT_TTL_MS;
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
        const first = list[0].id as ProfileId;
        setStoredProfileId(first);
        return first;
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
    setStoredChosenAt(Date.now());
  }, []);

  const signOut = useCallback(() => {
    setCurrentProfileIdState(null);
    setStoredProfileId(null);
    clearStoredChosenAt();
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
        setStoredChosenAt(Date.now());
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
