import type { Metadata } from 'next';
import { FilmsPage } from '@/views/FilmsPage';

export const metadata: Metadata = {
  title: 'Films - Nyetflix',
};

export default function FilmsRoute() {
  return <FilmsPage />;
}
