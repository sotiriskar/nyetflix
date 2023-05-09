import { Card, BottomNavigation, Stack, Typography, Slider, CircularProgress } from '@mui/material';
import CommentIcon from '@mui/icons-material/InsertCommentOutlined';
import FullscreenIcon from '@mui/icons-material/FullscreenRounded';
import VolumeOffIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeOnIcon from '@mui/icons-material/VolumeUpRounded';
import ForwardIcon from '@mui/icons-material/Forward10Rounded';
import PerformanceIcon from '@mui/icons-material/SpeedRounded';
import RewindIcon from '@mui/icons-material/Replay10Rounded';
import React, { useState, useEffect , useRef } from 'react';
import PlayIcon from '@mui/icons-material/PlayArrowRounded';
import FlagIcon from '@mui/icons-material/OutlinedFlag';
import PauseIcon from '@mui/icons-material/Pause';
import ArrowIcon from '@mui/icons-material/West';
import { useRouter } from 'next/router';
import Head from 'next/head';


export default function Watch() {
  const [progress, setProgress] = useState('00:00');
	const [loaded, setLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
	const [media, setMedia] = useState<Array<any>>([]);
  const [play, setPlay] = useState(true);
  const [mute, setMute] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  const router = useRouter();
  const { id } = router.query;

  const handlePlay = () => {
    setPlay(!play);
    if (play) {
        ref?.current?.play();
    } else {
        ref?.current?.pause();
    };
  };

  const handleFullscreen = () => {
    setFullscreen(!fullscreen);
		if (fullscreen) {
			ref?.current?.requestFullscreen();
		}
  };

  const handleForward = () => {
    if (ref.current) {
      ref.current.currentTime += 10;
    }
  };

  const handleRewind = () => {
    if (ref.current) {
      ref.current.currentTime -= 10;
    }
  };

	useEffect(() => {
		fetch(`/api/movies?imdb_id=${id}`)
    .then(response => response.json())
    .then(data => {
      setMedia(data);
      setLoaded(true);
			console.log(data);
		});

		setInterval(() => {
			if (ref.current) {
				const duration = ref.current.duration;
				const currentTime = ref.current.currentTime;
				const progress = (currentTime / duration) * 100;
				setDuration(progress);
			
				const hours = Math.floor(progress / 3600);
				const minutes = Math.floor((progress % 3600) / 60);
				const seconds = Math.floor(progress % 60);
			
				const timeFormat = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
				if(hours <= 0) {
					setProgress(timeFormat.slice(3));
				} else {
					setProgress(timeFormat);
				}
			}
		}, 100);
	}, [id, media]);

  const PlayerControl = () => {
		return (
			<BottomNavigation
				showLabels
				sx={{
					width: '100%',
					height: '13%',
					position: 'absolute',
					bottom: 0,
					backgroundColor: 'transparent',
				}}
			>
				<Stack direction="column" spacing={0} sx={{
					width: '100%',
					display: 'flex',
					justifyContent: 'left',
					alignItems: 'center',
					height: '100%',
					margin: '0 1.2vw',
					backgroundColor: 'transparent',
					boxShadow: 'None',
					border: '1px solid rgba(255,255,255,0.2)',
					}}
				>
					<Stack direction="row" spacing={1} sx={{
						width: '100%',
						display: 'flex',
						justifyContent: 'left',
						alignItems: 'center',
						border: '1px solid rgba(255,255,255,0.2)',
						}}
					>
						<div
							style={{
								width: '96%',
								padding: '0.5vw',
								display: 'flex',
								justifyContent: 'left',
								alignItems: 'center',
								border: '1px solid rgba(255,255,255,0.2)',
							}}
						>
							<Slider
								defaultValue={0}
								max={100}
								min={0}
								onChange={(e: any) => {
									if (ref.current) {
										const duration = ref.current.duration;
										const value = e.target.value;
										ref.current.currentTime = (value * duration) / 100;
									}
								}}
								value={duration}
								disableSwap
								sx={{
									width: '100%',
									height: '0.25vw',
									color: 'red',
									'& ,.:hover': {
										transform: 'scaleY(1.3)',
									},
									'& .MuiSlider-thumb': {
										width: '.8vw',
										height: '.8vw',
									},
									'& .MuiSlider-rail': {
										height: '0.25vw',
										backgroundColor: 'rgba(255,255,255,1)',
									},
									'& .MuiSlider-track': {
									},
								}}
							/>
						</div>
						<Typography
							sx={{
								fontSize: '.95vw',
								fontWeight: '500',
								letterSpacing: '0.05vw',
								color: 'rgba(255,255,255,1)',
							}}
						>
							{progress}
						</Typography>
					</Stack>
					<Stack direction="row" spacing={2} sx={{
							border: '1px solid rgba(255,255,255,0.2)',
							justifyContent: 'left',
							position: 'absolute',
							alignItems: 'center',
							display: 'flex',
							bottom: '.5vw',
							left: '1.2vw',
							zIndex: 2,
						}}
					>
					{!play ? (
						<PlayIcon
							onClick={() => handlePlay()}
							sx={{
								transition: 'all 0.1s ease-in-out',
								transform: 'scale(1.4)',
								cursor: 'pointer',
								fontSize: '3vw',
								color: '#fff',
								'&:hover': {
									transform: 'scale(1.7)',
								},
							}}
						/>
					) : (
						<PauseIcon
							onClick={() => handlePlay()}
							sx={{
								transition: 'all 0.1s ease-in-out',
								cursor: 'pointer',
								fontSize: '3vw',
								color: '#fff',
								'&:hover': {
									transform: 'scale(1.4)',
								},
							}}
						/>
					)}
						<RewindIcon 
							onClick={() => handleRewind()}
							sx={{
								transition: 'all 0.1s ease-in-out',
								cursor: 'pointer',
								fontSize: '3vw',
								color: '#fff',
								'&:hover': {
									transform: 'scale(1.4)',
								},
							}}
						/>
						<ForwardIcon
							onClick={() => handleForward()}
							sx={{
								transition: 'all 0.1s ease-in-out',
								cursor: 'pointer',
								fontSize: '3vw',
								color: '#fff',
								'&:hover': {
									transform: 'scale(1.4)',
								},
							}}
						/>
						{!mute ? (
							<VolumeOnIcon
								onClick={() => setMute(!mute)}
									sx={{
										transition: 'all 0.1s ease-in-out',
										color: '#fff',
										cursor: 'pointer',
										fontSize: '3vw',
										'&:hover': {
											transform: 'scale(1.4)',
										},
									}}
							/>
						) : (
							<VolumeOffIcon
								onClick={() => setMute(!mute)}
								sx={{
									transition: 'all 0.1s ease-in-out',
									cursor: 'pointer',
									fontSize: '3vw',
									color: '#fff',
									'&:hover': {
										transform: 'scale(1.4)',
									},
								}}
							/>
						)}
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
							{media[0].name}
						</Typography>
					</Stack>
          <Stack direction="row" spacing={4} sx={{
              justifyContent: 'right',
              position: 'absolute',
              marginLeft: 'auto',
              display: 'flex',
              bottom: '.5vw',
              right: '1.2vw',
              border: '1px solid rgba(255,255,255,0.2)',
              zIndex: 1,
            }}
          >
            <CommentIcon
              sx={{
                transition: 'all 0.1s ease-in-out',
                cursor: 'pointer',
                fontSize: '3vw',
                color: '#fff',
                '&:hover': {
                  transform: 'scale(1.4)',
                },
              }}
            />
            <PerformanceIcon
              sx={{
                transition: 'all 0.1s ease-in-out',
                cursor: 'pointer',
                fontSize: '3vw',
                color: '#fff',
                '&:hover': {
                  transform: 'scale(1.4)',
                },
              }}
            />
            <FullscreenIcon
              onClick={() => handleFullscreen()}
              sx={{
                transition: 'all 0.1s ease-in-out',
                cursor: 'pointer',
                fontSize: '3vw',
                color: '#fff',
                '&:hover': {
                  transform: 'scale(1.4)',
                },
              }}
            />
          </Stack>
        </Stack>
      </BottomNavigation>
    );
  };

  return (
		<>
		<Head>
			<title>Nyetflix</title>
			<meta name="description" content="Generated by create next app" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<link rel="icon" href="/favicon.ico" />
		</Head>
		{loaded ? (
    <Card
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
      }}
    >
      <ArrowIcon
        onClick={() => {
					router.back()
				}}
        sx={{
          position: 'absolute',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontSize: '55px',
          color: '#fff',
          left: '25px',
          zIndex: 100,
          top: '25px',
        }}
      />
      <FlagIcon
        sx={{
          transform: 'scaleX(1.3)',
          position: 'absolute',
          cursor: 'pointer',
          fontSize: '55px',
          color: '#fff',
          right: '50px',
          zIndex: 100,
          top: '25px',
        }}
      />
      <video
        style={{
          objectFit: 'cover',
          height: '100%',
          width: '100%',
        }}
        src={`/data/movies/trailers/${id}.mp4` }
        controls={false}
        autoPlay={true}
        muted={mute}
        ref={ref}
      />       
      <PlayerControl />
    </Card>
		) : (
			<Card
				style={{
					position: 'absolute',
					backgroundColor: '#000',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					height: '100%',
					width: '100%',
				}}
			>
				<CircularProgress
						size="3vw"
						sx={{
							color: 'red',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							height: '100%',
							width: '100%',
						}}
					/>
			</Card>
		)}		
		</>
	);
};