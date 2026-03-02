import { useState, useRef, useCallback, useMemo } from 'react';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PlayArrow from '@mui/icons-material/PlayArrow';
import ThumbUp from '@mui/icons-material/ThumbUp';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import type { CarouselItem } from '../types/movie';

const HOVER_DELAY_MS = 400;

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
  showProgressBar = false,
  onClick,
  onPlay,
  onAddClick,
  isInList = false,
  onLikeClick,
  isLiked = false,
}: CarouselHoverCardProps) {
  const progressPercent = Math.min(1, Math.max(0, progress ?? 0)) * 100;
  const [showTrailer, setShowTrailer] = useState(false);

  const genreList = useMemo(() => {
    if (!genres?.trim()) return [];
    return genres.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3);
  }, [genres]);

  const durationDisplay = duration ? formatDuration(duration) : undefined;
  const metaLine = mediaType === 'series' && seasonsCount != null && seasonsCount > 0
    ? `${seasonsCount} Season${seasonsCount !== 1 ? 's' : ''}`
    : durationDisplay;
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
      className="h-full w-full rounded-lg transition-all duration-200 origin-center group-hover/slide:scale-y-[1.5] group-hover/slide:overflow-hidden group-hover/slide:shadow-xl group-hover/slide:ring-1 group-hover/slide:ring-white/20 group-hover/slide:bg-[#181818] cursor-pointer relative"
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

      {/* Title – bottom left over image; hide when trailer is playing so it doesn't overlap video */}
      <div
        className={`absolute left-0 right-0 bottom-0 pt-12 pb-2 px-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-lg pointer-events-none transition-opacity duration-200 ${showTrailer ? 'opacity-0' : ''}`}
      >
        <div className="flex items-end min-h-[clamp(1.5rem,6vmin,2.5rem)]">
          {item.titleLogoUrl ? (
            <img
              src={item.titleLogoUrl}
              alt={item.title}
              className="max-h-[clamp(2rem,10vmin,4.5rem)] w-auto object-contain object-left"
            />
          ) : (
            <span
              className="text-white font-semibold truncate drop-shadow-md"
              style={{ fontSize: 'clamp(0.95rem, 2.8vmin, 1.4rem)' }}
            >
              {item.title}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar at bottom of card (Continue Watching only) */}
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

      {/* Bottom panel – controls + metadata (genres, seasons/duration, HD, subtitle) */}
      <div className="absolute left-0 right-0 bottom-0 overflow-hidden rounded-b-lg max-h-0 opacity-0 transition-all duration-200 group-hover/slide:max-h-32 group-hover/slide:opacity-100">
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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/80">
            {metaLine && <span>{metaLine}</span>}
            <span className="inline-flex items-center justify-center rounded border border-white/60 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">HD</span>
            {hasSubtitles && (
              <span className="inline-flex items-center rounded border border-white/60 bg-white/10 p-0.5 text-white/90">
                <SubtitlesOutlined sx={{ fontSize: 14 }} />
              </span>
            )}
            {genreList.length > 0 && (
              <span className="w-full truncate">
                {genreList.join(' • ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
