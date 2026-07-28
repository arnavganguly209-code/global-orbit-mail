"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ImagePlus,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "@/components/ui/search";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { adminFetch } from "@/lib/api/admin-fetch";
import {
  DnsSetupWizardScroll,
  type DnsWizardPayload,
} from "@/features/admin/dns-setup-wizard";
import { FriendlyDomainBadge } from "@/components/domain/friendly-status";
import { normalizeApexDomain } from "@/lib/dns/domain-name";
import type { AdminDomain, ApiResponse, PaginatedResult } from "@/types";
import type { AutoVerifyReport } from "@/hooks/use-dns-auto-verify";

type DnsInstructionPayload = DnsWizardPayload;

type DomainCreateResult = AdminDomain & {
  dns?: DnsInstructionPayload;
  alreadyExisted?: boolean;
  restored?: boolean;
  created?: boolean;
};

type VerifyReport = AutoVerifyReport;

type DomainBrandingForm = {
  companyName: string;
  brandColor: string;
  logoDataUrl: string | null;
};

const LOGO_MAX_BYTES = 800_000;

async function fetchGeneratedDns(domainId: string): Promise<DnsInstructionPayload> {
  const res = await adminFetch(`/api/admin/dns?domainId=${encodeURIComponent(domainId)}`);
  const json = (await res.json()) as ApiResponse<DnsInstructionPayload>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? "Failed to generate DNS records");
  }
  if (!json.data?.flat?.length && !json.data?.required?.length) {
    throw new Error("DNS generator returned no records");
  }
  return json.data;
}

