import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "0" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "globalorbitmail.com",
      },
      {
        protocol: "https",
        hostname: "webmail.globalorbitmail.cloud",
      },
      {
        protocol: "https",
        hostname: "mail.globalorbitmail.cloud",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "date-fns"],
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/orbit",
        permanent: true,
      },
      {
        source: "/admin/:path*",
        destination: "/orbit/:path*",
        permanent: true,
      },
      // Legacy /webmail UI → clean public paths (preserve query via Next)
      { source: "/webmail", destination: "/", permanent: true },
      { source: "/webmail/login", destination: "/", permanent: true },
      { source: "/webmail/mail", destination: "/mail", permanent: true },
      { source: "/webmail/mail/:id", destination: "/mail/:id", permanent: true },
      { source: "/webmail/compose", destination: "/compose", permanent: true },
      { source: "/webmail/settings", destination: "/settings", permanent: true },
      { source: "/webmail/contacts", destination: "/contacts", permanent: true },
      { source: "/webmail/:path*", destination: "/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
