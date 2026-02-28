import { useEffect } from 'react';
import Close from '@mui/icons-material/Close';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import Translate from '@mui/icons-material/Translate';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import {
  useSettings,
  type AppLanguage,
} from '../context/SettingsContext';

interface AppSettingsModalProps {
  onClose: () => void;
}

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

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
              onChange={(e) => setSubtitleLanguage(e.target.value as AppLanguage)}
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

          {/* Media library folder */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FolderOutlined sx={{ fontSize: 20, color: 'white' }} />
              <h3 className="text-sm font-medium text-white">Media library folder</h3>
            </div>
            <p className="text-xs text-white/60 mb-3">
              Type or paste the full folder path where your movies are stored. Changes are saved automatically.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={moviesFolderPath}
                onChange={(e) => setMoviesFolderPath(e.target.value)}
                placeholder="e.g. /Users/me/Movies or C:\Movies"
                className="flex-1 min-w-0 px-3 py-2.5 rounded bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
              />
              <button
                type="button"
                onClick={clearMoviesFolderPath}
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
