import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build gọn cho Docker: .next/standalone chứa server.js + node_modules tối thiểu
  output: 'standalone',
  async rewrites() {
    const api = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${api}/api/v1/:path*`,
      },
    ];
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
