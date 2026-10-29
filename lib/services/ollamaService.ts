import { LabelDisplayMode } from '@/lib/features/settings/labelDisplaySlice';

export interface ViewContext {
  currentPath: string;
  selectedCountries: string[];
  selectedIndicators: string[];
  availableData: {
    tables: string[];
    columns: Record<string, any[]>;
    countries: string[];
  };
  labelDisplayMode: LabelDisplayMode;
}

export interface QueryIntent {
  type: 'navigation' | 'filter' | 'analysis' | 'visualization' | 'export';
  confidence: number;
  entities: {
    countries?: string[];
    indicators?: string[];
    timeRange?: { start?: number; end?: number };
    visualization?: string;
    comparison?: string[];
  };
}

export interface AIFunctionCall {
  function: string;
  parameters: Record<string, any>;
}

export interface NLQueryResponse {
  functionCalls: AIFunctionCall[];
  explanation: string;
  confidence: number;
  suggestedFollowUps?: string[];
}

export class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = 'http://localhost:11434', model = 'gemma3:27b') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async parseQuery(query: string, context: ViewContext): Promise<NLQueryResponse> {
    const prompt = this.buildPrompt(query, context);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent parsing
            top_p: 0.9,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return this.parseResponse(result.response, query, context);
    } catch (error) {
      console.error('Ollama service error:', error);
      return this.fallbackResponse(query);
    }
  }

  private buildPrompt(query: string, context: ViewContext): string {
    const availableViews = [
      'choropleth', 'charts', 'histograms', '3d', 'dea', 'table',
      'stacked_bar', 'correlation_matrix', 'pca', '3d_mesh'
    ];

    const availableCountries = context.availableData.countries.slice(0, 10).join(', ') + '...';
    const availableIndicators = Object.values(context.availableData.columns)
      .flat()
      .slice(0, 15)
      .map(col => col.value || col.label)
      .join(', ');

    return `You are a data visualization assistant for MeDeMAP, a platform analyzing media and democracy indicators across European countries.

CONTEXT:
- Current view: ${context.currentPath}
- Available views: ${availableViews.join(', ')}
- Available countries: ${availableCountries}
- Available indicators: ${availableIndicators}
- Label mode: ${context.labelDisplayMode}

USER QUERY: "${query}"

You have access to the following AI API functions for data manipulation and UI control:

DISCOVERY:
- getTables(): Get all available data tables
- getColumns(params): Get column information {table?: string, pattern?: string}
- getCountries(params): Get available countries {hasData?: string[], region?: string}

SYSTEM:
- getCurrentState(): Get current application state
- getCapabilities(): Get available features and capabilities

NAVIGATION:
- navigateToView(params): Navigate to specific view {view: string, filters?: object}

SELECTION:
- selectCountries(params): Select countries {countries: string[], mode?: 'replace'|'add'|'remove'}
- selectIndicators(params): Select indicators {indicators: string[], tables?: string[]}
- selectTimeRange(params): Select time range {start?: number, end?: number}
- clearSelections(params): Clear selections {type?: 'all'|'countries'|'indicators'|'timeRange'}

DATA MANIPULATION:
- filterData(params): Apply data filters {criteria: object}
- aggregateData(params): Aggregate data {groupBy: string[], metrics: string[]}
- transformData(params): Transform data {operations: object[]}

ANALYSIS:
- performAnalysis(params): Run analysis {type: string, parameters: object}
- calculateStatistics(params): Calculate statistics {indicators: string[], countries?: string[]}
- findCorrelations(params): Find correlations {indicators: string[]}
- detectOutliers(params): Detect outliers {indicators: string[], method?: string}
- runDEAAnalysis(params): Run DEA analysis {countries: string[], inputs?: string[], outputs?: string[]}
- performPCA(params): Perform PCA {indicators: string[], countries?: string[]}

VISUALIZATION:
- createVisualization(params): Create custom visualization {type: string, config: object}
- updateVisualization(params): Update existing visualization {updates: object}
- setTheme(params): Set visual theme {theme: string, colors?: string[]}
- setLabelFormat(params): Set label format {mode: 'raw'|'formatted'}

VIEW-SPECIFIC:
- configureDeaAnalysis(params): Configure DEA analysis {inputs: string[], outputs: string[], modelType?: 'CCR'|'BCC'}
- runDeaAnalysis(): Run DEA analysis with current configuration
- configureChoropleth(params): Configure choropleth map {indicator: string, colorScale?: string}
- configureCharts(params): Configure charts {chartType: 'bar'|'line'|'scatter', aggregation?: string}

Parse the query and respond with a JSON object containing function calls to execute:
{
  "functionCalls": [
    {
      "function": "functionName",
      "parameters": {
        // Function parameters
      }
    }
  ],
  "explanation": "Human-readable explanation of what will happen",
  "confidence": 0.0-1.0,
  "suggestedFollowUps": ["suggestion1", "suggestion2"]
}

EXAMPLES:
Query: "Show me the choropleth map"
Response: {"functionCalls":[{"function":"navigateToView","parameters":{"view":"choropleth"}}],"explanation":"Navigating to the choropleth map view","confidence":0.95,"suggestedFollowUps":["Filter by specific countries","Change color scheme"]}

Query: "Compare Germany and France"
Response: {"functionCalls":[{"function":"selectCountries","parameters":{"countries":["Germany","France"]}},{"function":"navigateToView","parameters":{"view":"dea"}}],"explanation":"Selecting Germany and France for comparison and navigating to DEA analysis view","confidence":0.9,"suggestedFollowUps":["Add more countries to comparison","View efficiency scores"]}

Query: "Show press freedom trends for Nordic countries"
Response: {"functionCalls":[{"function":"selectCountries","parameters":{"countries":["nordic"]}},{"function":"selectIndicators","parameters":{"indicators":["press_freedom"]}},{"function":"navigateToView","parameters":{"view":"charts"}}],"explanation":"Selecting Nordic countries and press freedom indicators to show trends in chart view","confidence":0.85,"suggestedFollowUps":["Change to correlation matrix view","Add time range filter"]}

Query: "Set to raw label format"
Response: {"functionCalls":[{"function":"setLabelFormat","parameters":{"mode":"raw"}}],"explanation":"Switching to raw database column names for all indicators","confidence":0.95,"suggestedFollowUps":["Switch back to formatted labels","View table with raw labels"]}

Query: "What countries are available?"
Response: {"functionCalls":[{"function":"getCountries","parameters":{}}],"explanation":"Getting list of all available countries in the dataset","confidence":0.9,"suggestedFollowUps":["Filter by specific region","Select countries for analysis"]}

Query: "Compare Austria and Belgium using DEA with press freedom as output"
Response: {"functionCalls":[{"function":"selectCountries","parameters":{"countries":["Austria","Belgium"]}},{"function":"navigateToView","parameters":{"view":"dea"}},{"function":"configureDeaAnalysis","parameters":{"inputs":["2022_MEDIA_USE"],"outputs":["2022_PRESS_FREEDOM"],"modelType":"CCR"}},{"function":"runDeaAnalysis","parameters":{}}],"explanation":"Selecting Austria and Belgium, navigating to DEA view, configuring analysis with press freedom as output, and running the analysis","confidence":0.85,"suggestedFollowUps":["Add more input variables","Change to BCC model","View efficiency frontier"]}

Respond only with valid JSON:`;
  }

  private parseResponse(response: string, originalQuery: string, context: ViewContext): NLQueryResponse {
    try {
      // Extract JSON from response (handle any extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.functionCalls || !parsed.explanation) {
        throw new Error('Invalid response format');
      }

      // Ensure functionCalls is an array
      if (!Array.isArray(parsed.functionCalls)) {
        throw new Error('functionCalls must be an array');
      }

      return {
        functionCalls: parsed.functionCalls,
        explanation: parsed.explanation,
        confidence: parsed.confidence || 0.5,
        suggestedFollowUps: parsed.suggestedFollowUps || []
      };
    } catch (error) {
      console.warn('Failed to parse Ollama response, using fallback:', error);
      return this.fallbackResponse(originalQuery);
    }
  }

  private fallbackResponse(query: string): NLQueryResponse {
    // Simple keyword-based fallback
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('choropleth') || lowerQuery.includes('map')) {
      return {
        functionCalls: [
          { function: 'navigateToView', parameters: { view: 'choropleth' } }
        ],
        explanation: 'Showing choropleth map view',
        confidence: 0.7
      };
    }

    if (lowerQuery.includes('table')) {
      return {
        functionCalls: [
          { function: 'navigateToView', parameters: { view: 'table' } }
        ],
        explanation: 'Showing table view',
        confidence: 0.7
      };
    }

    if (lowerQuery.includes('3d')) {
      return {
        functionCalls: [
          { function: 'navigateToView', parameters: { view: '3d' } }
        ],
        explanation: 'Showing 3D visualization',
        confidence: 0.7
      };
    }

    if (lowerQuery.includes('compare') && (lowerQuery.includes('countries') || lowerQuery.includes('germany') || lowerQuery.includes('france'))) {
      // Extract potential country names
      const countries = ['germany', 'france', 'austria', 'belgium', 'italy', 'spain']
        .filter(country => lowerQuery.includes(country));

      if (countries.length >= 2) {
        return {
          functionCalls: [
            { function: 'selectCountries', parameters: { countries: countries.slice(0, 2) } },
            { function: 'navigateToView', parameters: { view: 'dea' } }
          ],
          explanation: `Comparing ${countries.slice(0, 2).join(' and ')} using DEA analysis`,
          confidence: 0.6
        };
      }
    }

    return {
      functionCalls: [],
      explanation: `I'm not sure how to handle "${query}". Try asking about specific views, countries, or indicators.`,
      confidence: 0.3,
      suggestedFollowUps: [
        'Show me the choropleth map',
        'Filter by Nordic countries',
        'Compare press freedom indicators'
      ]
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}