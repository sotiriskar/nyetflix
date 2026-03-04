import { useState, useRef, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PlayArrow from '@mui/icons-material/PlayArrow';
import ThumbUp from '@mui/icons-material/ThumbUp';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import VolumeOff from '@mui/icons-material/VolumeOff';
import VolumeUp from '@mui/icons-material/VolumeUp';
import type { CarouselItem } from '../types/movie';
import { getContentRatingDescriptors } from '@/lib/contentRating';
import { useTrailerMute } from '@/context/TrailerMuteContext';
import { useTrailerResume } from '@/context/TrailerResumeContext';

const HOVER_OVERLAY_PLAYER_ID = 'hover-overlay-trailer';

const HOVER_OVERLAY_DELAY_MS = 500;
const HOVER_TRAILER_DELAY_MS = 400;
const OVERLAY_WIDTH = 445;
const OVERLAY_MIN_HEIGHT = 400;

/** Format duration string: "145m" -> "2h 25m", "45m" -> "45m". */
function formatDuration(d: string | undefined): string | undefined {
  if (!d?.trim()) return undefined;
  const minOnly = d.trim().match(/^(\d+)\s*m(?:in)?$/i);
  if (minOnly) {
    const totalM = parseInt(minOnly[1], 10);
    if (totalM >= 60) return `${Math.floor(totalM / 60)}h ${totalM % 60}m`;
    return `${totalM}m`;
  }
  return d;
}

interface CarouselHoverCardProps {
  item: CarouselItem;
  duration?: string;
  progress?: number;
  genres?: string;
  mediaType?: 'movie' | 'series';
  seasonsCount?: number;
  hasSubtitles?: boolean;
  /** Age rating e.g. "13+", "18+" (shows badge + descriptors on hover card). */
  contentRating?: string;
  /** If true, show the thin progress bar at bottom of card (e.g. Continue Watching row). */
  showProgressBar?: boolean;
  onClick?: () => void;
  onPlay?: (item: CarouselItem) => void;
  onAddClick?: () => void;
  isInList?: boolean;
  onLikeClick?: () => void;
  isLiked?: boolean;
}

export function CarouselHoverCard({
  item,
  duration,
  progress = 0,
  genres,
  mediaType,
  seasonsCount,
  hasSubtitles = false,
  contentRating,
  showProgressBar = false,
  onClick,
  onPlay,
  onAddClick,
  isInList = false,
  onLikeClick,
  isLiked = false,
}: CarouselHoverCardProps) {
  const progressPercent = Math.min(1, Math.max(0, progress ?? 0)) * 100;
  const { isMuted, setMuted } = useTrailerMute();
  const [showTrailer, setShowTrailer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [overlayRect, setOverlayRect] = useState<{ left: number; top: number; cardWidth: number } | null>(null);
  const [overlayAnimated, setOverlayAnimated] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setResume } = useTrailerResume();
  const hoverYtPlayerRef = useRef<{ getCurrentTime: () => number; mute: () => void; unMute: () => void; destroy: () => void } | null>(null);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const genreList = useMemo(() => {
    if (!genres?.trim()) return [];
    return genres.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3);
  }, [genres]);

  const durationDisplay = duration ? formatDuration(duration) : undefined;
  const metaLine =
    mediaType === 'series'
      ? seasonsCount != null && seasonsCount > 0
        ? `${seasonsCount} Season${seasonsCount !== 1 ? 's' : ''}`
        : undefined
      : durationDisplay;

  const updateOverlayRect = useCallback(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setOverlayRect({
      left: rect.left + rect.width / 2 - OVERLAY_WIDTH / 2,
      top: rect.top + rect.height / 2 - OVERLAY_MIN_HEIGHT / 2,
      cardWidth: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isHovered) {
      setOverlayRect(null);
      setOverlayAnimated(false);
      return;
    }
    updateOverlayRect();
    const onScrollOrResize = () => updateOverlayRect();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isHovered, updateOverlayRect]);

  useEffect(() => {
    if (!overlayRect) {
      setOverlayAnimated(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setOverlayAnimated(true));
    });
    return () => cancelAnimationFrame(id);
  }, [overlayRect]);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (closeCooldownRef.current) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
      if (item.trailerYouTubeId) {
        hoverTimerRef.current = setTimeout(() => setShowTrailer(true), HOVER_TRAILER_DELAY_MS);
      }
    }, HOVER_OVERLAY_DELAY_MS);
  }, [item.trailerYouTubeId, clearHoverTimer]);

  const closeOverlay = useCallback(() => {
    clearHoverTimer();
    setIsHovered(false);
    setShowTrailer(false);
    if (closeCooldownRef.current) clearTimeout(closeCooldownRef.current);
    closeCooldownRef.current = setTimeout(() => {
      closeCooldownRef.current = null;
    }, 200);
  }, [clearHoverTimer]);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    const toOverlay = e.relatedTarget && overlayRef.current && overlayRef.current.contains(e.relatedTarget as Node);
    if (!toOverlay) closeOverlay();
  }, [closeOverlay]);

  const handleOverlayMouseLeave = useCallback((e: React.MouseEvent) => {
    const toCard = e.relatedTarget && cardRef.current && cardRef.current.contains(e.relatedTarget as Node);
    if (!toCard) closeOverlay();
  }, [closeOverlay]);

  useEffect(() => {
    if (!overlayRect || !showTrailer || !item.trailerYouTubeId || typeof document === 'undefined') return;
    const initYt = () => {
      const w = window as Window & { YT?: { Player: new (el: string | HTMLElement, opts: Record<string, unknown>) => { getCurrentTime: () => number; destroy: () => void } } };
      if (!w.YT?.Player) return;
      const el = document.getElementById(HOVER_OVERLAY_PLAYER_ID);
      if (!el) return;
      if (hoverYtPlayerRef.current) {
        hoverYtPlayerRef.current.destroy();
        hoverYtPlayerRef.current = null;
      }
      const Player = w.YT.Player;
      const player = new Player(el, {
        videoId: item.trailerYouTubeId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          loop: 1,
          rel: 0,
          playlist: item.trailerYouTubeId,
          disablekb: 1,
          fs: 0,
        },
        events: {
          onReady: () => {
            setTimeout(() => {
              if (hoverYtPlayerRef.current?.unMute && !isMutedRef.current) {
                hoverYtPlayerRef.current.unMute();
              }
            }, 100);
          },
        },
      }) as { getCurrentTime: () => number; mute: () => void; unMute: () => void; destroy: () => void };
      hoverYtPlayerRef.current = player;
    };
    if ((window as Window & { YT?: { Player: unknown } }).YT?.Player) {
      initYt();
      return () => {
        if (hoverYtPlayerRef.current) {
          hoverYtPlayerRef.current.destroy();
          hoverYtPlayerRef.current = null;
        }
      };
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    (window as Window & { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => {
      initYt();
    };
    return () => {
      if (hoverYtPlayerRef.current) {
        hoverYtPlayerRef.current.destroy();
        hoverYtPlayerRef.current = null;
      }
    };
  }, [overlayRect, showTrailer, item.trailerYouTubeId]);

  useEffect(() => {
    const p = hoverYtPlayerRef.current;
    if (!p?.mute || !p?.unMute) return;
    if (isMuted) {
      p.mute();
    } else {
      p.unMute();
      const t = setTimeout(() => { hoverYtPlayerRef.current?.unMute?.(); }, 300);
      return () => clearTimeout(t);
    }
  }, [isMuted]);

  const openModal = useCallback(() => {
    const t = hoverYtPlayerRef.current?.getCurrentTime?.();
    if (typeof t === 'number' && t > 0 && item.trailerYouTubeId) setResume(item.trailerYouTubeId, t);
    closeOverlay();
    onClick?.();
  }, [closeOverlay, onClick, item.trailerYouTubeId, setResume]);

  const initialScale = overlayRect ? Math.min(1, overlayRect.cardWidth / OVERLAY_WIDTH) : 1;
  const zoomInReady = overlayAnimated;
  const overlayContent = overlayRect && (
    <div
      ref={overlayRef}
      dir="ltr"
      className={`fixed z-[9999] rounded-md overflow-hidden bg-[#181818] shadow-2xl ring-1 ring-white/20 origin-center ${zoomInReady ? 'opacity-100' : 'opacity-0'}`}
      style={{
        left: Math.max(8, Math.min(overlayRect.left, typeof window !== 'undefined' ? window.innerWidth - OVERLAY_WIDTH - 8 : overlayRect.left)),
        top: Math.max(8, Math.min(overlayRect.top, typeof window !== 'undefined' ? window.innerHeight - OVERLAY_MIN_HEIGHT - 8 : overlayRect.top)),
        width: OVERLAY_WIDTH,
        minHeight: OVERLAY_MIN_HEIGHT,
        transform: zoomInReady ? 'scale(1)' : `scale(${initialScale})`,
        transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onMouseLeave={handleOverlayMouseLeave}
    >
      <div className="relative aspect-video w-full bg-white/10 overflow-hidden rounded-t-md">
        {showTrailer && item.trailerYouTubeId ? (
          <div className="absolute inset-0 overflow-hidden">
            <div
              id={HOVER_OVERLAY_PLAYER_ID}
              className="absolute inset-0 w-full h-full pointer-events-none origin-center"
              style={{ transform: 'scale(1.5)' }}
            />
          </div>
        ) : (item.backdropUrl ?? item.posterUrl) ? (
          <img
            src={item.backdropUrl ?? item.posterUrl}
            alt=""
            className="block size-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center min-h-[120px]">
            <span className="text-white/40 text-4xl font-bold select-none" aria-hidden>?</span>
          </div>
        )}
        {/* Title / logo inside video area, bottom-left */}
        <div className="absolute left-0 right-0 bottom-[-1px] pt-6 pb-2 px-5 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none rounded-t-md">
          <div className="flex items-end min-h-[1.25rem]">
            {item.titleLogoUrl ? (
              <img src={item.titleLogoUrl} alt={item.title} className="max-h-8 w-auto object-contain object-left drop-shadow-md" />
            ) : (
              <span className="text-white font-semibold text-xs truncate block drop-shadow-md">{item.title}</span>
            )}
          </div>
        </div>
        {/* Mute / unmute inside video area, bottom-right */}
        {showTrailer && item.trailerYouTubeId && (
          <button
            type="button"
            className="absolute bottom-2 right-5 z-10 w-10 h-10 rounded-full border-2 border-white/80 flex items-center justify-center text-white bg-black/30 hover:bg-black/50 transition-colors shrink-0"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            onClick={(e) => { e.stopPropagation(); setMuted(!isMuted); }}
          >
            {isMuted ? <VolumeOff sx={{ fontSize: 22 }} /> : <VolumeUp sx={{ fontSize: 22 }} />}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 px-5 pt-3 pb-3">
        <button
          type="button"
          className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0"
          aria-label="Play"
          onClick={(e) => { e.stopPropagation(); onPlay?.(item); }}
        >
          <PlayArrow sx={{ fontSize: 22 }} />
        </button>
        <button
          type="button"
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isInList ? 'border-white bg-white text-black' : 'border-white text-white hover:bg-white/20'}`}
          aria-label={isInList ? 'In My List' : 'Add to list'}
          onClick={(e) => { e.stopPropagation(); onAddClick?.(); }}
        >
          {isInList ? <Check sx={{ fontSize: 22 }} /> : <Add sx={{ fontSize: 22 }} />}
        </button>
        <button
          type="button"
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isLiked ? 'border-white bg-white text-black' : 'border-white text-white hover:bg-white/20'}`}
          aria-label={isLiked ? 'Liked' : 'Like'}
          onClick={(e) => { e.stopPropagation(); onLikeClick?.(); }}
        >
          <ThumbUp sx={{ fontSize: 20 }} />
        </button>
        <button
          type="button"
          className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0 ml-auto"
          aria-label="More info"
          onClick={(e) => { e.stopPropagation(); openModal(); }}
        >
          <ExpandMore sx={{ fontSize: 26 }} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 pb-5 text-base text-white/80">
        {contentRating && (
          <span className="flex items-center gap-2">
            <span className="inline-block border border-white/70 rounded px-1.5 py-0.5 text-xs font-medium text-white/90">{contentRating}</span>
          </span>
        )}
        {metaLine && <span>{metaLine}</span>}
        <span className="inline-flex items-center rounded border border-white/50 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/80">HD</span>
        {hasSubtitles && (
          <span className="inline-flex items-center text-white/80">
            <SubtitlesOutlined sx={{ fontSize: 24 }} />
          </span>
        )}
        {genreList.length > 0 && (
          <span className="w-full truncate text-lg font-medium text-white/90">{genreList.join(' • ')}</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={cardRef}
        className="h-full w-full rounded-md cursor-pointer relative"
        onClick={() => openModal()}
        onKeyDown={(e) => e.key === 'Enter' && openModal()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
      >
        <div className="absolute inset-0 rounded-md overflow-hidden ring-1 ring-white/10 bg-white/10">
          {/* Trailer plays only in the overlay portal, not on the thumbnail — avoids double video/sound */}
          {(item.backdropUrl ?? item.posterUrl) ? (
            <img src={item.backdropUrl ?? item.posterUrl} alt="" className="block size-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/40 text-5xl font-bold select-none leading-none" aria-hidden>?</span>
            </div>
          )}
        </div>
        <div className={`absolute left-0 right-0 bottom-0 pt-10 pb-2 px-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-md pointer-events-none transition-opacity duration-200 ${isHovered ? 'opacity-0' : ''} ${showTrailer ? 'opacity-0' : ''}`}>
          <div className="flex items-end justify-start min-h-[clamp(1.25rem,5vmin,2rem)]">
            {item.titleLogoUrl ? (
              <img src={item.titleLogoUrl} alt={item.title} className="max-h-[clamp(1.5rem,7vmin,3.5rem)] w-auto object-contain object-left" />
            ) : (
              <span className="text-white font-semibold truncate drop-shadow-md" style={{ fontSize: 'clamp(0.8rem, 2.4vmin, 1.15rem)' }}>
                {item.title}
              </span>
            )}
          </div>
        </div>
        {showProgressBar && progressPercent > 0 && (
          <div className="absolute left-0 right-0 bottom-0 h-1 rounded-b-md overflow-hidden bg-white/30 pointer-events-none z-10" aria-hidden>
            <div className="h-full bg-[#E50914] rounded-b-md transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>
      {typeof document !== 'undefined' && overlayContent && createPortal(overlayContent, document.body)}
    </>
  );
}
