import type { NextConfig } from 'next';

/**
 * A Google Cast receiver runs on the TV and fetches media/subtitles cross-origin,
 * so these endpoints have to be readable from any origin for casting to work.
 */
const MEDIA_CORS_HEADERS = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Range, Content-Type' },
  { key: 'Access-Control-Expose-Headers', value: 'Accept-Ranges, Content-Length, Content-Range' },
];

const CAST_REACHABLE_ROUTES = [
  '/api/stream-video',
  '/api/hls-file',
  '/api/subtitles',
  '/api/subtitle-tracks',
  '/api/hls-manifest',
  '/api/hls-segment',
  '/api/lan-address',
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Tree-shake barrel packages so dev compile and bundles are smaller
    optimizePackageImports: ['@mui/icons-material', '@mui/material', '@vidstack/react', 'swiper'],
  },
  async headers() {
    return CAST_REACHABLE_ROUTES.map((source) => ({ source, headers: MEDIA_CORS_HEADERS }));
  },
};

export default nextConfig;
