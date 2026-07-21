"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import type { AdminProfile, ApiResponse } from "@/types";

export function ProfileAdminPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-profile"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/profile");
      const json = (await res.json()) as ApiResponse<AdminProfile>;
      if (!json.success) throw new Error(json.message ?? "Failed");
      return json.data;
    },
  });

  const [name, setName] = React.useState("");
  const [image, setImage] = React.useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");

  React.useEffect(() => {
    if (!data) return;
    setName(data.name ?? "");
    setImage(data.image);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Save failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["admin-profile"] });
      qc.invalidateQueries({ queryKey: ["admin-me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/admin/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Change failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onAvatarSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Avatar must be an image");
      return;
    }
    if (file.size > 400_000) {
      toast.error("Avatar must be under 400KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImage(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <AdminShell title="Profile" description="Account · Role · Security">
      {isLoading ? <Loading label="Loading profile" /> : null}
      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt=""
                  className="size-16 rounded-2xl object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-lg font-semibold text-primary">
                  {(data.name ?? data.email).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-display text-xl font-semibold">{data.name ?? "Admin"}</p>
                <p className="text-sm text-muted-foreground">{data.email}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-gold">
                  {data.roleName}
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="flex justify-between gap-3 border-b border-border/50 py-2">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium">{data.company ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-border/50 py-2">
                <span className="text-muted-foreground">Last login</span>
                <span className="font-medium">
                  {data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString() : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{data.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Avatar</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => onAvatarSelected(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="button" onClick={() => saveMutation.mutate()}>
              Update profile
            </Button>
          </section>

          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">Change password</h2>
            <div className="space-y-2">
              <Label>Current password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label>New password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 12 characters with upper, lower, and a number.
              </p>
            </div>
            <Button type="button" onClick={() => passwordMutation.mutate()}>
              Change password
            </Button>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
