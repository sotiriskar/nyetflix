import * as React from 'react';
import {Box, BottomNavigation, BottomNavigationAction, Stack, Typography, LinearProgress, LinearProgressProps } from '@mui/material';
import CommentIcon from '@mui/icons-material/InsertCommentOutlined';
import PlayIcon from '@mui/icons-material/PlayArrowRounded';
import RewindIcon from '@mui/icons-material/Replay10Rounded';
import VolumeFullIcon from '@mui/icons-material/VolumeUpRounded';
import ForwardIcon from '@mui/icons-material/Forward10Rounded';
import PerformanceIcon from '@mui/icons-material/SpeedRounded';
import FullscreenIcon from '@mui/icons-material/FullscreenRounded';

function LinearProgressWithLabel(props: LinearProgressProps & { value: number }) {
  return (
    <Box sx={{ 
      border: '1px solid #fff',
      padding: '0 5vw 0 1vw',
      position: 'absolute',
      height: '100%',
      width: '100%',
      top: '0',
      }}
    >
      <Box sx={{ width: '100%' }}>
        <LinearProgress variant="determinate" {...props}
          sx={{
            backgroundColor: 'rgba(180,180,180,1)',
            '& .MuiLinearProgress-bar:after': {
              content: '""',
              position: 'absolute',
              top: '0',
              padding: '0 0 0 1vw',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,1)',

            },
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'red',
            },
          }}
        />
      </Box>
    </Box>
  );
}

export default function PlayerControl() {
  const [progress, setProgress] = React.useState(10);
  const [play, setPlay] = React.useState(false);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prevProgress) => (prevProgress >= 100 ? 10 : prevProgress + 10));
    }, 800);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <BottomNavigation
      showLabels
      sx={{
        width: '100%',
        height: '13.5%',
        position: 'absolute',
        bottom: 0,
        backgroundColor: 'transparent',
        boxShadow: 'None',
        zIndex: 100,
        border: '1px solid #fff',
      }}
    >
      <Stack direction="column" spacing={2} sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'left',
        alignItems: 'center',
        height: '100%',
        backgroundColor: 'transparent',
        boxShadow: 'None',
        }}
      >
        <LinearProgressWithLabel value={progress} />
        <Stack direction="row" spacing={3} sx={{
          width: '100%',
          position: 'absolute',
          bottom: '1vw',
          display: 'flex',
          justifyContent: 'left',
          alignItems: 'center',
          }}
        >
          <PlayIcon
            onClick={() => setPlay(!play)}
            sx={{
              color: '#fff',
              transform: 'scaleX(1.1)',
              fontSize: '4vw',
            }}
          />
          <RewindIcon sx={{
            color: '#fff',
            fontSize: '2.5vw',
            }}
          />
          <ForwardIcon sx={{
            color: '#fff',
            fontSize: '2.5vw',
            }}
          />
          <VolumeFullIcon sx={{
            color: '#fff',
            fontSize: '2.5vw',
            }}
          />
        </Stack>
        <Stack direction="row" spacing={2} sx={{
              justifyContent: 'center',
              alignItems: 'center',
              display: 'flex',
              height: '100%',
              width: '100%',
            }}
          >
            <Typography sx={{
              fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
              fontWeight: '500',
              fontSize: '1vw',
              color: '#fff',
              }}
            >
              GeoStorm
            </Typography>
          </Stack>
          <Stack direction="row" spacing={6} sx={{
              marginLeft: 'auto',
              width: '100%',
              bottom: '1.3vw',
              right: '1vw',
              position: 'absolute',
              display: 'flex',
              justifyContent: 'right',
              alignItems: 'center',
            }}
          >
            <CommentIcon sx={{
              color: '#fff',
              fontSize: '2.5vw',
              }}
            />
            <PerformanceIcon sx={{
              color: '#fff',
              fontSize: '2.5vw',
              }}
            />
            <FullscreenIcon sx={{
              transform: 'scaleX(1.4)',
              color: '#fff',
              fontSize: '3vw',
              }}
            />
          </Stack>
      </Stack>
    </BottomNavigation>
  );
}
