'use client';

import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PlayArrow from '@mui/icons-material/PlayArrow';
import ThumbUp from '@mui/icons-material/ThumbUp';
import VolumeOff from '@mui/icons-material/VolumeOff';
import VolumeUp from '@mui/icons-material/VolumeUp';
import Tooltip from '@mui/material/Tooltip';
import type { CarouselItem } from '@/types/movie';
import { useTrailerMute } from '@/context/TrailerMuteContext';
import { useTrailerResume } from '@/context/TrailerResumeContext';

const HOVER_OVERLAY_PLAYER_ID = 'hover-overlay-continue-trailer';
const HOVER_OVERLAY_DELAY_MS = 500;
const HOVER_TRAILER_DELAY_MS = 400;
const OVERLAY_WIDTH = 445;
const OVERLAY_MIN_HEIGHT = 400;

/** Parse duration string to total minutes. "126m" -> 126, "2h 25m" -> 145. */
function parseDurationToMinutes(d: string | undefined): number {
  if (!d?.trim()) return 0;
  const s = d.trim();
  const minOnly = s.match(/^(\d+)\s*m(?:in)?$/i);
  if (minOnly) return parseInt(minOnly[1], 10);
  const hAndM = s.match(/^(\d+)\s*h(?:ours?)?\s*(\d+)\s*m(?:in)?$/i);
  if (hAndM) return parseInt(hAndM[1], 10) * 60 + parseInt(hAndM[2], 10);
  return 0;
}

/** Format minutes as "Xm" only (no hours). */
function formatMinutes(m: number): string {
  return `${m}m`;
}

export interface ContinueWatchingHoverCardProps {
  item: CarouselItem;
  duration?: string;
  progress?: number;
  onClick?: () => void;
  onPlay?: (item: CarouselItem) => void;
  onAddClick?: () => void;
  isInList?: boolean;
  onLikeClick?: () => void;
  isLiked?: boolean;
  onRemoveFromContinueWatching?: () => void;
}

