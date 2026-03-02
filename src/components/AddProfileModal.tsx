'use client';

import { useEffect, useState } from 'react';
import Close from '@mui/icons-material/Close';
import { useProfile } from '@/context/ProfileContext';
import { AVATAR_PATHS } from '@/lib/profiles';

interface AddProfileModalProps {
  onClose: () => void;
}

export function AddProfileModal({ onClose }: AddProfileModalProps) {
  const { createProfile, canAddProfile } = useProfile();
  const [name, setName] = useState('');
  const [isKid, setIsKid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSave = async () => {
    setError(null);
    setLoading(true);
    try {
      const created = await createProfile({
        name: name.trim() || undefined,
        avatarPath: AVATAR_PATHS[0],
        isKid,
      });
      if (created) onClose();
      else setError('Could not create profile. Try again.');
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (!canAddProfile) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add a profile"
    >
      <div
        className="relative w-full max-w-md rounded-lg bg-[#181818] shadow-2xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Add a profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <Close sx={{ fontSize: 22 }} />
          </button>
        </div>
        <p className="px-6 pt-4 text-sm text-white/70">
          Add a profile for another person watching Nyetflix.
        </p>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded overflow-hidden bg-white/10 shrink-0">
              <img src={AVATAR_PATHS[0]} alt="" className="w-full h-full object-cover" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="flex-1 px-4 py-2.5 rounded bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Kids profile</p>
              <p className="text-xs text-white/60">Only see child-friendly series and films</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isKid}
              onClick={() => setIsKid((k) => !k)}
              className={"relative w-12 h-7 rounded-full transition-colors " + (isKid ? "bg-red-600" : "bg-white/30")}
            >
              <span
                className={"absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform " + (isKid ? "left-7" : "left-1")}
              />
            </button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full px-6 py-3 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-white/80 hover:text-white text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
