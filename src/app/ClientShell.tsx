'use client';

import { CreateProfileScreen } from '@/components/CreateProfileScreen';
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
  const { profiles } = useProfile();
  if (profiles.length === 0) {
    return <CreateProfileScreen />;
  }
  return <AppWithProviders>{children}</AppWithProviders>;
}
