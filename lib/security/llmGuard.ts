export class LLMRequestError extends Error {}

export const LLM_LIMITS = {
  maxMessages: 40,
  maxChars: 40_000,
  maxTokens: 4000,
};

const ROLES = new Set(['system', 'user', 'assistant']);

export interface LLMProviderLimits {
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SanitizedLLMRequest {
  messages: { role: string; content: string }[];
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Anything the caller sends that costs money is decided here: the model always
 * comes from server config, token and size limits are enforced, and only
 * role/content survive on each message.
 */
export function sanitizeLLMRequest(body: any, provider: LLMProviderLimits): SanitizedLLMRequest {
  const raw = body?.messages;
  if (!Array.isArray(raw) || raw.length === 0) throw new LLMRequestError('messages must be a non-empty array');
  if (raw.length > LLM_LIMITS.maxMessages) throw new LLMRequestError('too many messages');

  let chars = 0;
  const messages = raw.map((m: any) => {
    if (!m || typeof m.content !== 'string' || !ROLES.has(m.role)) {
      throw new LLMRequestError('invalid message');
    }
    chars += m.content.length;
    if (chars > LLM_LIMITS.maxChars) throw new LLMRequestError('conversation too long');
    return { role: m.role as string, content: m.content as string };
  });

  const ceiling = Math.min(provider.maxTokens ?? LLM_LIMITS.maxTokens, LLM_LIMITS.maxTokens);
  const asked = Number(body?.maxTokens);
  const maxTokens = Number.isFinite(asked) && asked > 0 ? Math.min(Math.floor(asked), ceiling) : ceiling;

  const t = body?.temperature;
  const defaultTemp = provider.temperature ?? 0.1;
  const temperature = typeof t === 'number' && Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : defaultTemp;

  return { messages, model: provider.model, temperature, maxTokens };
}
