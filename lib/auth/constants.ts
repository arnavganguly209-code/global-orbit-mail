/**
 * GLOBAL ORBIT MAIL — Auth security constants (Phase 3A)
 */

export const SESSION_COOKIE = "go_mail_session";
/** Double-submit CSRF token cookie (readable by client for future form posts). */
export const CSRF_COOKIE = "go_csrf";

export const SESSION_TTL_HOURS = 12;
export const REMEMBER_TTL_DAYS = 30;

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const IP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const IP_RATE_LIMIT_MAX = 20;
export const EMAIL_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_RATE_LIMIT_MAX = 10;
