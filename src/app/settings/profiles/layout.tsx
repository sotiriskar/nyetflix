import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Profiles - Nyetflix',
};

export default function ProfilesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
