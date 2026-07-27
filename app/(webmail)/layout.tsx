import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Global Orbit Mail",
  description: "Business email built for professionals.",
};

export default function WebmailLayout({ children }: { children: React.ReactNode }) {
  return <div className="orbit-webmail min-h-dvh bg-[#050508] text-[#f5f5f7] antialiased">{children}</div>;
}
