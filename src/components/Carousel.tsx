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
      <h2 className="text-xl font-semibold text-white mb-3 px-6 md:px-12">{title}</h2>
      {/* Full-bleed so prev/next sit at max left and max right of viewport */}
      <div
        ref={wrapperRef}
        className="relative w-[calc(100vw-24px)] max-w-none left-1/2 -translate-x-1/2"
      >
        {hasEnoughToScroll && !isBeginning && (
          <button
            type="button"
            onClick={() => swiperRef.current?.slidePrev()}
            className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-black/30 text-white flex items-center justify-center hover:bg-black/80 transition-all shadow-lg group/btn"
            style={{ borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}
            aria-label="Previous"
          >
            <ChevronLeft sx={{ fontSize: 32 }} className="transition-transform group-hover/btn:scale-125" />
          </button>
        )}
        {hasEnoughToScroll && !isEnd && (
          <button
            type="button"
            onClick={() => swiperRef.current?.slideNext()}
            className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-black/30 text-white flex items-center justify-center hover:bg-black/80 transition-all shadow-lg group/btn"
            style={{ borderTopRightRadius: 8, borderBottomRightRadius: 8 }}
            aria-label="Next"
          >
            <ChevronRight sx={{ fontSize: 32 }} className="transition-transform group-hover/btn:scale-125" />
          </button>
        )}
        {/* Wrapper gets z-20 on card hover so hover card stacks above nav buttons (z-10); overflow-visible so scaled card isn't clipped */}
        <div className="relative overflow-visible" style={{ zIndex: isCardHovered ? 20 : 0 }}>
          <SwiperRoot
            spaceBetween={12}
            slidesPerView={2}
            breakpoints={{
              640: { slidesPerView: 2 },
              768: { slidesPerView: 3 },
              1024: { slidesPerView: 3 },
              1280: { slidesPerView: 4 },
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
                className="aspect-video! w-full overflow-visible! hover:z-20! group/slide"
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
