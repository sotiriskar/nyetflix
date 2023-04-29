import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import MovieCard from './HoverCard';
import { useBetween } from 'use-between';
import { Paper } from '@mui/material';
import { Pagination, Navigation } from 'swiper';

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export const useHoveredSlide = () => {
  const [hoveredSlide, setHoveredSlide] = useState(null);
  return {
    hoveredSlide,
    setHoveredSlide,
  };
};

const MovieSlider = (movies: any) => {
  const { hoveredSlide, setHoveredSlide } = useBetween(useHoveredSlide);

  const handleSwiperHover = (swiper: any) => {
    console.log(swiper);
    const swiperNext = swiper.el.querySelector('.swiper-button-next');
    const swiperPrev = swiper.el.querySelector('.swiper-button-prev');
    const swiperPagination = swiper.el.querySelector('.swiper-pagination');

    if (swiperPrev) swiperPrev.style.opacity = '1';
    if (swiperNext) swiperNext.style.opacity = '1';
    if (swiperPagination) swiperPagination.style.opacity = '1';
  };

  // const handleSwiperOut = (swiper: any) => {
  //   console.log(swiper, 'out');
  //   const swiperNext = swiper.el.querySelector('.swiper-button-next');
  //   const swiperPrev = swiper.el.querySelector('.swiper-button-prev');
  //   const swiperPagination = swiper.el.querySelector('.swiper-pagination');

  //   if (swiperPrev) swiperPrev.style.opacity = '0';
  //   if (swiperNext) swiperNext.style.opacity = '0';
  //   if (swiperPagination) swiperPagination.style.opacity = '0';
  // };

  const handleSlideChange = (swiper: any) => {
    // const swiperNext = swiper.el.querySelector('.swiper-button-next');
  };

  useEffect(() => {
    const swiperPrev = document.querySelector('.swiper-button-prev');
    swiperPrev?.classList.add('swiper-button-disabled');
  }, []);

  return (
    <Paper
      style={{ 
        width: '100%',
        backgroundColor: 'transparent',
      }}
    >
      <Swiper
        loop
        navigation
        speed={700}
        pagination={{
          type: 'bullets',
        }}
        allowTouchMove={false}
        modules={[ Pagination, Navigation]}
        onMouseLeave={(swiper) => (handleSlideChange(swiper))}
        onMouseEnter={(swiper) => (handleSlideChange(swiper))}
        style={{
          overflow: 'visible',
          width: '100%',
          height: '100%',
        }}
        breakpoints={
          {
            0: {
              slidesPerGroup: 2,
              slidesPerView: 4, // 4
            },
            500: {
              slidesPerGroup: 3,
              slidesPerView: 5, // 5
            },
            800: {
              slidesPerGroup: 5,
              slidesPerView: 6, // 6
            },
            1100: {
              slidesPerGroup: 5,
              slidesPerView: 7, // 7
            },
            1400: {
              slidesPerGroup: 6,
              slidesPerView: 8, // 8
              spaceBetween: 4,
            },
          }
        }
      >
      {movies.movies.map((movie: any) => (
        <SwiperSlide
          key={movie.id}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            overflow: 'visible',
            height: '100%',
            width: '100%',
        }}>
          {hoveredSlide === movie.id ? (
              <MovieCard movie={movie} />
          ) : (
            <img
              src={movie.poster}
              alt="movie"
              style={{
                height: '100%',
                width: '100%',
                borderRadius: '4px',
                objectFit: 'fill',
              }}
            />
          )}
        </SwiperSlide>
      ))}
      </Swiper>
    </Paper>
  );
};

export default MovieSlider;
