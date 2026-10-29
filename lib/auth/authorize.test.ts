/**
 * @jest-environment node
 */
import { authorizeCredentials, type AuthUser } from './authorize';
import { createLoginGuard } from '../security/loginGuard';

const user: AuthUser = { id: 'u1', email: 'ada@example.org', password_hash: 'HASH-OF-correct', role: 'researcher', allowed_profiles: ['p1'] };

const make = () => {
  const compare = jest.fn(async (pw: string, hash: string) => hash === `HASH-OF-${pw}`);
  const findUser = jest.fn(async (email: string) => (email === user.email ? user : undefined));
  const guard = createLoginGuard({ maxPerEmail: 3, maxPerIp: 50, windowMs: 60_000 });
  return { compare, findUser, guard, dummyHash: 'DUMMY', deps: { compare, findUser, guard, dummyHash: 'DUMMY' } };
};

describe('authorizeCredentials', () => {
  it('signs in with the right password and returns the session fields', async () => {
    const { deps } = make();
    expect(await authorizeCredentials({ email: 'ada@example.org', password: 'correct' }, '1.1.1.1', deps)).toEqual({
      id: 'u1', email: 'ada@example.org', name: 'ada@example.org', role: 'researcher', allowedProfiles: ['p1'],
    });
  });

  it('finds the account whatever the case or look-alike characters in the email', async () => {
    const { deps } = make();
    expect(await authorizeCredentials({ email: ' ADA＠example.org ', password: 'correct' }, '1.1.1.1', deps)).not.toBeNull();
  });

  it('rejects a wrong password', async () => {
    const { deps } = make();
    expect(await authorizeCredentials({ email: 'ada@example.org', password: 'nope' }, '1.1.1.1', deps)).toBeNull();
  });

  it('spends the same password check on an unknown account (no timing leak)', async () => {
    const { deps, compare } = make();
    expect(await authorizeCredentials({ email: 'ghost@example.org', password: 'whatever' }, '1.1.1.1', deps)).toBeNull();
    expect(compare).toHaveBeenCalledWith('whatever', 'DUMMY');
  });

  it('locks the account after repeated failures, even for the right password', async () => {
    const { deps, findUser } = make();
    for (let i = 0; i < 3; i++) await authorizeCredentials({ email: 'ada@example.org', password: `bad${i}` }, `2.2.2.${i}`, deps);
    findUser.mockClear();
    expect(await authorizeCredentials({ email: 'ada@example.org', password: 'correct' }, '3.3.3.3', deps)).toBeNull();
    expect(findUser).not.toHaveBeenCalled();
  });

  it('a success clears the failure count', async () => {
    const { deps } = make();
    await authorizeCredentials({ email: 'ada@example.org', password: 'bad' }, '1.1.1.1', deps);
    await authorizeCredentials({ email: 'ada@example.org', password: 'bad' }, '1.1.1.1', deps);
    expect(await authorizeCredentials({ email: 'ada@example.org', password: 'correct' }, '1.1.1.1', deps)).not.toBeNull();
    await authorizeCredentials({ email: 'ada@example.org', password: 'bad' }, '1.1.1.1', deps);
    expect(await authorizeCredentials({ email: 'ada@example.org', password: 'correct' }, '1.1.1.1', deps)).not.toBeNull();
  });

  it.each([
    [{}], [{ email: 'ada@example.org' }], [{ password: 'x' }], [{ email: ['a@x.org'], password: 'x' }],
    [{ email: 'ada@example.org', password: 'x'.repeat(1000) }], [{ email: 'a'.repeat(400) + '@x.org', password: 'x' }],
  ])('rejects malformed input %#', async (creds) => {
    const { deps, findUser } = make();
    expect(await authorizeCredentials(creds as any, '1.1.1.1', deps)).toBeNull();
    expect(findUser).not.toHaveBeenCalled();
  });
});
