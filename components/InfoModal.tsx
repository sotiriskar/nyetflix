import { Button, Paper, Stack, Typography, Card, CardMedia, CardContent, Accordion } from '@mui/material';
import Tooltip, { tooltipClasses, TooltipProps } from '@mui/material/Tooltip';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLessOutlined';
import VolumeOffIcon from '@mui/icons-material/VolumeOffOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrowRounded';
import LikeIcon from '@mui/icons-material/ThumbUpOutlined';
import React, { useState, useRef, useEffect } from 'react';
import DialogContent from '@mui/material/DialogContent';
import AddIcon from '@mui/icons-material/AddOutlined';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/router';


interface InfoProps {
  media: any;
  allMedia: any;
}

interface MoreProps {
  more: any;
}

export const InfoModal = ({ media, allMedia }: InfoProps) => {
  const [video, setVideo] = useState(`data/movies/trailers/${media.imdb_id}.mp4`);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const playerRef = useRef<HTMLVideoElement>(null);
  const [expanded, setExpanded] = useState(false);
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

  // get all similar media to current media by genre. It can be any genre
  const similarMedia = allMedia.filter((item: any) => {
    const genres = item.genre.split(', ');
    return genres.some((g: any) => media.genre.includes(g) && item.imdb_id !== media.imdb_id);
  }).slice(0, 15);

  const mediaChunks = [];
  const chunkSize = 3;
  for (let i = 0; i < similarMedia.length; i += chunkSize) {
    mediaChunks.push(similarMedia.slice(i, i + chunkSize));
  }

  const convertToHours = (duration: string) => {
    const hours = Math.floor(parseInt(duration) / 60);
    const minutes = parseInt(duration) % 60;
    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  }
  const convertedDuration = convertToHours(media.duration);

  useEffect(() => {
  }, []);

  const MoreCard = ({ more }: MoreProps) => {
    return (
      <Card
        onClick={() => router.push(`/watch/${more.imdb_id}`)}
        sx={{
          width: '100%',
          height: '100%',
          backgroundColor: '#2f2f2f',
          margin: '0 1.5vw 0 0',
          borderRadius: '.25vw',
          cursor: 'pointer',
          boxShadow: '0',
        }}
      >
        <CardMedia
          sx={{ borderRadius: '0' }}
          image={more.poster}
          component="img"
          height="30%"
        />
        <CardContent sx={{ padding: '0' }}>
          <Stack direction="row" alignItems="left" sx={{ padding: 0 }}>
            <Stack direction="column" alignItems="left" sx={{ padding: '1vw 0 0 0' }}>
              <Typography
                sx={{
                  fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
                  color: '#46d369',
                  padding: '0 0 0 .5vw',
                  fontWeight: '600',
                  fontSize: '.9vw',
                }}
              >
                {Math.floor(Math.random() * (99 - 80 + 1)) + 80}% Match
              </Typography>
              <Stack direction="row" alignItems="left" spacing={1} sx={{ padding: '0 0 0 .5vw' }}>
                <Typography
                  sx={{
                    fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    height: '1.2vw',
                    width: '2.2vw',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontWeight: '500',
                    fontSize: '.85vw',
                    color: 'white',
                  }}
                >
                  {more.rating}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
                    lineHeight: '1vw',
                    fontWeight: '500',
                    fontSize: '.9vw',
                    color: 'white',
                  }}
                >
                  {more.release_date ? more.release_date.slice(0, 4) : '2023'}
                </Typography>
              </Stack>
            </Stack>
              <LightTooltip title="Add to My List" sx={{ padding: '0' }}>
                <button 
                  style={{
                    border: '2px solid rgba(255, 255, 255, 0.5)',
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    margin: '1.2vw .5vw 0 auto',
                    borderRadius: '100%',
                    marginLeft: 'auto',
                    cursor: 'pointer',
                    height: '45px',
                    width: '45px',
                  }}
                >
                  <AddIcon sx={{
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '0 .1vw',
                      display: 'flex',
                      height: '100%',
                      width: '100%',
                    }}
                  />
                </button>
              </LightTooltip>
            </Stack>
            <Stack direction="row" alignItems="left" sx={{ padding: '1vw .5vw 0 .5vw', height: '8.5vw', overflow: 'hidden' }}>
              <Typography
                sx={{
                  fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
                  fontSize: '.7vw',
                  fontWeight: '500',
                  padding: '0',
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                  {more.description}
              </Typography>
          </Stack>
          </CardContent>
        </Card>
    );
  };

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
          <Button 
            onClick={() =>  router.push(`/watch/${media.imdb_id}`)}
            sx={{
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
    <Stack direction="row" sx={{ padding: '1vw 1.5vw 0 1.5vw', zIndex: 1, width: '100%' }}>
      <Stack direction="column" sx={{ padding: '1vw 0 0 0', zIndex: 1, width: '70%' }}>
        <Stack
          spacing={1}
          direction="row"
          sx={{
            padding: '.3vw 1.5vw',
            bottom: '3vw',
            width: '100%',
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              color: '#46d369',
              fontWeight: '700',
              fontSize: '.9vw',
            }}
          >
            {Math.floor(Math.random() * (99 - 80 + 1)) + 80}% Match
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontWeight: '500',
              fontSize: '.9vw',
              color: 'white',
            }}
          >
            {media.release_date.slice(0, 4)}
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontWeight: '500',
              fontSize: '.9vw',
              color: 'white',
            }}
          >
            {convertedDuration}
          </Typography>
          <span
            style={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontWeight: '100',
              borderRadius: '3px',
              padding: '0 .27vw',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '.3vw',
              height: '.7vw',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              fontSize: '.59vw',
              color: 'white',
            }}
          >
            HD
          </span>
        </Stack>
        <Stack
          spacing={2}
          direction="row"
          alignItems="left"
          sx={{
            padding: '0 1.5vw',
            bottom: '1vw',
            width: '100%',
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '.74vw',
              fontWeight: '400',
              height: '1vw',
              display: 'flex',
              color: 'white',
              width: '2vw',
            }}
          >
            {media.rating}
          </span>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontWeight: '400',
              fontSize: '.7vw',
              color: 'white',
            }}
          >
            violence, language
          </Typography>
        </Stack>
        <Stack
          direction="row"
          alignItems="left"
          sx={{
            padding: '1.5vw 1.5vw',
            width: '100%',
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.8vw',
              fontWeight: '400',
              color: 'white',
            }}
          >
            {media.description}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          alignItems="left"
          sx={{
            padding: '1vw 1.5vw 0 1.5vw',
            width: '100%',
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '1.3vw',
              fontWeight: '600',
              color: 'white',
            }}
          >
            More Like This
          </Typography>
        </Stack>
      </Stack>
      <Stack direction="column" alignItems="right" sx={{ 
        padding: '0',
        marginTop: '-1vw', 
        zIndex: 1, width: '30%', marginLeft: 'auto' ,
        display: 'flex',
        justifyContent: 'right',
        alignItems: 'right',
        textAlign: 'left',
        }}>
        <Stack
          spacing={1}
          direction="column"
          sx={{
            padding: '.3vw 1.5vw',
            bottom: '3vw',
            display: 'flex',
            justifyContent: 'right',
            alignItems: 'right',
            textAlign: 'left',
            width: '100%',
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.7vw',
              fontWeight: '400',
              margin: '.3vw 0',
              color: 'rgb(255, 255, 255, 0.4)',
            }}
          >
            Cast: <span style={{ color: 'rgb(255, 255, 255, 0.7)', fontWeight: '600' }}>Jesse Eisenberg, Andrew Garfield, Justin Timberlake</span>
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.7vw',
              fontWeight: '400',
              margin: '.3vw 0',
              color: 'rgb(255, 255, 255, 0.4)',
            }}
          >
            Genres: <span style={{ color: 'rgb(255, 255, 255, 0.7)', fontWeight: '600' }}>{media.genre}</span>
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.7vw',
              fontWeight: '400',
              margin: '.3vw 0',
              color: 'rgb(255, 255, 255, 0.4)',
            }}
          >
          </Typography>
        </Stack>
      </Stack>
      </Stack>
        {mediaChunks.slice(0, 2).map((chunk: any) => (
          <Stack direction="column" sx={{ padding: '1vw 0 0 1.5vw', zIndex: 1, width: '100%' }}>
            <Stack
              direction="row"
              alignItems="left"
              sx={{
                width: '100%',
                zIndex: 1,
              }}
            >
              {chunk.map((more: any) => (
                <MoreCard more={more} />
              ))}
            </Stack>
          </Stack>
        ))}
        <Accordion
          expanded={expanded}
          sx={{
            width: '100%',
            backgroundColor: '#141414',
            overflow: 'hidden',
            boxShadow: 'none',
            transition: 'all 0s ease-in-out',
            padding: '0',
          }}
        >
          {mediaChunks.slice(2).map((chunk: any) => (
            <Stack direction="column" sx={{ padding: '1vw 0 0 1.5vw', zIndex: 1, width: '100%' }}>
              <Stack
                direction="row"
                alignItems="left"
                sx={{
                  width: '100%',
                  zIndex: 1,
                }}
              >
                {chunk.map((more: any) => (
                  <MoreCard more={more} />
                ))}
              </Stack>
            </Stack>
          ))}
        </Accordion>
        <div style={{ 
          justifyContent: 'center',
          alignItems: 'center',
          display: 'flex',
          width: '100%',
          height: '0vw',
          zIndex: 1,
          }}
        >
          <div style={{
            border: '1px solid rgba(255, 255, 255, 0.3)',
            justifyContent: 'center',
            position: 'absolute',
            alignItems: 'center',
            display: 'flex',
            width: '94.2%',
            height: '.1vw',
            margin: '0 auto',
            zIndex: 1,
            }}
          >
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              border: '2px solid rgba(255, 255, 255, 0.5)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '0 auto',
              borderRadius: '100%',
              marginLeft: 'auto',
              cursor: 'pointer',
              display: 'flex',
              height: '45px',
              width: '45px',
              zIndex: 1,
            }}
          >
            {expanded ? (
              <ExpandLessIcon sx={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0 .1vw',
                  display: 'flex',
                  height: '100%',
                  width: '100%',
                }}
              />
            ) : (
              <ExpandMoreIcon sx={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0 .1vw',
                  display: 'flex',
                  height: '100%',
                  width: '100%',
                }}
              />
            )}
          </button>
        </div>
        <Stack
          direction="column"
          alignItems="left"
          sx={{
            padding: '2vw 1.5vw 0 1.5vw',
            width: '100%',
            zIndex: 1,
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              margin: '0 0 1vw 0',
              fontSize: '1.3vw',
              fontWeight: '400',
              color: 'white',
            }}
          >
            About <span style={{ fontWeight: '700' }}>{media.name}</span>
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.7vw',
              fontWeight: '400',
              margin: '.3vw 0',
              color: 'rgb(255, 255, 255, 0.4)',
            }}
          >
            Director: <span style={{ color: 'white', fontWeight: '600' }}>David Fincher</span>
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.7vw',
              fontWeight: '400',
              margin: '.3vw 0',
              color: 'rgb(255, 255, 255, 0.4)',
            }}
          >
            Cast: <span style={{ color: 'white', fontWeight: '600' }}>Jesse Eisenberg, Andrew Garfield, Justin Timberlake</span>
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.7vw',
              fontWeight: '400',
              margin: '.3vw 0',
              color: 'rgb(255, 255, 255, 0.4)',
            }}
          >
            Writers: <span style={{ color: 'white', fontWeight: '600' }}>David Fincher, John Doe</span>
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.7vw',
              fontWeight: '400',
              margin: '.3vw 0',
              color: 'rgb(255, 255, 255, 0.4)',
            }}
          >
            Genres: <span style={{ color: 'white', fontWeight: '600' }}>{media.genre}</span>
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontSize: '.7vw',
              fontWeight: '400',
              margin: '.3vw 0',
              color: 'rgb(255, 255, 255, 0.4)',
            }}
          >
            Maturity Rating: <span style={{
              color: 'white',
              fontSize: '.7vw',
              fontWeight: '600',
              padding: '0vw .5vw',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              }}
            >{media.rating}</span>
            <span style={{ color: 'white', fontWeight: '600' }}> Reccomended for ages {media.rating.slice(0, -1)} and up</span>
          </Typography>
      </Stack>
      <div style={{ height: '2vw' }} />
    </>
  );
};

export default InfoModal;