'use client';

import { useState, useMemo, useCallback } from 'react';
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
import { VideoPlayerModal } from '@/components/VideoPlayerModal';
import { useLibrary } from '@/hooks/useLibrary';
import { useLiked } from '@/hooks/useLiked';
import { useMyList } from '@/hooks/useMyList';
import { useSettings } from '@/context/SettingsContext';
import { useProgress } from '@/context/ProgressContext';

const skeletonSx = { bgcolor: 'rgba(255,255,255,0.11)' };

function HeroSkeleton() {
  return (
    <section className="relative w-full min-h-[65vh] flex items-end bg-[#1a1a1a]">
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

export function HomePage() {
  const { moviesFolderPath, subtitleLanguage } = useSettings();
  const { carousels: libraryCarousels, detailsMap, loading, error, clearError, refresh, setError } = useLibrary(moviesFolderPath);
  const { toggle: toggleMyList, has: isInMyList } = useMyList();
  const { toggle: toggleLiked, has: isLiked } = useLiked();
  const { progressByItemId, getProgress } = useProgress();
  const [selectedItem, setSelectedItem] = useState<CarouselItem | null>(null);
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);
  const [nowPlayingTitle, setNowPlayingTitle] = useState<string | null>(null);
  const [nowPlayingSubtitleLanguages, setNowPlayingSubtitleLanguages] = useState<string[] | undefined>(undefined);
  const [playbackMessage, setPlaybackMessage] = useState<string | null>(null);

  const handlePlay = useCallback(
    async (item: CarouselItem) => {
      const path = moviesFolderPath?.trim() ?? '';
      if (path) {
        try {
          const res = await fetch(`/api/scan-library?path=${encodeURIComponent(path)}`);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data?.error ?? 'Could not load library. Check the path in Settings.');
            return;
          }
        } catch {
          setError('Network error. Try again.');
          return;
        }
      }
      setNowPlayingTitle(null);
      setNowPlayingSubtitleLanguages(undefined);
      const prog = getProgress(item.id);
      const resumeEpisodeId = detailsMap[item.id]?.mediaType === 'series' ? prog?.lastEpisodeId : undefined;
      setNowPlayingId(resumeEpisodeId ?? item.id);
    },
    [moviesFolderPath, getProgress, detailsMap, setError]
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

  const carousels = useMemo(() => {
    if (!hasLibraryData || libraryCarousels.length === 0) return [];
    const allItems = libraryCarousels[0].items;
    if (allItems.length === 0) return [{ title: 'Your Library', items: [] }];

    const latest = allItems.slice(0, 8);
    const continueWatching = allItems
      .filter((item) => (progressByItemId[item.id]?.progress ?? 0) > 0 && (progressByItemId[item.id]?.progress ?? 0) < 1)
      .sort((a, b) => (progressByItemId[b.id]?.lastWatchedAt ?? 0) - (progressByItemId[a.id]?.lastWatchedAt ?? 0))
      .slice(0, 8);

    const genreToItems = new Map<string, CarouselItem[]>();
    for (const item of allItems) {
      const genresStr = detailsMap[item.id]?.genres;
      const genres = genresStr ? genresStr.split(',').map((g) => g.trim()).filter(Boolean) : [];
      for (const g of genres) {
        if (!genreToItems.has(g)) genreToItems.set(g, []);
        genreToItems.get(g)!.push(item);
      }
    }
    const sortedGenres = [...genreToItems.entries()]
      .filter(([, items]) => items.length >= 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6);

    const rows: { title: string; items: CarouselItem[] }[] = [
      { title: 'Latest', items: latest },
      ...(continueWatching.length > 0 ? [{ title: 'Continue Watching', items: continueWatching }] : []),
      ...sortedGenres.map(([genre, items]) => ({ title: genre, items })),
    ];
    return rows;
  }, [hasLibraryData, libraryCarousels, detailsMap, progressByItemId]);

  const heroItem = carousels[0]?.items[0];

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
          />
          <div className="bg-[#141414]">
            {carousels.map((row) => (
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
          <HeroSkeleton />
          <div className="bg-[#141414]">
            <CarouselRowSkeleton />
          </div>
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
            setNowPlayingTitle(null);
            setNowPlayingSubtitleLanguages(undefined);
            void handlePlay({ id: d.id, title: d.title, posterUrl: d.posterUrl, backdropUrl: d.backdropUrl, titleLogoUrl: d.titleLogoUrl });
          }}
          onPlayEpisode={(episodeId, episodeTitle, subtitleLanguages) => {
            setSelectedItem(null);
            setPlaybackMessage(null);
            setNowPlayingTitle(episodeTitle ?? null);
            setNowPlayingSubtitleLanguages(subtitleLanguages);
            setNowPlayingId(episodeId);
          }}
          onPlayUnavailable={(msg) => {
            setSelectedItem(null);
            setNowPlayingId(null);
            setNowPlayingTitle(null);
            setNowPlayingSubtitleLanguages(undefined);
            setPlaybackMessage(msg);
          }}
          onAddClick={() => toggleMyList(detail.id)}
          isInList={isInMyList(detail.id)}
          onLikeClick={() => toggleLiked(detail.id)}
          isLiked={isLiked(detail.id)}
        />
      )}
      <VideoPlayerModal
        itemId={nowPlayingId}
        title={nowPlayingTitle ?? (nowPlayingId ? getDetail(nowPlayingId)?.title : undefined)}
        subtitleLanguages={nowPlayingSubtitleLanguages ?? (nowPlayingId ? getDetail(nowPlayingId)?.subtitleLanguages : undefined)}
        preferredSubtitleLang={subtitleLanguage}
        message={playbackMessage}
        onClose={() => { setNowPlayingId(null); setNowPlayingTitle(null); setNowPlayingSubtitleLanguages(undefined); setPlaybackMessage(null); }}
      />
    </div>
  );
}
