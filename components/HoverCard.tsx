import { Card, CardContent, Typography, CardMedia, Stack } from '@mui/material';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import VolumeOffIcon from '@mui/icons-material/VolumeOffOutlined';
import ExpandIcon from '@mui/icons-material/ExpandMoreOutlined';
import LikeIcon from '@mui/icons-material/ThumbUpOutlined';
import React, { useEffect, useState, useRef } from 'react';
import AddIcon from '@mui/icons-material/AddOutlined';
import PlayIcon from '@mui/icons-material/PlayArrow';
import { styled } from '@mui/material/styles';
import { useBetween } from 'use-between';
import { useRouter } from 'next/router';
import {useModal} from './Banner';

export const recommendedVideos = () => {
  const [ recMedia, setRecMedia ] = useState([]);
  return {
    recMedia,
    setRecMedia,
  };
};

export default function MovieCard({ movie }: any) {
  const [subVideoPlaying, setSubVideoPlaying] = useState(true);
  const [showMuteButton, setShowMuteButton] = useState(true);
  const video = `data/movies/trailers/${movie.imdb_id}.mp4`;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { setModalOpen } = useBetween(useModal);
  const { setRecMedia } = useBetween(recommendedVideos);
  const [muted, setMuted] = useState(true);
  const router = useRouter();

  const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} arrow classes={{ popper: className }} placement='top' />
  ))(({ theme }) => ({
    [`& .${tooltipClasses.arrow}`]: {
      color: theme.palette.common.white,
    },
    [`& .${tooltipClasses.tooltip}`]: {
      fontFamily: 'Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif',
      backgroundColor: theme.palette.common.white,
      boxShadow: theme.shadows[1],
      padding: '7px 20px',
      fontWeight: '600',
      fontSize: '25px',
      color: 'black',
    },
  }));

  const handleClickOpen = (movie: any) => {
    const html = document.querySelector('html');
    if (html) { html.style.marginRight = '17px'; html.style.overflow = 'hidden'; }
    setModalOpen(true);
  };

  const handleMute = () => {
    setMuted(!muted);
  }

  const convertToHours = (duration: string) => {
    const hours = Math.floor(parseInt(duration) / 60);
    const minutes = parseInt(duration) % 60;
    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  }
  const convertedDuration = convertToHours(movie.duration);

  useEffect(() => {
    const handleMouseMove = () => {
      setShowMuteButton(true);
      const next = document.querySelector('.splide:hover .splide__arrow--next svg');
      const prev = document.querySelector('.splide:hover .splide__arrow--prev svg');
      if (next && prev) {
        next.setAttribute('style', 'opacity: 1');
        prev.setAttribute('style', 'opacity: 1');
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShowMuteButton(false);
        if (next && prev) {
          next.setAttribute('style', 'opacity: 0 !important');
          prev.setAttribute('style', 'opacity: 0 !important');
        }
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <Card
      sx={{
        boxShadow: 'rgba(10, 10, 10, 0.5) 0px 2px 5px',
        backgroundColor: '#141414',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        cursor: 'pointer',
        color: 'white',
        height: '100%',
        width: '100%',
        left: 0,
        top: 0,
      }}
    >
      {subVideoPlaying ? (
        <CardMedia
          onClick={() =>  router.push(`/watch/${movie.imdb_id}`)}
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            objectFit: 'cover',
            display: 'flex',
            height: '60%',
            width: '100%',
            zIndex: 0,
          }}
        >
          {showMuteButton && (
          <div
            className='video-container'
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              height: '60%',
              width: '100%',
              zIndex: 1,
              backgroundColor: 'transparent',
            }}
          >
            <img 
              src={movie.logo} 
              alt={movie.title} 
              style={{ 
                height: '1.5vw',
                width: '4vw',
                objectFit: 'fill',
                position: 'absolute',
                bottom: '6%',
                left: '4%',
                transition: 'all 0.4s ease-in-out',
              }} 
            />
            <button
              id='mute-banner'
              onClick={(e) => {
                handleMute();
                e.stopPropagation();
              }}       
              style={{
                border: '1px solid rgba(255,255,255,0.4)',
                transition: 'all 0.4s ease-in-out',
                backgroundColor: 'transparent',
                position: 'absolute',
                alignItems: 'center',
                borderRadius: '100%',
                cursor: 'pointer',
                minWidth: '23px',
                minHeight: '13px',
                display: 'flex',
                height: '.9vw',
                width: '1.4vw',
                bottom: '6%',
                right: '7%',
              }}
              onMouseEnter={() => {
                const muteButton = document.getElementById('mute-banner');
                if (muteButton !== null) {
                  muteButton.style.backgroundColor = 'rgba(0,0,0,0.8)';
                  muteButton.style.border = '1px solid white';
                  muteButton.style.transition = 'all 0.4s ease-in-out';
                }
              }}
              onMouseLeave={() => {
                const muteButton = document.getElementById('mute-banner');
                if (muteButton !== null) {
                  muteButton.style.border = '1px solid rgba(255,255,255,0.4)';
                  muteButton.style.transition = 'all 0.4s ease-in-out';
                  muteButton.style.backgroundColor = 'transparent';
                  muteButton.style.color = 'rgba(255,255,255,0.4)';
                }
              }}
            >
            {muted ? (
              <VolumeOffIcon
                className='mute-icon'
                sx={{
                  transform: 'scaleX(1.3)',
                  padding: '0.07vw',
                  alignItems: 'center',
                  display: 'flex',
                  height: '100%',
                  width: '100%',
                  color: 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    color: 'white',
                    transition: 'all 0.4s ease-in-out',
                  }
                }}
              />
            ) : (
              <VolumeUpOutlinedIcon
                className='mute-icon'
                sx={{
                  transform: 'scaleX(1.3)',
                  padding: '0.07vw',
                  alignItems: 'center',
                  display: 'flex',
                  height: '100%',
                  width: '100%',
                  color: 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    color: 'white',
                    transition: 'all 0.4s ease-in-out',
                  }
                }}
              />
            )}
            </button>
          </div>
          )}
          <video
            controls={false}
            muted={muted}
            autoPlay={true}
            loop={false}
            onEnded={() => setSubVideoPlaying(false)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scale(1.4)',
            }}
          >
            <source src={video} type="video/mp4" />
          </video>
        </CardMedia>
      ) : (
        <CardMedia
          onClick={() =>  router.push(`/watch/${movie.imdb_id}`)}
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
          onClick={() => {
            handleClickOpen(movie)
            setSubVideoPlaying(false)
            setRecMedia(movie)
          }}
          sx={{
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '0',
            display: 'flex',
            width: '100%',
            height: '17%',
            padding: '0',
          }}
        >
          <Stack
            direction="row" 
            spacing={.5}
            sx={{
              padding: '0 1vw .1vw 1vw',
              justifyContent: 'left',
              alignItems: 'center',
              position: 'absolute',
              display: 'flex',
              width: '100%',
              height: '100%' 
              }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/watch/${movie.imdb_id}`)
              }}
              style={{
                border: '1px solid white',
                backgroundColor: 'white',
                alignItems: 'center',
                borderRadius: '100%',
                cursor: 'pointer',
                minWidth: '23px',
                minHeight: '13px',
                display: 'flex',
                height: '.9vw',
                width: '1.5vw',
              }}
            >
              <PlayIcon
                sx={{
                  transform: 'scaleX(2) scaleY(1.2)',
                  alignItems: 'center',
                  display: 'flex',
                  height: '100%',
                  width: '100%',
                  color: 'black',
                }}
              />
            </button>
            <LightTooltip title="Add to My List">
              <button 
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '100%',
                  cursor: 'pointer',
                  minWidth: '23px',
                  minHeight: '13px',
                  display: 'flex',
                  height: '.9vw',
                  width: '1.5vw',
                }}
              >
                <AddIcon sx={{
                    transform: 'scaleX(1.8) scaleY(1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '0 .32vw',
                    display: 'flex',
                    height: '100%',
                    width: '100%',
                  }}
                />
              </button>
            </LightTooltip>
            <LightTooltip title="I like this">
              <button style={{
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '100%',
                  cursor: 'pointer',
                  minWidth: '23px',
                  minHeight: '13px',
                  display: 'flex',
                  height: '.9vw',
                  width: '1.5vw',
                }}
              >
                <LikeIcon
                  sx={{
                    transform: 'scaleX(1.3) scaleY(.8)',
                    justifyContent: 'center',
                    padding: '.05vw .05vw',
                    alignItems: 'center',
                    display: 'flex',
                    height: '100%',
                    width: '100%',
                  }}
                />
              </button>
            </LightTooltip>
            <div style={{ marginLeft: 'auto' }}>
              <LightTooltip title="More Info">
                <button 
                  onClick={() => {
                    handleClickOpen(movie)
                    setSubVideoPlaying(false)
                    setRecMedia(movie)
                  }}
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '100%',
                    cursor: 'pointer',
                    minWidth: '23px',
                    minHeight: '13px',
                    display: 'flex',
                    height: '.9vw',
                    width: '1.5vw',
                  }}
                >
                  <ExpandIcon 
                    sx={{
                      transform: 'scaleX(2) scaleY(1.2)',
                      justifyContent: 'center',
                      margin: '0 .07vw 0 0',
                      alignItems: 'center',
                      display: 'flex',
                      height: '100%',
                      width: '100%',
                    }} 
                  />
                </button>
              </LightTooltip>
            </div>
        </Stack>
      </CardContent>
      <CardContent
        sx={{
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          display: 'flex',
          width: '100%',
          height: '7%',
          padding: '0',
        }}
      >
        <Stack
          direction="row" 
          spacing={1}
          sx={{
            justifyContent: 'left',
            alignItems: 'center',
            margin: '0 0 0 10%',
            display: 'flex',
            height: '100%',
            width: '100%',
            }}
        >
          <Typography sx={{
            fontFamily: 'Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif',
            color: '#46d369',
            letterSpacing: '1px',
            fontWeight: '700',
            fontSize: '10px',
            margin: '0',
            }}
          >
            {Math.floor(Math.random() * (99 - 80 + 1)) + 80}% Match
          </Typography>
          <Typography variant="h6" sx={{
            fontFamily: 'Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            justifyContent: 'center',
            letterSpacing: '.7px',
            alignItems: 'center',
            fontWeight: 'bold',
            padding: '0 4px',
            fontSize: '8px',
            display: 'flex',
            color: 'white',
            height: '10px',
            }}
          >
            {movie.rating}
          </Typography>
          <Typography variant="h6" sx={{
            fontFamily: 'Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif',
            letterSpacing: '.1px',
            alignItems: 'center',
            fontWeight: 'bold',
            display: 'flex',
            fontSize: '8px',
            color: 'white',
            height: '100%',
            padding: '0',
            }}
          >
            {convertedDuration}
          </Typography>
          <Typography variant="h6" sx={{
            fontFamily: 'Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            justifyContent: 'center',
            letterSpacing: '.7px',
            alignItems: 'center',
            borderRadius: '2px',
            fontWeight: '100',
            padding: '0 3px',
            fontSize: '7px',
            display: 'flex',
            color: 'white',
            height: '7px',
            }}
          >
            HD
          </Typography>
        </Stack>
      </CardContent>
      <CardContent
        sx={{
          flexDirection: 'column',
          justifyContent: 'left',
          margin: '.37vw 0 0 5%',
          alignItems: 'left',
          overflow: 'hidden',
          display: 'flex',
          padding: '0',
        }}
      >
        <Typography variant="h6" sx={{
          fontFamily: 'Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif',
          letterSpacing: '.7px',
          fontWeight: '500',
          fontSize: '8px',
          color: 'white',
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
};
