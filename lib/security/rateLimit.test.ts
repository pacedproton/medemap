import { createRateLimiter } from './rateLimit';

describe('createRateLimiter', () => {
  it('allows up to the limit, then blocks with a retry time', () => {
    let t = 1000;
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect(rl.check('a').ok).toBe(true);
    expect(rl.check('a').ok).toBe(true);
    expect(rl.check('a').ok).toBe(true);
    const blocked = rl.check('a');
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it('keeps keys independent and resets after the window', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    expect(rl.check('a').ok).toBe(true);
    expect(rl.check('b').ok).toBe(true);
    expect(rl.check('a').ok).toBe(false);
    t = 1001;
    expect(rl.check('a').ok).toBe(true);
  });

  it('does not grow without bound', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 10, maxKeys: 100, now: () => t });
    for (let i = 0; i < 500; i++) { t += 20; rl.check(`k${i}`); }
    expect(rl.size()).toBeLessThanOrEqual(100);
  });
});
