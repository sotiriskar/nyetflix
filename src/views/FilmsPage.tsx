'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import type { CarouselItem } from '@/types/movie';
import type { MovieDetail } from '@/types/movie';
import { Carousel } from '@/components/Carousel';
import { DetailCard } from '@/components/DetailCard';
import { Footer } from '@/components/Footer';
import { HeroBanner } from '@/components/HeroBanner';
import { LibraryRefreshButton } from '@/components/LibraryRefreshButton';
import { useLibrary } from '@/hooks/useLibrary';
import { LIBRARY_HANDLE_MODE } from '@/context/LibraryHandleContext';
import { useLiked } from '@/hooks/useLiked';
import { useMyList } from '@/hooks/useMyList';
import { useSettings } from '@/context/SettingsContext';
import { useProgress, CONTINUE_WATCHING_MAX_PROGRESS } from '@/context/ProgressContext';
import { buildWatchUrl } from '@/lib/watchUrl';
import { buildCarousels } from '@/lib/carouselBuild';

const skeletonSx = { bgcolor: 'rgba(255,255,255,0.11)' };

function HeroSkeleton() {
  return (
    <section className="relative w-full min-h-[98vh] flex items-end bg-[#1a1a1a]">
      <Skeleton variant="rectangular" height="100%" width="100%" sx={{ position: 'absolute', inset: 0, ...skeletonSx }} />
      <div className="relative z-10 w-full px-6 md:px-12 pb-8 md:pb-12 pt-32">
        <div className="max-w-4xl flex flex-col gap-5">
          <Skeleton variant="text" width={320} height={56} sx={skeletonSx} />
          <Skeleton variant="text" width="80%" height={28} sx={skeletonSx} />
          <Skeleton variant="text" width="60%" height={28} sx={skeletonSx} />
        </div>
        <div className="flex gap-3 mt-5">
          <Skeleton variant="rounded" width={120} height={48} sx={skeletonSx} />
          <Skeleton variant="rounded" width={140} height={48} sx={skeletonSx} />
        </div>
      </div>
    </section>
  );
}

function CarouselRowSkeleton() {
  return (
    <section className="w-full pt-6 pb-4 px-6 md:px-12">
      <Skeleton variant="text" width={160} height={28} sx={{ mb: 2, ...skeletonSx }} />
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton
            key={i}
            variant="rounded"
            sx={{ flex: '0 0  clamp(140px, 25vw, 240px)', aspectRatio: '16/9', ...skeletonSx }}
          />
        ))}
      </div>
    </section>
  );
}

function isMovie(detailsMap: Record<string, MovieDetail>, id: string): boolean {
  const type = detailsMap[id]?.mediaType;
  return type !== 'series';
}

