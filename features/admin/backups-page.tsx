"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Play } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import { formatDateTime, pageCount } from "@/features/admin/admin-format";
import type { ApiResponse, PaginatedResult } from "@/types";

type BackupKind = "PLATFORM" | "ORGANIZATION" | "DOMAIN" | "MAILBOX";

type BackupJob = {
  id: string;
  kind: BackupKind;
  status: string;
  label: string;
  organizationId: string | null;
  domainId: string | null;
  mailboxId: string | null;
  sizeBytes: number | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

type BackupDetail = BackupJob & {
  artifact: unknown;
};

const PAGE_SIZE = 10;

async function fetchBackups(page: number) {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  const res = await adminFetch(`/api/admin/backups?${qs}`);
  const json = (await res.json()) as ApiResponse<PaginatedResult<BackupJob> & { items: BackupJob[] }>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load backups");
  return json.data;
}

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function BackupsAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [runOpen, setRunOpen] = React.useState(false);
  const [kind, setKind] = React.useState<BackupKind>("PLATFORM");
  const [organizationId, setOrganizationId] = React.useState("");
  const [domainId, setDomainId] = React.useState("");
  const [mailboxId, setMailboxId] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [viewJob, setViewJob] = React.useState<BackupDetail | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-backups", page],
    queryFn: () => fetchBackups(page),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = { kind };
      if (label.trim()) payload.label = label.trim();
      if (kind === "ORGANIZATION") payload.organizationId = organizationId.trim();
      if (kind === "DOMAIN") payload.domainId = domainId.trim();
      if (kind === "MAILBOX") payload.mailboxId = mailboxId.trim();

      const res = await adminFetch("/api/admin/backups", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<BackupJob>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Backup failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Backup completed");
      setRunOpen(false);
      setOrganizationId("");
      setDomainId("");
      setMailboxId("");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await adminFetch(`/api/admin/backups/${jobId}`);
      const json = (await res.json()) as ApiResponse<BackupDetail>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load backup");
      return json.data;
    },
    onSuccess: (job) => setViewJob(job),
    onError: (e: Error) => toast.error(e.message),
  });

  function downloadArtifact(job: BackupDetail) {
    const blob = new Blob([JSON.stringify(job.artifact, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${job.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = pageCount(data?.total ?? 0, PAGE_SIZE);

  return (
    <AdminShell
      title="Backups"
      description="Export platform, organization, domain, and mailbox configuration"
      actions={
        <Button onClick={() => setRunOpen(true)}>
          <Play className="size-4" />
          Run backup
        </Button>
      }
    >
      {isLoading ? <Loading label="Loading backup jobs…" /> : null}
      {!isLoading && data?.items.length === 0 ? (
        <EmptyState title="No backups" description="Run a backup to export configuration as JSON." />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="space-y-4">
          <div className="glass-surface overflow-hidden rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.label}</TableCell>
                    <TableCell>{job.kind}</TableCell>
                    <TableCell>
                      <StatusPill label={job.status} tone={statusToneFromValue(job.status)} uppercase />
                    </TableCell>
                    <TableCell>{formatBytes(job.sizeBytes)}</TableCell>
                    <TableCell>{formatDateTime(job.finishedAt)}</TableCell>
                    <TableCell className="text-right">
                      {job.status === "SUCCEEDED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={viewMutation.isPending}
                          onClick={() => viewMutation.mutate(job.id)}
                        >
                          <Eye className="size-3.5" />
                          View
                        </Button>
                      ) : job.error ? (
                        <span className="text-xs text-destructive">{job.error}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run backup</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Backup kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as BackupKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLATFORM">Platform</SelectItem>
                  <SelectItem value="ORGANIZATION">Organization</SelectItem>
                  <SelectItem value="DOMAIN">Domain</SelectItem>
                  <SelectItem value="MAILBOX">Mailbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind === "ORGANIZATION" ? (
              <div className="grid gap-2">
                <Label>Organization ID</Label>
                <Input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} placeholder="UUID" />
              </div>
            ) : null}
            {kind === "DOMAIN" ? (
              <div className="grid gap-2">
                <Label>Domain ID</Label>
                <Input value={domainId} onChange={(e) => setDomainId(e.target.value)} placeholder="UUID" />
              </div>
            ) : null}
            {kind === "MAILBOX" ? (
              <div className="grid gap-2">
                <Label>Mailbox ID</Label>
                <Input value={mailboxId} onChange={(e) => setMailboxId(e.target.value)} placeholder="UUID" />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Label (optional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
              {runMutation.isPending ? "Running…" : "Run backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewJob != null} onOpenChange={(o) => !o && setViewJob(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewJob?.label}</DialogTitle>
          </DialogHeader>
          {viewJob ? (
            <div className="space-y-4">
              <Button variant="outline" size="sm" onClick={() => downloadArtifact(viewJob)}>
                <Download className="size-4" />
                Download JSON
              </Button>
              <pre className="max-h-[50vh] overflow-auto rounded-xl bg-background/50 p-4 text-xs">
                {JSON.stringify(viewJob.artifact, null, 2)}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
