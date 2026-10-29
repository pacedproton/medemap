/**
 * @jest-environment node
 */
import { GET } from './route';

const KEY = 'shared-access-key-for-tests-1234';
let n = 0;
const get = (key?: string) =>
  GET(new Request('http://localhost/api/llm/access', {
    headers: { 'cf-connecting-ip': `10.2.0.${++n}`, ...(key ? { 'x-ai-access-key': key } : {}) },
  }) as any);

describe('GET /api/llm/access', () => {
  beforeEach(() => { process.env.AI_ACCESS_KEY = KEY; });

  it('confirms a valid key', async () => {
    const res = await get(KEY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it('rejects a wrong or missing key', async () => {
    expect((await get('nope')).status).toBe(401);
    expect((await get()).status).toBe(401);
  });
  it('is 503 when access is not configured', async () => {
    delete process.env.AI_ACCESS_KEY;
    expect((await get(KEY)).status).toBe(503);
  });
});