export function FilmsPage() {
  const router = useRouter();
  const { moviesFolderPath } = useSettings();
  const { carousels: libraryCarousels, detailsMap, loading, error, clearError, refresh, updateItemDetail } = useLibrary(moviesFolderPath);
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
    [moviesFolderPath, getProgress, detailsMap, router]
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

  const detail: MovieDetail | undefined = selectedItem
    ? (getDetail?.(selectedItem.id) ?? {
        id: selectedItem.id,
        title: selectedItem.title,
        posterUrl: selectedItem.posterUrl,
        description: 'No description available.',
      })
    : undefined;

  const hasPath = moviesFolderPath.trim() !== '';
  const hasLibraryData = hasPath && !error && libraryCarousels.length > 0 && (libraryCarousels[0]?.items?.length ?? 0) > 0;

  const movieItems = useMemo(() => {
    if (!hasLibraryData || libraryCarousels.length === 0) return [];
    return libraryCarousels[0].items.filter((item) => isMovie(detailsMap, item.id));
  }, [hasLibraryData, libraryCarousels, detailsMap]);

  const { heroItem, carousels } = useMemo(() => {
    if (movieItems.length === 0) return { heroItem: null as CarouselItem | null, carousels: [] as { title: string; items: CarouselItem[] }[] };
    const allItems = libraryCarousels[0]?.items ?? [];
    const homeHeroId = allItems.length >= 2 ? allItems[allItems.length - 2].id : undefined;
    const result = buildCarousels({
      items: movieItems,
      getGenres: (id) => {
        const s = detailsMap[id]?.genres;
        return s ? s.split(',').map((g) => g.trim()).filter(Boolean) : undefined;
      },
      getProgress: (id) => progressByItemId[id],
      isContinueWatching: (p) => p > 0 && p < CONTINUE_WATCHING_MAX_PROGRESS,
      heroPosition: 'last',
      excludeHeroId: homeHeroId,
    });
    const myListItems = movieItems.filter((item) => isInMyList(item.id));
    const carousels = myListItems.length > 0
      ? [...result.carousels, { title: 'My List', items: myListItems }]
      : result.carousels;
    return { heroItem: result.heroItem, carousels };
  }, [movieItems, libraryCarousels, detailsMap, progressByItemId, isInMyList]);

  const showSkeleton = !hasLibraryData;

  const displayCarousels = useMemo(() => {
    if (!heroItem) return carousels;
    return carousels.filter((row) => row.items.some((item) => item.id !== heroItem.id));
  }, [carousels, heroItem]);

  return (
    <div className="pb-0">
      <LibraryRefreshButton onRefresh={refresh} loading={loading} visible={hasPath} />
      <Snackbar
        open={!!error}
        autoHideDuration={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        onClose={clearError}
      >
        <Alert severity="error" onClose={clearError} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      {showSkeleton ? (
        <>
          <HeroSkeleton />
          <div className="bg-[#141414]">
            <CarouselRowSkeleton />
            <CarouselRowSkeleton />
            <CarouselRowSkeleton />
          </div>
        </>
      ) : heroItem ? (
        <>
          <HeroBanner
            heroItem={heroItem}
            onMoreInfo={setSelectedItem}
            onPlay={handlePlay}
            getMovieDetail={getDetail}
            pageTitle="Films"
            onFetchItemDetail={async (id, title) => {
              const res = await fetch('/api/item-metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title }) });
              if (!res.ok) return;
              const patch = (await res.json()) as Partial<import('@/types/movie').MovieDetail>;
              if (patch && (patch.description ?? patch.tagline ?? patch.backdropUrl ?? patch.posterUrl)) updateItemDetail(id, patch);
            }}
          />
          <div className="relative z-10 -mt-24 pt-0">
            {displayCarousels[0] && (
              <Carousel
                key={displayCarousels[0].title}
                title={displayCarousels[0].title}
                items={displayCarousels[0].items.filter((item) => item.id !== heroItem.id)}
                onItemClick={setSelectedItem}
                onPlayClick={handlePlay}
                getMovieDetail={getDetail}
                onAddClick={(item) => toggleMyList(item.id)}
                getIsInList={isInMyList}
                onLikeClick={(item) => toggleLiked(item.id)}
                getIsLiked={isLiked}
              />
            )}
            <div
              className="absolute left-0 right-0 top-full h-[28vh] min-h-[120px] pointer-events-none w-full"
              style={{
                background: 'linear-gradient(to bottom, transparent 0%, transparent 30%, rgba(20,20,20,0.25) 50%, rgba(20,20,20,0.55) 72%, rgba(20,20,20,0.85) 90%, #141414 100%)',
              }}
              aria-hidden
            />
          </div>
          <div className="relative z-10 bg-[#141414] pt-6">
            {displayCarousels.slice(1).map((row) => (
              <Carousel
                key={row.title}
                title={row.title}
                items={row.items.filter((item) => item.id !== heroItem.id)}
                onItemClick={setSelectedItem}
                onPlayClick={handlePlay}
                getMovieDetail={getDetail}
                onAddClick={(item) => toggleMyList(item.id)}
                getIsInList={isInMyList}
                onLikeClick={(item) => toggleLiked(item.id)}
                getIsLiked={isLiked}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <section className="relative w-full min-h-[40vh] flex items-end bg-[#1a1a1a]">
            <div className="relative z-10 w-full px-6 md:px-12 pb-8 pt-28">
              <h2 className="text-white text-3xl md:text-4xl font-bold mb-4">Films</h2>
              <p className="text-white/60">No movies in your library. Add movies and scan in Settings.</p>
            </div>
          </section>
          <div className="bg-[#141414]" />
        </>
      )}
      <Footer
        socialLinks={{
          facebook: 'https://www.facebook.com/sotiris.karagiannis95/',
          instagram: 'https://www.instagram.com/sotiris_kar/',
          linkedin: 'https://www.linkedin.com/in/sotiris-kar/',
        }}
      />
      {detail && (
        <DetailCard
          detail={detail}
          onClose={() => setSelectedItem(null)}
          onPlay={(d) => {
            setSelectedItem(null);
            void handlePlay({ id: d.id, title: d.title, posterUrl: d.posterUrl, backdropUrl: d.backdropUrl, titleLogoUrl: d.titleLogoUrl });
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
        />
      )}
    </div>
  );
}
