'use client';

import { usePathname } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { WhosWatching } from '@/components/WhosWatching';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { LibraryHandleProvider } from '@/context/LibraryHandleContext';
import { ProgressProvider } from '@/context/ProgressContext';
import { TrailerMuteProvider } from '@/context/TrailerMuteContext';
import { TrailerResumeProvider } from '@/context/TrailerResumeContext';

function AppWithProviders({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <LibraryHandleProvider>
        <ProgressProvider>
          <TrailerMuteProvider>
          <TrailerResumeProvider>
          <div className="min-h-screen bg-[#141414]">
            <TopBar />
            <main>{children}</main>
          </div>
          </TrailerResumeProvider>
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
  const pathname = usePathname();
  const { profilesLoaded, profiles, currentProfileId } = useProfile();

  if (!profilesLoaded) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center" aria-busy="true">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
      </div>
    );
  }

  const isOnSettingsProfiles = pathname?.startsWith('/settings/profile') ?? false;
  const hasChosenProfile = currentProfileId != null && profiles.some((p) => p.id === currentProfileId);
  const showWhosWatching =
    profiles.length > 0 && !hasChosenProfile && !isOnSettingsProfiles;

  if (showWhosWatching) {
    return <WhosWatching />;
  }

  return <AppWithProviders>{children}</AppWithProviders>;
}
