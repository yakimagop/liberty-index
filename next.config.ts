import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  turbopack: {
    root: '/Users/mattbrown/Claude-Home/wa-scorecard',
  },
};

export default nextConfig;
