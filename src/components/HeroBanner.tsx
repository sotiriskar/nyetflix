import { useEffect, useRef } from 'react';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PlayArrow from '@mui/icons-material/PlayArrow';
import type { CarouselItem } from '../types/movie';
import type { MovieDetail } from '../types/movie';
import { getMovieDetail } from '../data/dummyCarousel';
import { truncateToWords } from '@/lib/description';

const MAX_DESCRIPTION_RETRIES = 3;
const RETRY_DELAY_MS = 2500;

export interface HeroBannerProps {
  /** Hero movie shown in the banner (title/description). */
  heroItem: CarouselItem;
  /** Called when "More Info" is clicked – e.g. open detail modal. */
  onMoreInfo?: (item: CarouselItem) => void;
  /** Called when "Play" is clicked – e.g. open video player. */
  onPlay?: (item: CarouselItem) => void;
  getMovieDetail?: (id: string) => MovieDetail | undefined;
  /** Optional page title shown top-left (e.g. "Films" or "Series"). */
  pageTitle?: string;
  /** When description is missing, fetch metadata for this item only (no full rescan). Auto-called up to 3 times with delay. */
  onFetchItemDetail?: (id: string, title: string) => Promise<unknown>;
}

const NO_DESCRIPTION = 'No description available.';

export function HeroBanner({ heroItem, onMoreInfo, onPlay, getMovieDetail: getMovieDetailProp, pageTitle, onFetchItemDetail }: HeroBannerProps) {
  const detail = getMovieDetailProp?.(heroItem.id) ?? getMovieDetail(heroItem.id);
  const description = detail?.description ?? NO_DESCRIPTION;
  const heroImageUrl = detail?.backdropUrl ?? heroItem.backdropUrl;
  const titleLogoUrl = detail?.titleLogoUrl ?? heroItem.titleLogoUrl;
  const contentRating = detail?.contentRating;

  const retryCountRef = useRef(0);
  const heroIdRef = useRef(heroItem.id);
  if (heroIdRef.current !== heroItem.id) {
    heroIdRef.current = heroItem.id;
    retryCountRef.current = 0;
  }

  useEffect(() => {
    if (description !== NO_DESCRIPTION || !onFetchItemDetail || retryCountRef.current >= MAX_DESCRIPTION_RETRIES) return;
    const id = setTimeout(() => {
      retryCountRef.current += 1;
      onFetchItemDetail(heroItem.id, heroItem.title).catch(() => {});
    }, RETRY_DELAY_MS);
    return () => clearTimeout(id);
  }, [description, heroItem.id, heroItem.title, onFetchItemDetail]);

  return (
    <section className="relative z-0 w-full min-h-[98vh] flex items-end bg-[#1a1a1a]">
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
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
      )}

      {/* Gradient at bottom of hero only; first carousel has higher z-index so it stacks above this */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[50vh] z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, transparent 35%, rgba(20,20,20,0.2) 55%, rgba(20,20,20,0.5) 72%, rgba(20,20,20,0.82) 88%, #141414 100%)',
        }}
        aria-hidden
      />

      {/* Page title – fixed near top of hero, just under nav (match carousel px) */}
      {pageTitle && (
        <div className="absolute top-24 left-0 z-10 px-12 md:px-20">
          <h2 className="text-white text-3xl md:text-4xl font-bold drop-shadow-md">
            {pageTitle}
          </h2>
        </div>
      )}

      {/* Content – anchored to bottom (flex items-end); smaller mb = block sits lower */}
      <div className="relative z-10 w-full px-12 md:px-20 pb-8 md:pb-12 pt-40 mb-30 md:mb-40">
        <div className="max-w-4xl flex flex-col gap-5">
          {titleLogoUrl ? (
            <img
              src={titleLogoUrl}
              alt={heroItem.title}
              className="max-w-2xl max-h-16 md:max-h-20 lg:max-h-50 w-auto object-contain object-left drop-shadow-lg"
            />
          ) : (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
              {heroItem.title}
            </h1>
          )}
          <p className="md:text-xl font-semibold text-white/90 max-w-2xl drop-shadow-md">
            {truncateToWords(description, 50)}
          </p>
        </div>
        {/* Play + More Info (left) | Age rating wide bar (right-0, full bleed) */}
        <div className="flex items-center gap-4 mt-5 relative -mr-12 md:-mr-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onPlay?.(heroItem)}
              className="flex items-center gap-3 pl-4 pr-8 py-1 rounded-md bg-white text-black text-xl font-bold hover:bg-white/80 transition-colors min-w-[120px] justify-center"
            >
              <PlayArrow sx={{ fontSize: 50 }} />
              Play
            </button>
            <button
              type="button"
              onClick={() => onMoreInfo?.(heroItem)}
              className="flex items-center gap-3 px-8 py-1 rounded-md bg-gray-400/65 text-white hover:bg-gray-400/50 text-xl font-bold transition-colors min-w-[140px] justify-center"
            >
              <InfoOutlined sx={{ fontSize: 50, color: 'white' }} />
              More Info
            </button>
          </div>
          {contentRating && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-12 min-w-[120px] w-[7vw] flex items-center justify-start pl-7 bg-black/50 border-l-3 border-white/90">
              <span className="text-white text-xl">{contentRating}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