async function fetchDomains(params: {
  page: number;
  search: string;
  status: string;
}) {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: "8",
    search: params.search,
  });
  if (params.status !== "ALL") qs.set("status", params.status);
  const res = await adminFetch(`/api/admin/domains?${qs}`);
  const json = (await res.json()) as ApiResponse<PaginatedResult<AdminDomain>>;
  if (!json.success) throw new Error("Failed to load domains");
  return json.data;
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image"));
    };
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function DomainsAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editDomain, setEditDomain] = React.useState<AdminDomain | null>(null);
  const [brandDomain, setBrandDomain] = React.useState<AdminDomain | null>(null);
  const [brandForm, setBrandForm] = React.useState<DomainBrandingForm>({
    companyName: "",
    brandColor: "#1a56db",
    logoDataUrl: null,
  });
  const [domainName, setDomainName] = React.useState("");
  const [dnsDialogDomain, setDnsDialogDomain] = React.useState<AdminDomain | null>(null);
  const [dnsPayload, setDnsPayload] = React.useState<DnsInstructionPayload | null>(null);
  const [dnsLoading, setDnsLoading] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-domains", page, search, status],
    queryFn: () => fetchDomains({ page, search, status }),
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeApexDomain(domainName);
      setDomainName(normalized);
      const res = await adminFetch("/api/admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Unable to save domain. Please try again.");
      }
      return {
        data: json.data as DomainCreateResult,
        message: (json.message as string | undefined) ?? undefined,
      };
    },
    onSuccess: ({ data: created, message }) => {
      setCreateOpen(false);
      setDomainName("");
      qc.invalidateQueries({ queryKey: ["admin-domains"] });

      if (created.alreadyExisted) {
        toast.message(message ?? "This domain already exists in your account.");
      } else if (created.restored) {
        toast.success("✓ Domain Connected");
      } else {
        toast.success("✓ Domain Connected");
      }

      if (created.dns) {
        setDnsDialogDomain(created);
        setDnsPayload(created.dns);
      } else {
        void openDnsDialog(created);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      body: Record<string, string | null>;
    }) => {
      const res = await adminFetch(`/api/admin/domains/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Update failed");
      return json.data as AdminDomain;
    },
    onSuccess: () => {
      toast.success("Domain updated");
      setEditDomain(null);
      setBrandDomain(null);
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { id: string; status: "ACTIVE" | "SUSPENDED" }) => {
      const res = await adminFetch(`/api/admin/domains/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: payload.status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Status update failed");
      return json.data;
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.status === "SUSPENDED" ? "Domain suspended" : "Domain activated");
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
      qc.invalidateQueries({ queryKey: ["admin-mailboxes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await adminFetch(`/api/admin/domains/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success("Domain deleted");
      qc.invalidateQueries({ queryKey: ["admin-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runVerify(domainId: string): Promise<VerifyReport> {
    const res = await adminFetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message ?? "Verification failed");
    const report = json.data as VerifyReport;
    qc.invalidateQueries({ queryKey: ["admin-domains"] });
    if (report.ready) {
      setDnsDialogDomain((prev) =>
        prev && prev.id === domainId
          ? { ...prev, status: "ACTIVE", dnsStatus: "VERIFIED", mailStatus: "ACTIVE" }
          : prev,
      );
    }
    return report;
  }

  async function openDnsDialog(domain: AdminDomain) {
    setDnsDialogDomain(domain);
    setDnsPayload(null);
    setDnsLoading(true);
    try {
      const payload = await fetchGeneratedDns(domain.id);
      setDnsPayload(payload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate DNS");
      setDnsDialogDomain(null);
    } finally {
      setDnsLoading(false);
    }
  }

  function openBranding(domain: AdminDomain) {
    setBrandDomain(domain);
    setBrandForm({
      companyName: domain.companyName ?? "",
      brandColor: domain.brandColor ?? "#1a56db",
      logoDataUrl: domain.logoDataUrl ?? null,
    });
  }

  async function onLogoSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image (PNG, JPEG, WebP, or SVG)");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo must be under 800KB");
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setBrandForm((f) => ({ ...f, logoDataUrl: dataUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read logo");
    }
  }

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminShell
      title="Domains"
      description="Connect a domain, add DNS, and go live — Google Workspace–style"
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-blue border-0">
              <Plus className="size-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Domain</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="domain-name">Domain name</Label>
              <Input
                id="domain-name"
                placeholder="example.com"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                onBlur={() => {
                  const normalized = normalizeApexDomain(domainName);
                  if (normalized && normalized !== domainName.trim()) {
                    setDomainName(normalized);
                  }
                }}
              />
              {domainName.trim() && normalizeApexDomain(domainName) !== domainName.trim().toLowerCase() ? (
                <p className="text-xs text-muted-foreground">
                  Will be saved as{" "}
                  <span className="font-mono text-foreground">
                    {normalizeApexDomain(domainName) || "…"}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  www and https are removed automatically. Stored as the root domain only.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                Create Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Search
          placeholder="Search domains…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          containerClassName="flex-1"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="VERIFYING">Verifying</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loading label="Loading domains" /> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          title="No domains yet"
          description="Add your first domain to begin mailbox provisioning."
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="glass-surface overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mailboxes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {domain.logoDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={domain.logoDataUrl}
                          alt=""
                          className="size-8 shrink-0 rounded-lg object-contain ring-1 ring-border"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-medium tracking-tight">{domain.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {domain.companyName
                            ? domain.companyName
                            : domain.mailboxCount === 0
                              ? "Create a mailbox when DNS is ready"
                              : `${domain.mailboxCount} mailbox${domain.mailboxCount === 1 ? "" : "es"}`}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <FriendlyDomainBadge domain={domain} />
                  </TableCell>
                  <TableCell className="tabular-nums">{domain.mailboxCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 border-gold/30 text-xs"
                        disabled={dnsLoading && dnsDialogDomain?.id === domain.id}
                        onClick={() => void openDnsDialog(domain)}
                      >
                        <Copy className="size-3.5 text-gold" />
                        {dnsLoading && dnsDialogDomain?.id === domain.id ? "…" : "DNS Setup"}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Branding"
                        onClick={() => openBranding(domain)}
                      >
                        <ImagePlus className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Edit status"
                        onClick={() => setEditDomain(domain)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {domain.status === "SUSPENDED" ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Activate"
                          disabled={statusMutation.isPending}
                          onClick={() =>
                            statusMutation.mutate({ id: domain.id, status: "ACTIVE" })
                          }
                        >
                          <PlayCircle className="size-4 text-emerald-400" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Suspend"
                          disabled={
                            statusMutation.isPending ||
                            domain.status === "PENDING" ||
                            domain.status === "VERIFYING"
                          }
                          onClick={() => {
                            if (
                              window.confirm(
                                `Suspend domain ${domain.name}? Mailboxes on this domain will be suspended.`,
                              )
                            ) {
                              statusMutation.mutate({ id: domain.id, status: "SUSPENDED" });
                            }
                          }}
                        >
                          <PauseCircle className="size-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        onClick={() => {
                          if (window.confirm(`Delete domain ${domain.name}?`)) {
                            deleteMutation.mutate(domain.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
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

      <Dialog
        open={Boolean(dnsDialogDomain)}
        onOpenChange={(open) => {
          if (!open) {
            setDnsDialogDomain(null);
            setDnsPayload(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect domain</DialogTitle>
            <DialogDescription>
              Add required mail DNS, then we verify automatically — no manual refresh.
            </DialogDescription>
          </DialogHeader>

          {dnsLoading ? <Loading label="Preparing DNS wizard" /> : null}

          {!dnsLoading && dnsPayload && dnsDialogDomain ? (
            <DnsSetupWizardScroll
              domainId={dnsDialogDomain.id}
              domainMeta={dnsDialogDomain}
              payload={dnsPayload}
              mailboxHref={`/orbit/mailboxes?domainId=${dnsDialogDomain.id}`}
              verifyFn={runVerify}
              onDomainRefresh={() => {
                qc.invalidateQueries({ queryKey: ["admin-domains"] });
              }}
              onReady={() => {
                qc.invalidateQueries({ queryKey: ["admin-domains"] });
              }}
            />
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDnsDialogDomain(null);
                setDnsPayload(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(brandDomain)}
        onOpenChange={(o) => {
          if (!o) setBrandDomain(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Domain branding</DialogTitle>
            <DialogDescription>
              Company identity for {brandDomain?.name}. Logo is for Orbit webmail branding.
              Gmail&apos;s round sender icon needs BIMI + a paid VMC (see checklist below).
            </DialogDescription>
          </DialogHeader>
          {brandDomain ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-company">Company name</Label>
                <Input
                  id="brand-company"
                  value={brandForm.companyName}
                  onChange={(e) =>
                    setBrandForm((f) => ({ ...f, companyName: e.target.value }))
                  }
                  placeholder="Acme Inc."
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-color">Brand color</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand-color"
                    type="color"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(brandForm.brandColor)
                        ? brandForm.brandColor
                        : "#1a56db"
                    }
                    onChange={(e) =>
                      setBrandForm((f) => ({ ...f, brandColor: e.target.value }))
                    }
                    className="size-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={brandForm.brandColor}
                    onChange={(e) =>
                      setBrandForm((f) => ({ ...f, brandColor: e.target.value }))
                    }
                    placeholder="#1a56db"
                    className="font-mono"
                    maxLength={32}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Company logo (webmail + BIMI)</Label>
                <p className="text-xs text-muted-foreground">
                  Used in Orbit webmail UI and synced to every mailbox on this domain. This upload
                  does <span className="font-medium text-foreground">not</span> change Gmail&apos;s
                  blue round sender icon by itself.
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-foreground">Gmail profile logo (BIMI) checklist</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>DMARC on this domain must be <code className="text-[11px]">p=quarantine</code> or <code className="text-[11px]">p=reject</code>.</li>
                    <li>Upload a BIMI-ready <strong>SVG Tiny PS</strong> logo here (PNG/JPEG cannot fill Gmail&apos;s circle).</li>
                    <li>Publish the optional BIMI TXT on Host <code className="text-[11px]">default._bimi</code> (shown in DNS).</li>
                    <li>Buy a Verified Mark Certificate (VMC) from DigiCert/Entrust and add its URL as BIMI <code className="text-[11px]">a=</code>.</li>
                    <li>Wait for Gmail to cache BIMI (can take days). Until then the blue silhouette stays.</li>
                  </ol>
                  <p>
                    Public SVG URL after SVG upload:{" "}
                    <code className="break-all text-[11px]">
                      https://globalorbitmail.cloud/api/public/bimi/{brandDomain.name}
                    </code>
                  </p>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    void onLogoSelected(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                {brandForm.logoDataUrl ? (
                  <div className="flex items-start gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={brandForm.logoDataUrl}
                      alt="Domain logo preview"
                      className="max-h-16 max-w-[180px] object-contain"
                    />
                    <div className="flex flex-1 flex-col gap-2">
                      <p className="text-xs text-muted-foreground">
                        Preview · PNG, JPEG, WebP, or SVG · max 800KB
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setBrandForm((f) => ({ ...f, logoDataUrl: null }))
                          }
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <ImagePlus className="size-4" />
                    Upload logo
                  </Button>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBrandDomain(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={updateMutation.isPending || !brandDomain}
              onClick={() =>
                brandDomain &&
                updateMutation.mutate({
                  id: brandDomain.id,
                  body: {
                    companyName: brandForm.companyName.trim() || null,
                    brandColor: brandForm.brandColor.trim() || null,
                    logoDataUrl: brandForm.logoDataUrl,
                  },
                })
              }
            >
              {updateMutation.isPending ? "Saving…" : "Save branding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editDomain)} onOpenChange={(o) => !o && setEditDomain(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Domain</DialogTitle>
          </DialogHeader>
          {editDomain ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["status", editDomain.status],
                  ["sslStatus", editDomain.sslStatus],
                  ["dnsStatus", editDomain.dnsStatus],
                  ["mailStatus", editDomain.mailStatus],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label>{key}</Label>
                  <Select
                    value={value}
                    onValueChange={(next) =>
                      setEditDomain({ ...editDomain, [key]: next } as AdminDomain)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {key === "status" &&
                        ["PENDING", "VERIFYING", "ACTIVE", "SUSPENDED", "FAILED"].map(
                          (opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ),
                        )}
                      {key === "sslStatus" &&
                        ["NONE", "PENDING", "ACTIVE", "EXPIRED", "FAILED"].map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      {key === "dnsStatus" &&
                        ["UNKNOWN", "PENDING", "PARTIAL", "VERIFIED", "FAILED"].map(
                          (opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ),
                        )}
                      {key === "mailStatus" &&
                        ["DISABLED", "PROVISIONING", "ACTIVE", "SUSPENDED", "ERROR"].map(
                          (opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ),
                        )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() =>
                editDomain &&
                updateMutation.mutate({
                  id: editDomain.id,
                  body: {
                    status: editDomain.status,
                    sslStatus: editDomain.sslStatus,
                    dnsStatus: editDomain.dnsStatus,
                    mailStatus: editDomain.mailStatus,
                  },
                })
              }
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
