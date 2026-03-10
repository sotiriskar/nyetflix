import { BrowseLayout } from '@/components/BrowseLayout';

export default function BrowseLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BrowseLayout>{children}</BrowseLayout>;
}
