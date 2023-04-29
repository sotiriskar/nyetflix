import {AppBar, Toolbar, Button, Menu, MenuItem, Grid, Typography} from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import React, { useState, useEffect } from 'react';
import { useMediaQuery } from '@mui/material';
import { useRouter } from 'next/router';
import Link from 'next/link';


export default function NavBar() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isTop, setIsTop] = useState(true);

  const isSmallScreen = useMediaQuery('(max-width: 800px)');

  const handleMenuClick = (event: any) => {
      setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setTimeout(() => {
      setAnchorEl(null);
    }, 100);
  };

  const router = useRouter();
  const currentRoute = router.pathname;

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      setIsTop(scrollPosition === 0);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <AppBar
      sx={{
        backgroundImage: isTop ? 'linear-gradient(180deg,rgba(0,0,0,.7) 10%,transparent)' : '#141414',
        transition: 'background-color 500ms ease-in-out, background-image 500ms ease-in-out',
        backgroundColor: isTop ? 'transparent' : 'black',
        height: 'calc(6.5vw + 1vh)',
        justifyContent: 'center',
        minHeight: '40px',
        maxHeight: '70px',
        alignItems: 'left',
        boxShadow: 'none',
        display: 'flex',
        color: 'white',
    }}
    >
      <Toolbar sx={{ margin: '0 3%' }}>
        <Link href="/"
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
        >
          <img
            src="/nyetflix-logo.png"
            alt="neytflix-logo"
            style={{
              marginRight: '25px',
              maxWidth: '100px',
              marginTop: '5px',
              minWidth: '35px',
              height: '100%',
              width: '100%',
            }}
          />
        </Link>
        {isSmallScreen ? (
          <>
          <Button
            onClick={handleMenuClick}
            disableRipple
            sx={{
              color: 'white',
              height: '100%',
              padding: '0 1vw',
              fontSize: 'clamp(5px, 3vw, 14px)',
              textTransform: 'none',
              fontWeight: '400',
              '&:hover': {
                backgroundColor: 'transparent',
              },
            }}
          >
            Browse
            <DropDownIcon sx={{ margin: '0 0 3px 0' }} />
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem onClick={handleClose}>
              <Link href="/">Home</Link>
            </MenuItem>
            <MenuItem onClick={handleClose}>
              <Link href="/tvShows">TV Shows</Link>
            </MenuItem>
            <MenuItem onClick={handleClose}>
              <Link href="/movies">Movies</Link>
            </MenuItem>
          </Menu>
        </>
      ) : (
      <>
      <Button
        key="home"
        disableRipple
        sx={{
          fontWeight: currentRoute === '/' ? '900' : '400',
          fontSize: 'clamp(5px, 3vw, 14px)',
          textTransform: 'none',
          marginRight: '1vw',
          color: 'white',
          '&:hover': {
            backgroundColor: 'transparent',
          },
        }}>
        <Link href="/"
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
        >
          Home
        </Link>
      </Button>
      <Button
        key="tvShows"
        disableRipple
        sx={{
          fontWeight: currentRoute === '/tvShows' ? '900' : '400',
          fontSize: 'clamp(5px, 3vw, 14px)',
          textTransform: 'none',
          marginRight: '1vw',
          display: 'block',
          color: 'white',
          '&:hover': {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Link href="/tvShows"
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
        >
          TV Shows
        </Link>
      </Button>
      <Button
          key="movies"
          disableRipple
          sx={{
            fontWeight: currentRoute === '/movies' ? '900' : '400',
            fontSize: 'clamp(5px, 3vw, 14px)',
            textTransform: 'none',
            marginRight: '1vw',
            display: 'block',
            color: 'white',
            '&:hover': {
              backgroundColor: 'transparent',
            },
          }}
        >
          <Link href="/movies"
            onClick={(event) => {
              setAnchorEl(event.currentTarget);
            }}
          >
            Movies
          </Link>
        </Button>
        </>
      )}
      </Toolbar>
    </AppBar>
  )
}
