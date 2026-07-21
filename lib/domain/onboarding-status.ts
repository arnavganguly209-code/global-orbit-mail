/**
 * Customer-facing domain onboarding labels.
 * Never show raw VERIFYING / PARTIAL / PROVISIONING in primary UI.
 */

import type { VerificationTone } from "@/types";

export const ONBOARDING_STEPS = [
  { id: "connected", label: "Domain Connected" },
  { id: "dns", label: "DNS Setup" },
  { id: "verify", label: "DNS Verification" },
  { id: "mailbox", label: "Mailbox Ready" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export type DomainOnboardingInput = {
  status: string;
  dnsStatus: string;
  mailStatus: string;
  mailboxCount?: number;
  /** From live verify report when available */
  requiredPassed?: number;
  requiredTotal?: number;
  waitingFor?: string | null;
  ready?: boolean;
  dnsCheckStarted?: boolean;
};

export type FriendlyDomainStatus = {
  label: string;
  description: string;
  tone: VerificationTone;
  stepIndex: number;
  ready: boolean;
  technical: {
    status: string;
    dnsStatus: string;
    mailStatus: string;
  };
};

function upper(value: string) {
  return (value ?? "").toUpperCase();
}

export function isDomainReady(input: DomainOnboardingInput): boolean {
  if (input.ready) return true;
  const status = upper(input.status);
  const dns = upper(input.dnsStatus);
  return status === "ACTIVE" || dns === "VERIFIED";
}

export function getFriendlyDomainStatus(input: DomainOnboardingInput): FriendlyDomainStatus {
  const status = upper(input.status);
  const dns = upper(input.dnsStatus);
  const mail = upper(input.mailStatus);
  const ready = isDomainReady(input);
  const technical = {
    status: input.status,
    dnsStatus: input.dnsStatus,
    mailStatus: input.mailStatus,
  };

  if (status === "SUSPENDED") {
    return {
      label: "Paused",
      description: "This domain is paused. Contact support to resume service.",
      tone: "danger",
      stepIndex: 1,
      ready: false,
      technical,
    };
  }

  if (status === "FAILED" || dns === "FAILED") {
    return {
      label: "Needs attention",
      description: "We could not confirm required DNS yet. Check the records and we will keep trying.",
      tone: "danger",
      stepIndex: 2,
      ready: false,
      technical,
    };
  }

  if (ready) {
    const mailboxReady = (input.mailboxCount ?? 0) > 0 || mail === "ACTIVE";
    return {
      label: "Ready",
      description: mailboxReady
        ? "Your domain is ready for professional email."
        : "DNS looks good — create your first mailbox.",
      tone: "success",
      stepIndex: mailboxReady ? 3 : 3,
      ready: true,
      technical,
    };
  }

  if (input.dnsCheckStarted || status === "VERIFYING" || dns === "PARTIAL") {
    const passed = input.requiredPassed;
    const total = input.requiredTotal ?? 3;
    if (typeof passed === "number" && passed > 0 && passed < total) {
      return {
        label: `${passed} of ${total} required records detected`,
        description: input.waitingFor
          ? `Waiting for ${input.waitingFor}`
          : "DNS is propagating. We'll continue checking automatically.",
        tone: "warning",
        stepIndex: 2,
        ready: false,
        technical,
      };
    }
    if (input.waitingFor) {
      return {
        label: `Waiting for ${input.waitingFor}`,
        description: "DNS is propagating. This usually takes a few minutes. No action required.",
        tone: "warning",
        stepIndex: 2,
        ready: false,
        technical,
      };
    }
    return {
      label: "Checking DNS...",
      description:
        "DNS is propagating. This usually takes a few minutes. We'll continue checking automatically. No action required.",
      tone: "warning",
      stepIndex: 2,
      ready: false,
      technical,
    };
  }

  if (mail === "PROVISIONING" && dns === "VERIFIED") {
    return {
      label: "Preparing your mail service...",
      description: "Finalizing mail routing for your domain.",
      tone: "warning",
      stepIndex: 3,
      ready: false,
      technical,
    };
  }

  // Freshly added domain — celebrate connection, never show PENDING/PROVISIONING
  return {
    label: "Domain Connected",
    description: "Add the required DNS records to finish setup.",
    tone: "success",
    stepIndex: 1,
    ready: false,
    technical,
  };
}

export function getOnboardingStepIndex(input: DomainOnboardingInput): number {
  return getFriendlyDomainStatus(input).stepIndex;
}
