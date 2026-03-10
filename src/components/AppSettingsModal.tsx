import { useCallback, useEffect, useState } from 'react';
import Close from '@mui/icons-material/Close';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import Translate from '@mui/icons-material/Translate';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import { useProfile } from '@/context/ProfileContext';
import { AVATAR_PATHS, getFirstUnusedAvatar } from '@/lib/profiles';
import type { ProfileId } from '@/lib/profiles';
import {
  useSettings,
  type AppLanguage,
  type SubtitlePreference,
} from '../context/SettingsContext';
import { LIBRARY_HANDLE_MODE } from '@/context/LibraryHandleContext';
import { removeLibraryHandle } from '@/lib/libraryHandleStorage';

interface AppSettingsModalProps {
  onClose: () => void;
}

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'el', label: 'Greek' },
];

const SUBTITLE_OPTIONS: { value: SubtitlePreference; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'en', label: 'English' },
  { value: 'el', label: 'Greek' },
];

export function AppSettingsModal({ onClose }: AppSettingsModalProps) {
  const {
    language,
    subtitleLanguage,
    moviesFolderPath,
    setLanguage,
    setSubtitleLanguage,
    setMoviesFolderPath,
    clearMoviesFolderPath,
  } = useSettings();
  const { profiles, canAddProfile, createProfile, deleteProfile, currentProfileId } = useProfile();
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatarPath, setNewAvatarPath] = useState<string>(AVATAR_PATHS[0]);
  const [newIsKid, setNewIsKid] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<ProfileId | null>(null);
  const isHandleMode = moviesFolderPath === LIBRARY_HANDLE_MODE;

  const handleClearLibrary = useCallback(async () => {
    if (currentProfileId != null && isHandleMode) {
      await removeLibraryHandle(currentProfileId);
    }
    clearMoviesFolderPath();
  }, [currentProfileId, isHandleMode, clearMoviesFolderPath]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (addProfileOpen) {
      setNewAvatarPath(getFirstUnusedAvatar(profiles.map((p) => p.avatarPath)));
    }
  }, [addProfileOpen, profiles]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="App Settings"
    >
      <div
        className="relative w-full max-w-xl rounded-lg bg-[#181818] shadow-2xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">App Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <Close sx={{ fontSize: 24 }} />
          </button>
        </div>

        <div className="p-8 space-y-10">
          {/* Language */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Translate sx={{ fontSize: 20, color: 'white' }} />
              <h3 className="text-sm font-medium text-white">Language</h3>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as AppLanguage)}
              className="w-full max-w-xs px-4 py-2.5 rounded bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent appearance-none cursor-pointer bg-no-repeat bg-[length:1rem] bg-[right_0.5rem_center] pr-10"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")" }}
            >
              {LANGUAGE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value} className="bg-[#181818] text-white">
                  {label}
                </option>
              ))}
            </select>
          </section>

          {/* Subtitle preference */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <SubtitlesOutlined sx={{ fontSize: 20, color: 'white' }} />
              <h3 className="text-sm font-medium text-white">Subtitle preference</h3>
            </div>
            <select
              value={subtitleLanguage}
              onChange={(e) => setSubtitleLanguage(e.target.value as SubtitlePreference)}
              className="w-full max-w-xs px-4 py-2.5 rounded bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent appearance-none cursor-pointer bg-no-repeat bg-[length:1rem] bg-[right_0.5rem_center] pr-10"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23fff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")" }}
            >
              {SUBTITLE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value} className="bg-[#181818] text-white">
                  {label}
                </option>
              ))}
            </select>
          </section>

          {/* Profiles: create up to 5 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <PersonOutlined sx={{ fontSize: 20, color: 'white' }} />
              <h3 className="text-sm font-medium text-white">Profiles</h3>
            </div>
            <p className="text-xs text-white/60 mb-3">
              You can have up to 5 profiles. Each has its own list, likes, and settings.
            </p>
            <div className="space-y-2 mb-4">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 py-2 px-3 rounded bg-white/5 border border-white/10"
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-white/10 shrink-0">
                    <img src={p.avatarPath} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-white flex-1 min-w-0 truncate">{p.name}</span>
                  {currentProfileId === p.id && (
                    <span className="text-xs text-white/50 shrink-0">Current</span>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (deletingId != null || profiles.length <= 1) return;
                      setDeletingId(p.id as ProfileId);
                      try {
                        await deleteProfile(p.id as ProfileId);
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                    disabled={deletingId != null || profiles.length <= 1}
                    className="px-3 py-1.5 rounded text-sm text-red-500 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletingId === p.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
            {canAddProfile && !addProfileOpen && (
              <button
                type="button"
                onClick={() => setAddProfileOpen(true)}
                className="px-4 py-2.5 rounded text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
              >
                Add profile
              </button>
            )}
            {canAddProfile && addProfileOpen && (
              <div className="p-4 rounded bg-white/5 border border-white/10 space-y-4">
                <div>
                  <label className="block text-xs text-white/70 mb-2">Avatar</label>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_PATHS.map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => setNewAvatarPath(path)}
                        className={`w-10 h-10 rounded overflow-hidden border-2 transition-colors ${newAvatarPath === path ? 'border-white' : 'border-transparent hover:border-white/50'}`}
                      >
                        <img src={path} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-2">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Profile name"
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-white/90 text-sm">
                  <input
                    type="checkbox"
                    checked={newIsKid}
                    onChange={(e) => setNewIsKid(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-600"
                  />
                  Kid?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setAddLoading(true);
                      await createProfile({ name: newName.trim() || undefined, avatarPath: newAvatarPath, isKid: newIsKid });
                      setAddLoading(false);
                      setAddProfileOpen(false);
                      setNewName('');
                      setNewAvatarPath(AVATAR_PATHS[0]);
                      setNewIsKid(false);
                    }}
                    disabled={addLoading}
                    className="px-4 py-2 rounded bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50"
                  >
                    {addLoading ? 'Creating…' : 'Create profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddProfileOpen(false);
                      setNewName('');
                      setNewAvatarPath(AVATAR_PATHS[0]);
                      setNewIsKid(false);
                    }}
                    className="px-4 py-2 rounded border border-white/50 text-white text-sm font-medium hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Media library folder */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FolderOutlined sx={{ fontSize: 20, color: 'white' }} />
              <h3 className="text-sm font-medium text-white">Media library folder</h3>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <input
                type="text"
                value={moviesFolderPath}
                onChange={(e) => setMoviesFolderPath(e.target.value)}
                placeholder="e.g. /Users/me/Movies or C:\Movies"
                className="flex-1 min-w-[200px] px-3 py-2.5 rounded bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleClearLibrary}
                disabled={!moviesFolderPath}
                className="px-4 py-2.5 rounded text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Clear
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
