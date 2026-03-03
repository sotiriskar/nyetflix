import type { Metadata } from 'next';
import { MyListPage } from '@/views/MyListPage';

export const metadata: Metadata = {
  title: 'My List - Nyetflix',
};

export default function MyListRoute() {
  return <MyListPage />;
}
