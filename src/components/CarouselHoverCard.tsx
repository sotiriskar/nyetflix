import { useState, useRef, useCallback } from 'react';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PlayArrow from '@mui/icons-material/PlayArrow';
import ThumbUp from '@mui/icons-material/ThumbUp';
import type { CarouselItem } from '../types/movie';

const HOVER_DELAY_MS = 400;

interface CarouselHoverCardProps {
  item: CarouselItem;
  duration?: string;
  progress?: number;
  onClick?: () => void;
  /** Called when Play is clicked (instead of opening detail). */
  onPlay?: (item: CarouselItem) => void;
  /** Called when Add to list is clicked. */
  onAddClick?: () => void;
  /** Whether this title is in My List (show checkmark). */
  isInList?: boolean;
  /** Called when Like is clicked. */
  onLikeClick?: () => void;
  /** Whether this title is liked. */
  isLiked?: boolean;
  /** If true, show the thin progress bar at bottom of card (e.g. Continue Watching row only). */
  showProgressBar?: boolean;
}

export function CarouselHoverCard({
  item,
  duration = '145m',
  progress = 0,
  onClick,
  onPlay,
  onAddClick,
  isInList = false,
  onLikeClick,
  isLiked = false,
  showProgressBar = false,
}: CarouselHoverCardProps) {
  const progressPercent = Math.min(1, Math.max(0, progress ?? 0)) * 100;
  const [showTrailer, setShowTrailer] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearHoverTimer();
    if (!item.trailerYouTubeId) return;
    hoverTimerRef.current = setTimeout(() => setShowTrailer(true), HOVER_DELAY_MS);
  }, [item.trailerYouTubeId, clearHoverTimer]);

  const handleMouseLeave = useCallback(() => {
    clearHoverTimer();
    setShowTrailer(false);
  }, [clearHoverTimer]);

  const trailerUrl = item.trailerYouTubeId
    ? `https://www.youtube.com/embed/${item.trailerYouTubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${item.trailerYouTubeId}&rel=0`
    : null;

  return (
    <div
      className="h-full w-full rounded-lg transition-all duration-200 origin-center group-hover/slide:scale-y-[1.45] group-hover/slide:overflow-hidden group-hover/slide:shadow-xl group-hover/slide:ring-1 group-hover/slide:ring-white/20 group-hover/slide:bg-[#181818] cursor-pointer relative"
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
    >
      {/* Image or trailer – fills entire card; trailer uses cover-style so no black letterboxing */}
      <div className="absolute inset-0 bg-white/10 rounded-lg ring-1 ring-white/10 group-hover/slide:rounded-b-none group-hover/slide:rounded-t-lg overflow-hidden">
        {showTrailer && trailerUrl ? (
          <div className="absolute left-1/2 top-1/2 w-full origin-center -translate-x-1/2 -translate-y-1/2 scale-[1.778] h-0 pb-[56.25%]">
            <div className="absolute inset-0">
              <iframe
                src={trailerUrl}
                title={`${item.title} trailer`}
                className="absolute inset-0 h-full w-full pointer-events-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <>
            {(item.backdropUrl ?? item.posterUrl) ? (
              <img
                src={item.backdropUrl ?? item.posterUrl}
                alt=""
                className="block size-full object-cover object-top"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center min-w-0 min-h-0 origin-center group-hover/slide:scale-y-[0.69] group-hover/slide:-translate-y-[14%]">
                <span className="text-white/40 text-5xl font-bold select-none leading-none" aria-hidden>?</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Title – bottom left over image */}
      <div className="absolute left-0 right-0 bottom-0 pt-12 pb-2 px-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-lg pointer-events-none">
        <div className="flex items-end">
          {item.titleLogoUrl ? (
            <img
              src={item.titleLogoUrl}
              alt={item.title}
              className="max-h-6 md:max-h-8 w-auto object-contain object-left"
            />
          ) : (
            <span className="text-white font-semibold text-sm truncate drop-shadow-md">
              {item.title}
            </span>
          )}
        </div>
      </div>

      {/* Always-visible progress bar at bottom of card (Continue Watching only) */}
      {showProgressBar && progressPercent > 0 && (
        <div
          className="absolute left-0 right-0 bottom-0 h-1 rounded-b-lg overflow-hidden bg-white/30 pointer-events-none"
          aria-hidden
        >
          <div
            className="h-full bg-[#E50914] rounded-b-lg transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Bottom panel – outer clips to rounded-b-lg; inner counter-scaled so icons aren't stretched */}
      <div className="absolute left-0 right-0 bottom-0 overflow-hidden rounded-b-lg max-h-0 opacity-0 transition-all duration-200 group-hover/slide:max-h-28 group-hover/slide:opacity-100">
        <div className="origin-bottom bg-[#181818] px-3 pb-3 pt-2.5 rounded-b-lg group-hover/slide:scale-y-[0.69]">
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0"
            aria-label="Play"
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.(item);
            }}
          >
            <PlayArrow sx={{ fontSize: 20 }} />
          </button>
          <button
            type="button"
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
              isInList ? 'border-white bg-white text-black' : 'border-white text-white hover:bg-white/20'
            }`}
            aria-label={isInList ? 'In My List' : 'Add to list'}
            onClick={(e) => {
              e.stopPropagation();
              onAddClick?.();
            }}
          >
            {isInList ? <Check sx={{ fontSize: 18 }} /> : <Add sx={{ fontSize: 18 }} />}
          </button>
          <button
            type="button"
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
              isLiked ? 'border-white bg-white text-black' : 'border-white text-white hover:bg-white/20'
            }`}
            aria-label={isLiked ? 'Liked' : 'Like'}
            onClick={(e) => {
              e.stopPropagation();
              onLikeClick?.();
            }}
          >
            <ThumbUp sx={{ fontSize: 16 }} />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0 ml-auto"
            aria-label="More info"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            <ExpandMore sx={{ fontSize: 22 }} />
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1 w-full bg-white/30 rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full bg-[#E50914] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-white/80">
          <span>of {duration}</span>
          <span>Today</span>
        </div>
        </div>
      </div>
    </div>
  );
}
