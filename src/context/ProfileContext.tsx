'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ProfileId } from '@/lib/profiles';
import { MAX_PROFILES } from '@/lib/profiles';

const STORAGE_KEY = 'nyetflix-current-profile-id';

export interface Profile {
  id: number;
  name: string;
  avatarPath: string;
  isKid: boolean;
}

export interface ProfileContextValue {
  currentProfileId: ProfileId | null;
  setCurrentProfileId: (id: ProfileId | null) => void;
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
    try {
      const res = await fetch(`/api/profiles?id=${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      await refetchProfiles();
      // refetchProfiles already syncs currentProfileId to first remaining or null
    } catch {
      // ignore
    }
  }, [refetchProfiles]);

  const canAddProfile = profiles.length < MAX_PROFILES;

  const value = useMemo(
    () => ({
      currentProfileId,
      setCurrentProfileId,
      profiles,
      profilesLoaded,
      refetchProfiles,
      updateProfile,
      createProfile,
      deleteProfile,
      canAddProfile,
    }),
    [currentProfileId, setCurrentProfileId, profiles, profilesLoaded, refetchProfiles, updateProfile, createProfile, deleteProfile, canAddProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  return ctx ?? defaultValue;
}
