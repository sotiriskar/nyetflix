import React, { useEffect, useState, useRef } from 'react';
import { Splide, SplideSlide } from '@splidejs/react-splide';
import { useBetween } from 'use-between';
import '@splidejs/react-splide/css';
import { Paper } from '@mui/material';
import MovieCard from './HoverCard';

export const useHoveredSlide = () => {
  const [hoveredSlide, setHoveredSlide] = useState(null);
  return {
    hoveredSlide,
    setHoveredSlide,
  };
};

const Slider = (movies: any) => {
  const { hoveredSlide, setHoveredSlide } = useBetween(useHoveredSlide);

  const handleSlideChange = () => {
    const swiperPrev = document.querySelector('.splide__arrow--prev');
    swiperPrev?.setAttribute('style', 'visibility: visible;');
  };

  const handlePagination = () => {

  };
  
  useEffect(() => {
    handlePagination();
  }, []);
  
  return (
    <Paper sx={{ width: '100%', overflow: 'visible', backgroundColor: 'transparent', zIndex: 1 }}>
      <Splide
        onMoved={() => handleSlideChange()}
        options={{
          pagination: true,
          omitEnd: true,
          rewind: false,
          arrows: true,
          drag: false,
          perPage: 7,
          perMove: 6,
          loop: true,
          focus: .21,
          speed: 800,
          height:'9vw',
          gap:'.32vw',
          type:'loop',
          breakpoints: {
            1400: {
              perPage  : 7,
              perMove  : 6,
              focus  : .18,
              gap: '0.32vw',
            },
            1100: {
              perPage : 4,
              perMove : 3,
              focus : .15,
              gap: '.4vw',
            },
            800: {
              perPage : 3,
              perMove : 2,
              focus : .10,
              gap: '.3vw',
            },
            500: {
              perPage: 2,
              perMove: 1,
              gap    : 0,
              focus: .07,
            },
          },
        }}
      >
        {movies.movies.map((movie: any) => (
          <SplideSlide
            onMouseEnter={() => setHoveredSlide(movie.id)}
            onMouseLeave={() => setHoveredSlide(null)}
            key={movie.imdb_id}
          >
            {hoveredSlide === movie.id ? (
              <MovieCard movie={movie} />
            ) : (
              <img
                src={movie.poster}
                alt={movie.title}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '.2vw',
                  objectFit: 'fill',
                }}
              />
            )}
             <div className="custom-pagination"></div>
          </SplideSlide>
        ))}
      </Splide>
    </Paper>
  );
};

export default Slider;