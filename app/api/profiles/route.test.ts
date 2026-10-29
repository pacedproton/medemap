/**
 * @jest-environment node
 */
const mockAccessible = jest.fn();
jest.mock('@/lib/profiles/loader', () => ({ getAccessibleProfiles: () => mockAccessible() }));
jest.mock('../../../lib/logging/serverLogger', () => ({
  serverLogger: { info: jest.fn(), error: jest.fn(), warning: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { GET } from './route';

describe('GET /api/profiles', () => {
  it('lists the profiles the loader returns', async () => {
    mockAccessible.mockResolvedValue([{ profile: { id: 'p', name: 'P', description: 'd', icon: 'i', color: 'c', public: true, metadata: { tags: ['t'] } } }]);
    const body = await (await GET()).json();
    expect(body.count).toBe(1);
    expect(body.profiles[0]).toMatchObject({ id: 'p', name: 'P', public: true });
  });

  it('does not leak the internal error message when loading fails', async () => {
    mockAccessible.mockRejectedValue(new Error("ENOENT: no such file '/app/config/profiles/secret.yaml'"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ENOENT|\/app\/|secret\.yaml/);
  });
});
