import React, { useEffect, useState } from 'react';
import { Paper } from '@mui/material';
import { Splide, SplideSlide } from '@splidejs/react-splide';
import { useBetween } from 'use-between';
import MovieCard from './HoverCard';
import '@splidejs/react-splide/css';


export const useHoveredSlide = () => {
  const [hoveredSlide, setHoveredSlide] = useState(null);
  return {
    hoveredSlide,
    setHoveredSlide,
  };
};

export default function Slider(movies: any) {
  const { hoveredSlide, setHoveredSlide } = useBetween(useHoveredSlide);

  const handleSlideChange = () => {
    const swiperPrev = document.querySelector('.splide:hover .splide__arrow--prev');
    const firstSlide = document.querySelector('.splide__slide--clone');
    swiperPrev?.setAttribute('style', 'visibility: visible !important;');
    firstSlide?.setAttribute('style', 'visibility: visible !important;');
  };

  useEffect(() => {
  }, []);

  return (
    <Paper sx={{ width: '100%', overflow: 'visible', backgroundColor: 'transparent', boxShadow: 'None' }}>
      <Splide
        onMoved={() => handleSlideChange()}
        options={{
          pagination: false,
          omitEnd:     true,
          rewind:     false,
          arrows:      true,
          drag:       false,
          perPage: 7,
          perMove: 6,
          loop: true,
          focus: .21,
          speed: 800,
          height: '9vw',
          gap:  '.32vw',
          type:  'loop',
          breakpoints: {
            1400: {
              perPage:   7,
              perMove:   6,
              focus:   .18,
              gap: '0.32vw',
            },
            1100: {
              perPage:  4,
              perMove:  3,
              focus:  .15,
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
              gap:     0,
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
              <MovieCard
                movie={movie}
              />
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
          </SplideSlide>
        ))}
      </Splide>
    </Paper>
  );
};
