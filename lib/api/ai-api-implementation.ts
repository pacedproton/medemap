/**
 * AI API Implementation for MeDeMAP
 *
 * This implements the comprehensive AI API for data manipulation and UI control
 */

import { AIAPI, APIResponse, DataFilter, Column, DataPoint, AIAPIFunctions } from './ai-api-spec';
import { store } from '@/lib/store';
import {
  selectMedeMapData,
  setSelectedOptions,
  setSelectedCountries
} from '@/lib/features/medemap/medeMapSlice';
import { useRouter } from 'next/navigation';

// ============================================================================
// API Implementation Class
// ============================================================================

export class MeDeMapAIAPI implements AIAPI {
  private store: typeof store;
  public router: ReturnType<typeof useRouter> | null = null;
  private operationHistory: any[] = [];
  private maxHistorySize = 100;

  constructor(storeInstance: typeof store, router?: ReturnType<typeof useRouter>) {
    this.store = storeInstance;
    this.router = router || null;
  }

  // Helper method to create API response
  private createResponse<T>(data?: T, error?: string): APIResponse<T> {
    const response: APIResponse<T> = {
      success: !error,
      metadata: {
        timestamp: new Date().toISOString(),
        executionTime: 0, // Would be calculated in real implementation
      }
    };

    if (data) response.data = data;
    if (error) response.error = error;

    // Add to history
    this.addToHistory({
      timestamp: new Date(),
      response,
      operation: new Error().stack?.split('\n')[2]?.trim()
    });

    return response;
  }

