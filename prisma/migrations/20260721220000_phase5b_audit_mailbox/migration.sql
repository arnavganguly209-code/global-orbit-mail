-- Phase 5B — Audit enrichment + mailbox last login

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS "oldValue" JSONB,
  ADD COLUMN IF NOT EXISTS "newValue" JSONB;

CREATE INDEX IF NOT EXISTS "audit_logs_status_idx" ON "audit_logs"("status");

ALTER TABLE "mailboxes"
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
