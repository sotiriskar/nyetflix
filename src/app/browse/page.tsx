import type { Metadata } from 'next';
import { HomePage } from '@/views/HomePage';

export const metadata: Metadata = {
  title: 'Home - Nyetflix',
};

export default function BrowsePage() {
  return <HomePage />;
}
