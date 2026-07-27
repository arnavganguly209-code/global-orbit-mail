"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, XCircle } from "lucide-react";
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
import { pageCount } from "@/features/admin/admin-format";
import type { ApiResponse, PaginatedResult } from "@/types";

type MigrationKind = "IMAP_IMPORT" | "DOMAIN_CUTOVER" | "MAILBOX_MOVE";

type MigrationJob = {
  id: string;
  kind: MigrationKind;
  status: string;
  sourceHost: string;
  sourcePort: number;
  sourceEmail: string | null;
  targetEmail: string;
  progress: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

const PAGE_SIZE = 10;

async function fetchMigrations(page: number) {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  const res = await adminFetch(`/api/admin/migration?${qs}`);
  const json = (await res.json()) as ApiResponse<PaginatedResult<MigrationJob> & { items: MigrationJob[] }>;
  if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to load migrations");
  return json.data;
}

export function MigrationAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [runJob, setRunJob] = React.useState<MigrationJob | null>(null);
  const [pollingId, setPollingId] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<MigrationKind>("IMAP_IMPORT");
  const [organizationId, setOrganizationId] = React.useState("");
  const [sourceHost, setSourceHost] = React.useState("");
  const [sourcePort, setSourcePort] = React.useState("993");
  const [sourceEmail, setSourceEmail] = React.useState("");
  const [targetEmail, setTargetEmail] = React.useState("");

  const [sourcePassword, setSourcePassword] = React.useState("");
  const [targetPassword, setTargetPassword] = React.useState("");
  const [runSourceEmail, setRunSourceEmail] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-migration", page],
    queryFn: () => fetchMigrations(page),
    refetchInterval: pollingId ? 3000 : false,
  });

  React.useEffect(() => {
    if (!pollingId || !data?.items) return;
    const job = data.items.find((j) => j.id === pollingId);
    if (job && (job.status === "SUCCEEDED" || job.status === "FAILED" || job.status === "CANCELLED")) {
      setPollingId(null);
      if (job.status === "SUCCEEDED") toast.success("Migration completed");
      else if (job.status === "FAILED") toast.error(job.error ?? "Migration failed");
    }
  }, [data, pollingId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        kind,
        sourceHost: sourceHost.trim(),
        sourcePort: Number(sourcePort) || 993,
        targetEmail: targetEmail.trim(),
      };
      if (organizationId.trim()) payload.organizationId = organizationId.trim();
      if (sourceEmail.trim()) payload.sourceEmail = sourceEmail.trim();

      const res = await adminFetch("/api/admin/migration", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<MigrationJob>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Create failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Migration job created");
      setCreateOpen(false);
      setOrganizationId("");
      setSourceHost("");
      setSourcePort("993");
      setSourceEmail("");
      setTargetEmail("");
      qc.invalidateQueries({ queryKey: ["admin-migration"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!runJob) throw new Error("No job selected");
      const payload: Record<string, string> = {
        sourcePassword,
        targetPassword,
      };
      if (runSourceEmail.trim()) payload.sourceEmail = runSourceEmail.trim();

      const res = await adminFetch(`/api/admin/migration/${runJob.id}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<MigrationJob>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Run failed");
      return json.data;
    },
    onSuccess: (job) => {
      toast.info("Migration started");
      setRunJob(null);
      setSourcePassword("");
      setTargetPassword("");
      setRunSourceEmail("");
      setPollingId(job.id);
      qc.invalidateQueries({ queryKey: ["admin-migration"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await adminFetch(`/api/admin/migration/${jobId}?action=cancel`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<MigrationJob>;
      if (!res.ok || !json.success) throw new Error(json.message ?? "Cancel failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Migration cancelled");
      qc.invalidateQueries({ queryKey: ["admin-migration"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openRun(job: MigrationJob) {
    setRunJob(job);
    setRunSourceEmail(job.sourceEmail ?? "");
    setSourcePassword("");
    setTargetPassword("");
  }

  const totalPages = pageCount(data?.total ?? 0, PAGE_SIZE);

  return (
    <AdminShell
      title="Migration"
      description="IMAP import and mailbox migration jobs"
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New migration
        </Button>
      }
    >
      {isLoading && !data ? <Loading label="Loading migration jobs…" /> : null}
      {!isLoading && data?.items.length === 0 ? (
        <EmptyState title="No migration jobs" description="Create a job to import mail from an external IMAP server." />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="space-y-4">
          <div className="glass-surface overflow-hidden rounded-2xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.targetEmail}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.sourceEmail ?? "—"} @ {job.sourceHost}:{job.sourcePort}
                    </TableCell>
                    <TableCell>{job.kind}</TableCell>
                    <TableCell>
                      <StatusPill label={job.status} tone={statusToneFromValue(job.status)} uppercase />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{job.progress}%</span>
                      </div>
                      {job.error ? <p className="mt-1 text-xs text-destructive">{job.error}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {["QUEUED", "FAILED"].includes(job.status) ? (
                          <Button variant="outline" size="sm" onClick={() => openRun(job)}>
                            <Play className="size-3.5" />
                            Run
                          </Button>
                        ) : null}
                        {["QUEUED"].includes(job.status) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(job.id)}
                          >
                            <XCircle className="size-3.5" />
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageCount={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create migration job</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as MigrationKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMAP_IMPORT">IMAP import</SelectItem>
                  <SelectItem value="DOMAIN_CUTOVER">Domain cutover</SelectItem>
                  <SelectItem value="MAILBOX_MOVE">Mailbox move</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Organization ID (optional)</Label>
              <Input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label>Source host</Label>
                <Input value={sourceHost} onChange={(e) => setSourceHost(e.target.value)} placeholder="imap.example.com" />
              </div>
              <div className="grid gap-2">
                <Label>Port</Label>
                <Input type="number" value={sourcePort} onChange={(e) => setSourcePort(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Source email (optional)</Label>
              <Input value={sourceEmail} onChange={(e) => setSourceEmail(e.target.value)} placeholder="user@oldmail.com" />
            </div>
            <div className="grid gap-2">
              <Label>Target email</Label>
              <Input value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} placeholder="user@yourdomain.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !sourceHost.trim() || !targetEmail.trim()}
            >
              {createMutation.isPending ? "Creating…" : "Create job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runJob != null} onOpenChange={(o) => !o && setRunJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run migration — {runJob?.targetEmail}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Source email</Label>
              <Input value={runSourceEmail} onChange={(e) => setRunSourceEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Source password</Label>
              <Input type="password" value={sourcePassword} onChange={(e) => setSourcePassword(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Target password</Label>
              <Input type="password" value={targetPassword} onChange={(e) => setTargetPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunJob(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || !sourcePassword || !targetPassword}
            >
              {runMutation.isPending ? "Starting…" : "Start migration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
