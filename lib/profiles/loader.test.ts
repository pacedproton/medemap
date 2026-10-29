/**
 * @jest-environment node
 */
jest.mock('@/lib/auth/server', () => ({ getCurrentUser: jest.fn() }));

import fs from 'fs';
import { loadProfile, isSafeProfileId } from './loader';

describe('isSafeProfileId', () => {
  it.each(['democracy-focus', 'full-access', 'a', 'Media_Freedom2'])('accepts %s', (id) => {
    expect(isSafeProfileId(id)).toBe(true);
  });

  it.each([
    '', '.', '..', '../x', '../../public/medemap-llm', 'a/b', 'a\\b', '/etc/passwd',
    '%2e%2e%2fx', 'a.b', '.hidden', 'a b', 'a\u0000b', '-lead', 'x'.repeat(65), 'a\nb',
  ])('rejects %j', (id) => {
    expect(isSafeProfileId(id)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isSafeProfileId(undefined as any)).toBe(false);
    expect(isSafeProfileId(['a'] as any)).toBe(false);
  });
});

describe('loadProfile', () => {
  it('still loads a real profile', () => {
    const p = loadProfile('democracy-focus');
    expect(p?.profile.id).toBe('democracy-focus');
  });

  it('returns null for a traversal id without touching the filesystem', () => {
    const exists = jest.spyOn(fs, 'existsSync');
    const read = jest.spyOn(fs, 'readFileSync');
    exists.mockClear();
    read.mockClear();
    expect(loadProfile('../../public/medemap-llm')).toBeNull();
    expect(loadProfile('../app/config')).toBeNull();
    expect(exists).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    exists.mockRestore();
    read.mockRestore();
  });

  it('does not cache attacker-chosen ids', () => {
    expect(loadProfile('no-such-profile-xyz')).toBeNull();
    expect(loadProfile('no-such-profile-xyz')).toBeNull();
  });
});
