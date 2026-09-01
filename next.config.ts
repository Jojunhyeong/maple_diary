import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: '/api/equipment-catalog/icon',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.maplestorywiki.net',
        pathname: '/yetidb/**',
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
