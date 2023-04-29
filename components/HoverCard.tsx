import React from 'react';
import { Card, CardContent, Typography, Grid, LinearProgress, Box, Button, CardActions, CardMedia } from '@mui/material';
import AddIcon from '@mui/icons-material/AddOutlined';
import LikeIcon from '@mui/icons-material/ThumbUpOutlined';
import ExpandIcon from '@mui/icons-material/ExpandMoreOutlined';
import PlayIcon from '@mui/icons-material/PlayArrow';

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";

export default function MovieCard({ movie }: any) {
  const video = `data/movies/trailers/${movie.imdb_id}.mp4`;
  const [subVideoPlaying, setSubVideoPlaying] = React.useState(true);

  const convertToHours = (duration: string) => {
    const hours = Math.floor(parseInt(duration) / 60);
    const minutes = parseInt(duration) % 60;
    return `${hours}h ${minutes}m`;
  }

  const convertedDuration = convertToHours(movie.duration);

  return (
    <Card
      sx={{
        boxShadow: 'rgba(10, 10, 10, 0.5) 0px 2px 5px',
        backgroundColor: '#141414',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        color: 'white',
        height: '100%',
        width: '100%',
        left: 0,
        top: 0,
      }}
    >
      {subVideoPlaying ? (
        <CardMedia
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            objectFit: 'cover',
            display: 'flex',
            height: '60%',
            width: '100%',
            overflow: 'hidden',
          }}
        >
        <video
          controls={false}
          muted={true}
          autoPlay={true}
          loop={false}
          onEnded={() => setSubVideoPlaying(false)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.4)',
            zIndex: 1
          }}
        >
          <source src={video} type="video/mp4" />
        </video>
      </CardMedia>
      ) : (
        <CardMedia
          component="img"
          src={movie.poster}
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            objectFit: 'cover',
            display: 'flex',
            height: '60%',
            width: '100%',
          }}
        />
      )}
      <CardContent
        sx={{
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '.2vw',
          display: 'flex',
          width: '100%',
          height: '18%',
          padding: '0',
        }}
      >
        <Grid container sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'left', alignItems: 'center' }}>
          <Grid item sx={{ margin: '0 .3vw 0 1vw' }}>
            <button style={{
                border: '1px solid white',
                justifyContent: 'center',
                backgroundColor: 'white',
                alignItems: 'center',
                borderRadius: '50%',
                display: 'flex',
                height: '.9vw',
                width: '1.5vw',
              }}
            >
              <PlayIcon
                sx={{
                  transform: 'scaleX(2) scaleY(1.2)',
                  height: '100%',
                  width: '100%',
                  color: 'black',
                }}
              />
            </button>
          </Grid>
          <Grid item sx={{ marginRight: '.3vw' }}>
            <button 
              style={{
                border: '1px solid rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '50%',
                display: 'flex',
                height: '.9vw',
                width: '1.5vw',
              }}
            >
              <AddIcon sx={{
                  transform: 'scaleX(1.8) scaleY(1)',
                  height: '90%',
                  width: '90%',
                }}
              />
            </button>
          </Grid>
          <Grid item >
            <button style={{
                border: '1px solid rgba(255, 255, 255, 0.5)',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '50%',
                display: 'flex',
                height: '.9vw',
                width: '1.5vw',
              }}
            >
              <LikeIcon
                sx={{
                  transform: 'scaleX(1.3) scaleY(.8)',
                  height: '80%',
                  width: '80%',
                }}
              />
            </button>
          </Grid>
          <Grid item sx={{ margin: '0 1vw 0 auto' }}>
            <button style={{
              border: '1px solid rgba(255, 255, 255, 0.5)',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: '50%',
              display: 'flex',
              height: '.9vw',
              width: '1.5vw',
              }}
            >
              <ExpandIcon sx={{
                transform: 'scaleX(1.8) scaleY(1.2)',
                color: 'white',
                height: '90%',
                width: '90%',
              }} />
            </button>
          </Grid>
        </Grid>
      </CardContent>
      <CardContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          width: '100%',
          height: '7%',
          padding: '0',
        }}
      >
        <Grid container sx={{
          fontFamily: 'Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif',
          display: 'flex',
          marginLeft: '1.5vw',
          justifyContent: 'left',
          alignItems: 'center',
          }}
        >
          <Grid item sx={{ margin: '0 .3vw 0 0' }}>
            <Typography sx={{
              letterSpacing: '.7px',
              fontWeight: 'bold',
              fontSize: '.43vw',
              color: 'rgba(60, 168, 86, 1)',
              margin: '0',
              }}
            >
              98% Match
            </Typography>
          </Grid>
          <Grid item sx={{ margin: '0 .3vw 0 0' }}>
            <Typography variant="h6" sx={{
              border: '1px solid rgba(255, 255, 255, 0.5)',
              padding: '0 .3vw',
              fontWeight: 'bold',
              height: '.5vw',
              fontSize: '.4vw',
              letterSpacing: '.7px',
              color: 'white',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              }}
            >
              {movie.rating}
            </Typography>
          </Grid>
          <Grid item sx={{ margin: '0 .3vw 0 0' }}>
            <Typography variant="h6" sx={{
              height: '100%',
              fontWeight: 'bold',
              fontSize: '.4vw',
              letterSpacing: '.7px',
              color: 'white',
              }}
            >
              {convertedDuration}
            </Typography>
          </Grid>
          <Grid item sx={{ margin: '0 .3vw 0 0' }}>
            <Typography variant="h6" sx={{
              border: '1px solid rgba(255, 255, 255, 0.5)',
              height: '.4vw',
              padding: '0 .3vw',
              fontWeight: 'bold',
              borderRadius: '2px',
              letterSpacing: '.7px',
              fontSize: '.2vw',
              color: 'white',
              }}
            >
              HD
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
      <CardContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'left',
          margin: '.1vw 0 0 .7vw',
          alignItems: 'left',
          overflow: 'hidden',
          padding: '0',
        }}
      >
        <Typography variant="h6" sx={{
          fontFamily: 'Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif',
          fontWeight: 'bold',
          fontSize: '.4vw',
          letterSpacing: '.7px',
          color: 'white',
          margin: '0',
          }}
        >
          {movie.genre && movie.genre.split(', ').map((genre: string, index: number) => {
            if (index < 3) {
              return (
                <span key={index} className="genres" style={{   
                  letterSpacing: '1.5px',
                  }}
                >
                  {genre}
                  {index < 2 && ' '}
                </span>
              );
            }
          })}
        </Typography>
      </CardContent>
    </Card>
  );
}
