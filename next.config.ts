import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable the src directory for App Router
  // This ensures Next.js uses the app directory at the root level
  // experimental: {
  //   appDir: true
  // },
  // Ensure we're using the correct directory structure
  distDir: '.next',
  
  // Performance optimizations
  compress: true, // Enable gzip compression
  
  // API routes optimizations
  experimental: {
    serverComponentsExternalPackages: ['mongoose']
  },
  
  // Headers for better caching and compression
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          },
          {
            key: 'Content-Encoding',
            value: 'gzip'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
