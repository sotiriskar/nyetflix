'use client';

import { TopBar } from '@/components/TopBar';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ProgressProvider } from '@/context/ProgressContext';

function AppWithProviders({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ProgressProvider>
        <div className="min-h-screen bg-[#141414]">
          <TopBar />
          <main>{children}</main>
        </div>
      </ProgressProvider>
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
