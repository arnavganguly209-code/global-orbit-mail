"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { customerFetch } from "@/lib/api/customer-fetch";
import type { AdminDomain, AdminMailbox, ApiResponse, PaginatedResult } from "@/types";

async function fetchMailboxes() {
  const res = await customerFetch("/api/customer/mailboxes?page=1&pageSize=50");
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminMailbox>>;
  if (!json.success) throw new Error("Failed to load mailboxes");
  return json.data.items;
}

async function fetchDomainOptions() {
  const res = await customerFetch("/api/customer/domains?page=1&pageSize=100");
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
  if (!json.success) throw new Error("Failed to load domains");
  return json.data.items;
}

export function CustomerMailboxesPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    localPart: "",
    domainId: searchParams.get("domainId") ?? "",
    displayName: "",
    quotaMb: "2048",
    password: "",
  });

  React.useEffect(() => {
    const domainId = searchParams.get("domainId");
    if (domainId) {
      setForm((f) => ({ ...f, domainId }));
      setOpen(true);
    }
  }, [searchParams]);

  const { data: mailboxes, isLoading } = useQuery({
    queryKey: ["customer-mailboxes"],
    queryFn: fetchMailboxes,
  });

  const { data: domains } = useQuery({
    queryKey: ["customer-domains-options"],
    queryFn: fetchDomainOptions,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await customerFetch("/api/customer/mailboxes", {
        method: "POST",
        body: JSON.stringify({
          localPart: form.localPart,
          domainId: form.domainId,
          displayName: form.displayName || undefined,
          quotaMb: Number(form.quotaMb),
          password: form.password,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Create failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Mailbox created");
      setOpen(false);
      setForm({ localPart: "", domainId: "", displayName: "", quotaMb: "2048", password: "" });
      qc.invalidateQueries({ queryKey: ["customer-mailboxes"] });
      qc.invalidateQueries({ queryKey: ["customer-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Mailboxes"
        description="Create and manage mailboxes on your verified domains"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-blue border-0">
                <Plus className="size-4" />
                Create Mailbox
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Mailbox</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label>Local part</Label>
                  <Input
                    value={form.localPart}
                    onChange={(e) => setForm((f) => ({ ...f, localPart: e.target.value }))}
                    placeholder="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select
                    value={form.domainId}
                    onValueChange={(domainId) => setForm((f) => ({ ...f, domainId }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {(domains ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quota (MB)</Label>
                  <Input
                    value={form.quotaMb}
                    onChange={(e) => setForm((f) => ({ ...f, quotaMb: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? <Loading label="Loading mailboxes" /> : null}
      {mailboxes && mailboxes.length === 0 ? (
        <EmptyState title="No mailboxes" description="Create a mailbox on one of your verified domains." />
      ) : null}

      {mailboxes && mailboxes.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead>Forwarders</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailboxes.map((mailbox) => (
                <TableRow key={mailbox.id}>
                  <TableCell>
                    <p className="font-medium">{mailbox.email}</p>
                    <p className="text-xs text-muted-foreground">{mailbox.displayName ?? "—"}</p>
                  </TableCell>
                  <TableCell>
                    <StatusPill label={mailbox.status} tone={statusToneFromValue(mailbox.status)} />
                  </TableCell>
                  <TableCell>
                    {mailbox.usedMb} / {mailbox.quotaMb} MB
                  </TableCell>
                  <TableCell>{mailbox.aliasCount}</TableCell>
                  <TableCell>{mailbox.forwarderCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}
