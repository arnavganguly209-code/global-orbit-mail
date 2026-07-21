/**
 * Future VPS / mail-engine integration layer.
 * No Linux commands. No Postfix/Dovecot calls in Phase 2A.
 */

export interface MailEngineProvisionRequest {
  type: "domain" | "mailbox" | "dns" | "ssl";
  payload: Record<string, unknown>;
}

export const mailEngineIntegration = {
  isConnected() {
    return false;
  },
  async provision(_request: MailEngineProvisionRequest) {
    return {
      accepted: false,
      reason: "Mail engine integration is deferred beyond Phase 2A",
    } as const;
  },
};
