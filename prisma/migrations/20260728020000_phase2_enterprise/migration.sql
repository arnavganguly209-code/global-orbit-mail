-- Phase 2 enterprise: templates, backups, migration jobs, mail daily stats, coupon redemptions

CREATE TYPE "EmailTemplateCategory" AS ENUM ('SYSTEM', 'BILLING', 'WELCOME', 'SECURITY', 'QUOTA', 'CUSTOM');
CREATE TYPE "BackupJobKind" AS ENUM ('ORGANIZATION', 'DOMAIN', 'MAILBOX', 'PLATFORM');
CREATE TYPE "MigrationJobKind" AS ENUM ('IMAP_IMPORT', 'DOMAIN_CUTOVER', 'MAILBOX_MOVE');
CREATE TYPE "JobRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "coupon_redemptions_couponId_idx" ON "coupon_redemptions"("couponId");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_organizationId_idx" ON "coupon_redemptions"("organizationId");

ALTER TABLE "coupon_redemptions" DROP CONSTRAINT IF EXISTS "coupon_redemptions_couponId_fkey";
ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EmailTemplateCategory" NOT NULL DEFAULT 'CUSTOM',
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT,
    "variables" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_key_key" ON "email_templates"("key");

CREATE TABLE IF NOT EXISTS "backup_jobs" (
    "id" TEXT NOT NULL,
    "kind" "BackupJobKind" NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'QUEUED',
    "organizationId" TEXT,
    "domainId" TEXT,
    "mailboxId" TEXT,
    "label" TEXT NOT NULL,
    "artifact" JSONB,
    "sizeBytes" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backup_jobs_status_createdAt_idx" ON "backup_jobs"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "migration_jobs" (
    "id" TEXT NOT NULL,
    "kind" "MigrationJobKind" NOT NULL DEFAULT 'IMAP_IMPORT',
    "status" "JobRunStatus" NOT NULL DEFAULT 'QUEUED',
    "organizationId" TEXT,
    "sourceHost" TEXT NOT NULL,
    "sourcePort" INTEGER NOT NULL DEFAULT 993,
    "sourceEmail" TEXT,
    "targetEmail" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "migration_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_jobs_status_createdAt_idx" ON "migration_jobs"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "mail_daily_stats" (
    "id" TEXT NOT NULL,
    "statDate" DATE NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "spamActionCount" INTEGER NOT NULL DEFAULT 0,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "mail_daily_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mail_daily_stats_statDate_key" ON "mail_daily_stats"("statDate");
