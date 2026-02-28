'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CarouselItem } from '@/types/movie';
import type { MovieDetail } from '@/types/movie';
import { CarouselHoverCard } from '@/components/CarouselHoverCard';
import { DetailCard } from '@/components/DetailCard';
import { LibraryRefreshButton } from '@/components/LibraryRefreshButton';
import { VideoPlayerModal } from '@/components/VideoPlayerModal';
import { useLibrary } from '@/hooks/useLibrary';
import { useLiked } from '@/hooks/useLiked';
import { useMyList } from '@/hooks/useMyList';
import { useSettings } from '@/context/SettingsContext';
import { useProgress } from '@/context/ProgressContext';

export function SearchPage() {
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();
  const { moviesFolderPath, subtitleLanguage } = useSettings();
  const { carousels: libraryCarousels, detailsMap, loading, error, refresh } = useLibrary(moviesFolderPath);
  const { toggle: toggleMyList, has: isInMyList } = useMyList();
  const { toggle: toggleLiked, has: isLiked } = useLiked();
  const { progressByItemId } = useProgress();
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
          if (!res.ok) return;
        } catch {
          return;
        }
      }
      setNowPlayingTitle(null);
      setNowPlayingSubtitleLanguages(undefined);
      setNowPlayingId(item.id);
    },
    [moviesFolderPath]
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
                  className="group/slide relative z-0 aspect-video w-full overflow-visible hover:z-20"
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
            setNowPlayingTitle(null);
            setNowPlayingSubtitleLanguages(undefined);
            void handlePlay({
              id: d.id,
              title: d.title,
              posterUrl: d.posterUrl,
              backdropUrl: d.backdropUrl,
              titleLogoUrl: d.titleLogoUrl,
            });
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
