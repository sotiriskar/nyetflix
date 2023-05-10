import { Grid, Skeleton, Stack, Paper, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavBar from '../../../components/NavBar';
import Slider from '../../../components/Slider';
import Banner from '../../../components/Banner';
import Footer from '../../../components/Footer';
import { useEffect, useState } from 'react';
import Head from 'next/head';


interface SlideProps {
  title: string;
  slideList: any[];
}

const FullSlider = ({ title, slideList }: SlideProps) => {
  return (
    <Stack spacing={0} sx={{ overflow: 'visible', marginBottom: '10.7vw', zindex: 1 }}>
      <Paper sx={{ 
        backgroundColor: 'transparent',
        marginTop: 'calc(-7vw - .5vw)',
        boxShadow: 'None',
        zIndex: 1,
        '&:hover': {
          '& .MuiSvgIcon-root': {
            opacity: '1',
          },
        },
        }}
      >
        <Paper sx={{
            display: 'flex',
            justifyContent: 'left',
            alignItems: 'left',
            height: '100%',
            width: '100%',
            backgroundColor: 'transparent',
            boxShadow: 'None',
            zIndex: 1,
          }}
        >
          <Typography variant="h4" 
            className='explore'
              sx={{
                fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
                margin: '0 0 1vw 3.1%',
                verticalAlign: 'bottom',
                letterSpacing: '.05em',
                lineHeight: '1vw',
                position: 'inline',
                cursor: 'pointer',
                fontSize: '1.4vw',
                fontWeight: 500,
                color: '#fff', 
                '&:hover': {
                '& span': {
                  opacity: '1',
                  margin: '0 0 0 .7vw',
                  transition: 'all .7s ease-in-out',
                },
                '& svg': {
                  marginLeft: '4.7%',
                  transition: 'all .5s ease-in-out',
                },
              },
            }}
          >{title}
            <NavigateNextIcon sx={{ 
                position: 'absolute',
                fontSize: '1.8vw',
                cursor: 'pointer',
                color: '#54b9c4',
                opacity: '0',
                margin: '-.3vw 0 0 0',
              }}
            />
            <Typography variant="h4" component="span" sx={{
                verticalAlign: 'bottom',
                justifyContent: 'left',
                fontFamily: 'inherit',
                lineHeight: '.9vw',
                position: 'inline',
                alignItems: 'left',
                cursor: 'pointer',
                fontSize: '.9vw',
                color: '#54b9c4',
                fontWeight: 600,
                opacity: '0',
              }}
            >Explore All
            </Typography>
          </Typography>
        </Paper>
        <Slider movies={slideList} />
      </Paper>
    </Stack>
  );
};

export default function Movies() {
  const [movies, setMovies] = useState<Array<any>>([]);
  const [itemsToShow, setItemsToShow] = useState<any>([]);
  const [loaded, setLoaded] = useState(false);
  const items = [ 0, 1, 2, 3, 4, 5, 6 ];

  useEffect(() => {
    fetch('/api/movies')
    .then(response => response.json())
    .then(data => {
      setMovies(data);
      setLoaded(true);
    });

    if (!loaded) {        
      for (let i = 0; i < items.length; i++) {
        setTimeout(() => {
          setItemsToShow((prevItems: any) => [...prevItems, items[i]]);
        }, i * 200);
      }
    } else {
      setItemsToShow([]);
    }
  }, []);

  // trending now
  const trendingNow = movies
  ?.filter((movie: any) => {
    const releaseDate = new Date(movie.release_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return releaseDate >= threeMonthsAgo;
  })
  .sort((a: any, b: any) => b.popularity - a.popularity)
  .slice(0, 28);

  // banner movie (first movie in trending now)
  const bannerMovie = trendingNow?.shift();

  // top rated
  const topRated = movies
  ?.sort((a: any, b: any) => b.vote_count - a.vote_count || b.score - a.score) // sort by vote count and score
  .filter((movie: any) => !trendingNow?.some((trend: any) => trend.id === movie.id) && movie.id !== bannerMovie?.id) // remove all trending movies
  .slice(0, 28);

  // popular
  const popular = movies
  ?.sort((a: any, b: any) => b.popularity - a.popularity)
  // remove all trending movies & top rated movies from popular and banner movie
  .filter((movie: any) => !trendingNow?.some((trend: any) =>
    trend.id === movie.id) && !topRated?.some((top: any) =>
    top.id === movie.id) && movie.id !== bannerMovie?.id)
  .slice(0, 28);

  // comedy
  const comedy = movies
  .filter((movie: any) => movie.genre.includes('Comedy'))
  .sort((a: any, b: any) => b.popularity - a.popularity)
  // remove all trending movies & top rated movies & popular movies from comedy and banner movie
  .filter((movie: any) => !trendingNow?.some((trend: any) =>
    trend.id === movie.id) && !topRated?.some((top: any) =>
    top.id === movie.id) && !popular?.some((pop: any) =>
    pop.id === movie.id) && movie.id !== bannerMovie?.id)
  .slice(0, 28);

  // movies released past year
  const pastYear = movies
  ?.filter((movie: any) => {
    const releaseDate = new Date(movie.release_date);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return releaseDate >= oneYearAgo;
  })
  .sort((a: any, b: any) => b.popularity - a.popularity)
  // remove all trending movies & top rated movies & popular movies & comedy movies from past year and banner movie
  .filter((movie: any) => !trendingNow?.some((trend: any) =>
    trend.id === movie.id) && !topRated?.some((top: any) =>
    top.id === movie.id) && !popular?.some((pop: any) =>
    pop.id === movie.id) && !comedy?.some((com: any) =>
    com.id === movie.id) && movie.id !== bannerMovie?.id)
  .slice(0, 28);

  // sci-fi
  const sciFi = movies
  ?.filter((movie: any) => movie.genre.includes('Science Fiction'))
  .sort((a: any, b: any) => b.popularity - a.popularity)
  // remove all trending movies & top rated movies & popular movies & comedy movies & past year movies from sci-fi and banner movie
  .filter((movie: any) => !trendingNow?.some((trend: any) =>
    trend.id === movie.id) && !topRated?.some((top: any) =>
    top.id === movie.id) && !popular?.some((pop: any) =>
    pop.id === movie.id) && !comedy?.some((com: any) =>
    com.id === movie.id) && !pastYear?.some((past: any) =>
    past.id === movie.id) && movie.id !== bannerMovie?.id)
  .slice(0, 28);

  // family animation
  const familyAnimation = movies
  // ?.filter((movie: any) => movie.genre.includes('Family') && movie.genre.includes('Animation'))
  ?.filter((movie: any) => movie.genre.includes('Animation') && (movie.genre.includes('Family') || movie.rating === '0+' || movie.rating === '7+'))
  .sort((a: any, b: any) => b.popularity - a.popularity)
  // remove all trending movies & top rated movies & popular movies & comedy movies & past year movies & sci-fi movies from animation pg and banner movie
  .filter((movie: any) => !trendingNow?.some((trend: any) =>
    trend.id === movie.id) && !topRated?.some((top: any) =>
    top.id === movie.id) && !popular?.some((pop: any) =>
    pop.id === movie.id) && !comedy?.some((com: any) =>
    com.id === movie.id) && !pastYear?.some((past: any) =>
    past.id === movie.id) && !sciFi?.some((sci: any) =>
    sci.id === movie.id) && movie.id !== bannerMovie?.id)
  .slice(0, 28);

  return (
    <>
      <Head>
        <title>Movies - Nyetflix</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main
        className="main"
        style={{
          fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
          backgroundColor: '#141414',
          height: '100%',
          width: '100%',
          minWidth: '375px',
          minHeight: '700px',
      }}>
        <NavBar />
        { loaded ? (
          <>
          <Banner movie={bannerMovie} allMovies={movies} />
          <FullSlider title="Trending Now" slideList={trendingNow} />
          <FullSlider title="Critically-acclaimed Movies" slideList={topRated} />
          <FullSlider title="Popular on Nyetflix" slideList={popular} />
          <FullSlider title="Family Feature Animation" slideList={familyAnimation} />
          <FullSlider title="Comedies" slideList={comedy} />
          <FullSlider title="Mind-Bending Sci-Fi" slideList={sciFi} />
          <FullSlider title="Released in the Past Year" slideList={pastYear} />
          </>
        ) : (
          <div style={{
            justifyContent: 'left',
            alignItems: 'left',
            display: 'flex',
            height: '100vh',
            width: '150vw',
          }}
          >
            <Skeleton
              sx={{
                position: 'absolute',
                top: '8vw',
                left: '6vw',
                display: 'flex',
                justifyContent: 'left',
                alignItems: 'left',
                width: '10vw',
                height: '3vw',
                borderRadius: '0',
                backgroundColor: '#303030',
              }}
            />
            <Grid container
              sx={{
                display: 'flex',
                justifyContent: 'left',
                alignItems: 'left',
                margin: '11vw 0 0 6vw',
                width: '100%',
                height: '9vw',
                gap: '0.25vw',
              }}
            >
              {items.map((item) => (
                <Grid key={item} item sx={{
                  backgroundColor: `rgb(${(40 - item * 2)}, ${(40 - item * 2)}, ${(40 - item * 2)})`,
                  opacity: itemsToShow.includes(item) ? 1 : 0,
                  transition: `opacity 0.2s ease ${item * 0.1}s`,
                  width: '16vw',
                  height: '100%',
                  borderRadius: '5px',
                  }}
                />
              ))}
            </Grid>
          </div>
        )}
        <Footer />
      </main>
    </>
  )
}
