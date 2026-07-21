"use client";

import * as React from "react";

/** Poll intervals after "I've Added DNS": 30s, 60s, 120s, 300s (then keep 300s). */
export const DNS_VERIFY_POLL_MS = [30_000, 60_000, 120_000, 300_000] as const;

export type AutoVerifyReport = {
  domainId: string;
  domain: string;
  overall: string;
  checkedAt: string;
  ready: boolean;
  requiredPassed: number;
  requiredTotal: number;
  waitingFor: string | null;
  mx?: { ok: boolean; label: string };
  spf?: { ok: boolean; label: string };
  mailA?: { ok: boolean; label: string };
};

type Options = {
  domainId: string | null;
  enabled: boolean;
  verify: (domainId: string) => Promise<AutoVerifyReport>;
  onReport?: (report: AutoVerifyReport) => void;
  onReady?: (report: AutoVerifyReport) => void;
};

export function useDnsAutoVerify({
  domainId,
  enabled,
  verify,
  onReport,
  onReady,
}: Options) {
  const [checking, setChecking] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [lastReport, setLastReport] = React.useState<AutoVerifyReport | null>(null);
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const timeoutIds = React.useRef<number[]>([]);
  const intervalId = React.useRef<number | null>(null);
  const verifyRef = React.useRef(verify);
  const onReportRef = React.useRef(onReport);
  const onReadyRef = React.useRef(onReady);

  React.useEffect(() => {
    verifyRef.current = verify;
    onReportRef.current = onReport;
    onReadyRef.current = onReady;
  });

  const clearTimers = React.useCallback(() => {
    for (const id of timeoutIds.current) window.clearTimeout(id);
    timeoutIds.current = [];
    if (intervalId.current != null) {
      window.clearInterval(intervalId.current);
      intervalId.current = null;
    }
  }, []);

  const runCheck = React.useCallback(
    async (attemptIndex: number) => {
      if (!domainId) return false;
      setChecking(true);
      setAttempt(attemptIndex + 1);
      try {
        const report = await verifyRef.current(domainId);
        setLastReport(report);
        onReportRef.current?.(report);
        if (report.ready || report.overall === "VERIFIED") {
          clearTimers();
          onReadyRef.current?.(report);
          return true;
        }
      } catch {
        // Keep polling — propagation / transient DNS failures are expected
      } finally {
        setChecking(false);
      }
      return false;
    },
    [clearTimers, domainId],
  );

  const start = React.useCallback(async () => {
    if (!domainId) return;
    clearTimers();
    setStartedAt(Date.now());
    setAttempt(0);
    const done = await runCheck(0);
    if (done) return;

    DNS_VERIFY_POLL_MS.forEach((delay, index) => {
      const id = window.setTimeout(() => {
        void runCheck(index + 1).then((ready) => {
          if (ready) return;
          if (index === DNS_VERIFY_POLL_MS.length - 1 && intervalId.current == null) {
            intervalId.current = window.setInterval(() => {
              void runCheck(index + 2);
            }, 300_000);
          }
        });
      }, delay);
      timeoutIds.current.push(id);
    });
  }, [clearTimers, domainId, runCheck]);

  const stop = React.useCallback(() => {
    clearTimers();
    setStartedAt(null);
  }, [clearTimers]);

  React.useEffect(() => {
    if (!enabled || !domainId) {
      stop();
      return;
    }
    void start();
    return () => stop();
  }, [enabled, domainId, start, stop]);

  return {
    checking,
    attempt,
    lastReport,
    startedAt,
    start,
    stop,
    runNow: () => runCheck(attempt),
  };
}
