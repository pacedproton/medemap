export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/** Fixed-window limiter held in memory; fine for a single replica. */
export function createRateLimiter({ limit, windowMs, maxKeys = 10_000, now = Date.now }: RateLimiterOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  function prune(t: number) {
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    // still full of live keys: drop the oldest so memory stays bounded
    while (hits.size >= maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const cur = hits.get(key);
      if (!cur || cur.resetAt <= t) {
        if (!cur && hits.size >= maxKeys) prune(t);
        hits.set(key, { count: 1, resetAt: t + windowMs });
        return { ok: true, retryAfterSec: 0 };
      }
      if (cur.count < limit) {
        cur.count += 1;
        return { ok: true, retryAfterSec: 0 };
      }
      return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - t) / 1000) };
    },
    size: () => hits.size,
  };
}
