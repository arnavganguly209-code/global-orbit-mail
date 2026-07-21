import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Super Admin",
    template: "%s · Orbit Admin",
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
