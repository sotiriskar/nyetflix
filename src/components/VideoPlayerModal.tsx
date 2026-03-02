'use client';

import { useEffect, useState, useRef, memo } from 'react';
import Close from '@mui/icons-material/Close';
import SkipNext from '@mui/icons-material/SkipNext';
import PlaylistPlay from '@mui/icons-material/PlaylistPlay';
import {
  MediaPlayer,
  MediaProvider,
  Track,
  Time,
  formatTime,
  useMediaState,
  useMediaRemote,
} from '@vidstack/react';
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { useProgress } from '@/context/ProgressContext';
import type { SeriesSeason, SeriesEpisode } from '@/types/movie';
import type { ProgressEntry } from '@/context/ProgressContext';

const SAVE_INTERVAL_MS = 5000;

function ProgressSync({
  itemId,
  initialProgress,
  streamStartOffset,
  onSave,
  overrideDurationSeconds,
}: {
  itemId: string;
  initialProgress: number;
  streamStartOffset: number;
  onSave: (itemId: string, progress: number) => void;
  overrideDurationSeconds?: number | null;
}) {
  const currentTime = useMediaState('currentTime');
  const duration = useMediaState('duration');
  const effectiveDuration = (duration > 0 ? duration : overrideDurationSeconds ?? 0) || 0;
  const fullDuration = overrideDurationSeconds ?? effectiveDuration;
  const effectiveCurrentTime = currentTime + streamStartOffset;
  const remote = useMediaRemote();
  const hasSeeked = useRef(false);
  const hasFixedStartAtZero = useRef(false);
  const lastSaved = useRef(0);
  const latestProgress = useRef(0);
  const prevItemId = useRef(itemId);
  if (prevItemId.current !== itemId) {
    prevItemId.current = itemId;
    hasSeeked.current = false;
    hasFixedStartAtZero.current = false;
  }

  // When the stream reports "at end" at load (wrong timestamps), seek to 0 so time starts at 0 and progresses correctly.
  useEffect(() => {
    if (effectiveDuration <= 0 || hasFixedStartAtZero.current || streamStartOffset > 0) return;
    if (currentTime >= effectiveDuration - 0.5) {
      hasFixedStartAtZero.current = true;
      if (initialProgress <= 0 || initialProgress >= 1) remote.seek(0);
    }
  }, [currentTime, effectiveDuration, initialProgress, streamStartOffset, remote]);

  useEffect(() => {
    if (streamStartOffset > 0) {
      hasSeeked.current = true; // Already at seek target from restart
      return;
    }
    if (effectiveDuration <= 0 || hasSeeked.current) return;
    // New episode / start from beginning: always seek to 0 so we don't keep previous episode's position
    if (initialProgress <= 0 || initialProgress >= 1) {
      hasSeeked.current = true;
      remote.seek(0);
      return;
    }
    hasSeeked.current = true;
    remote.seek(initialProgress * effectiveDuration);
  }, [effectiveDuration, initialProgress, streamStartOffset, remote]);

  if (fullDuration > 0 && effectiveCurrentTime >= 0) {
    const p = effectiveCurrentTime / fullDuration;
    if (p > 0 && p < 1) latestProgress.current = p;
  }

  useEffect(() => {
    if (fullDuration <= 0) return;
    const progress = effectiveCurrentTime / fullDuration;
    const now = Date.now();
    if (progress > 0 && progress < 1 && now - lastSaved.current >= SAVE_INTERVAL_MS) {
      lastSaved.current = now;
      onSave(itemId, progress);
    }
  }, [effectiveCurrentTime, fullDuration, itemId, onSave]);

  useEffect(() => {
    return () => {
      const p = latestProgress.current;
      if (p > 0 && p < 1) onSave(itemId, p);
    };
  }, [itemId, onSave]);

  return null;
}

