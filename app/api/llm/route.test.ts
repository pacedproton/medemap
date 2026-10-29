/**
 * @jest-environment node
 */
jest.mock('@/lib/logging/serverLogger', () => ({
  serverLogger: { info: jest.fn(), error: jest.fn(), warning: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { POST, GET } from './route';

const KEY = 'shared-access-key-for-tests-1234';
const fetchMock = jest.fn();
let ipCounter = 0;
const nextIp = () => `10.1.0.${++ipCounter}`;

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('http://localhost/api/llm', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': nextIp(), ...headers },
    body: JSON.stringify(body),
  }) as any);

const ok = { messages: [{ role: 'user', content: 'hello' }], provider: 'openai' };
const withKey = { 'x-ai-access-key': KEY };

beforeEach(() => {
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
  process.env.OPENAI_API_KEY = 'sk-test-0123456789';
  process.env.AI_ACCESS_KEY = KEY;
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'hi' } }], model: 'gpt-6.1-sol', usage: {} }),
    text: async () => '',
  });
});

describe('POST /api/llm access key', () => {
  it('refuses a request without the key and never contacts the model provider', async () => {
    const res = await post(ok);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a wrong key', async () => {
    const res = await post(ok, { 'x-ai-access-key': 'guess' });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is switched off (503) when no AI_ACCESS_KEY is configured', async () => {
    delete process.env.AI_ACCESS_KEY;
    expect((await post(ok, withKey)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('locks an IP out after ten wrong keys', async () => {
    const ip = { 'cf-connecting-ip': '172.16.0.99' };
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (await POST(new Request('http://localhost/api/llm', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-ai-access-key': `g${i}`, ...ip }, body: JSON.stringify(ok),
      }) as any)).status;
    }
    expect(last).toBe(429);
  });

  it('serves a caller with the right key', async () => {
    const res = await post(ok, withKey);
    expect(res.status).toBe(200);
    expect((await res.json()).content).toBe('hi');
  });
});

describe('POST /api/llm request limits', () => {
  it('uses the configured model and clamps tokens, whatever the caller asks for', async () => {
    const res = await post({ ...ok, model: 'o1-pro', maxTokens: 1_000_000, temperature: 50 }, withKey);
    expect(res.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.model).toBe('gpt-6.1-sol');
    expect(sent.max_completion_tokens ?? sent.max_tokens).toBeLessThanOrEqual(4000);
  });

  it('sends the newer-model token parameter and no custom temperature', async () => {
    await post(ok, withKey);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.max_completion_tokens).toBeDefined();
    expect(sent.max_tokens).toBeUndefined();
    expect(sent.temperature).toBeUndefined();
  });

  it('returns 400 for a malformed conversation without calling out', async () => {
    const res = await post({ provider: 'openai', messages: [{ role: 'root', content: 'x' }] }, withKey);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized body with 413', async () => {
    expect((await post(ok, { ...withKey, 'content-length': '999999' })).status).toBe(413);
  });

  it('does not leak upstream error text (which can contain key fragments)', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 401, json: async () => ({}),
      text: async () => 'Incorrect API key provided: sk-test-0123...6789',
    });
    const res = await post(ok, withKey);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/sk-test|API key/);
  });

  it('rate limits one address after 20 calls a minute', async () => {
    const same = { ...withKey, 'cf-connecting-ip': '192.0.2.77' };
    let last = 200;
    for (let i = 0; i < 25; i++) {
      last = (await POST(new Request('http://localhost/api/llm', {
        method: 'POST', headers: { 'content-type': 'application/json', ...same }, body: JSON.stringify(ok),
      }) as any)).status;
    }
    expect(last).toBe(429);
  });
});

describe('GET /api/llm status', () => {
  it('exposes only provider, model and connected, never URLs, model lists or error text', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [{ id: 'gpt-6.1-sol' }, { id: 'secret-fine-tune' }] }),
      text: async () => '',
    });
    const res = await GET();
    const body = await res.json();
    expect(Object.keys(body.primary).sort()).toEqual(['connected', 'model', 'provider']);
    expect(body.primary.model).toBe('gpt-6.1-sol');
    expect(JSON.stringify(body)).not.toMatch(/secret-fine-tune|https?:\/\//);
  });
});
