import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fwfsbeeamszwfiwvrfuz.supabase.co"
      }
    ]
  },
  // The parts store is shelved until it ships. These stay temporary so
  // browsers don't cache them once the routes come back.
  async redirects() {
    return [
      { source: "/parts", destination: "/", permanent: false },
      { source: "/parts/:path*", destination: "/", permanent: false }
    ];
  }
};

export default nextConfig;

