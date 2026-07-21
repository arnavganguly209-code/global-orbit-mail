-- Phase 5A — Real Provisioning Engine
-- DKIM keys, mailbox vacation/mail hash, provision jobs

ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "dkimSelector" TEXT NOT NULL DEFAULT 'orbit',
  ADD COLUMN IF NOT EXISTS "dkimPublicKey" TEXT,
  ADD COLUMN IF NOT EXISTS "dkimPrivateKey" TEXT,
  ADD COLUMN IF NOT EXISTS "provisionedAt" TIMESTAMP(3);

ALTER TABLE "mailboxes"
  ADD COLUMN IF NOT EXISTS "mailPasswordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "vacationEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "vacationSubject" TEXT,
  ADD COLUMN IF NOT EXISTS "vacationBody" TEXT,
  ADD COLUMN IF NOT EXISTS "vacationExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "provisionedAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "ProvisionJobKind" AS ENUM (
    'DOMAIN_CREATE',
    'DOMAIN_DELETE',
    'MAILBOX_CREATE',
    'MAILBOX_DELETE',
    'MAILBOX_SUSPEND',
    'MAILBOX_UNSUSPEND',
    'MAILBOX_PASSWORD',
    'MAILBOX_QUOTA',
    'ALIAS_SYNC',
    'FORWARDER_SYNC',
    'VACATION_SYNC',
    'DKIM_SYNC',
    'STORAGE_SYNC'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProvisionJobStatus" AS ENUM (
    'QUEUED',
    'RUNNING',
    'SUCCEEDED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "provision_jobs" (
  "id" TEXT NOT NULL,
  "kind" "ProvisionJobKind" NOT NULL,
  "status" "ProvisionJobStatus" NOT NULL DEFAULT 'QUEUED',
  "domainId" TEXT,
  "mailboxId" TEXT,
  "payload" JSONB,
  "result" JSONB,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provision_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "provision_jobs_status_createdAt_idx" ON "provision_jobs"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "provision_jobs_kind_idx" ON "provision_jobs"("kind");
CREATE INDEX IF NOT EXISTS "provision_jobs_domainId_idx" ON "provision_jobs"("domainId");
CREATE INDEX IF NOT EXISTS "provision_jobs_mailboxId_idx" ON "provision_jobs"("mailboxId");

DO $$ BEGIN
  ALTER TABLE "provision_jobs"
    ADD CONSTRAINT "provision_jobs_domainId_fkey"
    FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "provision_jobs"
    ADD CONSTRAINT "provision_jobs_mailboxId_fkey"
    FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
