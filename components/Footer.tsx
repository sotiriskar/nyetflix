
import React, { useEffect } from 'react';
import { Button, Typography, Grid, Box } from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';

export default function Footer() {
    useEffect(() => {
    }, []);

  return (
      <Box>
        <Grid container spacing={4} sx={{ width: '100%', margin: '-30px auto', alignItems: 'center', justifyContent: 'center' }}>
          <Grid item xs={12} lg={8}>
            <FacebookIcon sx={{ fontSize: '30px', color: 'rgba(255,255,255,0.8)', marginRight: '20px' }} />
            <InstagramIcon sx={{ fontSize: '30px', color: 'rgba(255,255,255,0.8)', marginRight: '20px' }} />
            <YouTubeIcon sx={{ fontSize: '30px', color: 'rgba(255,255,255,0.8)',}} />
          </Grid>
        </Grid>
        <Grid container spacing={4} sx={{ width: '100%', margin: '0 auto', alignItems: 'center', justifyContent: 'center' }}>
          <Grid item xs={12} sm={6} md={3} lg={2}>
            <Box component="ul" aria-labelledby="category-a">
              <ul style={{
                listStyleType: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                color: 'rgba(255,255,255,0.3)',
                gap: '10px',
                marginTop: '20px',
              }}>
                <li>Audio Description</li>
                <li>Investor Relations</li>
                <li>Legal Notices</li>
              </ul>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3} lg={2}>
            <Box component="ul" aria-labelledby="category-b">
              <ul style={{
                listStyleType: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                color: 'rgba(255,255,255,0.3)',
                gap: '10px',
                marginTop: '20px',
              }}
              >
                <li>Help Center</li>
                <li>Jobs</li>
                <li>Cookie Preferences</li>
              </ul>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3} lg={2}>
            <Box component="ul" aria-labelledby="category-c">
              <ul style={{
                listStyleType: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                color: 'rgba(255,255,255,0.3)',
                gap: '10px',
                marginTop: '20px',
              }}
              >
                <li>Gift Cards</li>
                <li>Terms of Use</li>
                <li>Corporate Information</li>
              </ul>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3} lg={2}>
            <Box component="ul" aria-labelledby="category-d">
              <ul style={{
                listStyleType: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                gap: '10px',
                marginTop: '20px',
                color: 'rgba(255,255,255,0.3)',
              }}>
                <li>Media Center</li>
                <li>Privacy</li>
                <li>Contact Us</li>
              </ul>
            </Box>
          </Grid>
        </Grid>
        <Grid container spacing={4} sx={{ width: '100%', margin: '0 auto', alignItems: 'center', justifyContent: 'center' }}>
          <Grid item xs={12} lg={8}>
              <Button
                variant="contained"
                sx={{
                  margin: '10px 0 5px 0',
                  color: 'rgba(255,255,255,0.3)',
                  textTransform: 'none',
                  fontSize: '15px',
                  padding: '3px 5px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '0',
                  backgroundColor: 'transparent',
                  fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
                  '&:hover': {
                  backgroundColor: 'Transparent',
                  color: 'white',
                  },
                }}
              >
                Service Code
              </Button>
          </Grid>
        </Grid>
        <Grid container spacing={4} sx={{ width: '100%', margin: '0 auto', alignItems: 'center', justifyContent: 'center' }}>
          <Grid item xs={12} lg={8}>
              <Typography sx={{
                fontSize: '15px',
                color: 'rgba(255,255,255,0.3)',
                fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif'
                }}
              >
                © 1995-2023 Netflix, Inc.
              </Typography>
            </Grid>
          </Grid>
      </Box>
    );
}
