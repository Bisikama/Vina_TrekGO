import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const api = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    return ['trips', 'bookings', 'auth'].map((resource) => ({ source: `/api/v1/${resource}/:path*`, destination: `${api}/api/v1/${resource}/:path*` }));
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
