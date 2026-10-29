import { createLoginGuard, normalizeEmail } from './loginGuard';

describe('normalizeEmail', () => {
  it('lower-cases, trims and folds look-alike characters', () => {
    expect(normalizeEmail('  Ada@Example.ORG ')).toBe('ada@example.org');
    expect(normalizeEmail('ada＠example.org')).toBe('ada@example.org'); // fullwidth @
    expect(normalizeEmail('Ａda@example.org')).toBe('ada@example.org'); // fullwidth A
  });
});

describe('createLoginGuard', () => {
  const make = (t = { now: 0 }) => ({ t, g: createLoginGuard({ maxPerEmail: 3, maxPerIp: 5, windowMs: 1000, now: () => t.now }) });

  it('locks an account after too many failures, from any address', () => {
    const { g } = make();
    for (let i = 0; i < 3; i++) g.recordFailure('a@x.org', `1.1.1.${i}`);
    expect(g.isLocked('a@x.org', '9.9.9.9').locked).toBe(true);
    expect(g.isLocked('b@x.org', '9.9.9.9').locked).toBe(false);
  });

  it('locks an address that sprays many different accounts', () => {
    const { g } = make();
    for (let i = 0; i < 5; i++) g.recordFailure(`u${i}@x.org`, '6.6.6.6');
    expect(g.isLocked('fresh@x.org', '6.6.6.6').locked).toBe(true);
    expect(g.isLocked('fresh@x.org', '7.7.7.7').locked).toBe(false);
  });

  it('forgets after the window and on success', () => {
    const { g, t } = make();
    for (let i = 0; i < 3; i++) g.recordFailure('a@x.org', '1.1.1.1');
    expect(g.isLocked('a@x.org', '1.1.1.1').locked).toBe(true);
    t.now = 1001;
    expect(g.isLocked('a@x.org', '1.1.1.1').locked).toBe(false);
    g.recordFailure('a@x.org', '1.1.1.1'); g.recordFailure('a@x.org', '1.1.1.1');
    g.recordSuccess('a@x.org');
    g.recordFailure('a@x.org', '1.1.1.1');
    expect(g.isLocked('a@x.org', '1.1.1.1').locked).toBe(false);
  });

  it('reports how long to wait', () => {
    const { g } = make();
    for (let i = 0; i < 3; i++) g.recordFailure('a@x.org', '1.1.1.1');
    expect(g.isLocked('a@x.org', '1.1.1.1').retryAfterSec).toBe(1);
  });

  it('keeps memory bounded', () => {
    const t = { now: 0 };
    const g = createLoginGuard({ maxPerEmail: 3, maxPerIp: 5, windowMs: 10, maxKeys: 50, now: () => t.now });
    for (let i = 0; i < 400; i++) { t.now += 20; g.recordFailure(`u${i}@x.org`, `10.0.${i % 250}.1`); }
    expect(g.size()).toBeLessThanOrEqual(100);
  });
});
