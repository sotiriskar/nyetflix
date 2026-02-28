import { useState } from 'react';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PlayArrow from '@mui/icons-material/PlayArrow';
import VolumeOff from '@mui/icons-material/VolumeOff';
import VolumeUp from '@mui/icons-material/VolumeUp';
import type { CarouselItem } from '../types/movie';
import type { MovieDetail } from '../types/movie';
import { getMovieDetail } from '../data/dummyCarousel';

export interface HeroBannerProps {
  /** Hero movie shown in the banner (title/description). */
  heroItem: CarouselItem;
  /** Called when "More Info" is clicked – e.g. open detail modal. */
  onMoreInfo?: (item: CarouselItem) => void;
  /** Called when "Play" is clicked – e.g. open video player. */
  onPlay?: (item: CarouselItem) => void;
  getMovieDetail?: (id: string) => MovieDetail | undefined;
  /** Optional category labels shown in the hero (e.g. ["Series", "Movies"]). No dropdown. */
  categoryLabels?: string[];
}

export function HeroBanner({ heroItem, onMoreInfo, onPlay, getMovieDetail: getMovieDetailProp, categoryLabels }: HeroBannerProps) {
  const [muted, setMuted] = useState(true);
  const detail = getMovieDetailProp?.(heroItem.id) ?? getMovieDetail(heroItem.id);
  const description = detail?.description ?? 'No description available.';
  const heroImageUrl = detail?.backdropUrl ?? heroItem.backdropUrl;
  const titleLogoUrl = detail?.titleLogoUrl ?? heroItem.titleLogoUrl;

  return (
    <section className="relative w-full min-h-[65vh] flex items-end bg-[#1a1a1a]">
      <div
        className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-black/30"
        aria-hidden
      />
      {heroImageUrl ? (
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage: `url('${heroImageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
      )}

      {/* Transition fade: stage-by-stage opacity into carousel area */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[40vh] z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(20,20,20,0.15) 20%, rgba(20,20,20,0.4) 40%, rgba(20,20,20,0.65) 60%, rgba(20,20,20,0.88) 80%, #141414 100%)',
        }}
        aria-hidden
      />

      {/* Content */}
      <div className="relative z-10 w-full px-6 md:px-12 pb-8 md:pb-12 pt-32">
        {categoryLabels && categoryLabels.length > 0 && (
          <p className="text-white/90 text-lg md:text-xl font-medium mb-4 drop-shadow-md">
            {categoryLabels.join('  ·  ')}
          </p>
        )}
        <div className="max-w-4xl flex flex-col gap-5">
          {titleLogoUrl ? (
            <img
              src={titleLogoUrl}
              alt={heroItem.title}
              className="max-h-24 md:max-h-28 lg:max-h-32 w-auto object-contain object-left drop-shadow-lg"
            />
          ) : (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
              {heroItem.title}
            </h1>
          )}
          <p className="text-base md:text-lg text-white/90 max-w-2xl drop-shadow-md">
            {description}
          </p>
        </div>
        {/* Full-width row: Play + More Info on left, Sound on right edge */}
        <div className="flex items-center justify-between gap-4 mt-5 w-full">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onPlay?.(heroItem)}
              className="flex items-center gap-2 px-8 py-3.5 rounded-md bg-white text-black font-semibold hover:bg-white/90 transition-colors min-w-[120px] justify-center"
            >
              <PlayArrow sx={{ fontSize: 36 }} />
              Play
            </button>
            <button
              type="button"
              onClick={() => onMoreInfo?.(heroItem)}
              className="flex items-center gap-2 px-8 py-3.5 rounded-md bg-gray-400 text-white font-semibold hover:bg-gray-300 transition-colors min-w-[140px] justify-center"
            >
              <InfoOutlined sx={{ fontSize: 36, color: 'white' }} />
              More Info
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-white/50 bg-black/40 hover:bg-white/20 hover:border-white/80 transition-colors text-white shrink-0"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <VolumeOff sx={{ fontSize: 28, color: 'white' }} />
            ) : (
              <VolumeUp sx={{ fontSize: 28, color: 'white' }} />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
