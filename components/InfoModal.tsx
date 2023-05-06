import React, { useState, useRef } from 'react';
import { Button, Paper, Stack } from '@mui/material';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import PlayArrowIcon from '@mui/icons-material/PlayArrowRounded';
import VolumeOffIcon from '@mui/icons-material/VolumeOffOutlined';
import LikeIcon from '@mui/icons-material/ThumbUpOutlined';
import AddIcon from '@mui/icons-material/AddOutlined';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import Tooltip, { tooltipClasses, TooltipProps } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

export const InfoModal = ({ media }: any ) => {
  const [open, setOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [video, setVideo] = useState(`data/movies/trailers/${media.imdb_id}.mp4`);
  const playerRef = useRef<HTMLVideoElement>(null);
  const descriptionElementRef = useRef<HTMLElement>(null);

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

  return (
    <>
    <DialogContent sx={{ padding: '0' }}>
      <Paper
        sx={{
          width: '100%',
          height: '100%',
          padding: '0',
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
            src={media.banner}
            alt={media.name}
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
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            position: 'absolute',
            width: '35%',
            height: '40%',
            marginLeft: '1.5vw',
            bottom: '6.5vw',
            zIndex: 1,
          }}
        >
          <img
            src={media.logo}
            alt={media.name}
            style={{
              objectFit: 'fill',
              width: '100%',
              height: '100%',
            }}
          />
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            position: 'absolute',
            padding: '0 1.5vw',
            bottom: '3vw',
            width: '100%',
            zIndex: 1,
            left: 0,
          }}
        >
          <Button sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              justifyContent: 'center',
              alignItems: 'center',
              display: 'flex',
              backgroundColor: 'white',
              color: 'black',
              borderRadius: '5px',
              height: '42px',
              padding: '0 2vw 0 1vw',
              fontSize: '1.2vw',
              textTransform: 'none',
              fontWeight: '700',
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
          <LightTooltip title="Add to My List" placement="top">
            <button
              className="add-to-list"
              style={{
                border: '2px solid rgba(255, 255, 255, 0.6)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '100%',
                cursor: 'pointer',
                display: 'flex',
                height: '2.1vw',
                width: '2.1vw',
                marginLeft: '.5vw',
              }}
            >
              <AddIcon sx={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0',
                  display: 'flex',
                  height: '100%',
                  width: '100%',
                }}
              />
            </button>
          </LightTooltip>
          <LightTooltip title="I like this" placement="top">
            <button
              className="like-button"
              style={{
                border: '2px solid rgba(255, 255, 255, 0.6)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '100%',
                cursor: 'pointer',
                display: 'flex',
                height: '2.1vw',
                width: '2.1vw',
                marginLeft: '.5vw',
              }}
            >
              <LikeIcon sx={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '.3vw',
                  display: 'flex',
                  height: '100%',
                  width: '100%',
                }}
              />
            </button>
          </LightTooltip>
          <div style={{ marginLeft: 'auto' }}>
            <button
              className="mute-button"
              onClick={() => setMuted(!muted)}
              style={{
                border: '2px solid rgba(255, 255, 255, 0.6)',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '100%',
                cursor: 'pointer',
                display: 'flex',
                height: '2.1vw',
                width: '2.1vw',
                marginLeft: '.5vw',
              }}
            >
              {muted ? (
                <VolumeOffIcon
                  className='mute-icon'
                  sx={{
                    padding: '.2vw',
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
                    padding: '.2vw',
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
        </Stack>
      </Paper>
    </DialogContent>
    <DialogActions>
      <Button>Cancel</Button>
      <Button>Subscribe</Button>
    </DialogActions>
    </>
  );
};

export default InfoModal;