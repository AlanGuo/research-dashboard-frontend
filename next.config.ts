import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable the src directory for App Router
  // This ensures Next.js uses the app directory at the root level
  // experimental: {
  //   appDir: true
  // },
  // Ensure we're using the correct directory structure
  distDir: '.next',

  reactStrictMode: false, // Disable React strict mode for performance

  // Performance optimizations
  compress: true, // Enable gzip compression

  // API routes optimizations - updated to use the new option name
  serverExternalPackages: ['mongoose'],

  // Headers for better caching (gzip compression is handled automatically by compress: true)
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
