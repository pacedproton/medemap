import { createHash, timingSafeEqual } from 'crypto';
import { createRateLimiter } from './rateLimit';

/** Shorter keys are refused outright: a shared secret that guessable is no gate. */
export const MIN_KEY_LENGTH = 16;

export type GateResult =
  | { ok: true }
  | { ok: false; status: 401 | 429 | 503; error: string; retryAfterSec?: number };

/** Constant-time comparison; hashing first hides the key length too. */
export function keysMatch(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

interface GateOptions {
  getKey: () => string | undefined;
  maxFailures?: number;
  windowMs?: number;
}

/**
 * One shared access key for the AI assistant, taken from the runtime environment.
 * Wrong guesses are counted per IP; past the limit that IP gets 429 (the right key still works).
 */
export function createAccessGate({ getKey, maxFailures = 10, windowMs = 15 * 60_000 }: GateOptions) {
  const failures = createRateLimiter({ limit: maxFailures, windowMs });

  return {
    check(ip: string, provided: string | null | undefined): GateResult {
      const key = getKey();
      if (!key || key.length < MIN_KEY_LENGTH) {
        return { ok: false, status: 503, error: 'AI access is not configured' };
      }
      if (keysMatch(provided, key)) return { ok: true };

      const f = failures.check(ip);
      if (!f.ok) {
        return { ok: false, status: 429, error: 'Too many wrong keys, try again later', retryAfterSec: f.retryAfterSec };
      }
      return { ok: false, status: 401, error: 'Invalid or missing access key' };
    },
  };
}

export const aiAccessGate = createAccessGate({ getKey: () => process.env.AI_ACCESS_KEY });

export const ACCESS_KEY_HEADER = 'x-ai-access-key';

/** Caller address as seen through the Cloudflare tunnel. */
export function clientIp(headers: Headers): string {
  return headers.get('cf-connecting-ip') || headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}
