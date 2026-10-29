/**
 * @jest-environment node
 */
import { GET } from './route';

const call = (auth?: string) =>
  GET(new Request('http://localhost/api/metrics', { headers: auth ? { authorization: auth } : {} }));

describe('/api/metrics', () => {
  const saved = process.env.METRICS_TOKEN;
  afterEach(() => { process.env.METRICS_TOKEN = saved; if (saved === undefined) delete process.env.METRICS_TOKEN; });

  it('is disabled (404) when no METRICS_TOKEN is configured', async () => {
    delete process.env.METRICS_TOKEN;
    expect((await call()).status).toBe(404);
    expect((await call('Bearer anything')).status).toBe(404);
  });

  it('rejects a missing or wrong token with 401', async () => {
    process.env.METRICS_TOKEN = 's3cret-token';
    expect((await call()).status).toBe(401);
    expect((await call('Bearer nope')).status).toBe(401);
    expect((await call('s3cret-token')).status).toBe(401);
  });

  it('serves metrics with the right token', async () => {
    process.env.METRICS_TOKEN = 's3cret-token';
    const res = await call('Bearer s3cret-token');
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/process_cpu|nodejs_/);
  });
});
