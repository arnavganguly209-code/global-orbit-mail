"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { MailboxCreateFields } from "@/components/mailboxes/mailbox-create-fields";
import { customerFetch } from "@/lib/api/customer-fetch";
import type { AdminDomain, AdminMailbox, ApiResponse, PaginatedResult } from "@/types";

async function fetchMailboxes() {
  const res = await customerFetch("/api/customer/mailboxes?page=1&pageSize=50");
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminMailbox>>;
  if (!json.success) throw new Error("Failed to load mailboxes");
  return json.data.items;
}

async function fetchDomainOptions() {
  const res = await customerFetch("/api/customer/domains?mailboxable=1");
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
  if (!json.success) throw new Error("Failed to load domains");
  return json.data.items ?? [];
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

  const {
    data: domains = [],
    isLoading: domainsLoading,
    refetch: refetchDomains,
  } = useQuery({
    queryKey: ["customer-domains-options"],
    queryFn: fetchDomainOptions,
  });

  React.useEffect(() => {
    if (open) void refetchDomains();
  }, [open, refetchDomains]);

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
      qc.invalidateQueries({ queryKey: ["customer-domains-options"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Mailboxes"
        description="Create and manage mailboxes on your ready domains"
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
              <MailboxCreateFields
                form={form}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                domains={domains}
                domainsLoading={domainsLoading}
                domainsHref="/dashboard/domains"
              />
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={
                    createMutation.isPending ||
                    !form.domainId ||
                    !form.localPart ||
                    form.password.length < 12 ||
                    domains.length === 0
                  }
                >
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? <Loading label="Loading mailboxes" /> : null}
      {mailboxes && mailboxes.length === 0 ? (
        <EmptyState
          title="No mailboxes"
          description="Create a mailbox on one of your ready domains."
        />
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
