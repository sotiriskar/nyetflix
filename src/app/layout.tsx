import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClientShell } from './ClientShell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-app',
});

export const metadata: Metadata = {
  title: 'Nyetflix',
  description: 'Your personal Netflix-style library',
  icons: {
    icon: '/static/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className}`}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
