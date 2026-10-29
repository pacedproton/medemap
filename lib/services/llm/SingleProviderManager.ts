/**
 * Single Provider Manager
 *
 * Ensures that only one LLM provider is active at a time
 * and prevents multiple models from running simultaneously
 */

import { LLMConfig } from './types';
import { llmService } from './LLMService';

export class SingleProviderManager {
  private static instance: SingleProviderManager;
  private currentProvider: string | null = null;
  private exclusiveMode: boolean = true; // Default to exclusive mode

  private constructor() {}

  static getInstance(): SingleProviderManager {
    if (!SingleProviderManager.instance) {
      SingleProviderManager.instance = new SingleProviderManager();
    }
    return SingleProviderManager.instance;
  }

  /**
   * Switch to a single provider exclusively
   */
  async switchToExclusiveProvider(config: LLMConfig): Promise<void> {
    console.log(`Switching to exclusive provider: ${config.provider}`);

    // Clear any existing providers
    await this.clearAllProviders();

    // Initialize only the selected provider
    await llmService.initialize(config, []); // No fallbacks

    this.currentProvider = config.provider;
    this.exclusiveMode = true;

    console.log(`Exclusive provider ${config.provider} activated`);
  }

  /**
   * Clear all provider connections
   */
  private async clearAllProviders(): Promise<void> {
    // This would clear any existing connections
    // Implementation depends on the specific provider cleanup needs
    console.log('Clearing all existing provider connections');
  }

  /**
   * Get current active provider
   */
  getCurrentProvider(): string | null {
    return this.currentProvider;
  }

  /**
   * Check if running in exclusive mode
   */
  isExclusiveMode(): boolean {
    return this.exclusiveMode;
  }

  /**
   * Ensure only one provider is processing requests
   */
  async processQuery(query: string, context: any): Promise<any> {
    if (!this.currentProvider) {
      throw new Error('No provider selected. Please select a provider first.');
    }

    if (!this.exclusiveMode) {
      throw new Error('Single provider mode is not enabled.');
    }

    console.log(`Processing query with exclusive provider: ${this.currentProvider}`);

    // Use the LLM service with fallback disabled
    return await llmService.parseQuery(query, context, true); // disableFallback = true
  }

  /**
   * Validate that only one provider is configured
   */
  validateSingleProvider(): boolean {
    const status = llmService.getCurrentProvider();
    const fallbacks = llmService.getAvailableProviders().filter(p => p.name !== status);

    if (fallbacks.length > 0 && this.exclusiveMode) {
      console.warn(' Multiple providers detected in exclusive mode');
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const singleProviderManager = SingleProviderManager.getInstance();