/**
 * @jest-environment node
 */
import { createAccessGate, keysMatch, MIN_KEY_LENGTH } from './accessGate';

const KEY = 'k'.repeat(MIN_KEY_LENGTH) + '-secret';

describe('keysMatch', () => {
  it('accepts only the exact key', () => {
    expect(keysMatch(KEY, KEY)).toBe(true);
    expect(keysMatch(KEY + 'x', KEY)).toBe(false);
    expect(keysMatch(KEY.slice(0, -1), KEY)).toBe(false);
    expect(keysMatch('', KEY)).toBe(false);
    expect(keysMatch(null, KEY)).toBe(false);
    expect(keysMatch(undefined, KEY)).toBe(false);
  });
});

describe('createAccessGate', () => {
  const make = (key: string | undefined, maxFailures = 3) =>
    createAccessGate({ getKey: () => key, maxFailures, windowMs: 60_000 });

  it('is disabled (503) when no key is configured, or the key is too weak', () => {
    expect(make(undefined).check('1.1.1.1', KEY)).toMatchObject({ ok: false, status: 503 });
    expect(make('short').check('1.1.1.1', 'short')).toMatchObject({ ok: false, status: 503 });
  });

  it('lets the right key in', () => {
    expect(make(KEY).check('1.1.1.1', KEY)).toEqual({ ok: true });
  });

  it('rejects a wrong or missing key with 401', () => {
    const g = make(KEY);
    expect(g.check('1.1.1.1', 'nope')).toMatchObject({ ok: false, status: 401 });
    expect(g.check('1.1.1.1', null)).toMatchObject({ ok: false, status: 401 });
  });

  it('locks an IP out with 429 after too many wrong guesses, but not other IPs', () => {
    const g = make(KEY, 3);
    for (let i = 0; i < 3; i++) expect(g.check('9.9.9.9', `guess${i}`)).toMatchObject({ status: 401 });
    const locked = g.check('9.9.9.9', 'guess-again');
    expect(locked).toMatchObject({ ok: false, status: 429 });
    expect((locked as any).retryAfterSec).toBeGreaterThan(0);
    expect(g.check('8.8.8.8', 'guess')).toMatchObject({ status: 401 });
  });

  it('never blocks the correct key, even from an IP that has been guessing', () => {
    const g = make(KEY, 2);
    g.check('9.9.9.9', 'a'); g.check('9.9.9.9', 'b'); g.check('9.9.9.9', 'c');
    expect(g.check('9.9.9.9', KEY)).toEqual({ ok: true });
  });
});
