/**
 * PromptBuilder Utility
 *
 * Builds prompts and extracts function calls for all LLM providers
 */

import { LLMMessage, PromptTemplate } from '../types';
import { ViewContext, AIFunctionCall } from '../../ollamaService';

export class PromptBuilder {
  buildPrompt(query: string, context: ViewContext): {
    messages: LLMMessage[];
    functions?: any[];
  } {
    const template = this.buildFunctionPrompt(context);

    const systemMessage: LLMMessage = {
      role: 'system',
      content: this.buildSystemPrompt(context, template)
    };

    const userMessage: LLMMessage = {
      role: 'user',
      content: `USER QUERY: "${query}"`
    };

    return {
      messages: [systemMessage, userMessage],
      functions: this.buildFunctionDefinitions()
    };
  }

  extractFunctionCalls(response: string): AIFunctionCall[] {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackExtraction(response);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.functionCalls && Array.isArray(parsed.functionCalls)) {
        return parsed.functionCalls;
      }

      // Handle single function call
      if (parsed.function && parsed.parameters) {
        return [{
          function: parsed.function,
          parameters: parsed.parameters
        }];
      }

      return this.fallbackExtraction(response);
    } catch (error) {
      return this.fallbackExtraction(response);
    }
  }

  buildFunctionPrompt(context: ViewContext): PromptTemplate {
    const availableViews = [
      'choropleth', 'charts', 'histograms', '3d', 'dea', 'table',
      'stacked_bar', 'correlation_matrix', 'pca', '3d_mesh'
    ];

    const availableCountries = context.availableData.countries.slice(0, 10).join(', ') + '...';
    const availableIndicators = Object.values(context.availableData.columns)
      .flat()
      .slice(0, 15)
      .map((col: any) => col.value || col.label)
      .join(', ');

    return {
      system: `You are a data visualization assistant for MeDeMAP, a platform analyzing media and democracy indicators across European countries.

CONTEXT:
- Current view: ${context.currentPath}
- Available views: ${availableViews.join(', ')}
- Available countries: ${availableCountries}
- Available indicators: ${availableIndicators}
- Label mode: ${context.labelDisplayMode}`,

      user: '',

      examples: [
        {
          query: "Show me the choropleth map",
          response: JSON.stringify({
            functionCalls: [{ function: "navigateToView", parameters: { view: "choropleth" } }],
            explanation: "Navigating to the choropleth map view",
            confidence: 0.95,
            suggestedFollowUps: ["Filter by specific countries", "Change color scheme"]
          })
        },
        {
          query: "Compare Austria and Belgium using DEA",
          response: JSON.stringify({
            functionCalls: [
              { function: "selectCountries", parameters: { countries: ["Austria", "Belgium"] } },
              { function: "navigateToView", parameters: { view: "dea" } },
              { function: "configureDeaAnalysis", parameters: { inputs: ["government_control_index", "media_concentration"], outputs: ["press_freedom_score", "public_trust_in_media"], modelType: "CCR" } },
              { function: "runDeaAnalysis", parameters: {} }
            ],
            explanation: "Selecting Austria and Belgium, navigating to DEA view, configuring analysis with government control and media concentration as inputs (to minimize) and press freedom and public trust as outputs (to maximize)",
            confidence: 0.85,
            suggestedFollowUps: ["Add more input variables", "Change to BCC model", "View efficiency frontier"]
          })
        }
      ],

      functions: this.buildFunctionDefinitions()
    };
  }

  private buildSystemPrompt(context: ViewContext, template: PromptTemplate): string {
    return `You are a data visualization assistant for MeDeMAP. Execute multiple steps as needed.

Available views: choropleth, charts, dea, table, 3d
Current view: ${context.currentPath}

Key functions:
- selectCountries({countries: string[]}): Select countries FIRST
- navigateToView({view: string}): Navigate to view
- getColumns({table: string}): Get available indicators from a specific table
- configureDeaAnalysis({inputs: string[], outputs: string[]}): Configure DEA with variables ONLY after user chooses
- runDeaAnalysis(): Run DEA analysis LAST

IMPORTANT DEA GUIDANCE:
- DEA (Data Envelopment Analysis) measures efficiency where units try to MINIMIZE inputs while MAXIMIZING outputs
- Good INPUTS (resources to minimize): costs, spending, corruption levels, negative indicators
- Good OUTPUTS (benefits to maximize): press freedom, democracy scores, trust levels, positive outcomes

CRITICAL: When user asks for DEA analysis but doesn't specify variables:
1. First, navigate to DEA view
2. DO NOT select arbitrary variables
3. Instead, respond with suggestions and ask the user to choose:
   "I've navigated to the DEA view. Please select your variables:
    - INPUTS (factors to minimize): Choose indicators like government control, media concentration, or corruption
    - OUTPUTS (goals to maximize): Choose indicators like press freedom, democracy scores, or public trust
    You can also let me analyze the available data and suggest optimal variable combinations."

Available indicator patterns (check actual data for exact names):
- Press/Media freedom indicators
- Democracy and governance scores
- Trust and confidence metrics
- Media diversity and pluralism measures
- Government control and regulation indices

Respond with JSON containing ALL needed function calls:
{
  "functionCalls": [{"function": "name", "parameters": {}}],
  "explanation": "description",
  "confidence": 0.9,
  "suggestedFollowUps": ["suggestions"]
}

Examples:
Query: "Compare Germany and France with DEA"
Response: {"functionCalls": [{"function": "selectCountries", "parameters": {"countries": ["Germany", "France"]}}, {"function": "navigateToView", "parameters": {"view": "dea"}}], "explanation": "I've selected Germany and France and navigated to the DEA view. Now please choose your analysis variables:\n\n**INPUTS** (factors to minimize):\n- Government media control indices\n- Media market concentration\n- Corruption perception scores\n\n**OUTPUTS** (goals to maximize):\n- Press freedom scores\n- Democracy indices\n- Public trust in media\n\nWhich variables would you like to use?", "confidence": 0.9, "suggestedFollowUps": ["Use press freedom as output and government control as input", "Let me suggest optimal variables based on data", "Show me available indicators"]}

Query: "Show choropleth map"
Response: {"functionCalls": [{"function": "navigateToView", "parameters": {"view": "choropleth"}}], "explanation": "Navigating to map", "confidence": 0.95, "suggestedFollowUps": ["Filter countries"]}

When selecting DEA variables, think about causality:
- INPUTS should be resources, constraints, or negative factors
- OUTPUTS should be achievements, benefits, or positive outcomes
- The goal is to find who produces the MOST output with the LEAST input

Execute ALL required steps. Respond only with valid JSON:`;
  }

  private buildFunctionDefinitions(): any[] {
    return [
      {
        name: "navigateToView",
        description: "Navigate to a specific view",
        parameters: {
          type: "object",
          properties: {
            view: {
              type: "string",
              enum: ["choropleth", "charts", "histograms", "3d", "dea", "table", "stacked_bar", "correlation_matrix", "pca", "3d_mesh"],
              description: "The view to navigate to"
            }
          },
          required: ["view"]
        }
      },
      {
        name: "selectCountries",
        description: "Select countries for analysis",
        parameters: {
          type: "object",
          properties: {
            countries: {
              type: "array",
              items: { type: "string" },
              description: "List of countries to select"
            },
            mode: {
              type: "string",
              enum: ["replace", "add", "remove"],
              description: "How to apply the selection"
            }
          },
          required: ["countries"]
        }
      },
      {
        name: "configureDeaAnalysis",
        description: "Configure DEA analysis parameters",
        parameters: {
          type: "object",
          properties: {
            inputs: {
              type: "array",
              items: { type: "string" },
              description: "Input variables for DEA"
            },
            outputs: {
              type: "array",
              items: { type: "string" },
              description: "Output variables for DEA"
            },
            modelType: {
              type: "string",
              enum: ["CCR", "BCC"],
              description: "DEA model type"
            }
          },
          required: ["inputs", "outputs"]
        }
      }
      // Add more function definitions as needed
    ];
  }

  private fallbackExtraction(response: string): AIFunctionCall[] {
    const functionCalls: AIFunctionCall[] = [];

    // Simple keyword-based extraction
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('choropleth') || lowerResponse.includes('map')) {
      functionCalls.push({
        function: 'navigateToView',
        parameters: { view: 'choropleth' }
      });
    }

    if (lowerResponse.includes('compare') && (lowerResponse.includes('countries') || lowerResponse.includes('germany') || lowerResponse.includes('france'))) {
      // Extract potential country names
      const countries = ['germany', 'france', 'austria', 'belgium', 'italy', 'spain']
        .filter(country => lowerResponse.includes(country));

      if (countries.length >= 2) {
        functionCalls.push({
          function: 'selectCountries',
          parameters: { countries: countries.slice(0, 2) }
        });
        functionCalls.push({
          function: 'navigateToView',
          parameters: { view: 'dea' }
        });
      }
    }

    return functionCalls;
  }
}