import React, { useEffect, useState, useRef } from 'react';
import { Splide, SplideSlide } from '@splidejs/react-splide';
import { useBetween } from 'use-between';
import { Paper } from '@mui/material';

import '@splidejs/react-splide/css';

export const useHoveredSlide = () => {
  const [hoveredSlide, setHoveredSlide] = useState(null);
  return {
    hoveredSlide,
    setHoveredSlide,
  };
};

const Slider = (movies: any) => {
  const { hoveredSlide, setHoveredSlide } = useBetween(useHoveredSlide);

  const handleSlideChange = (splide: any) => {
    const swiperPrev = document.querySelector('.splide__arrow--prev');
    swiperPrev?.setAttribute('style', 'visibility: visible;');
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'visible', backgroundColor: 'transparent' }}>
      <Splide
        onMoved={(splide) => handleSlideChange(splide)}
        options={{
          rewind: false,
          loop: true,
          drag: false,
          pagination: true,
          arrows: true,
          perPage: 7,
          perMove: 6,
          focus: .21,
          speed: 800,
          gap: '.32vw',
          type: 'loop',
          height: '9vw',
          breakpoints: {
            1400: {
              perPage: 7,
              perMove: 6,
              focus: .18,
              gap    : '0.32vw',
            },
            1100: {
              perPage: 4,
              perMove: 3,
              focus: .15,
              gap    : '.4vw',
            },
            800: {
              perPage: 3,
              perMove: 2,
              focus: .10,
              gap    : '.3vw',
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
          <SplideSlide key={movie.imdb_id}>
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
          </SplideSlide>
        ))}
      </Splide>
    </Paper>
  );
};

export default Slider;