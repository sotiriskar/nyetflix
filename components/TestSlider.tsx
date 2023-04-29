import React, { useEffect, useState } from 'react';
import { Navigation } from 'swiper';
import { Swiper, SwiperSlide } from 'swiper/react';
import MovieCard from './HoverCard';
import { useBetween } from 'use-between';

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";

export const useHoveredSlide = () => {
  const [hoveredSlide, setHoveredSlide] = useState(null);
  return {
    hoveredSlide,
    setHoveredSlide,
  };
};

const MovieSlider = (movies: any) => {
  const { hoveredSlide, setHoveredSlide } = useBetween(useHoveredSlide);

  const handleSlideChange = (swiper: any) => {
    const swiperContainer = swiper.el;
    const swiperNext = swiper.el.querySelector('.swiper-button-next');
    const swiperPrev = swiper.el.querySelector('.swiper-button-prev');

    swiperNext.style.marginRight = '21.4%';
    swiperPrev.style.marginLeft = '8.7%';
    swiperContainer.style.marginLeft = '0';
    swiperContainer.style.transform = 'translate3d(-10%, 0px, 0px)';
    swiperContainer.style.width = '123%';

    swiperPrev.style.visibility = 'visible';
  };

  useEffect(() => {
    const swiperPrev = document.querySelector('.swiper-button-prev');
    swiperPrev?.classList.add('swiper-button-disabled');
  }, []);

  return (
    <div
      style={{ 
        width: '121%',
        height: '100%',
      }}
    >
      <Swiper
        loop
        navigation
        speed={1000}
        spaceBetween={7}
        slidesPerView={8}
        centeredSlides
        centeredSlidesBounds
        centerInsufficientSlides
        modules={[ Navigation]}
        onNavigationNext={(swiper) => handleSlideChange(swiper)}
        breakpoints={{
          0: {
            slidesPerView: 2,
            slidesPerGroup: 2,
          },
          600: {
            slidesPerView: 3,
            slidesPerGroup: 3,
          },
          900: {
            slidesPerView: 5,
            slidesPerGroup: 5,
          },
          1200: {
            slidesPerView: 6,
            slidesPerGroup: 3,
          },
          1500: {
            slidesPerView: 7,
            slidesPerGroup: 4,
          },
          1800: {
            slidesPerView: 8,
            slidesPerGroup: 5,
          },
        }}
        style={{
          height: '180px',
          width: '100%',
          marginLeft: '5%',
          overflow: 'visible',
        }}
      >
      {movies.movies.map((movie: any) => (
        <SwiperSlide
          key={movie.id}
          onMouseEnter={() => setHoveredSlide(movie.id)}
          onMouseLeave={() => setHoveredSlide(null)}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            borderRadius: '5px',
            height: '100%',
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
                  objectFit: 'cover',
                }}
              />
          )}
        </SwiperSlide>
      ))}
      </Swiper>
    </div>
  );
};

export default MovieSlider;



//   return (
//     <div className="swiper-container">
//       <div className="swiper-wrapper" style={{ width: '100%', height: '10vw' }}>
//         <ImageList cols={8} gap={8} style={{ width: '119.5vw', height: '100%' }} component={Stack} direction="row">
//           {movies.slice(startIndex, endIndex).map((movie: any, index: number) => (
//             <ImageListItem key={movie.id}>
//               <img
//                 src={movie.poster}
//                 srcSet={movie.poster}
//                 alt={movie.id}
//                 style={{ borderRadius: '5px' }}
//                 onClick={handleNextClick}
//               />
//             </ImageListItem>
//           ))}
//         </ImageList>
//       </div>
//     </div>
//   );
// };
