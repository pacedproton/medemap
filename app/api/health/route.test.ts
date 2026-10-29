/**
 * @jest-environment node
 */
import { GET } from './route';

const mockQuery = jest.fn();
jest.mock('../../../lib/server-reldb', () => ({
  __esModule: true,
  default: () => ({ query: mockQuery }),
}));

const probe = (name?: string) =>
  GET(new Request(`http://localhost/api/health${name ? `?probe=${name}` : ''}`));

describe('/api/health', () => {
  beforeEach(() => mockQuery.mockReset());

  it('readiness is 200 when the database answers a query', async () => {
    mockQuery.mockResolvedValue({ rows: [{ ok: 1 }] });
    const res = await probe('readiness');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ready' });
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
  });

  it('readiness is 503 when the database is unreachable', async () => {
    mockQuery.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await probe('readiness');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'not ready', message: 'connect ECONNREFUSED' });
  });

  it('liveness and startup do not touch the database', async () => {
    expect((await probe('liveness')).status).toBe(200);
    expect((await probe('startup')).status).toBe(200);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects an unknown probe', async () => {
    expect((await probe('bogus')).status).toBe(400);
  });
});
