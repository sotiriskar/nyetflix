'use client';

import { useEffect, useState, useRef } from 'react';
import Close from '@mui/icons-material/Close';
import {
  MediaPlayer,
  MediaProvider,
  Track,
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
  onSave,
}: {
  itemId: string;
  initialProgress: number;
  onSave: (itemId: string, progress: number) => void;
}) {
  const currentTime = useMediaState('currentTime');
  const duration = useMediaState('duration');
  const remote = useMediaRemote();
  const hasSeeked = useRef(false);
  const lastSaved = useRef(0);
  const latestProgress = useRef(0);

  useEffect(() => {
    if (duration > 0 && initialProgress > 0 && initialProgress < 1 && !hasSeeked.current) {
      hasSeeked.current = true;
      remote.seek(initialProgress * duration);
    }
  }, [duration, initialProgress, remote]);

  if (duration > 0 && currentTime >= 0) {
    const p = currentTime / duration;
    if (p > 0 && p < 1) latestProgress.current = p;
  }

  useEffect(() => {
    if (duration <= 0) return;
    const progress = currentTime / duration;
    const now = Date.now();
    if (progress > 0 && progress < 1 && now - lastSaved.current >= SAVE_INTERVAL_MS) {
      lastSaved.current = now;
      onSave(itemId, progress);
    }
  }, [currentTime, duration, itemId, onSave]);

  useEffect(() => {
    return () => {
      const p = latestProgress.current;
      if (p > 0 && p < 1) onSave(itemId, p);
    };
  }, [itemId, onSave]);

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

export function VideoPlayerModal({ itemId, title, subtitleLanguages, preferredSubtitleLang, message, onClose }: VideoPlayerModalProps) {
  const [streamUrl, setStreamUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const showModal = !!itemId || !!message;
  const { getProgress, setProgress } = useProgress();
  const initialProgress = itemId ? (getProgress(itemId)?.progress ?? 0) : 0;

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
      setStreamUrl('');
      setError(null);
      return;
    }
    setError(null);
    setStreamUrl(`${window.location.origin}/api/stream-video?id=${encodeURIComponent(itemId)}`);
  }, [itemId]);

  const handleError = () => {
    if (!streamUrl) return;
    fetch(streamUrl, { method: 'GET', headers: { Range: 'bytes=0-0' }, credentials: 'same-origin' })
      .then((r) => {
        if (r.status === 404) {
          setError(itemId?.startsWith('episode-') ? 'This episode is not in your library.' : 'Rescan your library and try again.');
        } else if (r.status === 415) return r.json().then((d) => setError(d?.error ?? 'Format not supported. Use MP4 or WebM.'));
        else setError('Could not play video.');
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
      ) : (
        <MediaPlayer
          src={streamUrl}
          autoPlay
          className="w-full h-full"
          title={title}
          onError={handleError}
        >
          <MediaProvider>
            {itemId && (
              <ProgressSync
                itemId={itemId}
                initialProgress={initialProgress}
                onSave={setProgress}
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
          />
        </MediaPlayer>
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
