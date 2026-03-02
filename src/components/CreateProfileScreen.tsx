'use client';

import { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { AVATAR_PATHS } from '@/lib/profiles';

export function CreateProfileScreen() {
  const { createProfile } = useProfile();
  const [name, setName] = useState('');
  const [avatarPath, setAvatarPath] = useState(AVATAR_PATHS[0]);
  const [isKid, setIsKid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      const created = await createProfile({
        name: name.trim() || undefined,
        avatarPath,
        isKid,
      });
      if (!created) setError('Could not create profile. Try again.');
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Create your profile</h1>
        <p className="text-white/70 text-center mb-8 text-sm">
          Add a profile so you can have your own list, likes, and settings.
        </p>
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-white/70 mb-2">Avatar</label>
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
          <div>
            <label htmlFor="create-profile-name" className="block text-sm text-white/70 mb-2">
              Name
            </label>
            <input
              id="create-profile-name"
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
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="w-full px-6 py-3 rounded bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {loading ? 'Creating…' : 'Create profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
