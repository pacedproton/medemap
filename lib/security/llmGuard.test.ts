import { sanitizeLLMRequest, LLMRequestError } from './llmGuard';

const cfg = { model: 'gpt-6.1-sol', maxTokens: 4000, temperature: 0.1 };
const msg = (content: string, role = 'user') => ({ role, content });

describe('sanitizeLLMRequest', () => {
  it('ignores the caller-chosen model and uses the configured one', () => {
    const out = sanitizeLLMRequest({ messages: [msg('hi')], model: 'o1-pro' }, cfg);
    expect(out.model).toBe('gpt-6.1-sol');
  });

  it('clamps maxTokens to the configured ceiling', () => {
    expect(sanitizeLLMRequest({ messages: [msg('hi')], maxTokens: 1_000_000 }, cfg).maxTokens).toBe(4000);
    expect(sanitizeLLMRequest({ messages: [msg('hi')], maxTokens: 50 }, cfg).maxTokens).toBe(50);
    expect(sanitizeLLMRequest({ messages: [msg('hi')] }, cfg).maxTokens).toBe(4000);
  });

  it('never exceeds the hard ceiling even if the config is larger', () => {
    expect(sanitizeLLMRequest({ messages: [msg('hi')], maxTokens: 99999 }, { ...cfg, maxTokens: 99999 }).maxTokens).toBe(4000);
  });

  it('clamps temperature to 0..1 and ignores junk', () => {
    expect(sanitizeLLMRequest({ messages: [msg('hi')], temperature: 9 }, cfg).temperature).toBe(1);
    expect(sanitizeLLMRequest({ messages: [msg('hi')], temperature: -3 }, cfg).temperature).toBe(0);
    expect(sanitizeLLMRequest({ messages: [msg('hi')], temperature: 'x' }, cfg).temperature).toBe(0.1);
  });

  it.each([
    [undefined], [null], ['text'], [[]], [{}],
  ])('rejects messages = %p', (messages) => {
    expect(() => sanitizeLLMRequest({ messages }, cfg)).toThrow(LLMRequestError);
  });

  it('rejects unknown roles and non-string content', () => {
    expect(() => sanitizeLLMRequest({ messages: [msg('x', 'tool')] }, cfg)).toThrow(LLMRequestError);
    expect(() => sanitizeLLMRequest({ messages: [{ role: 'user', content: { a: 1 } }] }, cfg)).toThrow(LLMRequestError);
  });

  it('rejects too many messages and too much text', () => {
    expect(() => sanitizeLLMRequest({ messages: Array.from({ length: 41 }, () => msg('x')) }, cfg)).toThrow(LLMRequestError);
    expect(() => sanitizeLLMRequest({ messages: [msg('x'.repeat(40_001))] }, cfg)).toThrow(LLMRequestError);
  });

  it('passes through a normal conversation unchanged', () => {
    const messages = [msg('be brief', 'system'), msg('hello'), msg('hi there', 'assistant'), msg('why?')];
    expect(sanitizeLLMRequest({ messages }, cfg).messages).toEqual(messages);
  });

  it('keeps only role and content on each message', () => {
    const out = sanitizeLLMRequest({ messages: [{ role: 'user', content: 'a', tool_calls: [1], name: 'x' }] }, cfg);
    expect(out.messages).toEqual([{ role: 'user', content: 'a' }]);
  });
});
