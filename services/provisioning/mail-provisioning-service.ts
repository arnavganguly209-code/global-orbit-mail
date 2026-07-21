/**
 * Phase 5B — Transactional mail provisioning orchestrator.
 * DB write → VPS agent → on failure: reverse agent + DB rollback.
 */

import { prisma } from "@/lib/db";
import { writeAudit, type AuditStatus } from "@/lib/audit";
import {
  mailEngine,
  type AgentCommand,
} from "@/services/provisioning/mail-engine";
import type { ProvisionJobKind } from "@prisma/client";

export class ProvisioningError extends Error {
  constructor(
    message: string,
    public readonly step: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProvisioningError";
  }
}

type AuditCtx = {
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

async function runOrThrow(input: {
  kind: ProvisionJobKind;
  command: AgentCommand;
  domainId?: string | null;
  mailboxId?: string | null;
  payload: Record<string, unknown>;
  step: string;
}) {
  const result = await mailEngine.runTracked({
    kind: input.kind,
    command: input.command,
    domainId: input.domainId,
    mailboxId: input.mailboxId,
    payload: input.payload,
  });
  if (!result.ok) {
    throw new ProvisioningError(
      result.stderr || `Provisioning failed at ${input.step}`,
      input.step,
    );
  }
  return result;
}

export const MailProvisioningService = {
  /**
   * After DB domain row + DNS exist, provision on mail stack.
   * On failure: deprovision agent + soft-delete domain (rollback).
   */
  async provisionDomain(input: {
    domainId: string;
    domainName: string;
    dkimSelector: string;
    dkimPublicKey: string;
    dkimPrivateKey: string;
    audit?: AuditCtx;
  }) {
    try {
      await runOrThrow({
        kind: "DOMAIN_CREATE",
        command: "domain.create",
        domainId: input.domainId,
        step: "domain.create",
        payload: {
          domain: input.domainName,
          dkimSelector: input.dkimSelector,
          dkimPublicKey: input.dkimPublicKey,
          dkimPrivateKey: input.dkimPrivateKey,
        },
      });
      await runOrThrow({
        kind: "DKIM_SYNC",
        command: "dkim.sync",
        domainId: input.domainId,
        step: "dkim.sync",
        payload: {
          domain: input.domainName,
          selector: input.dkimSelector,
          privateKeyPem: input.dkimPrivateKey,
          publicKey: input.dkimPublicKey,
        },
      });
      await prisma.domain.update({
        where: { id: input.domainId },
        data: { mailStatus: "ACTIVE", provisionedAt: new Date() },
      });
      await writeAudit({
        actorId: input.audit?.actorId,
        ipAddress: input.audit?.ipAddress,
        userAgent: input.audit?.userAgent,
        action: "provision.domain.success",
        resource: "domain",
        resourceId: input.domainId,
        status: "SUCCESS",
        newValue: { domain: input.domainName, mailStatus: "ACTIVE" },
      });
    } catch (error) {
      await mailEngine
        .runTracked({
          kind: "DOMAIN_DELETE",
          command: "domain.delete",
          domainId: input.domainId,
          payload: { domain: input.domainName },
        })
        .catch(() => undefined);

      await prisma.$transaction([
        prisma.dnsRecord.updateMany({
          where: { domainId: input.domainId, deletedAt: null },
          data: { deletedAt: new Date() },
        }),
        prisma.domain.update({
          where: { id: input.domainId },
          data: {
            deletedAt: new Date(),
            status: "FAILED",
            mailStatus: "ERROR",
          },
        }),
      ]);

      await writeAudit({
        actorId: input.audit?.actorId,
        ipAddress: input.audit?.ipAddress,
        userAgent: input.audit?.userAgent,
        action: "provision.domain.failed",
        resource: "domain",
        resourceId: input.domainId,
        status: "FAILED",
        metadata: {
          error: error instanceof Error ? error.message : "unknown",
        },
      });
      throw error instanceof ProvisioningError
        ? error
        : new ProvisioningError(
            error instanceof Error ? error.message : "Domain provision failed",
            "domain.create",
            error,
          );
    }
  },

  async deprovisionDomain(input: {
    domainId: string;
    domainName: string;
    audit?: AuditCtx;
  }) {
    const result = await mailEngine.runTracked({
      kind: "DOMAIN_DELETE",
      command: "domain.delete",
      domainId: input.domainId,
      payload: { domain: input.domainName },
    });
    const status: AuditStatus = result.ok ? "SUCCESS" : "PARTIAL";
    await writeAudit({
      actorId: input.audit?.actorId,
      ipAddress: input.audit?.ipAddress,
      userAgent: input.audit?.userAgent,
      action: "provision.domain.delete",
      resource: "domain",
      resourceId: input.domainId,
      status,
      oldValue: { domain: input.domainName },
    });
    if (!result.ok) {
      throw new ProvisioningError(
        result.stderr || "Domain deprovision failed",
        "domain.delete",
      );
    }
  },

  async provisionMailbox(input: {
    mailboxId: string;
    domainId: string;
    email: string;
    mailPasswordHash: string;
    /** Plaintext — used by VPS agent with `doveadm pw` so scheme matches live Dovecot */
    password?: string;
    quotaBytes: number;
    displayName?: string | null;
    audit?: AuditCtx;
  }) {
    try {
      const result = await runOrThrow({
        kind: "MAILBOX_CREATE",
        command: "mailbox.create",
        mailboxId: input.mailboxId,
        domainId: input.domainId,
        step: "mailbox.create",
        payload: {
          email: input.email,
          mailPasswordHash: input.mailPasswordHash,
          password: input.password ?? null,
          quotaBytes: input.quotaBytes,
          displayName: input.displayName ?? null,
        },
      });

      const agentHash =
        typeof result.data?.mailPasswordHash === "string"
          ? result.data.mailPasswordHash
          : null;
      if (input.password && result.data?.authTest !== true) {
        throw new ProvisioningError(
          `Dovecot auth not proved (doveadm auth test required). ${result.stderr || result.stdout || ""}`.trim(),
          "mailbox.create",
        );
      }
      if (agentHash && agentHash !== input.mailPasswordHash) {
        await prisma.mailbox.update({
          where: { id: input.mailboxId },
          data: {
            mailPasswordHash: agentHash,
            status: "ACTIVE",
            provisionedAt: new Date(),
          },
        });
      } else {
        await prisma.mailbox.update({
          where: { id: input.mailboxId },
          data: { status: "ACTIVE", provisionedAt: new Date() },
        });
      }
      await writeAudit({
        actorId: input.audit?.actorId,
        ipAddress: input.audit?.ipAddress,
        userAgent: input.audit?.userAgent,
        action: "provision.mailbox.success",
        resource: "mailbox",
        resourceId: input.mailboxId,
        status: "SUCCESS",
        newValue: {
          email: input.email,
          status: "ACTIVE",
          authTest: result.data?.authTest === true,
        },
      });
    } catch (error) {
      await mailEngine
        .runTracked({
          kind: "MAILBOX_DELETE",
          command: "mailbox.delete",
          mailboxId: input.mailboxId,
          domainId: input.domainId,
          payload: { email: input.email },
        })
        .catch(() => undefined);

      await prisma.mailbox.update({
        where: { id: input.mailboxId },
        data: { deletedAt: new Date(), status: "DISABLED" },
      });

      await writeAudit({
        actorId: input.audit?.actorId,
        ipAddress: input.audit?.ipAddress,
        userAgent: input.audit?.userAgent,
        action: "provision.mailbox.failed",
        resource: "mailbox",
        resourceId: input.mailboxId,
        status: "FAILED",
        metadata: {
          email: input.email,
          error: error instanceof Error ? error.message : "unknown",
        },
      });
      throw error instanceof ProvisioningError
        ? error
        : new ProvisioningError(
            error instanceof Error ? error.message : "Mailbox provision failed",
            "mailbox.create",
            error,
          );
    }
  },

  async deprovisionMailbox(input: {
    mailboxId: string;
    domainId: string;
    email: string;
    audit?: AuditCtx;
  }) {
    const result = await mailEngine.runTracked({
      kind: "MAILBOX_DELETE",
      command: "mailbox.delete",
      mailboxId: input.mailboxId,
      domainId: input.domainId,
      payload: { email: input.email },
    });
    await writeAudit({
      actorId: input.audit?.actorId,
      ipAddress: input.audit?.ipAddress,
      userAgent: input.audit?.userAgent,
      action: "provision.mailbox.delete",
      resource: "mailbox",
      resourceId: input.mailboxId,
      status: result.ok ? "SUCCESS" : "FAILED",
      oldValue: { email: input.email },
    });
    if (!result.ok) {
      throw new ProvisioningError(
        result.stderr || "Mailbox deprovision failed",
        "mailbox.delete",
      );
    }
  },

  async setMailboxActive(input: {
    mailboxId: string;
    domainId: string;
    email: string;
    active: boolean;
    audit?: AuditCtx;
  }) {
    const command = input.active ? "mailbox.unsuspend" : "mailbox.suspend";
    const kind = input.active ? "MAILBOX_UNSUSPEND" : "MAILBOX_SUSPEND";
    await runOrThrow({
      kind,
      command,
      mailboxId: input.mailboxId,
      domainId: input.domainId,
      step: command,
      payload: { email: input.email },
    });
    await writeAudit({
      actorId: input.audit?.actorId,
      ipAddress: input.audit?.ipAddress,
      userAgent: input.audit?.userAgent,
      action: input.active ? "provision.mailbox.enable" : "provision.mailbox.suspend",
      resource: "mailbox",
      resourceId: input.mailboxId,
      status: "SUCCESS",
      newValue: { email: input.email, active: input.active },
    });
  },

  async updatePassword(input: {
    mailboxId: string;
    domainId: string;
    email: string;
    mailPasswordHash: string;
    password?: string;
    audit?: AuditCtx;
  }) {
    const result = await runOrThrow({
      kind: "MAILBOX_PASSWORD",
      command: "mailbox.password",
      mailboxId: input.mailboxId,
      domainId: input.domainId,
      step: "mailbox.password",
      payload: {
        email: input.email,
        mailPasswordHash: input.mailPasswordHash,
        password: input.password ?? null,
      },
    });
    const agentHash =
      typeof result.data?.mailPasswordHash === "string"
        ? result.data.mailPasswordHash
        : null;
    if (input.password && result.data?.authTest !== true) {
      throw new ProvisioningError(
        `Dovecot auth not proved (doveadm auth test required). ${result.stderr || result.stdout || ""}`.trim(),
        "mailbox.password",
      );
    }
    if (agentHash) {
      await prisma.mailbox.update({
        where: { id: input.mailboxId },
        data: { mailPasswordHash: agentHash },
      });
    }
    await writeAudit({
      actorId: input.audit?.actorId,
      ipAddress: input.audit?.ipAddress,
      userAgent: input.audit?.userAgent,
      action: "provision.mailbox.password",
      resource: "mailbox",
      resourceId: input.mailboxId,
      status: "SUCCESS",
      newValue: {
        email: input.email,
        passwordChanged: true,
        authTest: result.data?.authTest === true,
      },
    });
  },

  async updateQuota(input: {
    mailboxId: string;
    domainId: string;
    email: string;
    quotaBytes: number;
    audit?: AuditCtx;
  }) {
    await runOrThrow({
      kind: "MAILBOX_QUOTA",
      command: "mailbox.quota",
      mailboxId: input.mailboxId,
      domainId: input.domainId,
      step: "mailbox.quota",
      payload: { email: input.email, quotaBytes: input.quotaBytes },
    });
    await writeAudit({
      actorId: input.audit?.actorId,
      ipAddress: input.audit?.ipAddress,
      userAgent: input.audit?.userAgent,
      action: "provision.mailbox.quota",
      resource: "mailbox",
      resourceId: input.mailboxId,
      status: "SUCCESS",
      newValue: { email: input.email, quotaBytes: input.quotaBytes },
    });
  },

  async syncAlias(input: {
    mailboxId: string;
    domainId: string;
    address: string;
    goto: string;
    audit?: AuditCtx;
  }) {
    await runOrThrow({
      kind: "ALIAS_SYNC",
      command: "alias.sync",
      mailboxId: input.mailboxId,
      domainId: input.domainId,
      step: "alias.sync",
      payload: { address: input.address, goto: input.goto },
    });
    await writeAudit({
      actorId: input.audit?.actorId,
      ipAddress: input.audit?.ipAddress,
      userAgent: input.audit?.userAgent,
      action: "provision.alias.sync",
      resource: "alias",
      resourceId: input.mailboxId,
      status: "SUCCESS",
      newValue: { address: input.address, goto: input.goto },
    });
  },

  async syncForwarder(input: {
    mailboxId: string;
    domainId: string;
    address: string;
    goto: string;
    audit?: AuditCtx;
  }) {
    await runOrThrow({
      kind: "FORWARDER_SYNC",
      command: "forwarder.sync",
      mailboxId: input.mailboxId,
      domainId: input.domainId,
      step: "forwarder.sync",
      payload: { address: input.address, goto: input.goto },
    });
    await writeAudit({
      actorId: input.audit?.actorId,
      ipAddress: input.audit?.ipAddress,
      userAgent: input.audit?.userAgent,
      action: "provision.forwarder.sync",
      resource: "forwarder",
      resourceId: input.mailboxId,
      status: "SUCCESS",
      newValue: { address: input.address, goto: input.goto },
    });
  },
};
