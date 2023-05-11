import React, { useEffect } from 'react';
import { Button, Typography, Grid, Box } from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';


export default function Footer() {
    useEffect(() => {
    }, []);

  return (
      <Box className="footer" sx={{ width: '100%', marginTop: '-100px' }}>
        <Grid container spacing={4} sx={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Grid item lg={5.5}>
            <FacebookIcon sx={{ fontSize: '30px', color: 'rgba(255,255,255,0.8)', margin: '0 20px 0 0', cursor: 'pointer' }} />
            <InstagramIcon sx={{ fontSize: '30px', color: 'rgba(255,255,255,0.8)', margin: '0 20px 0 0', cursor: 'pointer' }} />
            <YouTubeIcon sx={{ fontSize: '30px', color: 'rgba(255,255,255,0.8)', margin: '0 0 0 0', cursor: 'pointer' }} />
          </Grid>
        </Grid>
        <Grid container spacing={2} sx={{ width: '100%', alignItems: 'center', justifyContent: 'center', margin: '0 0 0 -20px' }}>
          <Grid item lg={1.4}>
            <Box component="ul" aria-labelledby="category-a">
              <ul style={{
                listStyleType: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                color: 'rgba(255,255,255,0.5)',
                gap: '12px',
                fontSize: '14px',
              }}>
                <li style={{ borderBottom: '1px solid transparent'}}>Audio Description</li>
                <li style={{ borderBottom: '1px solid transparent'}}>Investor Relations</li>
                <li style={{ borderBottom: '1px solid transparent'}}>Legal Notices</li>
              </ul>
            </Box>
          </Grid>
          <Grid item lg={1.4}>
            <Box component="ul" aria-labelledby="category-b">
              <ul style={{
                listStyleType: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                color: 'rgba(255,255,255,0.5)',
                gap: '10px',
                fontSize: '14px',
              }}
              >
                <li style={{ borderBottom: '1px solid transparent'}}>Help Center</li>
                <li style={{ borderBottom: '1px solid transparent'}}>Jobs</li>
                <li style={{ borderBottom: '1px solid transparent'}}>Cookie Preferences</li>
              </ul>
            </Box>
          </Grid>
          <Grid item lg={1.4}>
            <Box component="ul" aria-labelledby="category-c">
              <ul style={{
                listStyleType: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                color: 'rgba(255,255,255,0.5)',
                gap: '10px',
                fontSize: '14px',
              }}
              >
                <li style={{ borderBottom: '1px solid transparent'}}>Gift Cards</li>
                <li style={{ borderBottom: '1px solid transparent'}}>Terms of Use</li>
                <li style={{ borderBottom: '1px solid transparent'}}>Corporate Information</li>
              </ul>
            </Box>
          </Grid>
          <Grid item lg={1.4}>
            <Box component="ul" aria-labelledby="category-d">
              <ul style={{
                listStyleType: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                gap: '10px',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.5)',
              }}>
                <li style={{ borderBottom: '1px solid transparent'}}>Media Center</li>
                <li style={{ borderBottom: '1px solid transparent'}}>Privacy</li>
                <li style={{ borderBottom: '1px solid transparent'}}>Contact Us</li>
              </ul>
            </Box>
          </Grid>
        </Grid>
        <Grid container spacing={4} sx={{ width: '100%', margin: '0 auto', alignItems: 'center', justifyContent: 'center' }}>
          <Grid item xs={12} lg={6.05}>
              <Button
                variant="contained"
                sx={{
                  margin: '0',
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: '400',
                  fontSize: '13px',
                  padding: '3px 5px',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderRadius: '0',
                  backgroundColor: 'transparent',
                  fontFamily: 'Netflix Sans,Helvetica Neue,Segoe UI,Roboto,Ubuntu,sans-serif',
                  '&:hover': {
                    transition: 'all 0s ease-in-out',
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
          <Grid item xs={12} lg={6.05}>
              <Typography sx={{
                fontSize: '12px',
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
