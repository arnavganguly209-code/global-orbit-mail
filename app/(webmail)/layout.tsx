import type { Metadata, Viewport } from "next";
import { RegisterWebmailSw } from "@/features/webmail/register-webmail-sw";
import { PwaInstallBanner } from "@/features/webmail/pwa-install-banner";

export const metadata: Metadata = {
  title: {
    default: "Global Orbit Mail",
    template: "%s · Global Orbit Mail",
  },
  description: "Business email built for professionals.",
  applicationName: "Global Orbit Mail",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Orbit Mail",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/brand/logo.png", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/brand/icon-192.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050508" },
    { media: "(prefers-color-scheme: light)", color: "#050508" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function WebmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="orbit-webmail min-h-dvh bg-[#050508] text-[#f5f5f7] antialiased [color-scheme:dark]">
      <RegisterWebmailSw />
      {children}
      <PwaInstallBanner />
    </div>
  );
}
