'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { WhosWatching } from '@/components/WhosWatching';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { LibraryHandleProvider } from '@/context/LibraryHandleContext';
import { ProgressProvider } from '@/context/ProgressContext';
import { LibraryProvider } from '@/context/LibraryContext';
import { TrailerMuteProvider } from '@/context/TrailerMuteContext';
import { TrailerResumeProvider } from '@/context/TrailerResumeContext';
import { ConversionStatusProvider } from '@/context/ConversionStatusContext';
import { MyListProvider } from '@/hooks/useMyList';
import { LikedProvider } from '@/hooks/useLiked';

function AppWithProviders({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <LibraryHandleProvider>
        <LibraryProvider>
          <ProgressProvider>
            <ConversionStatusProvider>
              <MyListProvider>
                <LikedProvider>
                  <TrailerMuteProvider>
                    <TrailerResumeProvider>
                      <div className="min-h-screen bg-[#141414]">
                        <Suspense fallback={null}>
                          <TopBar />
                        </Suspense>
                        <main>{children}</main>
                      </div>
                    </TrailerResumeProvider>
                  </TrailerMuteProvider>
                </LikedProvider>
              </MyListProvider>
            </ConversionStatusProvider>
          </ProgressProvider>
        </LibraryProvider>
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
