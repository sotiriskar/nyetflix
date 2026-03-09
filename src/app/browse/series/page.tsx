import type { Metadata } from 'next';
import { SeriesPage } from '@/views/SeriesPage';

export const metadata: Metadata = {
  title: 'Series - Nyetflix',
};

export default function BrowseSeriesRoute() {
  return <SeriesPage />;
}