/** Syncs display current time to parent so the layout slot shows 0 at start and advances when stream reports "at end". Runs inside MediaProvider. */
function DisplayTimeSync({
  apiDuration,
  streamStartOffset,
  onDisplayTimeChange,
}: {
  apiDuration: number | null;
  streamStartOffset: number;
  onDisplayTimeChange: (t: number) => void;
}) {
  const currentTime = useMediaState('currentTime');
  const duration = useMediaState('duration');
  const playing = useMediaState('playing');
  const hasSeenLowCurrentTime = useRef(false);
  const playStartRef = useRef<number>(0);
  const [tick, setTick] = useState(0);

  const effectiveCurrentTime = currentTime + streamStartOffset;
  const max = apiDuration ?? (duration > 0 ? duration + streamStartOffset : 0);

  useEffect(() => {
    if (max > 10 && effectiveCurrentTime > 1 && effectiveCurrentTime < max - 10) hasSeenLowCurrentTime.current = true;
    const bogusAtEnd = max > 0 && effectiveCurrentTime >= max - 0.5 && !hasSeenLowCurrentTime.current;

    if (bogusAtEnd) {
      if (playing && playStartRef.current === 0) playStartRef.current = Date.now();
      if (!playing) playStartRef.current = 0;
      const display = playing && playStartRef.current
        ? Math.min(streamStartOffset + (Date.now() - playStartRef.current) / 1000, max)
        : streamStartOffset;
      onDisplayTimeChange(display);
    } else {
      playStartRef.current = 0;
      onDisplayTimeChange(Math.min(Math.max(0, effectiveCurrentTime), max || effectiveCurrentTime || 0));
    }
  }, [effectiveCurrentTime, duration, apiDuration, playing, streamStartOffset, onDisplayTimeChange, tick, max]);

  useEffect(() => {
    if (!playing) return;
    const bogusAtEnd = max > 0 && effectiveCurrentTime >= max - 0.5 && !hasSeenLowCurrentTime.current;
    if (!bogusAtEnd) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [playing, effectiveCurrentTime, duration, apiDuration, max]);

  return null;
}

/** Ensures volume is on and not muted (browser autoplay can force mute). */
function EnsureUnmuted() {
  const remote = useMediaRemote();
  const muted = useMediaState('muted');
  const volume = useMediaState('volume');

  useEffect(() => {
    if (muted || volume < 0.01) {
      remote.unmute();
    }
  }, [muted, volume, remote]);

  return null;
}

/** Memoized episodes panel to avoid re-renders from high-frequency display time updates. */
const EpisodesPanel = memo(function EpisodesPanel({
  seriesEpisodes,
  itemId,
  setEpisodesPanelOpen,
  onPlayEpisode,
  getProgress,
}: {
  seriesEpisodes: SeriesSeason[] | null;
  itemId: string | null;
  setEpisodesPanelOpen: (open: boolean) => void;
  onPlayEpisode?: (episodeId: string, episodeTitle?: string, subtitleLanguages?: string[], seriesTitle?: string) => void;
  getProgress: (id: string) => ProgressEntry | undefined;
}) {
  const closePanel = () => setEpisodesPanelOpen(false);
  return (
    <div
      className="absolute inset-0 z-30 flex justify-end bg-black/60"
      role="dialog"
      aria-label="Episodes list"
      onClick={(e) => e.target === e.currentTarget && closePanel()}
    >
      <div
        className="w-full max-w-lg bg-[#181818] shadow-xl flex flex-col max-h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Episodes</h2>
          <button
            type="button"
            onClick={closePanel}
            className="p-2 rounded-full text-white hover:bg-white/10"
            aria-label="Close episodes list"
          >
            <Close sx={{ fontSize: 24 }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {seriesEpisodes === null ? (
            <p className="text-white/70 p-4">Loading…</p>
          ) : seriesEpisodes.length === 0 ? (
            <p className="text-white/70 p-4">No episodes found.</p>
          ) : (
            seriesEpisodes.map((season) => (
              <div key={season.number} className="mb-6">
                <h3 className="text-sm font-medium text-white/90 px-1 py-3">
                  Season {season.number}
                </h3>
                <ul className="space-y-4">
                  {(season.episodes ?? []).map((ep: SeriesEpisode) => {
                    const hasFile = ep.hasFile !== false;
                    const isCurrent = ep.id === itemId;
                    return (
                      <li key={ep.id ?? `${season.number}-${ep.episodeNumber}`}>
                        <button
                          type="button"
                          onClick={() => {
                            if (ep.id && hasFile && onPlayEpisode) {
                              onPlayEpisode(ep.id, ep.title, ep.subtitleLanguages);
                              closePanel();
                            }
                          }}
                          disabled={!ep.id || !hasFile}
                          className={`w-full text-left rounded overflow-hidden flex gap-4 p-1 transition-colors ${
                            isCurrent
                              ? 'ring-2 ring-red-500 bg-white/10'
                              : hasFile
                                ? 'hover:bg-white/10'
                                : 'opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <div className="w-32 shrink-0 aspect-video bg-white/10 rounded overflow-hidden relative">
                            {ep.posterUrl ? (
                              <img
                                src={ep.posterUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
                                E{ep.episodeNumber}
                              </div>
                            )}
                            {ep.id && (() => {
                              const progress = getProgress(ep.id)?.progress ?? 0;
                              const pct = Math.min(100, Math.max(0, progress * 100));
                              return pct > 0 ? (
                                <div
                                  className="absolute left-0 right-0 bottom-0 h-1 rounded-b overflow-hidden bg-white/30 pointer-events-none"
                                  aria-hidden
                                >
                                  <div
                                    className="h-full bg-[#E50914] rounded-b transition-[width] duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex-1 min-w-0 py-2 pr-3 flex flex-col justify-center">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-white/80 shrink-0">
                                Episode {ep.episodeNumber}
                              </span>
                              {ep.durationMinutes != null && (
                                <span className="text-xs text-white/50">
                                  {ep.durationMinutes}m
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-white truncate mt-1.5">
                              {ep.title}
                            </h4>
                            {ep.description && (
                              <p className="text-xs text-white/70 line-clamp-2 mt-1.5 leading-relaxed">
                                {ep.description}
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

const LANG_LABELS: Record<string, string> = {
  en: 'English', el: 'Greek', es: 'Spanish', fr: 'French',
  de: 'German', it: 'Italian', pt: 'Portuguese', ru: 'Russian',
  ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic',
  tr: 'Turkish', nl: 'Dutch', pl: 'Polish', sv: 'Swedish',
};

interface NextEpisodeInfo {
  nextId: string;
  nextTitle: string;
  subtitleLanguages?: string[];
}

interface VideoPlayerModalProps {
  itemId: string | null;
  title?: string;
  subtitleLanguages?: string[];
  /** Preferred subtitle language code (e.g. from settings). If a track matches, it will be selected by default. */
  preferredSubtitleLang?: string;
  /** When set, show this message instead of the video (e.g. "This episode is not in your library"). */
  message?: string | null;
  onClose: () => void;
  /** When playing a series episode, called when user clicks "Next episode" or picks from list. Parent should set nowPlayingId to the next episode. */
  onPlayEpisode?: (episodeId: string, episodeTitle?: string, subtitleLanguages?: string[], seriesTitle?: string) => void;
  /** Show/series name (for fetching episode metadata from TMDB in the Episodes panel). Pass when playing from series detail. */
  seriesTitle?: string | null;
  /** Optional: resolve series title by series id (e.g. from library detail) when seriesTitle is not set. */
  getSeriesTitle?: (seriesId: string) => string | null | undefined;
}

const EPISODE_ID_REGEX = /^episode-.+-S\d+-E\d+$/;

export function VideoPlayerModal({ itemId, title, subtitleLanguages, preferredSubtitleLang: _preferredSubtitleLang, message, onClose, onPlayEpisode, seriesTitle, getSeriesTitle }: VideoPlayerModalProps) {
  void _preferredSubtitleLang; // reserved for future use
  const [streamUrl, setStreamUrl] = useState('');
  const [streamType, setStreamType] = useState<'video' | 'hls'>('video');
  /** Which itemId the current streamUrl is for – only show player when this matches itemId so we never reuse old stream for new episode. */
  const [streamForItemId, setStreamForItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [displayCurrentTime, setDisplayCurrentTime] = useState(0);
  const [conversionProgress, setConversionProgress] = useState<number | null>(null);
  // Only the setters are used (for UI), so ignore state values.
  const [, setConversionCurrentTime] = useState(0);
  const [, setConversionDuration] = useState(0);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [nextEpisode, setNextEpisode] = useState<NextEpisodeInfo | null>(null);
  const [episodesPanelOpen, setEpisodesPanelOpen] = useState(false);
  const [seriesEpisodes, setSeriesEpisodes] = useState<SeriesSeason[] | null>(null);
  const showModal = !!itemId || !!message;
  const seriesId = itemId ? (itemId.match(/^episode-(.+)-S\d+-E\d+$/) ?? null)?.[1] ?? null : null;
  const { getProgress, setProgress } = useProgress();
  const initialProgress = itemId ? (getProgress(itemId)?.progress ?? 0) : 0;
  const conversionEsRef = useRef<EventSource | null>(null);
  const onPlayEpisodeRef = useRef(onPlayEpisode);
  onPlayEpisodeRef.current = onPlayEpisode;
  const stableOnPlayEpisode = useRef((epId: string, epTitle?: string, subs?: string[], seriesTitle?: string) => {
    onPlayEpisodeRef.current?.(epId, epTitle, subs, seriesTitle);
  }).current;
  const streamReadyForCurrentItem = !!streamUrl && streamForItemId === itemId;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (episodesPanelOpen) setEpisodesPanelOpen(false);
      else onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    if (showModal) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [showModal, onClose, episodesPanelOpen]);

  useEffect(() => {
    if (!itemId || typeof window === 'undefined') {
      if (conversionEsRef.current) {
        conversionEsRef.current.close();
        conversionEsRef.current = null;
      }
      setStreamUrl('');
      setStreamForItemId(null);
      setError(null);
      setDurationSeconds(null);
      setConversionProgress(null);
      setConversionError(null);
      setNextEpisode(null);
      setEpisodesPanelOpen(false);
      setSeriesEpisodes(null);
      return;
    }
    setError(null);
    setNextEpisode(null);
    setEpisodesPanelOpen(false);
    setSeriesEpisodes(null);
    setDurationSeconds(null);
    setDisplayCurrentTime(0);
    setConversionProgress(null);
    setConversionError(null);
    setStreamUrl('');
    setStreamForItemId(null);
    setStreamType('video');
    const origin = window.location.origin;
    const fallbackUrl = `${origin}/api/stream-video?id=${encodeURIComponent(itemId)}`;
    const requestedItemId = itemId;
    fetch(`${origin}/api/video-src?id=${encodeURIComponent(itemId)}`, { credentials: 'same-origin' })
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (data?.error && !data?.url) {
          setError(data.error);
          return;
        }
        const applyUrl = (url: string, type: 'video' | 'hls') => {
          setStreamUrl(url);
          setStreamType(type);
          setStreamForItemId(requestedItemId);
        };
        if (data?.needsConversion && data?.convertUrl) {
          setConversionProgress(0);
          const convertUrl = data.convertUrl.startsWith('http') ? data.convertUrl : `${origin}${data.convertUrl.startsWith('/') ? '' : '/'}${data.convertUrl}`;
          const es = new EventSource(convertUrl);
          conversionEsRef.current = es;
          es.onmessage = (e) => {
            try {
              const d = JSON.parse(e.data);
              if (d.done) {
                es.close();
                conversionEsRef.current = null;
                setConversionProgress(null);
                fetch(`${origin}/api/video-src?id=${encodeURIComponent(requestedItemId)}`, { credentials: 'same-origin' })
                  .then((r) => r.json().catch(() => null))
                  .then((src) => {
                    if (src?.url) {
                      const url = src.url.startsWith('http') ? src.url : `${origin}${src.url.startsWith('/') ? '' : '/'}${src.url}`;
                      applyUrl(url, (src.type ?? 'video') === 'hls' ? 'hls' : 'video');
                    } else {
                      setConversionError(src?.error ?? 'Could not start playback after conversion.');
                    }
                  })
                  .catch(() => setConversionError('Could not load video after conversion.'));
                return;
              }
              if (d.error) {
                es.close();
                conversionEsRef.current = null;
                setConversionProgress(null);
                setConversionError(d.error);
                return;
              }
              setConversionProgress(d.progress ?? 0);
              setConversionCurrentTime(d.currentTime ?? 0);
              setConversionDuration(d.durationSeconds ?? 0);
            } catch { /* ignore parse errors */ }
          };
          es.onerror = () => {
            es.close();
            conversionEsRef.current = null;
            setConversionError('Connection lost');
          };
          return;
        }
        if (data?.url) {
          const url = data.url.startsWith('http') ? data.url : `${origin}${data.url.startsWith('/') ? '' : '/'}${data.url}`;
          applyUrl(url, (data.type ?? 'video') === 'hls' ? 'hls' : 'video');
        } else {
          applyUrl(fallbackUrl, 'video');
        }
      })
      .catch(() => {
        setStreamUrl(fallbackUrl);
        setStreamType('video');
        setStreamForItemId(requestedItemId);
      });
    fetch(`${origin}/api/video-duration?id=${encodeURIComponent(itemId)}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.durationSeconds != null && data.durationSeconds > 0 && setDurationSeconds(Number(data.durationSeconds)))
      .catch(() => {});
    return () => {
      if (conversionEsRef.current) {
        conversionEsRef.current.close();
        conversionEsRef.current = null;
      }
    };
  }, [itemId]);

  // When playing a series episode, fetch next episode so we can show "Next episode" button
  useEffect(() => {
    if (!itemId || typeof window === 'undefined' || !EPISODE_ID_REGEX.test(itemId)) {
      setNextEpisode(null);
      return;
    }
    const origin = window.location.origin;
    fetch(`${origin}/api/next-episode?id=${encodeURIComponent(itemId)}`, { credentials: 'same-origin' })
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (data?.nextId) {
          setNextEpisode({
            nextId: data.nextId,
            nextTitle: data.nextTitle ?? 'Next episode',
            subtitleLanguages: data.subtitleLanguages,
          });
        } else {
          setNextEpisode(null);
        }
      })
      .catch(() => setNextEpisode(null));
  }, [itemId]);

  // When episodes panel opens, fetch full series episode list
  useEffect(() => {
    if (!episodesPanelOpen || !seriesId || typeof window === 'undefined') return;
    setSeriesEpisodes(null);
    const origin = window.location.origin;
    const showTitle = seriesTitle ?? (seriesId && getSeriesTitle?.(seriesId)) ?? title ?? '';
    const titleParam = showTitle ? `&title=${encodeURIComponent(showTitle)}` : '';
    fetch(`${origin}/api/series-episodes?id=${encodeURIComponent(seriesId)}${titleParam}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data?.seasons ? setSeriesEpisodes(data.seasons) : setSeriesEpisodes([])))
      .catch(() => setSeriesEpisodes([]));
  }, [episodesPanelOpen, seriesId, seriesTitle, title, getSeriesTitle]);

  const handleError = () => {
    if (!streamUrl) return;
    fetch(streamUrl, { method: 'GET', headers: { Range: 'bytes=0-0' }, credentials: 'same-origin' })
      .then((r) => {
        if (r.status === 404) {
          setError(itemId?.startsWith('episode-') ? 'This episode is not in your library.' : 'Rescan your library and try again.');
        } else if (r.status === 415) return r.json().then((d) => setError(d?.error ?? 'Format not supported. Use MP4, MKV, or WebM.'));
        else if (r.ok && r.headers.get('X-MKV-Remux-Unavailable')) {
          const converting = r.headers.get('X-MKV-Converting');
          setError(
            converting
              ? 'This MKV can’t play in the browser. We’re converting it in the background—close this and play the same title again in a few minutes for sound.'
              : 'This MKV couldn’t be played (audio codec not supported). Install ffmpeg and try again so we can convert it, or run: ffmpeg -i "movie.mkv" -c:v copy -c:a aac "movie.mp4"'
          );
        } else {
          setError(
            "Your browser can't play this file. Use MP4 or WebM, or convert MKV to MP4: ffmpeg -i file.mkv -c copy file.mp4"
          );
        }
      })
      .catch(() => setError('Network error.'));
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tracks = (itemId && subtitleLanguages?.length && origin)
    ? subtitleLanguages.map((lang) => ({
        lang,
        src: `${origin}/api/subtitles?id=${encodeURIComponent(itemId)}&lang=${encodeURIComponent(lang)}`,
        label: LANG_LABELS[lang] ?? lang,
      }))
    : [];

  // In the control bar: for series always "Show Name • S1 E2" (same whether from Play or Episodes list). Only add short episode name, never the long "Show – S1:E1 Episode 1" format from DetailCard.
  const episodeMatch = itemId?.match(/S(\d+)-E(\d+)/);
  const episodeLabel = episodeMatch ? `S${episodeMatch[1]} E${episodeMatch[2]}` : null;
  const seriesPart = seriesTitle ?? (seriesId ? getSeriesTitle?.(seriesId) ?? null : null);
  const isLongFormTitle = title && (title.includes(' – ') || title.includes(' - S') || (seriesPart && title.startsWith(seriesPart)));
  const shortEpisodeName = title && !isLongFormTitle && title.length < 50 ? title : null;
  const displayTitle =
    seriesId && (seriesPart || episodeLabel)
      ? [seriesPart, episodeLabel, shortEpisodeName].filter(Boolean).join(' • ')
      : (title ?? '');

  if (!showModal) return null;

  if (message) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-6 p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Playback unavailable"
      >
        <p className="text-white text-center text-lg max-w-md">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 rounded bg-white text-black font-medium hover:bg-white/90"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-12 h-12 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors"
          aria-label="Close"
        >
          <Close sx={{ fontSize: 28 }} />
        </button>
      </div>
    );
  }

  if (!itemId) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Playing ${title}` : 'Video player'}
    >
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black text-white p-6 z-30">
          <p className="text-center text-lg">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded bg-white text-black font-medium hover:bg-white/90"
          >
            Close
          </button>
        </div>
      ) : conversionProgress !== null ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 bg-black">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Converting" />
          <p className="text-white text-lg font-medium">Converting MKV to MP4…</p>
          <p className="text-white/70 text-sm">This might take a while. Don&apos;t close this window.</p>
          <div className="w-full max-w-md">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${Math.min(100, conversionProgress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-center text-white font-medium">
              {Math.round(Math.min(100, conversionProgress * 100))}%
            </p>
          </div>
        </div>
      ) : conversionError && !streamUrl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black text-white p-6 z-30">
          <p className="text-center text-lg">{conversionError}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded bg-white text-black font-medium hover:bg-white/90"
          >
            Close
          </button>
        </div>
      ) : !streamReadyForCurrentItem ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/70">Loading…</div>
      ) : (
        <div className="relative w-full h-full">
        <MediaPlayer
          key={itemId}
          src={streamType === 'hls' ? { src: streamUrl, type: 'application/vnd.apple.mpegurl' as const } : streamUrl}
          autoPlay
          playsInline
          muted={false}
          volume={1}
          duration={durationSeconds ?? undefined}
          className="w-full h-full"
          title={displayTitle}
          onError={handleError}
        >
          <MediaProvider>
            <EnsureUnmuted />
            <DisplayTimeSync
              apiDuration={durationSeconds}
              streamStartOffset={0}
              onDisplayTimeChange={setDisplayCurrentTime}
            />
            {itemId && (
              <ProgressSync
                itemId={itemId}
                initialProgress={initialProgress}
                streamStartOffset={0}
                onSave={setProgress}
                overrideDurationSeconds={durationSeconds}
              />
            )}
            {tracks.map((t, i) => (
              <Track
                key={t.lang}
                kind="subtitles"
                src={t.src}
                lang={t.lang}
                label={t.label}
                default={i === 0}
              />
            ))}
          </MediaProvider>
          <DefaultVideoLayout
            icons={defaultLayoutIcons}
            colorScheme="dark"
            slots={{
              currentTime: (
                <span className="vds-time" role="status" aria-label="Current time">
                  {formatTime(displayCurrentTime)}
                </span>
              ),
              endTime:
                durationSeconds != null && durationSeconds > 0 ? (
                  <span className="vds-time" role="status" aria-label="Total duration">
                    {formatTime(durationSeconds)}
                  </span>
                ) : (
                  <Time type="duration" />
                ),
              afterMuteButton:
                seriesId && onPlayEpisode ? (
                  <div className="vds-button-group flex items-center gap-0.5">
                    {nextEpisode && (
                      <button
                        type="button"
                        onClick={() => stableOnPlayEpisode(nextEpisode.nextId, nextEpisode.nextTitle, nextEpisode.subtitleLanguages)}
                        className="vds-button flex h-10 w-10 items-center justify-center rounded-sm text-white hover:bg-white/20 focus:ring-2 focus:ring-white/50"
                        aria-label={`Next: ${nextEpisode.nextTitle}`}
                        title={`Next: ${nextEpisode.nextTitle}`}
                      >
                        <SkipNext sx={{ fontSize: 22 }} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEpisodesPanelOpen(true)}
                      className="vds-button flex h-10 w-10 items-center justify-center rounded-sm text-white hover:bg-white/20 focus:ring-2 focus:ring-white/50"
                      aria-label="Episodes list"
                      title="Episodes"
                    >
                      <PlaylistPlay sx={{ fontSize: 22 }} />
                    </button>
                  </div>
                ) : undefined,
            }}
          />
        </MediaPlayer>
        </div>
      )}
      {/* Episodes list panel (series only) - memoized to avoid flicker from display time updates */}
      {episodesPanelOpen && seriesId && (
        <EpisodesPanel
          seriesEpisodes={seriesEpisodes}
          itemId={itemId}
          setEpisodesPanelOpen={setEpisodesPanelOpen}
          onPlayEpisode={stableOnPlayEpisode}
          getProgress={getProgress}
        />
      )}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-12 h-12 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors"
        aria-label="Close"
      >
        <Close sx={{ fontSize: 28 }} />
      </button>
    </div>
  );
}
