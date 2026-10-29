/**
 * Ollama LLM Provider
 *
 * Implements the LLMProvider interface for local Ollama models
 */

import { aiHeaders } from '../../../ai/accessKey';
import { LLMProvider, LLMConfig, LLMMessage, LLMResponse, LLMConnectionError } from '../types';
import { ViewContext, AIFunctionCall } from '../../ollamaService';
import { PromptBuilder } from '../utils/PromptBuilder';

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;
  readonly supportsVision = false;

  private config: LLMConfig | null = null;
  private promptBuilder = new PromptBuilder();

  async initialize(config: LLMConfig): Promise<void> {
    // Use config values directly, with defaults only as fallback
    this.config = {
      // Start with config values, then apply defaults for missing properties
      provider: config.provider || 'ollama',
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.model || 'gemma3:27b',
      temperature: config.temperature ?? 0.1,
      maxTokens: config.maxTokens ?? 4000,
      timeout: config.timeout ?? 30000,
    };

    console.log('Ollama provider initialized with timeout:', this.config.timeout);

    // Test connection
    try {
      await this.isAvailable();
    } catch (error) {
      throw new LLMConnectionError(this.name, `Failed to connect to Ollama: ${(error as Error).message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config) return false;

    try {
      // Use server-side API endpoint if running in browser
      const isClient = typeof window !== 'undefined';

      if (isClient) {
        // Check via server API endpoint
        const response = await fetch('/api/llm', {
          method: 'GET'
        });
        if (response.ok) {
          const data = await response.json();
          return data.primary?.connected || false;
        }
        return false;
      }

      // Direct connection (for server-side or development)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Availability check timed out')), 5000);
      });

      const fetchPromise = fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET'
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      return response.ok;
    } catch (error) {
      console.warn('Ollama availability check failed:', error);
      return false;
    }
  }

  async parseQuery(query: string, context: ViewContext): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const { messages, functions } = this.promptBuilder.buildPrompt(query, context);
    const isClient = typeof window !== 'undefined';

    // Use server-side API endpoint if running in browser
    if (isClient) {
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: aiHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          provider: 'ollama',
          messages,
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`Server API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract function calls from response
      const functionCalls = this.promptBuilder.extractFunctionCalls(data.content);

      return {
        content: data.content,
        functionCalls,
        model: data.model,
        finishReason: 'stop',
        usage: data.usage
      };
    }

    // Direct connection (for server-side or development)
    const timeoutMs = this.config.timeout || 30000;
    console.log('Ollama parseQuery using timeout:', timeoutMs);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Ollama request timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      const fetchPromise = fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: this.buildOllamaPrompt(messages),
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          }
        })
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return this.parseOllamaResponse(result.response);
    } catch (error) {
      console.error('Ollama provider error:', error);
      throw error;
    }
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const prompt = this.buildOllamaPrompt(messages);

    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: result.response,
      finishReason: 'stop',
      model: this.config.model
    };
  }

  async *streamComplete(messages: LLMMessage[]): AsyncGenerator<Partial<LLMResponse>, LLMResponse, unknown> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const prompt = this.buildOllamaPrompt(messages);

    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: true,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullContent += json.response;
              yield { content: json.response };
            }
            if (json.done) {
              return {
                content: fullContent,
                finishReason: 'stop',
                model: this.config.model
              };
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content: fullContent,
      finishReason: 'stop',
      model: this.config.model
    };
  }

  async getStatus(): Promise<{
    connected: boolean;
    model: string;
    version?: string;
    latency?: number;
    error?: string;
  }> {
    if (!this.config) {
      return { connected: false, model: 'none', error: 'Not initialized' };
    }

    try {
      const start = Date.now();
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      const latency = Date.now() - start;

      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        const currentModel = models.find((m: any) => m.name === this.config!.model);

        return {
          connected: true,
          model: this.config.model,
          latency,
          version: currentModel?.details?.parameter_size || 'unknown'
        };
      } else {
        return {
          connected: false,
          model: this.config.model,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        connected: false,
        model: this.config.model,
        error: (error as Error).message
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private buildOllamaPrompt(messages: LLMMessage[]): string {
    return messages.map(msg => {
      if (msg.role === 'system') {
        return `System: ${msg.content}`;
      } else if (msg.role === 'user') {
        return `User: ${msg.content}`;
      } else if (msg.role === 'assistant') {
        return `Assistant: ${msg.content}`;
      }
      return msg.content;
    }).join('\n\n');
  }

  private parseOllamaResponse(response: string): LLMResponse {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      let functionCalls: AIFunctionCall[] = [];

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.functionCalls && Array.isArray(parsed.functionCalls)) {
            functionCalls = parsed.functionCalls;
          }
        } catch (e) {
          // If JSON parsing fails, use fallback parsing
          functionCalls = this.promptBuilder.extractFunctionCalls(response);
        }
      }

      return {
        content: response,
        functionCalls,
        finishReason: 'stop',
        model: this.config?.model || 'unknown'
      };
    } catch (error) {
      return {
        content: response,
        functionCalls: [],
        finishReason: 'stop',
        model: this.config?.model || 'unknown'
      };
    }
  }
}