import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fwfsbeeamszwfiwvrfuz.supabase.co"
      }
    ]
  }
};

export default nextConfig;

