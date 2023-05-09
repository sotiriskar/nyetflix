import { useRef, useState, useEffect } from 'react';
import { Dialog, Button, Typography, Paper, Grid } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrowRounded';
import VolumeOffIcon from '@mui/icons-material/VolumeOffOutlined';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { recommendedVideos } from './HoverCard';
import { useHoveredSlide } from './Slider';
import { useBetween } from "use-between";
import { useRouter } from 'next/router';
import InfoModal from './InfoModal';


export const useVideoState = () => {
  const [videoPlaying, setVideoPlaying] = useState(true);
  return {
    videoPlaying,
    setVideoPlaying,
  };
};

export const useModal = () => {
  const [ modalOpen, setModalOpen ] = useState(false);
  return {
    modalOpen,
    setModalOpen
  };
};

interface BannerProps {
  movie: any;
  allMovies: any;
}

export default function Banner({ movie, allMovies }: BannerProps) {
  const { videoPlaying, setVideoPlaying } = useBetween(useVideoState);
  const [ removeDescription, setRemoveDescription ] = useState(false);
  const { modalOpen, setModalOpen } = useBetween(useModal);
  const { hoveredSlide } = useBetween(useHoveredSlide);
  const { recMedia, setRecMedia } = useBetween(recommendedVideos);
  const [muted, setMuted] = useState(true);
  const [video, setVideo] = useState(`data/movies/trailers/${movie.imdb_id}.mp4`);
  const playerRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  const handleMute = () => {
    setMuted(!muted);
  }

  const handleClickOpen = () => {
    const html = document.querySelector('html');
    if (html) { html.style.marginRight = '17px'; html.style.overflow = 'hidden'; }
    setModalOpen(true);
  };

  const handleClose = () => {
    const html = document.querySelector('html');
    if (html) { html.style.marginRight = '0'; html.style.overflow = 'unset'; }
    setModalOpen(false);
  };

  const resetVideo = () => {
    const ogVideo = `data/movies/trailers/${movie.imdb_id}.mp4`;
    setVideo('');

    // add delay so it doesn't overlap with other buttons
    setTimeout(() => {
      setVideo(ogVideo);
      setVideoPlaying(true);
      setMuted(true);
    }, 2);
  };

  useEffect(() => {
    if (hoveredSlide !== null) {
      if (playerRef.current) {
        playerRef.current.pause();
      }
    } else {
      if (playerRef.current) {
        playerRef.current.play();
      }
    }

    if (videoPlaying) {
      setTimeout(() => {
        setRemoveDescription(true);
      }
      , 10000);
    } else {
      setRemoveDescription(false);
    }
  }, [hoveredSlide]);

  return (
    <Paper
      sx={{
        width: '100%',
        height: '50.2vw',
        boxShadow: 'None',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'transparent',
      }}
    >
      {videoPlaying ? (
        <>
        <video
          ref={playerRef}
          controls={false}
          muted={muted}
          autoPlay={true}
          loop={false}
          onEnded={() => setVideoPlaying(false)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            transform: 'scaleY(1.4)',
          }}
        >
          <source src={video} type="video/mp4" />
        </video>
        <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '80px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #141414 100%)',
            }}
        />
        </>
      ) : (
        <>
        <img
          src={movie.banner}
          alt={movie.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'fill',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '80px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #141414 100%)',
          }}
        />
        </>
      )}
        <Grid container 
          sx={{
            width: '39%',
            bottom: '28%',
            position: 'absolute',
            overflow: 'hidden',
            display: 'flex',
            marginLeft: '6%',
            flexDirection: 'column',
            gap: '1.2vw',
          }}
        >
            <img
              src={movie.logo}
              alt={movie.imdb_id}
              style={{
                width: removeDescription && videoPlaying ? '45%' : '65%',
                height: removeDescription && videoPlaying ? '25%' : '45%',
                transition: 'width .7s, height .7s',
                objectFit: 'fill',
              }}
            />
          <Typography sx={{ 
              opacity: removeDescription && videoPlaying ? '0' : '1',
              lineHeight: removeDescription && videoPlaying ? '0' : '-10vw',
              transition: 'opacity .2s, line-height .7s',
              fontWeight: '400',
              fontSize: '1.1vw',
              spacing: '0.1vw',
              color: 'white',
              width: '100%',
              height: '100%',
              flex: '1',
            }}
          >
            {movie.description}
          </Typography>
          <Grid container spacing={2}>
            <Grid item >
              <Button
                onClick={() =>  router.push(`/watch/${movie.imdb_id}`)}
                sx={{
                  justifyContent: 'center',
                  backgroundColor: 'white',
                  color: 'black',
                  borderRadius: '5px',
                  padding: '0 1.5vw',
                  fontSize: '1.2vw',
                  textTransform: 'none',
                  fontWeight: 'bold',
                  opacity: 1,
                  zIndex: 1,
                  transition: 'opacity 0.3s',
                  '&:hover': {
                      backgroundColor: 'rgba(200,200,200,1)',
                      color: 'black',
                  }
              }}
            >
              <PlayArrowIcon
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '3vw',
                }}
              />
                Play
            </Button>
          </Grid>
          <Grid item >
            <Button
              onClick={
                () => {
                  handleClickOpen();
                  setVideoPlaying(false);
                  setRecMedia(movie);
                }
              }
              sx={{
                justifyContent: 'center',
                backgroundColor: 'rgba(86,86,86,0.8)',
                color: 'white',
                zIndex: 1,
                borderRadius: '5px',
                padding: '.4vw 1.7vw',
                fontSize: '1.2vw',
                textTransform: 'none',
                fontWeight: 'bold',
                fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
                '&:hover': {
                  backgroundColor: 'rgba(86,86,86,0.5)',
                  color: 'white',
                }
              }}
            >
              <InfoIcon
                sx={{
                  marginRight: '10px',
                  fontSize: '2.2vw',
                }}
              />
                More Info
            </Button>
          </Grid>
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{
        bottom: '26%',
        right: 0,
        display: 'flex',
        justifyContent: 'flex-end',
        position: 'absolute',
        marginLeft: 'auto',
      }}>
        <Grid item  sx={{
          height: 'calc(30px + 2vw)',
          width: 'calc(30px + 2vw)',
        }}>
          <button
            id='mute'
            onClick={handleMute}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid white',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              height: '90%',
              color: 'white',
              width: '90%',
            }}
            onMouseEnter={() => {
              const muteButton = document.getElementById('mute');
              if (muteButton !== null) {
                muteButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
              }
            }}
            onMouseLeave={() => {
              const muteButton = document.getElementById('mute');
              if (muteButton !== null) {
                muteButton.style.backgroundColor = 'transparent';
              }
            }}
          >
            {muted && videoPlaying ? (
              <VolumeOffIcon
                sx={{
                height: '100%',
                fontSize: '24px',
                color: 'white',
                }}
              />  
            ) : !muted && videoPlaying ? (
              <VolumeUpOutlinedIcon
                sx={{
                height: '100%',
                fontSize: '1.5vw',
                color: 'white',
                }}
              />
            ): !videoPlaying ? (
                <ReplayIcon
                    onClick={() => {
                      resetVideo();
                    }}
                    sx={{
                    height: '100%',
                    fontSize: '1.5vw',
                    color: 'white',
                    }}
                />
            ) : (
                <VolumeUpOutlinedIcon
                    sx={{
                    height: '100%',
                    fontSize: '1.5vw',
                    color: 'white',
                    }}
                />
            )}
          </button>
        </Grid>
        <Grid item >
          <Paper
            sx={{
              backgroundColor: 'rgba(30,30,30,0.5)',
              borderLeft: '3px solid white',
              justifyContent: 'center',
              alignItems: 'center',
              fontWeight: '400',
              fontSize: '1.2vw',
              display: 'flex',
              borderRadius: 0,
              color: 'white',
              height: '90%',
              width: '100%',
            }}
          >
            <span style={{ padding: '0 4.7vw 0 20px' }}
            >{movie.rating}</span>
          </Paper>
        </Grid>
      </Grid>
      <Dialog
        disableScrollLock={false}
        onClose={handleClose}
        aria-labelledby="customized-dialog-title"
        open={modalOpen}
        maxWidth={'md'}
        scroll={'body'}
        sx={{
          '& .MuiDialog-paper': {
            backgroundColor: '#141414',
            color: 'white',
            padding: '0',
          }
        }}
      >
        <IconButton
          aria-label="close"
          onClick={() => {
              handleClose();
              setVideoPlaying(true);
            }
          }
          sx={{
            position: 'absolute',
            backgroundColor: '#141414',
            zIndex: 1,
            width: '37px',
            height: '37px',
            right: 12,
            top: 12,
            color: 'white',
            '&:hover': {
              backgroundColor: '#141414',
            }
          }}
        >
          <CloseIcon />
        </IconButton>
        <InfoModal media={recMedia} allMedia={allMovies} />
      </Dialog>
    </Paper>
  );
}