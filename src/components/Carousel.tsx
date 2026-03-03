import { useRef, useState } from 'react';
import type Swiper from 'swiper';
import { Swiper as SwiperRoot, SwiperSlide } from 'swiper/react';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import 'swiper/css';
import { CarouselHoverCard } from './CarouselHoverCard';
import { getMovieDetail } from '../data/dummyCarousel';
import type { CarouselItem } from '../types/movie';
import type { MovieDetail } from '../types/movie';

export type { CarouselItem };

interface CarouselProps {
  title: string;
  items: CarouselItem[];
  onItemClick?: (item: CarouselItem) => void;
  onPlayClick?: (item: CarouselItem) => void;
  getMovieDetail?: (id: string) => MovieDetail | undefined;
  onAddClick?: (item: CarouselItem) => void;
  getIsInList?: (id: string) => boolean;
  onLikeClick?: (item: CarouselItem) => void;
  getIsLiked?: (id: string) => boolean;
}

const MAX_ITEMS = 8;

const getDetail = (id: string, getMovieDetailProp?: (id: string) => MovieDetail | undefined) =>
  getMovieDetailProp?.(id) ?? getMovieDetail(id);

export function Carousel({ title, items, onItemClick, onPlayClick, getMovieDetail: getMovieDetailProp, onAddClick, getIsInList, onLikeClick, getIsLiked }: CarouselProps) {
  const swiperRef = useRef<Swiper | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);

  const displayItems = items.slice(0, MAX_ITEMS);
  const hasEnoughToScroll = displayItems.length > 1;

  const updateNavState = (s: Swiper | null) => {
    if (!s) return;
    setIsBeginning(s.isBeginning);
    setIsEnd(s.isEnd);
  };

  const handleSlideMouseLeave = (e: React.MouseEvent) => {
    const stillOverSlide = (e.relatedTarget as Node) && wrapperRef.current?.contains(e.relatedTarget as Node) && (e.relatedTarget as Element)?.closest('[data-carousel-slide]');
    if (!stillOverSlide) setIsCardHovered(false);
  };

  return (
    <section className="w-full pt-6 pb-4 overflow-x-clip overflow-y-visible">
      <h2 className="text-xl md:text-2xl font-semibold text-white mb-3 px-20">{title}</h2>
      {/* Wider side margins; prev/next sit at edges of the carousel area */}
      <div
        ref={wrapperRef}
        className="relative w-[calc(100vw-160px)] max-w-none left-1/2 -translate-x-1/2"
      >
        {hasEnoughToScroll && !isBeginning && (
          <button
            type="button"
            onClick={() => swiperRef.current?.slidePrev()}
            className="absolute -left-20 top-0 bottom-0 z-[40] w-18 bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-all shadow-lg group/btn rounded-r-md"
            aria-label="Previous"
          >
            <ChevronLeft sx={{ fontSize: 50 }} className="transition-transform duration-200 group-hover/btn:scale-120" />
          </button>
        )}
        {hasEnoughToScroll && !isEnd && (
          <button
            type="button"
            onClick={() => swiperRef.current?.slideNext()}
            className="absolute -right-20 top-0 bottom-0 z-[40] w-18 bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-all shadow-lg group/btn rounded-l-md"
            aria-label="Next"
          >
            <ChevronRight sx={{ fontSize: 50 }} className="transition-transform duration-200 group-hover/btn:scale-120" />
          </button>
        )}
        {/* Wrapper gets z-30 on card hover so hover card stacks above slides; nav buttons use z-40 so they stay visible and clickable */}
        <div className="relative overflow-visible" style={{ zIndex: isCardHovered ? 30 : 0 }}>
          <SwiperRoot
            spaceBetween={8}
            slidesPerView={5}
            breakpoints={{
              640: { slidesPerView: 6 },
              768: { slidesPerView: 6 },
              1024: { slidesPerView: 6 },
              1280: { slidesPerView: 6 },
            }}
            onSwiper={(s) => {
              swiperRef.current = s;
              updateNavState(s);
            }}
            onSlideChange={(s) => updateNavState(s)}
            className="overflow-visible! px-14 [&_.swiper]:h-auto! [&_.swiper]:overflow-visible! [&_.swiper-wrapper]:overflow-visible! [&_.swiper-wrapper]:items-stretch [&_.swiper-slide]:h-auto [&_.swiper-slide]:overflow-visible!"
          >
          {displayItems.map((item) => {
            const detail = getDetail(item.id, getMovieDetailProp);
            return (
              <SwiperSlide
                key={item.id}
                className="aspect-video! w-full overflow-visible! hover:z-[30]! group/slide"
              >
                <div
                  className="h-full w-full"
                  data-carousel-slide
                  onMouseEnter={() => setIsCardHovered(true)}
                  onMouseLeave={handleSlideMouseLeave}
                >
                  <CarouselHoverCard
                    item={item}
                    duration={detail?.duration}
                    progress={detail?.progress}
                    genres={detail?.genres}
                    mediaType={detail?.mediaType}
                    seasonsCount={detail?.seasonsCount}
                    hasSubtitles={detail?.hasSubtitles ?? (detail?.subtitleLanguages?.length ?? 0) > 0}
                    showProgressBar={title === 'Continue Watching'}
                    onClick={() => onItemClick?.(item)}
                    onPlay={onPlayClick}
                    onAddClick={onAddClick ? () => onAddClick(item) : undefined}
                    isInList={getIsInList?.(item.id)}
                    onLikeClick={onLikeClick ? () => onLikeClick(item) : undefined}
                    isLiked={getIsLiked?.(item.id)}
                  />
                </div>
              </SwiperSlide>
            );
          })}
          </SwiperRoot>
        </div>
      </div>
    </section>
  );
}
