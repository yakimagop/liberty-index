import type { NextConfig } from "next";

const basePath = process.env.NODE_ENV === 'production' ? '/liberty-index' : '';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
