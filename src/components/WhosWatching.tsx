'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useProfile } from '@/context/ProfileContext';
import { AddProfileModal } from '@/components/AddProfileModal';

export function WhosWatching() {
  const router = useRouter();
  const { profiles, confirmProfileChoice, canAddProfile } = useProfile();
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center px-6 py-16">
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white text-center mb-14 md:mb-16">
        Who&apos;s watching?
      </h1>

      <div className="flex flex-wrap justify-center gap-10 md:gap-12 lg:gap-14 max-w-5xl">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => confirmProfileChoice(p.id as import('@/lib/profiles').ProfileId)}
            className="flex flex-col items-center gap-4 group"
          >
            <div className="w-32 h-32 md:w-40 md:h-40 lg:w-44 lg:h-44 rounded-lg overflow-hidden bg-white/10 border-2 border-transparent group-hover:border-4 group-hover:border-white transition-all duration-200 shrink-0">
              <img
                src={p.avatarPath}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-white/90 group-hover:text-white text-lg md:text-xl truncate max-w-[140px] md:max-w-[180px]">
              {p.name}
            </span>
          </button>
        ))}
        {canAddProfile && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex flex-col items-center gap-4 group"
          >
            <div className="w-32 h-32 md:w-40 md:h-40 lg:w-44 lg:h-44 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 text-gray-400 group-hover:bg-white/90">
              <AddCircleIcon sx={{ fontSize: 128 }} />
            </div>
            <span className="text-white/90 group-hover:text-white text-lg md:text-xl">
              Add Profile
            </span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => router.push('/settings/profiles')}
        className="mt-16 md:mt-20 px-8 py-3 rounded border border-white/60 text-white/90 text-base md:text-lg font-medium hover:bg-white/10 hover:text-white transition-colors"
      >
        Manage Profiles
      </button>

      {addModalOpen && (
        <AddProfileModal
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
}
