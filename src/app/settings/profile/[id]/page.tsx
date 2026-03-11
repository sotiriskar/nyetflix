'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ArrowBack from '@mui/icons-material/ArrowBack';
import EditOutlined from '@mui/icons-material/EditOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import Translate from '@mui/icons-material/Translate';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import { useProfile } from '@/context/ProfileContext';
import { useSettings } from '@/context/SettingsContext';
import { AVATAR_PATHS } from '@/lib/profiles';
import type { AppLanguage, SubtitlePreference } from '@/context/SettingsContext';
import type { Profile } from '@/context/ProfileContext';
import type { ProfileId } from '@/lib/profiles';
import { SUBTITLE_PREFERENCE_OPTIONS } from '@/lib/subtitleLabels';

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'el', label: 'Greek' },
];

async function fetchProfile(id: number): Promise<Profile | null> {
  const res = await fetch('/api/profiles');
  if (!res.ok) return null;
  const list = (await res.json()) as Profile[];
  return list.find((p) => p.id === id) ?? null;
}

async function fetchSettings(profileId: number) {
  const res = await fetch('/api/settings', { headers: { 'X-Profile-Id': String(profileId) } });
  if (!res.ok) return null;
  return res.json() as Promise<{ language: AppLanguage; subtitleLanguage: SubtitlePreference; moviesFolderPath: string } | null>;
}

async function saveProfile(id: ProfileId, data: { name?: string; avatarPath?: string; isKid?: boolean }) {
  const res = await fetch('/api/profiles', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  });
  return res.ok;
}

