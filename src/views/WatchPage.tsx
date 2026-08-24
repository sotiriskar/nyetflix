'use client';

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { VideoPlayerModal } from '@/components/VideoPlayerModal';
import { useLibraryContext } from '@/context/LibraryContext';
import { useProgress } from '@/context/ProgressContext';
import { useSettings } from '@/context/SettingsContext';
import { buildWatchUrl } from '@/lib/watchUrl';

export function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { subtitleLanguage } = useSettings();
  const { detailsMap } = useLibraryContext();
  const { getProgress } = useProgress();

  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  let id = rawId;
  if (typeof rawId === 'string') {
    try {
      id = decodeURIComponent(rawId);
    } catch {
      id = rawId;
    }
  }
  const titleFromQuery = searchParams.get('title') ?? undefined;
  const seriesTitleFromQuery = searchParams.get('seriesTitle') ?? undefined;
  const subsFromQuery = searchParams.get('subs');
  const subtitleLanguagesFromQuery = subsFromQuery
    ? subsFromQuery.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  const getDetail = useMemo(
    () => (itemId: string) => {
      const d = detailsMap[itemId];
      if (!d) return d;
      const prog = getProgress(itemId);
      if (prog == null) return d;
      return { ...d, progress: prog.progress };
    },
    [detailsMap, getProgress]
  );

  const title = titleFromQuery ?? (id ? getDetail(id)?.title : undefined);
  const subtitleLanguages = subtitleLanguagesFromQuery ?? (id ? getDetail(id)?.subtitleLanguages : undefined);
  const seriesTitle = seriesTitleFromQuery ?? (id ? getDetail(id)?.title : undefined);

  const isSeriesEpisode = typeof id === 'string' && /^episode-.+-S\d+-E\d+$/.test(id);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!id) {
      router.replace('/browse');
    }
  }, [id, router]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const target = isSeriesEpisode ? '/browse/series' : '/browse/films';
    router.replace(target);
  }, [isSeriesEpisode, router]);

  const getSeriesTitle = useCallback(
    (seriesItemId: string) => getDetail(seriesItemId)?.title ?? null,
    [getDetail],
  );

  const handlePlayEpisode = useCallback(
    (episodeId: string, episodeTitle?: string, subtitleLangs?: string[], seriesTitleParam?: string) => {
      router.push(buildWatchUrl(episodeId, {
        title: episodeTitle ?? undefined,
        seriesTitle: seriesTitleParam ?? undefined,
        subs: subtitleLangs,
      }));
    },
    [router],
  );

  if (!id) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <VideoPlayerModal
      itemId={id}
      title={title}
      subtitleLanguages={subtitleLanguages}
      preferredSubtitleLang={subtitleLanguage}
      message={null}
      onClose={handleClose}
      onPlayEpisode={handlePlayEpisode}
      seriesTitle={seriesTitle ?? undefined}
      getSeriesTitle={getSeriesTitle}
    />
  );
}
