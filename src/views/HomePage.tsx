'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import { LibraryRefreshButton } from '@/components/LibraryRefreshButton';
import type { CarouselItem } from '@/types/movie';
import type { MovieDetail } from '@/types/movie';
import { Carousel } from '@/components/Carousel';
import { DetailCard } from '@/components/DetailCard';
import { Footer } from '@/components/Footer';
import { HeroBanner } from '@/components/HeroBanner';
import { useLibraryContext } from '@/context/LibraryContext';
import { useLiked } from '@/hooks/useLiked';
import { useMyList } from '@/hooks/useMyList';
import { useSettings } from '@/context/SettingsContext';
import { useProgress, CONTINUE_WATCHING_MAX_PROGRESS } from '@/context/ProgressContext';
import { buildWatchUrl } from '@/lib/watchUrl';
import { getFirstEpisodeId } from '@/lib/getFirstEpisodeId';
import { buildCarousels } from '@/lib/carouselBuild';
import { pickMoreLikeThis } from '@/lib/moreLikeThis';

const skeletonSx = { bgcolor: 'rgba(255,255,255,0.11)' };

const CAROUSEL_SKELETON_CARDS = 6;

const SKELETON_APPEAR_DURATION = 0.6;
const SKELETON_APPEAR_STAGGER = 0.25;
const SKELETON_PULSE_START = 2.2;
const SKELETON_PULSE_DURATION = 2.2;

