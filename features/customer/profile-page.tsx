"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { customerFetch } from "@/lib/api/customer-fetch";
import type { AdminProfile, ApiResponse } from "@/types";

export function CustomerProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const res = await customerFetch("/api/customer/profile");
      const json = (await res.json()) as ApiResponse<AdminProfile>;
      if (!json.success) throw new Error("Failed");
      return json.data;
    },
  });

  const [name, setName] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");

  React.useEffect(() => {
    if (data) setName(data.name ?? "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await customerFetch("/api/customer/profile", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Save failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["customer-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const res = await customerFetch("/api/customer/profile/password", {
        method: "POST",
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

  return (
    <>
      <PageHeader title="Profile" description="Account details and security" />
      {isLoading ? <Loading label="Loading profile" /> : null}
      {data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass-surface space-y-4 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-lg font-semibold text-primary">
                {(data.name ?? data.email).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="font-display text-xl font-semibold">{data.name ?? "Customer"}</p>
                <p className="text-sm text-muted-foreground">{data.email}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-gold">
                  {data.company ?? "Workspace"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
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
    </>
  );
}