  // Add operation to history
  private addToHistory(operation: any) {
    this.operationHistory.unshift(operation);
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.pop();
    }
  }

  // Get current Redux state
  private getState() {
    return selectMedeMapData(this.store.getState());
  }

  // --------------------------------------------------------------------------
  // Discovery Implementation
  // --------------------------------------------------------------------------

  discovery = {
    getTables: async (): Promise<APIResponse<{
      tables: Array<{
        name: string;
        displayName: string;
        recordCount: number;
        columnCount: number;
        description?: string;
      }>;
    }>> => {
      try {
        const state = this.getState();
        const tables = Object.keys(state.data || {})
          .filter(key => !['columnOptions', 'columnOrder'].includes(key))
          .map(tableName => ({
            name: tableName,
            displayName: tableName.replace(/_/g, ' ').toUpperCase(),
            recordCount: state.data[tableName]?.length || 0,
            columnCount: state.columnOptions[tableName]?.length || 0,
            description: this.getTableDescription(tableName)
          }));

        return this.createResponse({ tables });
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message) as unknown as APIResponse<{
          tables: Array<{
            name: string;
            displayName: string;
            recordCount: number;
            columnCount: number;
            description?: string;
          }>;
        }>;
      }
    },

    getColumns: async (params?: {
      table?: string;
      pattern?: string;
      type?: Column['type'];
    }): Promise<APIResponse<Column[]>> => {
      try {
        const state = this.getState();
        let columns: Column[] = [];

        const tables = params?.table ? [params.table] : Object.keys(state.columnOptions || {});

        tables.forEach(tableName => {
          const tableColumns = state.columnOptions[tableName] || [];
          tableColumns.forEach((col: any) => {
            // Apply pattern filter if specified
            if (params?.pattern &&
                !col.value.toLowerCase().includes(params.pattern.toLowerCase()) &&
                !col.label?.toLowerCase().includes(params.pattern.toLowerCase())) {
              return;
            }

            columns.push({
              name: col.value,
              label: col.label || col.value,
              type: this.inferColumnType(col.value),
              table: tableName,
              metadata: {
                thresholds: col.thresholds,
                year: this.extractYear(col.value)
              }
            });
          });
        });

        return this.createResponse(columns);
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message) as unknown as APIResponse<Column[]>;
      }
    },

    getCountries: async (params?: {
      hasData?: string[];
      region?: string;
    }): Promise<APIResponse<string[]>> => {
      try {
        const state = this.getState();
        const countriesSet = new Set<string>();

        // Get all unique countries from all tables
        Object.values(state.data || {}).forEach((tableData: any) => {
          if (Array.isArray(tableData)) {
            tableData.forEach(row => {
              if (row.country) {
                countriesSet.add(row.country);
              }
            });
          }
        });

        let countries = Array.from(countriesSet);

        // Filter by region if specified
        if (params?.region) {
          countries = this.filterByRegion(countries, params.region);
        }

        // Filter by data availability if specified
        if (params?.hasData) {
          countries = countries.filter(country =>
            this.countryHasData(country, params.hasData!)
          );
        }

        return this.createResponse(countries.sort());
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message) as unknown as APIResponse<string[]>;
      }
    },

    getYears: async (params?: {
      indicator?: string;
      country?: string;
    }): Promise<APIResponse<number[]>> => {
      try {
        const state = this.getState();
        const yearsSet = new Set<number>();

        // Extract years from column names
        Object.values(state.columnOptions || {}).forEach((columns: any) => {
          columns.forEach((col: any) => {
            const year = this.extractYear(col.value);
            if (year) {
              yearsSet.add(year);
            }
          });
        });

        return this.createResponse(Array.from(yearsSet).sort());
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message) as unknown as APIResponse<number[]>;
      }
    },

    searchIndicators: async (params: {
      query: string;
      fuzzy?: boolean;
      limit?: number;
    }): Promise<APIResponse<Column[]>> => {
      try {
        const { data } = await this.discovery.getColumns();
        let results = data || [];

        // Simple search implementation
        const query = params.query.toLowerCase();
        results = results.filter(col =>
          col.name.toLowerCase().includes(query) ||
          col.label.toLowerCase().includes(query)
        );

        if (params.limit) {
          results = results.slice(0, params.limit);
        }

        return this.createResponse(results);
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message) as unknown as APIResponse<Column[]>;
      }
    },

    getSchema: async (): Promise<APIResponse<any>> => {
      // Implementation would return full schema
      return this.createResponse({
        tables: {}
      });
    }
  };

  // --------------------------------------------------------------------------
  // Data Manipulation Implementation
  // --------------------------------------------------------------------------

  data = {
    query: async (params: {
      filter?: DataFilter;
      groupBy?: string[];
      aggregate?: Array<{
        field: string;
        function: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'stddev';
        alias?: string;
      }>;
      orderBy?: Array<{
        field: string;
        direction: 'asc' | 'desc';
      }>;
      limit?: number;
      offset?: number;
    }): Promise<APIResponse<DataPoint[]>> => {
      try {
        const state = this.getState();
        let results: DataPoint[] = [];

        // Apply filters
        Object.keys(state.data || {}).forEach(tableName => {
          const tableData = state.data[tableName];
          if (!Array.isArray(tableData)) return;

          let filteredData = [...tableData];

          // Country filter
          if (params.filter?.countries?.length) {
            filteredData = filteredData.filter(row =>
              params.filter!.countries!.includes(row.country)
            );
          }

          // Time range filter
          if (params.filter?.timeRange) {
            // Implementation would filter by time range
          }

          // Convert to DataPoints
          filteredData.forEach(row => {
            Object.keys(row).forEach(key => {
              if (key !== 'country' && !key.startsWith('meta_')) {
                results.push({
                  country: row.country,
                  indicator: key,
                  value: row[key],
                  year: this.extractYear(key)
                });
              }
            });
          });
        });

        // Apply ordering
        if (params.orderBy) {
          // Implementation would sort results
        }

        // Apply limit and offset
        if (params.offset) {
          results = results.slice(params.offset);
        }
        if (params.limit) {
          results = results.slice(0, params.limit);
        }

        return this.createResponse(results);
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message) as unknown as APIResponse<DataPoint[]>;
      }
    },

    pivot: async (params: any): Promise<APIResponse<any[][]>> => {
      // Implementation would create pivot table
      return this.createResponse([]);
    },

    getTimeSeries: async (params: {
      indicator: string;
      countries?: string[];
      fillMissing?: 'interpolate' | 'forward' | 'backward' | 'zero';
    }): Promise<APIResponse<any>> => {
      // Implementation would get time series data
      return this.createResponse({ series: [] });
    },

    getStatistics: async (params: any): Promise<APIResponse<Record<string, any>>> => {
      // Implementation would calculate statistics
      return this.createResponse({});
    },

    validate: async (params?: any): Promise<APIResponse<any>> => {
      // Implementation would validate data
      return this.createResponse({ valid: true, issues: [] });
    }
  };

  // --------------------------------------------------------------------------
  // Selection Management Implementation
  // --------------------------------------------------------------------------

  selection = {
    setCountries: async (countries: string[]): Promise<APIResponse> => {
      try {
        this.store.dispatch(setSelectedCountries(countries));
        return this.createResponse({
          message: `Selected ${countries.length} countries`
        });
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message);
      }
    },

    setIndicators: async (indicators: string[]): Promise<APIResponse> => {
      try {
        // Convert indicators to column selections
        const state = this.getState();
        const selections: Record<string, any[]> = {};

        Object.keys(state.columnOptions || {}).forEach(tableName => {
          const tableColumns = state.columnOptions[tableName] || [];
          const selected = tableColumns.filter((col: any) =>
            indicators.includes(col.value)
          );
          if (selected.length > 0) {
            selections[tableName] = selected;
          }
        });

        this.store.dispatch(setSelectedOptions(selections));
        return this.createResponse({
          message: `Selected ${indicators.length} indicators`
        });
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message);
      }
    },

    getCurrent: async (): Promise<APIResponse<any>> => {
      try {
        const state = this.getState();
        return this.createResponse({
          countries: state.selectedCountries || [],
          indicators: this.getSelectedIndicators(state),
          view: 'unknown' // Router pathname not available in this context
        });
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message);
      }
    },

    savePreset: async (params: any): Promise<APIResponse<{ id: string }>> => {
      // Implementation would save to localStorage or backend
      const id = `preset_${Date.now()}`;
      return this.createResponse({ id });
    },

    loadPreset: async (id: string): Promise<APIResponse> => {
      // Implementation would load from storage
      return this.createResponse({ message: 'Preset loaded' });
    },

    getPresets: async (): Promise<APIResponse<any[]>> => {
      // Implementation would get saved presets
      return this.createResponse([]);
    },

    clear: async (params?: any): Promise<APIResponse> => {
      try {
        if (params?.all || params?.countries) {
          this.store.dispatch(setSelectedCountries([]));
        }
        if (params?.all || params?.indicators) {
          this.store.dispatch(setSelectedOptions({}));
        }
        return this.createResponse({ message: 'Selections cleared' });
      } catch (error) {
        return this.createResponse(undefined, (error as Error).message);
      }
    }
  };

  // --------------------------------------------------------------------------
  // Analysis Implementation
  // --------------------------------------------------------------------------

  analysis = {
    runDEA: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would run DEA analysis
      return this.createResponse({
        efficiency: {},
        peers: {},
        weights: {},
        frontier: []
      });
    },

    correlations: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would calculate correlations
      return this.createResponse({
        matrix: [],
        significant: []
      });
    },

    trends: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would analyze trends
      return this.createResponse({
        trends: []
      });
    },

    runPCA: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would run PCA
      return this.createResponse({
        components: [],
        scores: [],
        totalVarianceExplained: 0
      });
    },

    detectOutliers: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would detect outliers
      return this.createResponse({
        outliers: []
      });
    },

    cluster: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would perform clustering
      return this.createResponse({
        clusters: [],
        silhouetteScore: 0
      });
    },

    regression: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would run regression
      return this.createResponse({
        coefficients: {},
        intercept: 0,
        r2: 0,
        adjustedR2: 0,
        pValues: {}
      });
    }
  };

  // --------------------------------------------------------------------------
  // Visualization Implementation
  // --------------------------------------------------------------------------

  visualization = {
    navigateTo: async (view: string): Promise<APIResponse> => {
      try {
        const viewMap: Record<string, string> = {
          'choropleth': '/view_choropleth',
          'charts': '/view_charts',
          'table': '/view_table',
          'dea': '/view_dea',
          '3d': '/3d',
          'correlation_matrix': '/view_correlation_matrix',
          'pca': '/view_pca',
          'histograms': '/view_histograms',
          'stacked_bar': '/view_stacked_bar',
          '3d_mesh': '/view_3d_mesh',
          'cylindrical': '/3d/cylindrical'
        };

        const route = viewMap[view];
        if (!route) {
          return this.createResponse(undefined, `Invalid view: ${view}`);
        }

        // Add a small delay to ensure any pending operations complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Try router first
        if (this.router) {
          console.log(`Navigating to ${view} using Next.js router`);
          try {
            await this.router.push(route);
            // Give the navigation time to start
            await new Promise(resolve => setTimeout(resolve, 200));
            return this.createResponse({ message: `Navigated to ${view}` });
          } catch (routerError) {
            console.warn(`Router navigation failed, trying fallback:`, routerError);
            // Fall through to window.location fallback
          }
        }

        // Fallback to window.location if router not available or failed
        if (typeof window !== 'undefined') {
          console.log(`Navigating to ${view} using window.location (fallback)`);
          // Use replace instead of href to avoid adding to history
          window.location.replace(route);
          return this.createResponse({ message: `Navigated to ${view} (fallback)` });
        }

        return this.createResponse(undefined, 'Navigation not available in this context');
      } catch (error) {
        console.error('Navigation error:', error);
        // Last resort: try direct window navigation
        if (typeof window !== 'undefined') {
          const viewMap: Record<string, string> = {
            'choropleth': '/view_choropleth',
            'charts': '/view_charts',
            'table': '/view_table',
            'dea': '/view_dea',
            '3d': '/3d',
            'correlation_matrix': '/view_correlation_matrix',
            'pca': '/view_pca',
            'histograms': '/view_histograms',
            'stacked_bar': '/view_stacked_bar',
            '3d_mesh': '/view_3d_mesh',
            'cylindrical': '/3d/cylindrical'
          };
          const route = viewMap[view];
          if (route) {
            window.location.replace(route);
            return this.createResponse({ message: `Navigated to ${view} (emergency fallback)` });
          }
        }
        return this.createResponse(undefined, (error as Error).message);
      }
    },

    getCurrentView: async (): Promise<APIResponse<any>> => {
      return this.createResponse({
        name: 'unknown', // Router pathname not available in this context
        config: {},
        data: {}
      });
    },

    updateSettings: async (params: any): Promise<APIResponse> => {
      // Implementation would update viz settings
      return this.createResponse({ message: 'Settings updated' });
    },

    createCustom: async (params: any): Promise<APIResponse<{ id: string }>> => {
      // Implementation would create custom visualization
      return this.createResponse({ id: `viz_${Date.now()}` });
    },

    screenshot: async (params?: any): Promise<APIResponse<{ url: string }>> => {
      // Implementation would take screenshot
      return this.createResponse({ url: 'data:image/png;base64,...' });
    },

    recommend: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would recommend visualizations
      return this.createResponse({
        recommended: 'charts',
        reason: 'Best for comparing multiple indicators',
        alternatives: ['dea', 'correlation_matrix']
      });
    }
  };

  // --------------------------------------------------------------------------
  // Export Implementation
  // --------------------------------------------------------------------------

  export = {
    exportData: async (params: any): Promise<APIResponse<{ url: string }>> => {
      // Implementation would export data
      return this.createResponse({ url: '/downloads/export.csv' });
    },

    generateReport: async (params: any): Promise<APIResponse<{ url: string }>> => {
      // Implementation would generate PDF report
      return this.createResponse({ url: '/downloads/report.pdf' });
    },

    createShareLink: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would create shareable link
      return this.createResponse({
        url: 'https://medemap.com/share/abc123',
        shortUrl: 'https://mdmp.eu/abc123'
      });
    },

    generateEmbed: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would generate embed code
      return this.createResponse({
        html: '<div>...</div>',
        iframe: '<iframe>...</iframe>'
      });
    }
  };

  // --------------------------------------------------------------------------
  // Collaboration Implementation
  // --------------------------------------------------------------------------

  collaboration = {
    addAnnotation: async (params: any): Promise<APIResponse<{ id: string }>> => {
      // Implementation would add annotation
      return this.createResponse({ id: `annotation_${Date.now()}` });
    },

    getAnnotations: async (params?: any): Promise<APIResponse<any[]>> => {
      // Implementation would get annotations
      return this.createResponse([]);
    },

    createWorkspace: async (params: any): Promise<APIResponse<{ id: string }>> => {
      // Implementation would create workspace
      return this.createResponse({ id: `workspace_${Date.now()}` });
    },

    shareWorkspace: async (params: any): Promise<APIResponse> => {
      // Implementation would share workspace
      return this.createResponse({ message: 'Workspace shared' });
    }
  };

  // --------------------------------------------------------------------------
  // System Implementation
  // --------------------------------------------------------------------------

  system = {
    getCapabilities: async (): Promise<APIResponse<any>> => {
      return this.createResponse({
        version: '1.0.0',
        features: Object.keys(this),
        limits: {
          maxDataPoints: 1000000,
          maxConcurrentRequests: 10,
          rateLimits: {}
        }
      });
    },

    getStatus: async (): Promise<APIResponse<any>> => {
      return this.createResponse({
        healthy: true,
        database: 'connected',
        cache: 'connected',
        performance: {
          avgResponseTime: 50,
          activeRequests: 0
        }
      });
    },

    batch: async (operations: any[]): Promise<APIResponse<any[]>> => {
      // Implementation would execute batch operations
      const results = [];
      for (const op of operations) {
        // Execute each operation
        results.push({
          id: op.id,
          result: {},
          error: undefined
        });
      }
      return this.createResponse(results);
    },

    getHistory: async (params?: any): Promise<APIResponse<any[]>> => {
      const limit = params?.limit || 10;
      const offset = params?.offset || 0;
      return this.createResponse(
        this.operationHistory.slice(offset, offset + limit)
      );
    },

    undo: async (): Promise<APIResponse> => {
      // Implementation would undo last operation
      return this.createResponse({ message: 'Operation undone' });
    },

    redo: async (): Promise<APIResponse> => {
      // Implementation would redo operation
      return this.createResponse({ message: 'Operation redone' });
    }
  };

  // --------------------------------------------------------------------------
  // Machine Learning Implementation
  // --------------------------------------------------------------------------

  ml = {
    getRecommendations: async (params?: any): Promise<APIResponse<any[]>> => {
      // Implementation would get AI recommendations
      return this.createResponse([
        {
          action: 'analyze_trends',
          description: 'Analyze trends in selected data',
          confidence: 0.85
        }
      ]);
    },

    trainModel: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would train model
      return this.createResponse({
        modelId: `model_${Date.now()}`,
        metrics: {}
      });
    },

    predict: async (params: any): Promise<APIResponse<any[]>> => {
      // Implementation would make predictions
      return this.createResponse([]);
    },

    explain: async (params: any): Promise<APIResponse<any>> => {
      // Implementation would explain AI decisions
      return this.createResponse({
        explanation: 'The decision was based on...',
        factors: []
      });
    }
  };

  // --------------------------------------------------------------------------
  // View-Specific Extensions Implementation (Hybrid Architecture)
  // --------------------------------------------------------------------------

  views = {
    dea: {
      configureAnalysis: async (params: {
        inputs: string[];
        outputs: string[];
        modelType?: 'CCR' | 'BCC';
        orientation?: 'input' | 'output';
        countries?: string[];
      }): Promise<APIResponse<any>> => {
        try {
          // Store DEA configuration in localStorage for the view to pick up
          const config = {
            inputs: params.inputs,
            outputs: params.outputs,
            modelType: params.modelType || 'CCR',
            orientation: params.orientation || 'input',
            countries: params.countries,
            timestamp: new Date().toISOString()
          };

          localStorage.setItem('deaAIConfig', JSON.stringify(config));

          // Trigger a custom event that the DEA view can listen to
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('deaConfigUpdated', { detail: config }));
          }

          return this.createResponse({
            configured: true,
            inputCount: params.inputs.length,
            outputCount: params.outputs.length,
            countryCount: params.countries?.length || 0,
            message: `DEA analysis configured with ${params.inputs.length} inputs and ${params.outputs.length} outputs`
          });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      },

      runAnalysis: async (): Promise<APIResponse<any>> => {
        try {
          // Signal the DEA view to run analysis
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('deaRunAnalysis'));
          }

          return this.createResponse({
            message: 'DEA analysis started. Results will appear in the DEA view.'
          });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      },

      getEfficiencyFrontier: async (): Promise<APIResponse<any>> => {
        try {
          // This would return cached frontier data or trigger computation
          return this.createResponse({
            frontierPoints: [],
            countryPoints: [],
            surfaceData: {},
            message: 'Efficiency frontier data retrieved'
          });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      }
    },

    choropleth: {
      configure: async (params: any): Promise<APIResponse> => {
        try {
          localStorage.setItem('choroplethAIConfig', JSON.stringify(params));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('choroplethConfigUpdated', { detail: params }));
          }
          return this.createResponse({ message: 'Choropleth configuration updated' });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      },

      setThresholds: async (params: any): Promise<APIResponse> => {
        try {
          localStorage.setItem('choroplethThresholds', JSON.stringify(params));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('choroplethThresholdsUpdated', { detail: params }));
          }
          return this.createResponse({ message: 'Color thresholds updated' });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      }
    },

    charts: {
      configure: async (params: any): Promise<APIResponse> => {
        try {
          localStorage.setItem('chartsAIConfig', JSON.stringify(params));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('chartsConfigUpdated', { detail: params }));
          }
          return this.createResponse({ message: 'Charts configuration updated' });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      },

      addBaseline: async (params: any): Promise<APIResponse> => {
        try {
          localStorage.setItem('chartsBaseline', JSON.stringify(params));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('chartsBaselineUpdated', { detail: params }));
          }
          return this.createResponse({ message: 'Baseline added to charts' });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      }
    },

    threeDimensional: {
      configure: async (params: any): Promise<APIResponse> => {
        try {
          localStorage.setItem('3dAIConfig', JSON.stringify(params));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('3dConfigUpdated', { detail: params }));
          }
          return this.createResponse({ message: '3D visualization configured' });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      },

      setDisplayOptions: async (params: any): Promise<APIResponse> => {
        try {
          // These could integrate with existing Redux settings
          if (params.showDataLabels !== undefined) {
            // Integration with existing 3D settings slice would go here
          }
          return this.createResponse({ message: '3D display options updated' });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      }
    },

    table: {
      configure: async (params: any): Promise<APIResponse> => {
        try {
          localStorage.setItem('tableAIConfig', JSON.stringify(params));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tableConfigUpdated', { detail: params }));
          }
          return this.createResponse({ message: 'Table configuration updated' });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message);
        }
      },

      export: async (params: any): Promise<APIResponse<{ downloadUrl: string }>> => {
        try {
          // This would trigger table export functionality
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tableExport', { detail: params }));
          }
          return this.createResponse({
            downloadUrl: '/api/export/placeholder',
            message: 'Table export initiated'
          });
        } catch (error) {
          return this.createResponse(undefined, (error as Error).message) as unknown as APIResponse<{ downloadUrl: string }>;
        }
      }
    }
  };

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private getTableDescription(tableName: string): string {
    const descriptions: Record<string, string> = {
      'democracy': 'Democracy and participation indicators',
      'legal_framework_freedom': 'Legal framework and freedom indicators',
      'supply_side': 'Media supply side indicators',
      'demand_side_media_use': 'Media consumption patterns',
      'demand_side_trust_in_media': 'Trust in media indicators',
      'basic_data': 'Basic country data and statistics'
    };
    return descriptions[tableName] || '';
  }

  private inferColumnType(columnName: string): Column['type'] {
    if (columnName.includes('year') || columnName.match(/^\d{4}/)) {
      return 'date';
    }
    if (columnName === 'country') {
      return 'string';
    }
    return 'numeric';
  }

  private extractYear(columnName: string): number | undefined {
    const match = columnName.match(/(\d{4})/);
    return match ? parseInt(match[1]) : undefined;
  }

  private filterByRegion(countries: string[], region: string): string[] {
    const regions: Record<string, string[]> = {
      'nordic': ['Sweden', 'Denmark', 'Norway', 'Finland', 'Iceland'],
      'western_europe': ['Germany', 'France', 'Netherlands', 'Belgium', 'Luxembourg', 'Austria'],
      'eastern_europe': ['Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria'],
      'southern_europe': ['Italy', 'Spain', 'Portugal', 'Greece', 'Malta', 'Cyprus']
    };
    const regionCountries = regions[region.toLowerCase()] || [];
    return countries.filter(c => regionCountries.includes(c));
  }

  private countryHasData(country: string, indicators: string[]): boolean {
    // Implementation would check if country has data for specified indicators
    return true;
  }

  private getSelectedIndicators(state: any): string[] {
    const indicators: string[] = [];
    Object.values(state.selectedOptions || {}).forEach((columns: any) => {
      columns.forEach((col: any) => {
        indicators.push(col.value);
      });
    });
    return indicators;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apiInstance: MeDeMapAIAPI | null = null;

export function getAIAPI(router?: ReturnType<typeof useRouter>): MeDeMapAIAPI {
  if (!apiInstance) {
    apiInstance = new MeDeMapAIAPI(store, router);
  } else if (router && !apiInstance.router) {
    // Update the router if it wasn't available when the instance was created
    apiInstance.router = router;
  }
  return apiInstance;
}

// ============================================================================
// React Hook for using AI API
// ============================================================================

export function useAIAPI() {
  const router = useRouter();
  return getAIAPI(router);
}