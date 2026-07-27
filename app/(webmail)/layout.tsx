import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Global Orbit Mail",
  description: "Business email built for professionals.",
  applicationName: "Global Orbit Mail",
  icons: { icon: "/brand/logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#050508",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function WebmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="orbit-webmail min-h-dvh bg-[#050508] text-[#f5f5f7] antialiased [color-scheme:dark]">
      {children}
    </div>
  );
}
