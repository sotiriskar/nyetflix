'use client';

import { useEffect, useState, useRef } from 'react';
import Close from '@mui/icons-material/Close';
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
    if (effectiveDuration > 0 && initialProgress > 0 && initialProgress < 1 && !hasSeeked.current) {
      hasSeeked.current = true;
      remote.seek(initialProgress * effectiveDuration);
    }
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
  }, [effectiveCurrentTime, duration, apiDuration, playing, streamStartOffset, onDisplayTimeChange, tick]);

  useEffect(() => {
    if (!playing) return;
    const bogusAtEnd = max > 0 && effectiveCurrentTime >= max - 0.5 && !hasSeenLowCurrentTime.current;
    if (!bogusAtEnd) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
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

const LANG_LABELS: Record<string, string> = {
  en: 'English', el: 'Greek', es: 'Spanish', fr: 'French',
  de: 'German', it: 'Italian', pt: 'Portuguese', ru: 'Russian',
  ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic',
  tr: 'Turkish', nl: 'Dutch', pl: 'Polish', sv: 'Swedish',
};

interface VideoPlayerModalProps {
  itemId: string | null;
  title?: string;
  subtitleLanguages?: string[];
  /** Preferred subtitle language code (e.g. from settings). If a track matches, it will be selected by default. */
  preferredSubtitleLang?: string;
  /** When set, show this message instead of the video (e.g. "This episode is not in your library"). */
  message?: string | null;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoPlayerModal({ itemId, title, subtitleLanguages, preferredSubtitleLang, message, onClose }: VideoPlayerModalProps) {
  const [streamUrl, setStreamUrl] = useState('');
  const [streamType, setStreamType] = useState<'video' | 'hls'>('video');
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [displayCurrentTime, setDisplayCurrentTime] = useState(0);
  const [conversionProgress, setConversionProgress] = useState<number | null>(null);
  const [conversionEta, setConversionEta] = useState<number | null>(null);
  const [conversionCurrentTime, setConversionCurrentTime] = useState(0);
  const [conversionDuration, setConversionDuration] = useState(0);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const showModal = !!itemId || !!message;
  const { getProgress, setProgress } = useProgress();
  const initialProgress = itemId ? (getProgress(itemId)?.progress ?? 0) : 0;
  const conversionEsRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    if (showModal) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [showModal, onClose]);

  useEffect(() => {
    if (!itemId || typeof window === 'undefined') {
      if (conversionEsRef.current) {
        conversionEsRef.current.close();
        conversionEsRef.current = null;
      }
      setStreamUrl('');
      setError(null);
      setDurationSeconds(null);
      setConversionProgress(null);
      setConversionError(null);
      return;
    }
    setError(null);
    setDurationSeconds(null);
    setDisplayCurrentTime(0);
    setConversionProgress(null);
    setConversionError(null);
    setStreamUrl('');
    setStreamType('video');
    const origin = window.location.origin;
    const fallbackUrl = `${origin}/api/stream-video?id=${encodeURIComponent(itemId)}`;
    fetch(`${origin}/api/video-src?id=${encodeURIComponent(itemId)}`, { credentials: 'same-origin' })
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (data?.error && !data?.url) {
          setError(data.error);
          return;
        }
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
                fetch(`${origin}/api/video-src?id=${encodeURIComponent(itemId)}`, { credentials: 'same-origin' })
                  .then((r) => r.json().catch(() => null))
                  .then((src) => {
                    if (src?.url) {
                      const url = src.url.startsWith('http') ? src.url : `${origin}${src.url.startsWith('/') ? '' : '/'}${src.url}`;
                      setStreamUrl(url);
                      setStreamType((src.type ?? 'video') === 'hls' ? 'hls' : 'video');
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
              setConversionEta(d.etaSeconds ?? null);
            } catch {}
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
          setStreamUrl(url);
          setStreamType((data.type ?? 'video') === 'hls' ? 'hls' : 'video');
        } else {
          setStreamUrl(fallbackUrl);
          setStreamType('video');
        }
      })
      .catch(() => {
        setStreamUrl(fallbackUrl);
        setStreamType('video');
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

  const hasPreferred = !!preferredSubtitleLang && tracks.some((t) => t.lang === preferredSubtitleLang);

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
      ) : !streamUrl ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/70">Loading…</div>
      ) : (
        <div className="relative w-full h-full">
        <MediaPlayer
          key={streamUrl}
          src={streamType === 'hls' ? { src: streamUrl, type: 'application/vnd.apple.mpegurl' as const } : streamUrl}
          autoPlay
          playsInline
          muted={false}
          volume={1}
          duration={durationSeconds ?? undefined}
          className="w-full h-full"
          title={title}
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
                default={hasPreferred ? t.lang === preferredSubtitleLang : i === 0}
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
            }}
          />
        </MediaPlayer>
        </div>
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
