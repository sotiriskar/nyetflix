import type { NextConfig } from 'next';
import { networkInterfaces } from 'os';

/**
 * A Google Cast receiver runs on the TV and fetches media/subtitles cross-origin,
 * so these endpoints have to be readable from any origin for casting to work.
 * Same headers are needed when another PC on the LAN plays through the browser.
 */
const MEDIA_CORS_HEADERS = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Range, Content-Type' },
  { key: 'Access-Control-Expose-Headers', value: 'Accept-Ranges, Content-Length, Content-Range, Content-Type' },
];

const CAST_REACHABLE_ROUTES = [
  '/api/stream-video',
  '/api/hls-file',
  '/api/subtitles',
  '/api/subtitle-tracks',
  '/api/hls-manifest',
  '/api/hls-segment',
  '/api/lan-address',
  '/api/video-src',
  '/api/convert-mkv',
];

/** LAN IPs so Next.js 16 does not treat other PCs as a blocked cross-origin host in `next dev`. */
function lanDevOrigins(): string[] {
  const hosts = new Set<string>(['localhost', '127.0.0.1']);
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets ?? []) {
      const isIPv4 = net.family === 'IPv4' || (net.family as unknown as number) === 4;
      if (!isIPv4 || net.internal) continue;
      if (net.address.startsWith('169.254.')) continue;
      hosts.add(net.address);
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: lanDevOrigins(),
  experimental: {
    // Tree-shake barrel packages so dev compile and bundles are smaller
    optimizePackageImports: ['@mui/icons-material', '@mui/material', '@vidstack/react', 'swiper'],
  },
  // HTTP redirect so "/" never stays mounted under Who's watching (that blocked the
  // page-level redirect and crashed App Router when picking a profile).
  async redirects() {
    return [{ source: '/', destination: '/browse', permanent: false }];
  },
  async headers() {
    return CAST_REACHABLE_ROUTES.map((source) => ({ source, headers: MEDIA_CORS_HEADERS }));
  },
};

export default nextConfig;
