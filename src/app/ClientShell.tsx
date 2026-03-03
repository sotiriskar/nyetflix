'use client';

import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { AppSettingsModal } from '@/components/AppSettingsModal';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { LibraryHandleProvider } from '@/context/LibraryHandleContext';
import { ProgressProvider } from '@/context/ProgressContext';
import { TrailerMuteProvider } from '@/context/TrailerMuteContext';

function AppWithProviders({ children }: { children: React.ReactNode }) {
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  return (
    <SettingsProvider>
      <LibraryHandleProvider>
        <ProgressProvider>
          <TrailerMuteProvider>
          <div className="min-h-screen bg-[#141414]">
            <TopBar onOpenAppSettings={() => setAppSettingsOpen(true)} />
            <main>{children}</main>
          </div>
          {appSettingsOpen && (
            <AppSettingsModal onClose={() => setAppSettingsOpen(false)} />
          )}
          </TrailerMuteProvider>
        </ProgressProvider>
      </LibraryHandleProvider>
    </SettingsProvider>
  );
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <ProfileGate>{children}</ProfileGate>
    </ProfileProvider>
  );
}

function ProfileGate({ children }: { children: React.ReactNode }) {
  const { profilesLoaded } = useProfile();
  if (!profilesLoaded) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center" aria-busy="true">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
      </div>
    );
  }
  return <AppWithProviders>{children}</AppWithProviders>;
}
