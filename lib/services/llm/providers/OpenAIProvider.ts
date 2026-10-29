/**
 * OpenAI LLM Provider
 *
 * Implements the LLMProvider interface for OpenAI models (GPT-4, GPT-3.5, etc.)
 */

import { LLMProvider, LLMConfig, LLMMessage, LLMResponse, LLMAuthenticationError, LLMRateLimitError } from '../types';
import { ViewContext, AIFunctionCall } from '../../ollamaService';
import { PromptBuilder } from '../utils/PromptBuilder';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;
  readonly supportsVision = true;

  private config: LLMConfig | null = null;
  private promptBuilder = new PromptBuilder();

  async initialize(config: LLMConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.config = {
      provider: 'openai',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4-turbo-preview',
      temperature: config.temperature ?? 0.1,
      maxTokens: config.maxTokens ?? 4000,
      timeout: config.timeout ?? 30000,
      headers: config.headers,
    };

    // Test authentication
    try {
      await this.isAvailable();
    } catch (error) {
      throw new LLMAuthenticationError(this.name);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config?.apiKey) return false;

    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async parseQuery(query: string, context: ViewContext): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const { messages, functions } = this.promptBuilder.buildPrompt(query, context);

    const requestBody: any = {
      model: this.config.model,
      messages: this.convertToOpenAIMessages(messages),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    // Add function calling if supported
    if (functions && functions.length > 0) {
      requestBody.functions = functions;
      requestBody.function_call = 'auto';
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 30000)
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const result = await response.json();
      return this.parseOpenAIResponse(result);
    } catch (error) {
      console.error('OpenAI provider error:', error);
      throw error;
    }
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: this.convertToOpenAIMessages(messages),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      })
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const result = await response.json();
    return this.parseOpenAIResponse(result);
  }

  async *streamComplete(messages: LLMMessage[]): AsyncGenerator<Partial<LLMResponse>, LLMResponse, unknown> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: this.convertToOpenAIMessages(messages),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        stream: true
      })
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
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
        const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') {
            return {
              content: fullContent,
              finishReason: 'stop',
              model: this.config.model
            };
          }

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              yield { content: delta.content };
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
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      const latency = Date.now() - start;

      if (response.ok) {
        return {
          connected: true,
          model: this.config.model,
          latency,
          version: 'OpenAI API'
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

  private convertToOpenAIMessages(messages: LLMMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.functionCall && { function_call: msg.functionCall })
    }));
  }

  private parseOpenAIResponse(response: any): LLMResponse {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No response choices');
    }

    const message = choice.message;
    let functionCalls: AIFunctionCall[] = [];

    // Handle function calls
    if (message.function_call) {
      try {
        const args = JSON.parse(message.function_call.arguments);
        functionCalls = [{
          function: message.function_call.name,
          parameters: args
        }];
      } catch (e) {
        console.warn('Failed to parse function call arguments:', e);
      }
    } else if (message.content) {
      // Try to extract function calls from content
      functionCalls = this.promptBuilder.extractFunctionCalls(message.content);
    }

    return {
      content: message.content || '',
      functionCalls,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      } : undefined,
      model: response.model,
      finishReason: choice.finish_reason
    };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({}));

    switch (response.status) {
      case 401:
        throw new LLMAuthenticationError(this.name);
      case 429: {
        const retryAfter = response.headers.get('retry-after');
        throw new LLMRateLimitError(this.name, retryAfter ? parseInt(retryAfter) : undefined);
      }
      default:
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }
  }
}