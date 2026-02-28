import type { Metadata } from 'next';
import { ClientShell } from './ClientShell';
import './globals.css';

/* eslint-disable react-refresh/only-export-components */
export const metadata: Metadata = {
  title: 'nyetflix',
  description: 'Your personal Netflix-style library',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
