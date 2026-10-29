export const normalizeEmail = (raw: string): string => raw.normalize('NFKC').trim().toLowerCase();

interface Entry { count: number; resetAt: number }

interface LoginGuardOptions {
  maxPerEmail?: number;
  maxPerIp?: number;
  windowMs?: number;
  maxKeys?: number;
  now?: () => number;
}

/**
 * Counts failed sign-ins per account and per address. An account locks after a few failures
 * from anywhere, and an address that tries many accounts locks too. Memory only: one replica.
 */
export function createLoginGuard({
  maxPerEmail = 5,
  maxPerIp = 30,
  windowMs = 15 * 60_000,
  maxKeys = 10_000,
  now = Date.now,
}: LoginGuardOptions = {}) {
  const emails = new Map<string, Entry>();
  const ips = new Map<string, Entry>();

  const live = (m: Map<string, Entry>, key: string, t: number) => {
    const e = m.get(key);
    return e && e.resetAt > t ? e : undefined;
  };

  function prune(m: Map<string, Entry>, t: number) {
    for (const [k, v] of m) if (v.resetAt <= t) m.delete(k);
    while (m.size >= maxKeys) {
      const oldest = m.keys().next().value;
      if (oldest === undefined) break;
      m.delete(oldest);
    }
  }

  function bump(m: Map<string, Entry>, key: string, t: number) {
    const e = live(m, key, t);
    if (e) { e.count += 1; return; }
    if (m.size >= maxKeys) prune(m, t);
    m.set(key, { count: 1, resetAt: t + windowMs });
  }

  return {
    isLocked(email: string, ip: string): { locked: boolean; retryAfterSec: number } {
      const t = now();
      const byEmail = live(emails, email, t);
      const byIp = live(ips, ip, t);
      const hit = [
        byEmail && byEmail.count >= maxPerEmail ? byEmail : undefined,
        byIp && byIp.count >= maxPerIp ? byIp : undefined,
      ].filter((e): e is Entry => !!e);
      if (!hit.length) return { locked: false, retryAfterSec: 0 };
      const until = Math.max(...hit.map((e) => e.resetAt));
      return { locked: true, retryAfterSec: Math.max(1, Math.ceil((until - t) / 1000)) };
    },
    recordFailure(email: string, ip: string) {
      const t = now();
      bump(emails, email, t);
      bump(ips, ip, t);
    },
    recordSuccess(email: string) {
      emails.delete(email);
    },
    size: () => emails.size + ips.size,
  };
}

export type LoginGuard = ReturnType<typeof createLoginGuard>;