function CarouselRowSkeleton() {
  return (
    <section className="w-full pt-6 pb-4 px-6 md:px-12">
      <div
        className="mb-2"
        style={{
          animation: `skeleton-card-pulse ${SKELETON_PULSE_DURATION}s ease-in-out ${SKELETON_PULSE_START}s infinite`,
        }}
      >
        <Skeleton variant="text" width={160} height={28} animation={false} sx={skeletonSx} />
      </div>
      <div className="flex overflow-hidden" style={{ gap: 8 }}>
        {Array.from({ length: CAROUSEL_SKELETON_CARDS }, (_, i) => (
          <div
            key={i}
            className="flex-1 min-w-0 rounded overflow-hidden"
            style={{ aspectRatio: '16/9' }}
          >
            <div
              className="w-full h-full rounded bg-white/10"
              style={{
                opacity: 0,
                animation: `skeleton-card-appear ${SKELETON_APPEAR_DURATION}s ease-out forwards, skeleton-card-pulse ${SKELETON_PULSE_DURATION}s ease-in-out ${SKELETON_PULSE_START}s infinite`,
                animationDelay: `${i * SKELETON_APPEAR_STAGGER}s, ${SKELETON_PULSE_START}s`,
                animationFillMode: 'forwards, none',
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const router = useRouter();
  const { moviesFolderPath } = useSettings();
  const { carousels: libraryCarousels, detailsMap, loading, error, clearError, refresh, updateItemDetail } = useLibraryContext();
  const { toggle: toggleMyList, has: isInMyList } = useMyList();
  const { toggle: toggleLiked, has: isLiked } = useLiked();
  const { progressByItemId, getProgress, clearProgress } = useProgress();
  const [selectedItem, setSelectedItem] = useState<CarouselItem | null>(null);

  const handlePlay = useCallback(
    (item: CarouselItem) => {
      const prog = getProgress(item.id);
      const isSeries = detailsMap[item.id]?.mediaType === 'series';
      const resumeEpisodeId = isSeries ? prog?.lastEpisodeId : undefined;
      const seriesTitle = isSeries ? (detailsMap[item.id]?.title ?? undefined) : undefined;
      const subs = detailsMap[item.id]?.subtitleLanguages;

      if (isSeries && !resumeEpisodeId) {
        getFirstEpisodeId(item.id, seriesTitle).then((firstId) => {
          if (firstId) {
            router.push(buildWatchUrl(firstId, { seriesTitle, subs: subs?.length ? subs : undefined }));
          } else {
            router.replace('/browse/series');
          }
        });
        return;
      }

      const id = resumeEpisodeId ?? item.id;
      router.push(buildWatchUrl(id, { seriesTitle, subs: subs?.length ? subs : undefined }));
    },
    [getProgress, detailsMap, router]
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
  const showSkeleton = !hasLibraryData;

  const moreLikeThisItems = useMemo(() => {
    if (!hasLibraryData || libraryCarousels.length === 0 || !selectedItem) return [];
    const all = libraryCarousels[0].items ?? [];
    const currentGenres = detailsMap[selectedItem.id]?.genres
      ? detailsMap[selectedItem.id].genres!.split(',').map((g) => g.trim()).filter(Boolean)
      : undefined;
    return pickMoreLikeThis(
      selectedItem.id,
      currentGenres,
      all,
      (id) => detailsMap[id]?.genres?.split(',').map((g) => g.trim()).filter(Boolean),
      6
    );
  }, [hasLibraryData, libraryCarousels, selectedItem, detailsMap]);

  const { heroItem, carousels } = useMemo(() => {
    if (!hasLibraryData || libraryCarousels.length === 0) return { heroItem: null as CarouselItem | null, carousels: [] as { title: string; items: CarouselItem[] }[] };
    const allItems = libraryCarousels[0].items;
    if (allItems.length === 0) return { heroItem: null, carousels: [] };

    const result = buildCarousels({
      items: allItems,
      getGenres: (id) => {
        const s = detailsMap[id]?.genres;
        return s ? s.split(',').map((g) => g.trim()).filter(Boolean) : undefined;
      },
      getProgress: (id) => progressByItemId[id],
      isContinueWatching: (p) => p > 0 && p < CONTINUE_WATCHING_MAX_PROGRESS,
      heroPosition: 'secondLast',
    });
    const myListItems = allItems.filter((item) => isInMyList(item.id));
    const carousels = myListItems.length > 0
      ? [...result.carousels, { title: 'My List', items: myListItems }]
      : result.carousels;
    return { heroItem: result.heroItem, carousels };
  }, [hasLibraryData, libraryCarousels, detailsMap, progressByItemId, isInMyList]);

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
        <div className="bg-[#141414] pt-24 md:pt-50 pb-[70vh]">
          <CarouselRowSkeleton />
        </div>
      ) : heroItem ? (
        <>
          <HeroBanner
            heroItem={heroItem}
            onMoreInfo={setSelectedItem}
            onPlay={handlePlay}
            getMovieDetail={getDetail}
            onFetchItemDetail={async (id, title) => {
              const res = await fetch('/api/item-metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title }) });
              if (!res.ok) return;
              const patch = (await res.json()) as Partial<import('@/types/movie').MovieDetail>;
              if (patch && (patch.description ?? patch.tagline ?? patch.backdropUrl ?? patch.posterUrl)) updateItemDetail(id, patch);
            }}
          />
          {/* First carousel above hero z-index; gradient is absolute so it doesn't add gap */}
          <div className="relative z-10 -mt-24 pt-0">
            {carousels[0] && (
              <Carousel
                key={carousels[0].title}
                title={carousels[0].title}
                items={carousels[0].items.filter((item) => item.id !== heroItem.id)}
                onItemClick={setSelectedItem}
                onPlayClick={handlePlay}
                getMovieDetail={getDetail}
                onAddClick={(item) => toggleMyList(item.id)}
                getIsInList={isInMyList}
                onLikeClick={(item) => toggleLiked(item.id)}
                getIsLiked={isLiked}
                onRemoveFromContinueWatching={(item) => clearProgress(item.id)}
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
            {carousels.slice(1).map((row) => (
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
                onRemoveFromContinueWatching={(item) => clearProgress(item.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="bg-[#141414] pt-24 md:pt-32">
          <CarouselRowSkeleton />
        </div>
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