export function ContinueWatchingHoverCard({
  item,
  duration,
  progress = 0,
  onClick,
  onPlay,
  onAddClick,
  isInList = false,
  onLikeClick,
  isLiked = false,
  onRemoveFromContinueWatching,
}: ContinueWatchingHoverCardProps) {
  const progressPercent = Math.min(1, Math.max(0, progress ?? 0)) * 100;
  const totalMinutes = parseDurationToMinutes(duration);
  const currentMinutes = totalMinutes > 0 ? Math.floor((progress ?? 0) * totalMinutes) : 0;
  const progressLabel =
    totalMinutes > 0 ? `${currentMinutes} of ${formatMinutes(totalMinutes)}` : '';

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
          start: 8,
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

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveFromContinueWatching?.();
    closeOverlay();
  }, [onRemoveFromContinueWatching, closeOverlay]);

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
        <div className="absolute left-0 right-0 bottom-[-1px] pt-6 pb-2 px-5 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none rounded-t-md">
          <div className="flex items-end min-h-[1.25rem]">
            {item.titleLogoUrl ? (
              <img
                src={item.titleLogoUrl}
                alt={item.title}
                className="w-auto max-w-[min(100%,15rem)] max-h-14 object-contain object-left drop-shadow-md [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.35))_drop-shadow(0_1px_4px_rgba(0,0,0,0.5))]"
              />
            ) : (
              <span className="text-white font-semibold text-xs truncate block drop-shadow-md">{item.title}</span>
            )}
          </div>
        </div>
        {showTrailer && item.trailerYouTubeId && (
          <button
            type="button"
            className="absolute bottom-2 right-5 z-10 w-13 h-13 rounded-full border-2 border-white/20 hover:border-white/80 flex items-center justify-center text-white/20 hover:text-white/80 bg-black/5 hover:bg-black/25 transition-colors shrink-0"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            onClick={(e) => { e.stopPropagation(); setMuted(!isMuted); }}
          >
            {isMuted ? <VolumeOff sx={{ fontSize: 28 }} /> : <VolumeUp sx={{ fontSize: 28 }} />}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 px-5 pt-3 pb-3">
        <button
          type="button"
          className="w-13 h-13 rounded-full border-2 border-white flex items-center justify-center text-black bg-white hover:bg-white/90 transition-colors shrink-0"
          aria-label="Play"
          onClick={(e) => { e.stopPropagation(); onPlay?.(item); }}
        >
          <PlayArrow sx={{ fontSize: 28 }} />
        </button>
        <Tooltip slotProps={{ popper: { sx: { zIndex: 10001, '& .MuiTooltip-arrow': { color: '#fff' } } }, tooltip: { sx: { backgroundColor: '#fff', color: '#000', fontSize: '20px', padding: '5px 25px', fontWeight: 700 } } }} title={isInList ? 'Remove from My List' : 'Add to My List'} placement="top" arrow>
          <button
            type="button"
            className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isInList ? 'border-white bg-white text-black' : 'border-white/40 hover:border-white/80 text-white bg-white/5 hover:bg-white/25'}`}
            aria-label={isInList ? 'In My List' : 'Add to list'}
            onClick={(e) => { e.stopPropagation(); onAddClick?.(); }}
          >
            {isInList ? <Check sx={{ fontSize: 28 }} /> : <Add sx={{ fontSize: 28 }} />}
          </button>
        </Tooltip>
        <Tooltip slotProps={{ popper: { sx: { zIndex: 10001, '& .MuiTooltip-arrow': { color: '#fff' } } }, tooltip: { sx: { backgroundColor: '#fff', color: '#000', fontSize: '20px', padding: '5px 25px', fontWeight: 700 } } }} title="Remove from row" placement="top" arrow>
          <button
            type="button"
            className="w-14 h-14 rounded-full border-2 border-white/40 hover:border-white/80 flex items-center justify-center text-white bg-white/5 hover:bg-white/25 transition-colors shrink-0"
            aria-label="Remove from Continue Watching"
            onClick={handleRemove}
          >
            <Close sx={{ fontSize: 28 }} />
          </button>
        </Tooltip>
        <Tooltip slotProps={{ popper: { sx: { zIndex: 10001, '& .MuiTooltip-arrow': { color: '#fff' } } }, tooltip: { sx: { backgroundColor: '#fff', color: '#000', fontSize: '20px', padding: '5px 25px', fontWeight: 700 } } }} title={isLiked ? 'Not for me' : 'I like this'} placement="top" arrow>
          <button
            type="button"
            className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isLiked ? 'border-white bg-white text-black' : 'border-white/40 hover:border-white/80 text-white bg-white/5 hover:bg-white/25'}`}
            aria-label={isLiked ? 'Liked' : 'Like'}
            onClick={(e) => { e.stopPropagation(); onLikeClick?.(); }}
          >
            <ThumbUp sx={{ fontSize: 24 }} />
          </button>
        </Tooltip>
        <Tooltip slotProps={{ popper: { sx: { zIndex: 10001, '& .MuiTooltip-arrow': { color: '#fff' } } }, tooltip: { sx: { backgroundColor: '#fff', color: '#000', fontSize: '20px', padding: '5px 25px', fontWeight: 700 } } }} title="Episodes & info" placement="top" arrow>
          <button
            type="button"
            className="w-14 h-14 rounded-full border-2 border-white/40 hover:border-white/80 flex items-center justify-center text-white bg-white/5 hover:bg-white/25 transition-colors shrink-0 ml-auto"
            aria-label="More info"
            onClick={(e) => { e.stopPropagation(); openModal(); }}
          >
            <ExpandMore sx={{ fontSize: 28 }} />
          </button>
        </Tooltip>
      </div>
      {/* Progress bar + label inline */}
      <div className="px-5 pt-5 pb-5 flex items-center gap-3">
        <div className="flex-1 min-w-0 h-1 rounded-full overflow-hidden bg-white/30" aria-hidden>
          <div
            className="h-full bg-[#E50914] rounded-full transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {progressLabel && (
          <span className="text-sm text-white/80 tabular-nums shrink-0" aria-live="polite">
            {progressLabel}
          </span>
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
          {(item.backdropUrl ?? item.posterUrl) ? (
            <img src={item.backdropUrl ?? item.posterUrl} alt="" className="block size-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/40 text-5xl font-bold select-none leading-none" aria-hidden>?</span>
            </div>
          )}
        </div>
        <div className={`absolute left-0 right-0 bottom-0 pt-10 pb-2 px-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-md pointer-events-none transition-opacity duration-200 ${isHovered ? 'opacity-0' : ''} ${showTrailer ? 'opacity-0' : ''}`}>
          <div className="flex items-end justify-start min-h-[clamp(1.75rem,7vmin,2.75rem)]">
            {item.titleLogoUrl ? (
              <img
                src={item.titleLogoUrl}
                alt={item.title}
                className="w-auto max-w-[min(100%,13rem)] max-h-[clamp(2.25rem,10vmin,4.5rem)] object-contain object-left [filter:drop-shadow(0_0_5px_rgba(255,255,255,0.35))_drop-shadow(0_1px_3px_rgba(0,0,0,0.5))]"
              />
            ) : (
              <span className="text-white font-semibold truncate drop-shadow-md" style={{ fontSize: 'clamp(0.8rem, 2.4vmin, 1.15rem)' }}>
                {item.title}
              </span>
            )}
          </div>
        </div>
        {progressPercent > 0 && (
          <div className="absolute left-0 right-0 bottom-0 h-1 rounded-b-md overflow-hidden bg-white/30 pointer-events-none z-10" aria-hidden>
            <div className="h-full bg-[#E50914] rounded-b-md transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>
      {typeof document !== 'undefined' && overlayContent && createPortal(overlayContent, document.body)}
    </>
  );
}
