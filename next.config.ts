import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "theglobalorbit.com",
      },
      {
        protocol: "https",
        hostname: "webmail.theglobalorbit.com",
      },
      {
        protocol: "https",
        hostname: "orbit.theglobalorbit.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "date-fns"],
  },
};

export default nextConfig;
