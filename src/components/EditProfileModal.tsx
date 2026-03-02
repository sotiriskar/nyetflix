import { useEffect, useState } from 'react';
import Close from '@mui/icons-material/Close';
import { useProfile } from '@/context/ProfileContext';
import { AVATAR_PATHS } from '@/lib/profiles';

interface EditProfileModalProps {
  onClose: () => void;
}

export function EditProfileModal({ onClose }: EditProfileModalProps) {
  const { currentProfileId, profiles, updateProfile } = useProfile();
  const currentProfile = profiles.find((p) => p.id === currentProfileId);
  const [name, setName] = useState(currentProfile?.name ?? '');
  const [isKid, setIsKid] = useState(currentProfile?.isKid ?? false);
  const [avatarPath, setAvatarPath] = useState(currentProfile?.avatarPath ?? AVATAR_PATHS[0]);

  useEffect(() => {
    if (currentProfile) {
      setName(currentProfile.name);
      setIsKid(currentProfile.isKid);
      setAvatarPath(currentProfile.avatarPath);
    }
  }, [currentProfile]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSave = () => {
    if (currentProfileId == null) return;
    updateProfile(currentProfileId, {
      name: name.trim() || 'Profile',
      isKid,
      avatarPath,
    });
    onClose();
  };

  const handleCancel = () => {
    if (currentProfile) {
      setName(currentProfile.name);
      setIsKid(currentProfile.isKid);
      setAvatarPath(currentProfile.avatarPath);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit profile"
    >
      <div
        className="relative w-full max-w-xl rounded-lg bg-[#181818] shadow-2xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Edit profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <Close sx={{ fontSize: 24 }} />
          </button>
        </div>

        <div className="p-8">
          {/* Avatar picker */}
          <div className="mb-6">
            <label className="block text-sm text-white/70 mb-3">Avatar</label>
            <div className="flex flex-wrap gap-3">
              {AVATAR_PATHS.map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => setAvatarPath(path)}
                  className={`w-14 h-14 rounded overflow-hidden shrink-0 border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 ${
                    avatarPath === path ? 'border-white' : 'border-transparent hover:border-white/50'
                  }`}
                >
                  <img src={path} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          {/* Name + Kid */}
          <div className="flex flex-col gap-5 mb-10">
            <div>
              <label htmlFor="profile-name" className="block text-sm text-white/70 mb-2">
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Profile name"
                className="w-full px-4 py-2.5 rounded bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-white/90 hover:text-white">
              <input
                type="checkbox"
                checked={isKid}
                onChange={(e) => setIsKid(e.target.checked)}
                className="w-4 h-4 rounded accent-red-600"
              />
              <span>Kid?</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              className="px-7 py-3 rounded bg-white text-black font-semibold hover:bg-white/90 transition-colors"
            >
              SAVE
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-7 py-3 rounded border border-white/50 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
