'use client';

import { useState, useMemo, useCallback } from 'react';
import GridView from '@mui/icons-material/GridView';
import ViewList from '@mui/icons-material/ViewList';
import type { CarouselItem } from '@/types/movie';
import type { MovieDetail } from '@/types/movie';
import { CarouselHoverCard } from '@/components/CarouselHoverCard';
import { DetailCard } from '@/components/DetailCard';
import { LibraryRefreshButton } from '@/components/LibraryRefreshButton';
import { VideoPlayerModal } from '@/components/VideoPlayerModal';
import { useLibrary } from '@/hooks/useLibrary';
import { useSettings } from '@/context/SettingsContext';
import { useProgress } from '@/context/ProgressContext';
import { useLiked } from '@/hooks/useLiked';
import { useMyList } from '@/hooks/useMyList';

type SortBy = 'alphabetical' | 'time';

function SectionGrid({
  items,
  getDetail,
  onItemClick,
  onPlay,
  onAddClick,
  isInList,
  onLikeClick,
  isLiked,
}: {
  items: CarouselItem[];
  getDetail: (id: string) => MovieDetail | undefined;
  onItemClick: (item: CarouselItem) => void;
  onPlay: (item: CarouselItem) => void;
  onAddClick?: (item: CarouselItem) => void;
  isInList?: (id: string) => boolean;
  onLikeClick?: (item: CarouselItem) => void;
  isLiked?: (id: string) => boolean;
}) {
  return (
    <div
      className="grid gap-3 gap-y-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
      role="list"
    >
      {items.map((item) => {
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
              onClick={() => onItemClick(item)}
              onPlay={onPlay}
              onAddClick={onAddClick ? () => onAddClick(item) : undefined}
              isInList={isInList?.(item.id)}
              onLikeClick={onLikeClick ? () => onLikeClick(item) : undefined}
              isLiked={isLiked?.(item.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

export function MyListPage() {
  const { moviesFolderPath, subtitleLanguage } = useSettings();
  const { carousels: libraryCarousels, detailsMap, loading, error, refresh } = useLibrary(moviesFolderPath);
  const { list, toggle, has, getAddedAt } = useMyList();
  const { toggle: toggleLiked, has: isLiked } = useLiked();
  const { progressByItemId } = useProgress();
  const [sortBy, setSortBy] = useState<SortBy>('alphabetical');
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

  const listIds = useMemo(() => new Set(list.map((e) => e.id)), [list]);

  const { movies, series } = useMemo(() => {
    if (libraryCarousels.length === 0) return { movies: [] as CarouselItem[], series: [] as CarouselItem[] };
    const allItems = libraryCarousels[0].items ?? [];
    const inList = allItems.filter((item) => listIds.has(item.id));
    const movies: CarouselItem[] = [];
    const series: CarouselItem[] = [];
    for (const item of inList) {
      const type = detailsMap[item.id]?.mediaType ?? 'movie';
      if (type === 'series') series.push(item);
      else movies.push(item);
    }
    const byTitle = (a: CarouselItem, b: CarouselItem) => {
      const ta = (detailsMap[a.id]?.title ?? a.title).toLowerCase();
      const tb = (detailsMap[b.id]?.title ?? b.title).toLowerCase();
      return ta.localeCompare(tb);
    };
    const byTime = (a: CarouselItem, b: CarouselItem) => {
      const ta = getAddedAt(a.id) ?? 0;
      const tb = getAddedAt(b.id) ?? 0;
      return tb - ta;
    };
    const sortFn = sortBy === 'alphabetical' ? byTitle : byTime;
    movies.sort(sortFn);
    series.sort(sortFn);
    return { movies, series };
  }, [libraryCarousels, listIds, detailsMap, sortBy, getAddedAt]);

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
          Set your movies folder in App Settings and scan to use My List.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-36 pb-16">
      <LibraryRefreshButton onRefresh={refresh} loading={loading} visible={hasPath} />
      <div className="px-6 md:px-12">
        <div className="flex items-center justify-between mb-6 mt-4">
          <h1 className="text-xl md:text-2xl font-semibold text-white">
            My List
          </h1>
          {/* Sort: list / grid style icon buttons */}
          <div className="flex gap-px">
            <button
              type="button"
              onClick={() => setSortBy('alphabetical')}
              title="Sort A–Z"
              aria-label="Sort alphabetically"
              className={`flex items-center justify-center w-11 h-11 border border-white/40 bg-transparent text-white transition-opacity rounded-l hover:opacity-100 ${
                sortBy === 'alphabetical' ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <ViewList sx={{ fontSize: 22 }} />
            </button>
            <button
              type="button"
              onClick={() => setSortBy('time')}
              title="Sort by recently added"
              aria-label="Sort by when added"
              className={`flex items-center justify-center w-11 h-11 border border-white/40 bg-transparent text-white transition-opacity rounded-r hover:opacity-100 ${
                sortBy === 'time' ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <GridView sx={{ fontSize: 22 }} />
            </button>
          </div>
        </div>

        {/* Movies */}
        <section className="mb-10">
          <h2 className="text-lg font-medium text-white mb-4">
            Movies
            <span className="text-white/60 font-normal ml-2 text-base">
              ({movies.length})
            </span>
          </h2>
          {movies.length === 0 ? (
            <p className="text-white/50 text-sm">No movies in your list yet. Add titles from Home or Search.</p>
          ) : (
            <SectionGrid
              items={movies}
              getDetail={getDetail}
              onItemClick={setSelectedItem}
              onPlay={handlePlay}
              onAddClick={(item) => toggle(item.id)}
              isInList={has}
              onLikeClick={(item) => toggleLiked(item.id)}
              isLiked={isLiked}
            />
          )}
        </section>

        {/* Series */}
        <section>
          <h2 className="text-lg font-medium text-white mb-4">
            Series
            <span className="text-white/60 font-normal ml-2 text-base">
              ({series.length})
            </span>
          </h2>
          {series.length === 0 ? (
            <p className="text-white/50 text-sm">No series in your list yet. Add titles from Home or Search.</p>
          ) : (
            <SectionGrid
              items={series}
              getDetail={getDetail}
              onItemClick={setSelectedItem}
              onPlay={handlePlay}
              onAddClick={(item) => toggle(item.id)}
              isInList={has}
              onLikeClick={(item) => toggleLiked(item.id)}
              isLiked={isLiked}
            />
          )}
        </section>
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
          onAddClick={() => detail && toggle(detail.id)}
          isInList={detail ? has(detail.id) : false}
          onLikeClick={() => detail && toggleLiked(detail.id)}
          isLiked={detail ? isLiked(detail.id) : false}
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
