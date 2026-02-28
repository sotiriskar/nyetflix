import { Suspense } from 'react';
import { SearchPage } from '@/views/SearchPage';

function SearchFallback() {
  return (
    <div className="min-h-screen bg-[#141414] pt-28 px-6 md:px-12">
      <div className="h-8 w-64 bg-white/10 rounded animate-pulse mb-6" />
      <div className="grid gap-3 gap-y-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-video bg-white/10 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function SearchRoute() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchPage />
    </Suspense>
  );
}
