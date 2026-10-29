/**
 * LLM Configuration Manager
 *
 * Manages LLM provider configurations, API keys, and user preferences
 * Supports both JSON (localStorage) and YAML file configurations
 */

import { LLMConfig } from './types';
import { YamlConfigLoader } from './config/YamlConfigLoader';

export interface LLMConfigStore {
  primary: LLMConfig;
  fallbacks: LLMConfig[];
  preferences: {
    autoFallback: boolean;
    cacheResponses: boolean;
    timeoutMs: number;
  };
}

export class LLMConfigManager {
  private static readonly STORAGE_KEY = 'medemap_llm_config';

  // ============================================================================
  // Default Configurations
  // ============================================================================

  static getDefaultConfigs(): Record<string, Partial<LLMConfig>> {
    return {
      ollama: {
        provider: 'ollama',
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: 'gemma3:4b',  // Use the 4B model like in the YAML
        temperature: 0.1,
        maxTokens: 4000,
        timeout: 180000  // 3 minutes for remote models
      },
      openai: {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',  // Updated to GPT-4o
        temperature: 0.1,
        maxTokens: 4000,
        timeout: 30000
      },
      'openai-gpt35': {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        maxTokens: 4000,
        timeout: 30000
      },
      claude: {
        provider: 'claude',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.1,
        maxTokens: 4000,
        timeout: 30000
      },
      'claude-haiku': {
        provider: 'claude',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-haiku-20240307',
        temperature: 0.1,
        maxTokens: 4000,
        timeout: 30000
      }
    };
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  static async loadConfigFromYaml(yamlPath?: string): Promise<LLMConfigStore | null> {
    try {
      // In browser, only try to load from public directory
      const configPaths = yamlPath ? [yamlPath] : [
        'medemap-llm.yaml',
        'medemap-llm.yml'
      ];

      for (const path of configPaths) {
        const config = await YamlConfigLoader.loadFromFile(path);
        if (config) {
          console.log(`Loaded LLM config from ${path}`);
          return config;
        }
      }

      // Try to load from URL if it looks like a URL
      if (yamlPath && (yamlPath.startsWith('http://') || yamlPath.startsWith('https://'))) {
        const config = await YamlConfigLoader.loadFromUrl(yamlPath);
        if (config) {
          console.log(`Loaded LLM config from URL: ${yamlPath}`);
          return config;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to load YAML config:', error);
      return null;
    }
  }

  static loadConfigFromYamlString(yamlContent: string): LLMConfigStore | null {
    return YamlConfigLoader.loadFromString(yamlContent);
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  static saveConfig(config: LLMConfigStore): void {
    try {
      // Remove sensitive information before storing
      const sanitizedConfig = {
        ...config,
        primary: this.sanitizeConfig(config.primary),
        fallbacks: config.fallbacks.map(c => this.sanitizeConfig(c))
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sanitizedConfig));
    } catch (error) {
      console.error('Failed to save LLM config:', error);
    }
  }

  static loadConfig(): LLMConfigStore | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const config = JSON.parse(stored) as LLMConfigStore;

      // Restore API keys from environment or prompt user
      config.primary = this.restoreApiKey(config.primary);
      config.fallbacks = config.fallbacks.map(c => this.restoreApiKey(c));

      return config;
    } catch (error) {
      console.error('Failed to load LLM config:', error);
      return null;
    }
  }

  static getRecommendedConfig(): LLMConfigStore {
    const defaults = this.getDefaultConfigs();

    // Use a longer timeout for Ollama since local models can be slow
    const ollamaConfig = {
      ...defaults.ollama,
      timeout: 180000  // 3 minutes for slow local models
    } as LLMConfig;

    return {
      primary: ollamaConfig,
      fallbacks: [
        defaults.openai as LLMConfig,
        defaults.claude as LLMConfig
      ],
      preferences: {
        autoFallback: true,
        cacheResponses: true,
        timeoutMs: 180000
      }
    };
  }

  // ============================================================================
  // Environment Integration
  // ============================================================================

  static getConfigFromEnvironment(): Partial<LLMConfigStore> {
    const config: Partial<LLMConfigStore> = {};

    // Check for environment variables
    if (typeof process !== 'undefined' && process.env) {
      const env = process.env;

      // OpenAI configuration
      if (env.OPENAI_API_KEY) {
        const openaiConfig = {
          ...this.getDefaultConfigs().openai,
          apiKey: env.OPENAI_API_KEY
        } as LLMConfig;

        if (env.OPENAI_BASE_URL) {
          openaiConfig.baseUrl = env.OPENAI_BASE_URL;
        }

        config.primary = openaiConfig;
      }

      // Claude configuration
      if (env.ANTHROPIC_API_KEY) {
        const claudeConfig = {
          ...this.getDefaultConfigs().claude,
          apiKey: env.ANTHROPIC_API_KEY
        } as LLMConfig;

        if (!config.primary) {
          config.primary = claudeConfig;
        } else {
          config.fallbacks = [claudeConfig];
        }
      }

      // Ollama as fallback if we have cloud providers
      if (config.primary) {
        const ollamaConfig = this.getDefaultConfigs().ollama as LLMConfig;
        config.fallbacks = [...(config.fallbacks || []), ollamaConfig];
      }
    }

    // Default to OpenAI if no environment config
    if (!config.primary) {
      config.primary = this.getDefaultConfigs().openai as LLMConfig;
    }

    return config;
  }

  // ============================================================================
  // Provider Detection
  // ============================================================================

  static async detectAvailableProviders(): Promise<{
    provider: string;
    available: boolean;
    model?: string;
    latency?: number;
    error?: string;
  }[]> {
    const defaults = this.getDefaultConfigs();
    const results = [];

    for (const [name, config] of Object.entries(defaults)) {
      try {
        const result = await this.testProvider(config as LLMConfig);
        results.push({
          provider: name,
          ...result
        });
      } catch (error) {
        results.push({
          provider: name,
          available: false,
          error: (error as Error).message
        });
      }
    }

    return results;
  }

  private static async testProvider(config: LLMConfig): Promise<{
    available: boolean;
    model?: string;
    latency?: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      if (config.provider === 'ollama') {
        const response = await fetch(`${config.baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000)
        });
        const latency = Date.now() - start;
        return {
          available: response.ok,
          model: config.model,
          latency
        };
      } else if (config.provider === 'openai') {
        if (!config.apiKey) {
          return { available: false, error: 'No API key' };
        }
        // Would test OpenAI connection here
        return { available: false, error: 'API key required' };
      } else if (config.provider === 'claude') {
        if (!config.apiKey) {
          return { available: false, error: 'No API key' };
        }
        // Would test Claude connection here
        return { available: false, error: 'API key required' };
      }

      return { available: false, error: 'Unknown provider' };
    } catch (error) {
      return {
        available: false,
        error: (error as Error).message
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private static sanitizeConfig(config: LLMConfig): LLMConfig {
    const sanitized = { ...config };

    // Remove or mask sensitive data
    if (sanitized.apiKey) {
      sanitized.apiKey = `***${sanitized.apiKey.slice(-4)}`;
    }

    return sanitized;
  }

  private static restoreApiKey(config: LLMConfig): LLMConfig {
    const restored = { ...config };

    // Try to restore from environment
    if (restored.provider === 'openai' && !restored.apiKey?.startsWith('sk-')) {
      if (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) {
        restored.apiKey = process.env.OPENAI_API_KEY;
      }
    }

    if (restored.provider === 'claude' && !restored.apiKey?.startsWith('sk-ant-')) {
      if (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) {
        restored.apiKey = process.env.ANTHROPIC_API_KEY;
      }
    }

    return restored;
  }

  // ============================================================================
  // Migration Utilities
  // ============================================================================

  static migrateFromOldConfig(): LLMConfigStore | null {
    try {
      // Check for old Ollama-specific config
      const oldConfig = localStorage.getItem('medemap_ollama_config');
      if (oldConfig) {
        const parsed = JSON.parse(oldConfig);

        const migrated: LLMConfigStore = {
          primary: {
            provider: 'ollama',
            baseUrl: parsed.baseUrl || 'http://localhost:11434',
            model: parsed.model || 'gemma3:27b',
            temperature: parsed.temperature || 0.1,
            maxTokens: 4000,
            timeout: 30000
          },
          fallbacks: [],
          preferences: {
            autoFallback: true,
            cacheResponses: true,
            timeoutMs: 30000
          }
        };

        // Save the migrated config
        this.saveConfig(migrated);

        // Remove old config
        localStorage.removeItem('medemap_ollama_config');

        return migrated;
      }

      return null;
    } catch (error) {
      console.error('Failed to migrate old config:', error);
      return null;
    }
  }
}