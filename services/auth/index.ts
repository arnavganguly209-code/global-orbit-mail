/**
 * Auth service stubs — NextAuth wiring in a later phase.
 */

export const authService = {
  /**
   * Reserved for credentials / SSO sign-in.
   */
  async signIn() {
    throw new Error("Authentication is not enabled in Phase 1.");
  },
  /**
   * Reserved for session termination.
   */
  async signOut() {
    throw new Error("Authentication is not enabled in Phase 1.");
  },
} as const;
