"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusPill, statusToneFromValue } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "@/components/ui/search";
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
import { Pagination } from "@/components/ui/pagination";
import { Loading } from "@/components/ui/loading";
import type { AdminUser, ApiResponse, AuditLogEntry, PaginatedResult, SystemRole } from "@/types";

export function UsersAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<SystemRole>("SUPPORT_STAFF");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: "10", search });
      const res = await fetch(`/api/admin/users?${qs}`);
      const json = (await res.json()) as ApiResponse<PaginatedResult<AdminUser>>;
      if (!json.success) throw new Error("Failed");
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Failed");
      return json.data;
    },
    onSuccess: () => {
      toast.success("User invited");
      setOpen(false);
      setEmail("");
      setName("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminShell
      title="Users"
      description="RBAC identities — Super Admin, Reseller, Customer, Support"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-blue border-0">
              <Plus className="size-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as SystemRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "SUPER_ADMIN",
                        "RESELLER",
                        "CUSTOMER",
                        "SUPPORT_STAFF",
                        "MAILBOX_USER",
                      ] as SystemRole[]
                    ).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => createMutation.mutate()}>
                Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Search
        containerClassName="mb-4 max-w-md"
        placeholder="Search users…"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
      />
      {isLoading ? <Loading /> : null}
      {data ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead>Last login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.name ?? "—"}</p>
                  </TableCell>
                  <TableCell>
                    <StatusPill label={user.role} tone="warning" />
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={user.status}
                      tone={statusToneFromValue(user.status)}
                    />
                  </TableCell>
                  <TableCell>{user.twoFactorEnabled ? "Enabled" : "Ready"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : "Never"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border/60 p-4">
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

export function LogsAdminPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", page, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: "12", search });
      const res = await fetch(`/api/admin/audit?${qs}`);
      const json = (await res.json()) as ApiResponse<PaginatedResult<AuditLogEntry>>;
      if (!json.success) throw new Error("Failed");
      return json.data;
    },
  });

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminShell
      title="Logs"
      description="Audit trail with search and export"
      actions={
        <Button asChild variant="outline">
          <a href="/api/admin/audit?export=csv">
            <Download className="size-4" />
            Export CSV
          </a>
        </Button>
      }
    >
      <Search
        containerClassName="mb-4 max-w-md"
        placeholder="Filter by action, actor, resource…"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
      />
      {isLoading ? <Loading /> : null}
      {data ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{log.actorEmail ?? "system"}</TableCell>
                  <TableCell className="font-mono text-xs text-gold">{log.action}</TableCell>
                  <TableCell>
                    {log.resource}
                    {log.resourceId ? (
                      <span className="text-muted-foreground"> · {log.resourceId}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.ipAddress ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border/60 p-4">
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