async function saveSettings(profileId: number, data: { language?: AppLanguage; subtitleLanguage?: SubtitlePreference; moviesFolderPath?: string }) {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Profile-Id': String(profileId) },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export default function SettingsProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? parseInt(params.id, 10) : NaN;
  const profileId = (id >= 1 && id <= 5 ? id : null) as ProfileId | null;
  const { currentProfileId, refetchProfiles, deleteProfile, profiles } = useProfile();
  const { setSubtitleLanguage: setContextSubtitleLang, setLanguage: setContextLanguage, setMoviesFolderPath: setContextPath } = useSettings();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [subtitleLanguage, setSubtitleLanguage] = useState<SubtitlePreference>('off');
  const [moviesFolderPath, setMoviesFolderPath] = useState('');
  const [name, setName] = useState('');
  const [avatarPath, setAvatarPath] = useState('');
  const [isKid, setIsKid] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profileId == null || !Number.isFinite(profileId)) {
      setLoaded(true);
      return;
    }
    Promise.all([fetchProfile(profileId), fetchSettings(profileId)]).then(([p, s]) => {
      if (p) {
        setProfile(p);
        setName(p.name);
        setAvatarPath(p.avatarPath);
        setIsKid(p.isKid);
      }
      if (s) {
        setLanguage(s.language ?? 'en');
        setSubtitleLanguage(s.subtitleLanguage ?? 'off');
        setMoviesFolderPath(s.moviesFolderPath ?? '');
      }
      setLoaded(true);
    });
  }, [profileId]);

  const handleSaveProfile = useCallback(() => {
    if (profileId == null) return;
    saveProfile(profileId, { name: name.trim() || 'Profile', avatarPath, isKid }).then((ok) => {
      if (ok) refetchProfiles();
    });
  }, [profileId, name, avatarPath, isKid, refetchProfiles]);

  const isLastProfile = profiles.length <= 1;
  const handleDeleteProfile = useCallback(() => {
    if (profileId == null || deleting || isLastProfile) return;
    setDeleting(true);
    deleteProfile(profileId).then(() => {
      router.push('/settings/profiles');
    }).finally(() => setDeleting(false));
  }, [profileId, deleting, isLastProfile, deleteProfile, router]);

  const handleLanguageChange = useCallback(
    (lang: AppLanguage) => {
      setLanguage(lang);
      if (profileId === currentProfileId) setContextLanguage(lang);
      if (profileId != null) saveSettings(profileId, { language: lang });
    },
    [profileId, currentProfileId, setContextLanguage]
  );

  const handleSubtitleChange = useCallback(
    (lang: SubtitlePreference) => {
      setSubtitleLanguage(lang);
      if (profileId === currentProfileId) setContextSubtitleLang(lang);
      if (profileId != null) saveSettings(profileId, { subtitleLanguage: lang });
    },
    [profileId, currentProfileId, setContextSubtitleLang]
  );

  const handleMoviesPathChange = useCallback(
    (path: string) => {
      setMoviesFolderPath(path);
      setContextPath(path);
    },
    [setContextPath]
  );

  const handleClearLibrary = useCallback(() => {
    handleMoviesPathChange('');
  }, [handleMoviesPathChange]);

  if (!loaded) {
    return (
      <div className="py-12 text-center text-white/60">Loading…</div>
    );
  }

  if (profileId == null || !profile) {
    return (
      <div className="py-12">
        <p className="text-white/60 mb-4">Profile not found.</p>
        <Link href="/settings/profiles" className="text-[#54a3ff] hover:underline">
          ← Back to Profiles
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-white/10">
        <button
          type="button"
          onClick={() => router.push('/settings/profiles')}
          className="flex items-center justify-center w-9 h-9 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Back to Profiles"
        >
          <ArrowBack sx={{ fontSize: 22 }} />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          Preferences
        </h1>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#181818] p-5 md:p-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Avatar with edit overlay - pencil centered, low opacity black circle, black pencil on hover */}
            <div className="relative shrink-0 group">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden bg-white/10 ring-1 ring-white/10">
                <img src={avatarPath} alt="" className="w-full h-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarPicker((v) => !v)}
                className="absolute inset-0 flex items-center justify-center rounded-xl transition-colors"
                aria-label="Change avatar"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-full bg-black/40 group-hover:bg-black/50 transition-colors">
                  <EditOutlined sx={{ fontSize: 20 }} className="text-white group-hover:text-black transition-colors" />
                </span>
              </button>
            </div>

            {/* Profile name + Kid option */}
            <div className="flex-1 min-w-0 w-full">
              <label className="block text-sm text-white/60 mb-1.5">Profile name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSaveProfile}
                placeholder="Name"
                className="w-full max-w-sm px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 text-white font-semibold placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
              />
              <label className="flex items-center gap-2 text-sm text-white/90 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isKid}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsKid(checked);
                    saveProfile(profileId, { isKid: checked }).then((ok) => {
                      if (ok) void refetchProfiles();
                    });
                  }}
                  className="w-4 h-4 rounded accent-red-600"
                />
                Kids profile
              </label>
              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="px-5 py-2.5 rounded-lg border border-white/30 text-white text-sm font-medium hover:bg-white/10 hover:border-white/50 transition-colors"
                >
                  Save name
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProfile}
                  disabled={deleting || isLastProfile}
                  className="px-5 py-2.5 rounded-lg border border-red-600/50 text-red-500 text-sm font-medium hover:bg-red-500/10 hover:border-red-500/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting…' : 'Delete Profile'}
                </button>
              </div>
            </div>
          </div>

          {/* Avatar picker (toggled by edit button) */}
          {showAvatarPicker && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-sm text-white/60 mb-3">Choose avatar</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PATHS.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      setAvatarPath(path);
                      saveProfile(profileId, { avatarPath: path }).then((ok) => {
                        if (ok) void refetchProfiles();
                      });
                    }}
                    className={
                      'w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 ' +
                      (avatarPath === path
                        ? 'border-white'
                        : 'border-transparent hover:border-white/50')
                    }
                  >
                    <img src={path} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Preferences</h2>
        <div className="rounded-lg border border-white/10 overflow-hidden bg-[#181818] divide-y divide-white/10">
          <div className="flex items-center justify-between gap-4 py-4 px-4">
            <div className="flex items-center gap-3">
              <Translate sx={{ fontSize: 24, color: 'rgba(255,255,255,0.6)' }} />
              <div>
                <p className="font-medium text-white">Languages</p>
                <p className="text-sm text-white/60">Set languages for display and audio.</p>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as AppLanguage)}
              className="px-3 py-2 rounded border border-white/20 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {LANGUAGE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value} className="bg-[#181818] text-white">{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 py-4 px-4">
            <div className="flex items-center gap-3">
              <SubtitlesOutlined sx={{ fontSize: 24, color: 'rgba(255,255,255,0.6)' }} />
              <div>
                <p className="font-medium text-white">Subtitle appearance</p>
                <p className="text-sm text-white/60">Customise the way subtitles appear.</p>
              </div>
            </div>
            <select
              value={SUBTITLE_PREFERENCE_OPTIONS.some((o) => o.value === subtitleLanguage) ? subtitleLanguage : 'off'}
              onChange={(e) => handleSubtitleChange(e.target.value as SubtitlePreference)}
              className="px-3 py-2 rounded border border-white/20 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {SUBTITLE_PREFERENCE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value} className="bg-[#181818] text-white">{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-start gap-4 py-4 px-4">
            <div className="flex items-center gap-3 shrink-0">
              <FolderOutlined sx={{ fontSize: 24, color: 'rgba(255,255,255,0.6)' }} />
              <p className="font-medium text-white">Media library folder</p>
            </div>
            <div className="flex-1 min-w-0 flex gap-2">
              <input
                type="text"
                value={moviesFolderPath}
                onChange={(e) => setMoviesFolderPath(e.target.value)}
                onBlur={(e) => handleMoviesPathChange(e.target.value)}
                placeholder="e.g. C:\Movies"
                className="flex-1 min-w-[200px] px-3 py-2 rounded border border-white/20 bg-white/5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <button
                type="button"
                onClick={handleClearLibrary}
                disabled={!moviesFolderPath}
                className="px-4 py-2 rounded border border-white/20 text-white/90 text-sm hover:bg-white/10 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
