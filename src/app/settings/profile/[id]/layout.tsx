import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Settings - Nyetflix',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
