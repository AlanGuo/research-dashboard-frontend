import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable the src directory for App Router
  // This ensures Next.js uses the app directory at the root level
  // experimental: {
  //   appDir: true
  // },
  // Ensure we're using the correct directory structure
  distDir: '.next'
};

export default nextConfig;
