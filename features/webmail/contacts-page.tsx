"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, PenSquare } from "lucide-react";
import { webmailApi } from "@/features/webmail/lib/api";
import { webmailRoutes } from "@/config/webmail-routes";

export function WebmailContactsPage() {
  const router = useRouter();
  const [recent, setRecent] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void webmailApi<{ recent: string[]; contacts: Array<{ email: string }> }>("/api/webmail/contacts")
      .then((data) => setRecent(data.recent?.length ? data.recent : data.contacts?.map((c) => c.email) || []))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load contacts");
        router.replace(webmailRoutes.home);
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={webmailRoutes.mail}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to mail
        </Link>
        <Link
          href={webmailRoutes.compose}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f6e7a8] to-[#c9971a] px-4 py-2 text-sm font-bold text-[#1a1200]"
        >
          <PenSquare className="size-3.5" />
          Compose
        </Link>
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Contacts</h1>
      <p className="mb-6 text-sm text-zinc-500">Recent recipients from your mailbox</p>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="text-sm text-zinc-500">No contacts yet. Send mail to build your address book.</p>
      ) : (
        <ul className="divide-y divide-white/8 rounded-xl border border-white/10">
          {recent.map((email) => (
            <li key={email} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="truncate">{email}</span>
              <Link
                href={`${webmailRoutes.compose}?to=${encodeURIComponent(email)}`}
                className="shrink-0 text-xs font-medium text-[#d4af37] hover:underline"
              >
                Write
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
