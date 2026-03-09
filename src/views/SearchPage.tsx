'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CarouselItem } from '@/types/movie';
import type { MovieDetail } from '@/types/movie';
import { CarouselHoverCard } from '@/components/CarouselHoverCard';
import { DetailCard } from '@/components/DetailCard';
import { LibraryRefreshButton } from '@/components/LibraryRefreshButton';
import { useLibrary } from '@/hooks/useLibrary';
import { LIBRARY_HANDLE_MODE } from '@/context/LibraryHandleContext';
import { useLiked } from '@/hooks/useLiked';
import { useMyList } from '@/hooks/useMyList';
import { useSettings } from '@/context/SettingsContext';
import { useProgress } from '@/context/ProgressContext';
import { buildWatchUrl } from '@/lib/watchUrl';

export function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();
  const { moviesFolderPath } = useSettings();
  const { carousels: libraryCarousels, detailsMap, loading, error, refresh } = useLibrary(moviesFolderPath);
  const { toggle: toggleMyList, has: isInMyList } = useMyList();
  const { toggle: toggleLiked, has: isLiked } = useLiked();
  const { progressByItemId, getProgress } = useProgress();
  const [selectedItem, setSelectedItem] = useState<CarouselItem | null>(null);

  const handlePlay = useCallback(
    (item: CarouselItem) => {
      const prog = getProgress(item.id);
      const isSeries = detailsMap[item.id]?.mediaType === 'series';
      const resumeEpisodeId = isSeries ? prog?.lastEpisodeId : undefined;
      const id = resumeEpisodeId ?? item.id;
      const seriesTitle = isSeries ? (detailsMap[item.id]?.title ?? undefined) : undefined;
      const path = moviesFolderPath?.trim() ?? '';
      if (path && path !== LIBRARY_HANDLE_MODE) void fetch(`/api/scan-library?path=${encodeURIComponent(path)}`);
      router.push(buildWatchUrl(id, { seriesTitle }));
    },
    [moviesFolderPath, detailsMap, getProgress, router]
  );

  const getDetail = useMemo(
    () => (id: string): MovieDetail | undefined => {
      const d = detailsMap[id];
      if (!d) return d;
      const prog = progressByItemId[id];
      if (prog == null) return d;
      return { ...d, progress: prog.progress };
    },
    [detailsMap, progressByItemId]
  );

  const results = useMemo(() => {
    if (!q || libraryCarousels.length === 0) return [];
    const allItems = libraryCarousels[0].items ?? [];
    const lower = q.toLowerCase();
    return allItems.filter((item) => {
      const title = detailsMap[item.id]?.title ?? item.title;
      return title.toLowerCase().includes(lower);
    });
  }, [q, libraryCarousels, detailsMap]);

  const moreLikeThisItems = useMemo(() => {
    if (!selectedItem || results.length === 0) return [];
    return results.filter((item) => item.id !== selectedItem.id).slice(0, 6);
  }, [results, selectedItem?.id]);

  const detail: MovieDetail | undefined = selectedItem
    ? (getDetail?.(selectedItem.id) ?? {
        id: selectedItem.id,
        title: selectedItem.title,
        posterUrl: selectedItem.posterUrl,
        description: 'No description available.',
      })
    : undefined;

  const hasPath = moviesFolderPath.trim() !== '';
  const hasLibraryData = hasPath && !error && libraryCarousels.length > 0;

  if (!hasLibraryData) {
    return (
      <div className="min-h-screen bg-[#141414] pt-36 px-6 md:px-12">
        <LibraryRefreshButton onRefresh={refresh} loading={loading} visible={hasPath} />
        <p className="text-white/70">
          Set your movies folder in App Settings and scan to search your library.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-36 pb-16">
      <LibraryRefreshButton onRefresh={refresh} loading={loading} visible={hasPath} />
      <div className="px-6 md:px-12">
        <h1 className="text-xl md:text-2xl font-semibold text-white mb-6 mt-4">
          {q ? (
            <>
              Results for &quot;{q}&quot;
              <span className="text-white/60 font-normal ml-2 text-base md:text-lg">
                ({results.length} {results.length === 1 ? 'title' : 'titles'})
              </span>
            </>
          ) : (
            'Search'
          )}
        </h1>

        {!q ? (
          <p className="text-white/60">Enter a title in the search bar above and press Enter.</p>
        ) : results.length === 0 ? (
          <p className="text-white/60">No titles match your search. Try a different term.</p>
        ) : (
          <div
            className="grid gap-3 gap-y-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            role="list"
          >
            {results.map((item) => {
              const d = getDetail(item.id);
              return (
                <div
                  key={item.id}
                  className="group/slide relative z-0 aspect-video w-full overflow-visible hover:z-[30]"
                  role="listitem"
                >
                  <CarouselHoverCard
                    item={item}
                    duration={d?.duration}
                    progress={d?.progress}
                    onClick={() => setSelectedItem(item)}
                    onPlay={handlePlay}
                    onAddClick={() => toggleMyList(item.id)}
                    isInList={isInMyList(item.id)}
                    onLikeClick={() => toggleLiked(item.id)}
                    isLiked={isLiked(item.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detail && (
        <DetailCard
          detail={detail}
          onClose={() => setSelectedItem(null)}
          onPlay={(d) => {
            setSelectedItem(null);
            void handlePlay({
              id: d.id,
              title: d.title,
              posterUrl: d.posterUrl,
              backdropUrl: d.backdropUrl,
              titleLogoUrl: d.titleLogoUrl,
            });
          }}
          onPlayEpisode={(episodeId, episodeTitle, subtitleLanguages, seriesTitle) => {
            setSelectedItem(null);
            router.push(buildWatchUrl(episodeId, {
              title: episodeTitle ?? undefined,
              seriesTitle: seriesTitle ?? undefined,
              subs: subtitleLanguages,
            }));
          }}
          onPlayUnavailable={() => setSelectedItem(null)}
          onAddClick={() => toggleMyList(detail.id)}
          isInList={isInMyList(detail.id)}
          onLikeClick={() => toggleLiked(detail.id)}
          isLiked={isLiked(detail.id)}
          moreLikeThisItems={moreLikeThisItems}
          getDetailForId={getDetail}
          onMoreLikeThisPlay={(item) => { setSelectedItem(null); handlePlay(item); }}
          onMoreLikeThisAddClick={(item) => toggleMyList(item.id)}
          getIsInList={isInMyList}
        />
      )}
    </div>
  );
}
