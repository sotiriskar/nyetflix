import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Tree-shake barrel packages so dev compile and bundles are smaller
    optimizePackageImports: ['@mui/icons-material', '@mui/material', '@vidstack/react', 'swiper'],
  },
};

export default nextConfig;
