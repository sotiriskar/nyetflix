'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ChevronRight from '@mui/icons-material/ChevronRight';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useProfile } from '@/context/ProfileContext';
import { AddProfileModal } from '@/components/AddProfileModal';

export default function SettingsProfilesPage() {
  const router = useRouter();
  const { profiles, currentProfileId, canAddProfile } = useProfile();
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-white/10">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex items-center justify-center w-9 h-9 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowBack sx={{ fontSize: 22 }} />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Profiles</h1>
      </div>

      <section className="max-w-2xl">
        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#181818]">
          <ul className="space-y-0">
            {profiles.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/settings/profile/${p.id}`}
                  className="flex items-center gap-4 py-4 px-5 border-b border-white/10 last:border-b-0 text-white hover:bg-white/5 transition-colors group"
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-white/10 shrink-0">
                    <img src={p.avatarPath} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="flex-1 min-w-0 font-medium">{p.name}</span>
                  {currentProfileId === p.id && (
                    <span className="text-xs font-medium text-white bg-[#54a3ff]/30 px-2.5 py-1 rounded shrink-0">
                      Your profile
                    </span>
                  )}
                  <ChevronRight sx={{ fontSize: 24, color: 'rgba(255,255,255,0.5)' }} className="group-hover:text-white/80" />
                </Link>
              </li>
            ))}
          </ul>

          {canAddProfile && (
            <>
              <div className="p-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="w-full py-3.5 px-4 rounded-lg bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
                >
                  Add Profile
                </button>
              </div>
              <p className="px-5 pb-5 text-center text-sm text-white/60">
                Add up to 5 profiles for anyone who lives with you.
              </p>
            </>
          )}
        </div>
      </section>

      {addModalOpen && (
        <AddProfileModal onClose={() => setAddModalOpen(false)} />
      )}
    </>
  );
}
