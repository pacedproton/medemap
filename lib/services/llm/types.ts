/**
 * Abstract LLM Interface Types
 *
 * This module defines the common interface for all LLM providers
 * (Ollama, OpenAI, Claude, etc.)
 */

import { ViewContext, AIFunctionCall } from '../ollamaService';

// ============================================================================
// Core LLM Provider Interface
// ============================================================================

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'claude' | 'gemini' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string; // For function calls
  functionCall?: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  content: string;
  functionCalls?: AIFunctionCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: 'stop' | 'length' | 'function_call' | 'content_filter';
}

export interface LLMProvider {
  readonly name: string;
  readonly supportsStreaming: boolean;
  readonly supportsFunctionCalling: boolean;
  readonly supportsVision: boolean;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: LLMConfig): Promise<void>;

  /**
   * Check if the provider is available/connected
   */
  isAvailable(): Promise<boolean>;

  /**
   * Parse a natural language query into function calls
   */
  parseQuery(query: string, context: ViewContext): Promise<LLMResponse>;

  /**
   * Generate a completion from messages
   */
  complete(messages: LLMMessage[]): Promise<LLMResponse>;

  /**
   * Stream a completion (optional)
   */
  streamComplete?(messages: LLMMessage[]): AsyncGenerator<Partial<LLMResponse>, LLMResponse, unknown>;

  /**
   * Get provider-specific status/health info
   */
  getStatus(): Promise<{
    connected: boolean;
    model: string;
    version?: string;
    latency?: number;
    error?: string;
  }>;
}

// ============================================================================
// Provider Registry and Factory
// ============================================================================

export interface LLMProviderFactory {
  createProvider(config: LLMConfig): LLMProvider;
  getAvailableProviders(): string[];
  getProviderCapabilities(provider: string): {
    supportsStreaming: boolean;
    supportsFunctionCalling: boolean;
    supportsVision: boolean;
    models: string[];
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class LLMError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMConnectionError extends LLMError {
  constructor(provider: string, message: string) {
    super(`Connection failed: ${message}`, provider, 'CONNECTION_ERROR');
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(provider: string, retryAfter?: number) {
    super('Rate limit exceeded', provider, 'RATE_LIMIT', 429);
    this.retryAfter = retryAfter;
  }

  public retryAfter?: number;
}

export class LLMAuthenticationError extends LLMError {
  constructor(provider: string) {
    super('Authentication failed', provider, 'AUTH_ERROR', 401);
  }
}

// ============================================================================
// Prompt Templates
// ============================================================================

export interface PromptTemplate {
  system: string;
  user: string;
  examples: Array<{
    query: string;
    response: string;
  }>;
  functions: Array<{
    name: string;
    description: string;
    parameters: object;
  }>;
}

export interface PromptBuilder {
  buildPrompt(query: string, context: ViewContext): {
    messages: LLMMessage[];
    functions?: any[];
  };

  extractFunctionCalls(response: string): AIFunctionCall[];

  buildFunctionPrompt(context: ViewContext): PromptTemplate;
}