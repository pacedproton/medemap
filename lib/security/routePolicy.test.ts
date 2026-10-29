/**
 * @jest-environment node
 */
import { accessFor } from './routePolicy';

describe('accessFor', () => {
  it.each([
    ['/', 'public'],
    ['/login', 'public'],
    ['/verify', 'public'],
    ['/view_table', 'public'],
    ['/api/medemap', 'public'],
    ['/api/auth/signin', 'public'],
    ['/api/health', 'public'],
    ['/api/llm', 'public'], // gated by the access key inside the route, not by a login session
  ])('%s is %s', (p, want) => expect(accessFor(p)).toBe(want));

  it.each([
    '/admin', '/admin/', '/admin/users',
  ])('%s needs admin', (p) => expect(accessFor(p)).toBe('admin'));

  it.each([
    '/api/profiles', '/profile', '/profile/settings',
  ])('%s needs a session', (p) => expect(accessFor(p)).toBe('auth'));

  it('does not let a "/" public entry swallow every path (regression)', () => {
    expect(accessFor('/admin')).not.toBe('public');
    expect(accessFor('/api/profiles')).not.toBe('public');
  });

  it('is not fooled by slashes or percent-encoding', () => {
    expect(accessFor('//api//profiles')).toBe('auth');
    expect(accessFor('/%61pi/profiles')).toBe('auth');
    expect(accessFor('/%61dmin')).toBe('admin');
    expect(accessFor('/api/profiles/../profiles')).toBe('auth');
  });

  it('matches on path segments, not string prefixes', () => {
    expect(accessFor('/api/profilesx')).toBe('public');
    expect(accessFor('/administrator')).toBe('public');
  });
});
