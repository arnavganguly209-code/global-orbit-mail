/**
 * Lightweight sliding-window rate limit for admin APIs (in-process).
 * Production multi-instance deployments should front this with Nginx/Redis;
 * this still protects a single Node/PM2 worker from burst abuse.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export async function assertApiRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= max) {
    throw new Error("Too many requests. Please wait and try again.");
  }
  current.count += 1;
}
