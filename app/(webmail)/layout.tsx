import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RegisterWebmailSw } from "@/features/webmail/register-webmail-sw";
import { PwaInstallBanner } from "@/features/webmail/pwa-install-banner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-orbit-ui",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

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
    { media: "(prefers-color-scheme: dark)", color: "#08090C" },
    { media: "(prefers-color-scheme: light)", color: "#08090C" },
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
    <div
      className={`${inter.variable} orbit-webmail min-h-dvh bg-[#08090C] text-[#f5f5f7] antialiased [color-scheme:dark] [font-family:var(--font-orbit-ui),ui-sans-serif,system-ui,sans-serif]`}
    >
      <RegisterWebmailSw />
      {children}
      <PwaInstallBanner />
    </div>
  );
}
