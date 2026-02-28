'use client';

import { useState } from 'react';
import { AppSettingsModal } from '@/components/AppSettingsModal';
import { EditProfileModal } from '@/components/EditProfileModal';
import { TopBar } from '@/components/TopBar';
import { SettingsProvider } from '@/context/SettingsContext';
import { ProgressProvider } from '@/context/ProgressContext';

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  return (
    <SettingsProvider>
      <ProgressProvider>
      <div className="min-h-screen bg-[#141414]">
        <TopBar
          onOpenAccount={() => setEditProfileOpen(true)}
          onOpenAppSettings={() => setAppSettingsOpen(true)}
        />
        <main>{children}</main>
      </div>
      </ProgressProvider>
      {editProfileOpen && (
        <EditProfileModal onClose={() => setEditProfileOpen(false)} />
      )}
      {appSettingsOpen && (
        <AppSettingsModal onClose={() => setAppSettingsOpen(false)} />
      )}
    </SettingsProvider>
  );
}
