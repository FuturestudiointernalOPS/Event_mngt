import type { RateLimitOptions } from './rate-limit.decorator';

/**
 * Production rate-limit budgets, grouped by surface (R11).
 *
 * Keeping the numbers here makes traffic policy reviewable in one place instead of
 * scattered through controllers. Sensitive actions are keyed by account where a session
 * exists, so one office behind a shared address cannot exhaust another person's budget.
 */
export const RATE_LIMIT_BUDGETS = {
  auth: {
    /** Account creation is rare and triggers verification e-mail. */
    register: [
      { bucket: 'auth-register', key: 'ip', limit: 5, windowSeconds: 600 },
    ],
    verifyEmail: [
      { bucket: 'auth-verify', key: 'ip', limit: 20, windowSeconds: 600 },
    ],
    login: [
      // A generous address budget for shared networks; the account budget does the
      // real brute-force work.
      { bucket: 'auth-login-ip', key: 'ip', limit: 60, windowSeconds: 60 },
      { bucket: 'auth-login-email', key: 'email', limit: 10, windowSeconds: 300 },
    ],
    refresh: [
      { bucket: 'auth-refresh', key: 'ip', limit: 300, windowSeconds: 60 },
    ],
    forgotPassword: [
      { bucket: 'auth-forgot-ip', key: 'ip', limit: 10, windowSeconds: 900 },
      { bucket: 'auth-forgot-email', key: 'email', limit: 3, windowSeconds: 900 },
    ],
    resetPassword: [
      { bucket: 'auth-reset', key: 'ip', limit: 10, windowSeconds: 900 },
    ],
    mfaSetup: [
      { bucket: 'mfa-setup', key: 'user', limit: 10, windowSeconds: 300 },
    ],
    mfaEnable: [
      { bucket: 'mfa-enable', key: 'user', limit: 10, windowSeconds: 300 },
    ],
    mfaDisable: [
      { bucket: 'mfa-disable', key: 'user', limit: 10, windowSeconds: 300 },
    ],
  },
  workspace: {
    /** Workspace creation is unusual; per-account rather than per-address. */
    onboarding: [
      { bucket: 'onboarding-create', key: 'user', limit: 5, windowSeconds: 3600 },
    ],
    /** Each invitation sends mail, so this is also the bulk-mail brake. */
    invite: [
      { bucket: 'member-invite', key: 'user', limit: 50, windowSeconds: 3600 },
    ],
    /** Exports are expensive, queued, and can be large. */
    reportExport: [
      { bucket: 'report-export', key: 'user', limit: 30, windowSeconds: 3600 },
    ],
  },
  public: {
    /** Launch traffic can burst; this still stops scripted floods. */
    registration: [
      { bucket: 'public-registration', key: 'ip', limit: 120, windowSeconds: 60 },
    ],
  },
  operations: {
    /** Event staff behind one venue network need per-account and per-address room. */
    checkInSync: [
      { bucket: 'checkin-sync-user', key: 'user', limit: 120, windowSeconds: 60 },
      { bucket: 'checkin-sync-ip', key: 'ip', limit: 600, windowSeconds: 60 },
    ],
  },
} as const satisfies Record<string, Record<string, readonly RateLimitOptions[]>>;
