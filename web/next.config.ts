import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${process.env.API_SERVER_URL || 'http://127.0.0.1:3000'}/:path*` }];
  },
};

export default nextConfig;
