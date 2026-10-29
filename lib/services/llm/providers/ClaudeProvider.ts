/**
 * Claude LLM Provider
 *
 * Implements the LLMProvider interface for Anthropic's Claude models
 */

import { LLMProvider, LLMConfig, LLMMessage, LLMResponse, LLMAuthenticationError, LLMRateLimitError } from '../types';
import { ViewContext, AIFunctionCall } from '../../ollamaService';
import { PromptBuilder } from '../utils/PromptBuilder';

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude';
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;
  readonly supportsVision = true;

  private config: LLMConfig | null = null;
  private promptBuilder = new PromptBuilder();

  async initialize(config: LLMConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Claude API key is required');
    }

    this.config = {
      provider: 'claude',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.anthropic.com/v1',
      model: config.model || 'claude-3-5-sonnet-20241022',
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
      // Claude doesn't have a models endpoint, so we'll test with a simple request
      const response = await fetch(`${this.config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        }),
        signal: AbortSignal.timeout(5000)
      });

      return response.status !== 401 && response.status !== 403;
    } catch (error) {
      return false;
    }
  }

  async parseQuery(query: string, context: ViewContext): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const { messages, functions } = this.promptBuilder.buildPrompt(query, context);

    // Claude uses a different message format
    const claudeMessages = this.convertToClaudeMessages(messages);

    const requestBody: any = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: claudeMessages.messages,
      system: claudeMessages.system
    };

    // Add function calling if supported (Claude uses tools)
    if (functions && functions.length > 0) {
      requestBody.tools = this.convertToClaudeTools(functions);
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 30000)
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const result = await response.json();
      return this.parseClaudeResponse(result);
    } catch (error) {
      console.error('Claude provider error:', error);
      throw error;
    }
  }

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const claudeMessages = this.convertToClaudeMessages(messages);

    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: claudeMessages.messages,
        system: claudeMessages.system
      })
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const result = await response.json();
    return this.parseClaudeResponse(result);
  }

  async *streamComplete(messages: LLMMessage[]): AsyncGenerator<Partial<LLMResponse>, LLMResponse, unknown> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const claudeMessages = this.convertToClaudeMessages(messages);

    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: claudeMessages.messages,
        system: claudeMessages.system,
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
            if (json.type === 'content_block_delta' && json.delta?.text) {
              fullContent += json.delta.text;
              yield { content: json.delta.text };
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
      const available = await this.isAvailable();
      const latency = Date.now() - start;

      return {
        connected: available,
        model: this.config.model,
        latency,
        version: 'Claude API'
      };
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

  private convertToClaudeMessages(messages: LLMMessage[]): {
    system?: string;
    messages: any[];
  } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    return {
      system: systemMessages.map(m => m.content).join('\n\n'),
      messages: conversationMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    };
  }

  private convertToClaudeTools(functions: any[]): any[] {
    return functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters
    }));
  }

  private parseClaudeResponse(response: any): LLMResponse {
    const content = response.content?.[0]?.text || '';
    let functionCalls: AIFunctionCall[] = [];

    // Handle tool calls
    if (response.content) {
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          functionCalls.push({
            function: block.name,
            parameters: block.input
          });
        }
      }
    }

    // If no tool calls, try to extract from content
    if (functionCalls.length === 0 && content) {
      functionCalls = this.promptBuilder.extractFunctionCalls(content);
    }

    return {
      content,
      functionCalls,
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      } : undefined,
      model: response.model,
      finishReason: response.stop_reason === 'end_turn' ? 'stop' : response.stop_reason
    };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({}));

    switch (response.status) {
      case 401:
      case 403:
        throw new LLMAuthenticationError(this.name);
      case 429: {
        const retryAfter = response.headers.get('retry-after');
        throw new LLMRateLimitError(this.name, retryAfter ? parseInt(retryAfter) : undefined);
      }
      default:
        throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }
  }
}