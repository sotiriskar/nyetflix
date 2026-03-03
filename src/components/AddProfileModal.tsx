'use client';

import { useEffect, useState } from 'react';
import Close from '@mui/icons-material/Close';
import WarningAmber from '@mui/icons-material/WarningAmber';
import { useProfile } from '@/context/ProfileContext';
import { getFirstUnusedAvatar } from '@/lib/profiles';

interface AddProfileModalProps {
  onClose: () => void;
}

export function AddProfileModal({ onClose }: AddProfileModalProps) {
  const { createProfile, canAddProfile, profiles } = useProfile();
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
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a name');
      return;
    }
    setLoading(true);
    try {
      const avatarPath = getFirstUnusedAvatar(profiles.map((p) => p.avatarPath));
      const created = await createProfile({
        name: trimmedName,
        avatarPath,
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
        className="relative w-full max-w-xl rounded-xl bg-[#181818] shadow-2xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-8 pt-8 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <Close sx={{ fontSize: 26 }} />
          </button>
          <div className="text-center">
            <h2 className="mt-10 text-2xl md:text-3xl font-semibold text-white">Add a profile</h2>
            <p className="mt-4 text-sm text-white/70">
              Add a profile for another person watching Nyetflix.
            </p>
          </div>
        </div>
        <div className="px-10 py-4 space-y-8">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-white/10 shrink-0">
              <img src={getFirstUnusedAvatar(profiles.map((p) => p.avatarPath))} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                placeholder="Name"
                className={`w-full px-5 py-3.5 rounded-lg bg-[#181818] text-white placeholder-white/40 text-base focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent border ${error === 'Please enter a name' ? 'border-amber-400' : 'border-white/20'}`}
              />
              {error === 'Please enter a name' && (
                <p className="flex items-center gap-2 text-amber-400 text-sm">
                  <WarningAmber sx={{ fontSize: 18 }} />
                  Please enter a name
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-white/10" />
          <div className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-5 py-4">
            <div>
              <p className="text-base font-medium text-white">Kids profile</p>
              <p className="text-sm text-white/60 mt-0.5">Only see child-friendly series and films</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isKid}
              onClick={() => setIsKid((k) => !k)}
              className={"relative w-14 h-8 rounded-full transition-colors shrink-0 " + (isKid ? "bg-red-600" : "bg-white/30")}
            >
              <span
                className={"absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform " + (isKid ? "left-7" : "left-1")}
              />
            </button>
          </div>
          {error && error !== 'Please enter a name' && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full px-6 py-4 rounded-lg bg-white text-black text-lg font-semibold hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 pb-6 text-white/80 hover:text-white text-base font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
