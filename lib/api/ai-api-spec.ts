/**
 * Comprehensive AI API Specification for MeDeMAP
 *
 * This API provides a complete interface for AI agents to interact with
 * the MeDeMAP application, enabling data manipulation, analysis, visualization,
 * and UI control through a unified, extensible interface.
 */

// ============================================================================
// Core Types and Interfaces
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    executionTime: number;
    affectedRecords?: number;
    warnings?: string[];
  };
}

export interface DataFilter {
  countries?: string[];
  indicators?: string[];
  timeRange?: {
    start?: number;
    end?: number;
  };
  conditions?: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
    value: any;
  }>;
}

export interface Column {
  name: string;
  label: string;
  type: 'numeric' | 'string' | 'date' | 'boolean';
  table: string;
  metadata?: {
    unit?: string;
    source?: string;
    year?: number;
    description?: string;
    thresholds?: {
      low?: number;
      medium?: number;
      high?: number;
      euAverage?: number;
    };
  };
}

export interface DataPoint {
  country: string;
  indicator: string;
  value: number | string;
  year?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Main AI API Interface
// ============================================================================

export interface AIAPI {

  // --------------------------------------------------------------------------
  // Data Discovery & Exploration
  // --------------------------------------------------------------------------

  discovery: {
    /**
     * Get all available data tables in the system
     */
    getTables(): Promise<APIResponse<{
      tables: Array<{
        name: string;
        displayName: string;
        recordCount: number;
        columnCount: number;
        description?: string;
      }>;
    }>>;

    /**
     * Get columns for a specific table or all tables
     */
    getColumns(params?: {
      table?: string;
      pattern?: string;
      type?: Column['type'];
    }): Promise<APIResponse<Column[]>>;

    /**
     * Get all unique countries in the dataset
     */
    getCountries(params?: {
      hasData?: string[]; // Only countries with data for these indicators
      region?: string;
    }): Promise<APIResponse<string[]>>;

    /**
     * Get available years in the dataset
     */
    getYears(params?: {
      indicator?: string;
      country?: string;
    }): Promise<APIResponse<number[]>>;

    /**
     * Search for indicators by keyword
     */
    searchIndicators(params: {
      query: string;
      fuzzy?: boolean;
      limit?: number;
    }): Promise<APIResponse<Column[]>>;

    /**
     * Get data schema and relationships
     */
    getSchema(): Promise<APIResponse<{
      tables: Record<string, {
        columns: Column[];
        primaryKey: string;
        foreignKeys?: Array<{
          column: string;
          references: { table: string; column: string };
        }>;
      }>;
    }>>;
  };

  // --------------------------------------------------------------------------
  // Data Manipulation & Filtering
  // --------------------------------------------------------------------------

  data: {
    /**
     * Get filtered data with advanced querying capabilities
     */
    query(params: {
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
    }): Promise<APIResponse<DataPoint[]>>;

    /**
     * Get data in pivot table format
     */
    pivot(params: {
      rows: string[];
      columns: string[];
      values: string;
      aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
      filter?: DataFilter;
    }): Promise<APIResponse<any[][]>>;

    /**
     * Get time series data
     */
    getTimeSeries(params: {
      indicator: string;
      countries?: string[];
      fillMissing?: 'interpolate' | 'forward' | 'backward' | 'zero';
    }): Promise<APIResponse<{
      series: Array<{
        country: string;
        data: Array<{ year: number; value: number }>;
      }>;
    }>>;

    /**
     * Get statistical summary of data
     */
    getStatistics(params: {
      indicators: string[];
      countries?: string[];
      statistics?: Array<'mean' | 'median' | 'mode' | 'stddev' | 'min' | 'max' | 'quartiles'>;
    }): Promise<APIResponse<Record<string, any>>>;

    /**
     * Validate data integrity
     */
    validate(params?: {
      table?: string;
      checks?: Array<'missing' | 'outliers' | 'types' | 'ranges'>;
    }): Promise<APIResponse<{
      valid: boolean;
      issues: Array<{
        type: string;
        severity: 'error' | 'warning' | 'info';
        location: string;
        message: string;
      }>;
    }>>;
  };

  // --------------------------------------------------------------------------
  // Selection & State Management
  // --------------------------------------------------------------------------

  selection: {
    /**
     * Set selected countries
     */
    setCountries(countries: string[]): Promise<APIResponse>;

    /**
     * Set selected indicators
     */
    setIndicators(indicators: string[]): Promise<APIResponse>;

    /**
     * Get current selections
     */
    getCurrent(): Promise<APIResponse<{
      countries: string[];
      indicators: string[];
      timeRange?: { start: number; end: number };
      view: string;
    }>>;

    /**
     * Save selection as preset
     */
    savePreset(params: {
      name: string;
      description?: string;
      selections: any;
    }): Promise<APIResponse<{ id: string }>>;

    /**
     * Load selection preset
     */
    loadPreset(id: string): Promise<APIResponse>;

    /**
     * Get available presets
     */
    getPresets(): Promise<APIResponse<Array<{
      id: string;
      name: string;
      description?: string;
      created: Date;
    }>>>;

    /**
     * Clear all or specific selections
     */
    clear(params?: {
      countries?: boolean;
      indicators?: boolean;
      all?: boolean;
    }): Promise<APIResponse>;
  };

  // --------------------------------------------------------------------------
  // Analysis & Computation
  // --------------------------------------------------------------------------

  analysis: {
    /**
     * Run Data Envelopment Analysis
     */
    runDEA(params: {
      inputs: string[];
      outputs: string[];
      countries?: string[];
      model?: 'CCR' | 'BCC' | 'SBM';
      orientation?: 'input' | 'output';
    }): Promise<APIResponse<{
      efficiency: Record<string, number>;
      peers: Record<string, string[]>;
      weights: Record<string, any>;
      frontier: DataPoint[];
    }>>;

    /**
     * Calculate correlations
     */
    correlations(params: {
      indicators: string[];
      countries?: string[];
      method?: 'pearson' | 'spearman' | 'kendall';
      threshold?: number;
    }): Promise<APIResponse<{
      matrix: number[][];
      significant: Array<{
        indicator1: string;
        indicator2: string;
        correlation: number;
        pValue: number;
      }>;
    }>>;

    /**
     * Perform trend analysis
     */
    trends(params: {
      indicator: string;
      countries?: string[];
      method?: 'linear' | 'polynomial' | 'exponential' | 'moving_average';
      forecast?: number; // Years to forecast
    }): Promise<APIResponse<{
      trends: Array<{
        country: string;
        slope: number;
        intercept: number;
        r2: number;
        forecast?: Array<{ year: number; value: number; confidence: [number, number] }>;
        classification: 'increasing' | 'decreasing' | 'stable';
      }>;
    }>>;

    /**
     * Run Principal Component Analysis
     */
    runPCA(params: {
      indicators: string[];
      countries?: string[];
      components?: number;
      standardize?: boolean;
    }): Promise<APIResponse<{
      components: Array<{
        explained_variance: number;
        loadings: Record<string, number>;
      }>;
      scores: Array<{
        country: string;
        components: number[];
      }>;
      totalVarianceExplained: number;
    }>>;

    /**
     * Detect outliers
     */
    detectOutliers(params: {
      indicator: string;
      method?: 'iqr' | 'zscore' | 'isolation_forest' | 'dbscan';
      threshold?: number;
    }): Promise<APIResponse<{
      outliers: Array<{
        country: string;
        value: number;
        score: number;
        reason: string;
      }>;
    }>>;

    /**
     * Perform clustering
     */
    cluster(params: {
      indicators: string[];
      method?: 'kmeans' | 'hierarchical' | 'dbscan';
      clusters?: number;
      countries?: string[];
    }): Promise<APIResponse<{
      clusters: Array<{
        id: number;
        countries: string[];
        centroid: Record<string, number>;
        characteristics: string[];
      }>;
      silhouetteScore: number;
    }>>;

    /**
     * Run regression analysis
     */
    regression(params: {
      dependent: string;
      independent: string[];
      countries?: string[];
      type?: 'linear' | 'multiple' | 'logistic' | 'ridge' | 'lasso';
    }): Promise<APIResponse<{
      coefficients: Record<string, number>;
      intercept: number;
      r2: number;
      adjustedR2: number;
      pValues: Record<string, number>;
      predictions?: Array<{
        country: string;
        actual: number;
        predicted: number;
        residual: number;
      }>;
    }>>;
  };

  // --------------------------------------------------------------------------
  // Visualization & UI Control
  // --------------------------------------------------------------------------

  visualization: {
    /**
     * Navigate to a specific view
     */
    navigateTo(view:
      | 'choropleth'
      | 'charts'
      | 'table'
      | 'dea'
      | '3d'
      | 'correlation_matrix'
      | 'pca'
      | 'histograms'
      | 'stacked_bar'
      | '3d_mesh'
      | 'cylindrical'
    ): Promise<APIResponse>;

    /**
     * Get current view information
     */
    getCurrentView(): Promise<APIResponse<{
      name: string;
      config: any;
      data: any;
    }>>;

    /**
     * Update visualization settings
     */
    updateSettings(params: {
      colorScheme?: string;
      scale?: 'linear' | 'log' | 'sqrt';
      showLabels?: boolean;
      labelFormat?: 'raw' | 'formatted';
      opacity?: number;
      size?: { width: number; height: number };
      animation?: boolean;
    }): Promise<APIResponse>;

    /**
     * Create custom visualization
     */
    createCustom(params: {
      type: 'scatter' | 'line' | 'bar' | 'heatmap' | 'sankey' | 'network' | 'treemap';
      data: any;
      config: {
        x?: string;
        y?: string;
        z?: string;
        color?: string;
        size?: string;
        title?: string;
        axes?: any;
        legend?: any;
      };
    }): Promise<APIResponse<{ id: string }>>;

    /**
     * Take screenshot of current view
     */
    screenshot(params?: {
      format?: 'png' | 'jpeg' | 'svg';
      quality?: number;
      width?: number;
      height?: number;
    }): Promise<APIResponse<{ url: string }>>;

    /**
     * Generate visualization recommendation
     */
    recommend(params: {
      indicators: string[];
      intent?: 'compare' | 'trend' | 'distribution' | 'relationship' | 'composition';
    }): Promise<APIResponse<{
      recommended: string;
      reason: string;
      alternatives: string[];
    }>>;
  };

  // --------------------------------------------------------------------------
  // Export & Reporting
  // --------------------------------------------------------------------------

  export: {
    /**
     * Export data in various formats
     */
    exportData(params: {
      format: 'csv' | 'json' | 'excel' | 'parquet';
      data?: any;
      filter?: DataFilter;
      filename?: string;
    }): Promise<APIResponse<{ url: string }>>;

    /**
     * Generate PDF report
     */
    generateReport(params: {
      title: string;
      sections: Array<{
        type: 'text' | 'table' | 'chart' | 'statistics';
        content: any;
        config?: any;
      }>;
      template?: string;
    }): Promise<APIResponse<{ url: string }>>;

    /**
     * Create shareable link
     */
    createShareLink(params: {
      view: string;
      selections: any;
      expiresIn?: number; // hours
    }): Promise<APIResponse<{ url: string; shortUrl: string }>>;

    /**
     * Generate embed code
     */
    generateEmbed(params: {
      view: string;
      width?: number;
      height?: number;
      responsive?: boolean;
    }): Promise<APIResponse<{ html: string; iframe: string }>>;
  };

  // --------------------------------------------------------------------------
  // Collaboration & Annotations
  // --------------------------------------------------------------------------

  collaboration: {
    /**
     * Add annotation to data point or view
     */
    addAnnotation(params: {
      target: {
        type: 'datapoint' | 'view' | 'selection';
        id: string;
      };
      text: string;
      tags?: string[];
    }): Promise<APIResponse<{ id: string }>>;

    /**
     * Get annotations
     */
    getAnnotations(params?: {
      target?: string;
      tags?: string[];
      author?: string;
    }): Promise<APIResponse<Array<{
      id: string;
      text: string;
      author: string;
      created: Date;
      tags: string[];
    }>>>;

    /**
     * Create workspace
     */
    createWorkspace(params: {
      name: string;
      description?: string;
      public?: boolean;
    }): Promise<APIResponse<{ id: string }>>;

    /**
     * Share workspace
     */
    shareWorkspace(params: {
      workspaceId: string;
      users?: string[];
      permissions?: 'view' | 'edit' | 'admin';
    }): Promise<APIResponse>;
  };

  // --------------------------------------------------------------------------
  // System & Metadata
  // --------------------------------------------------------------------------

  system: {
    /**
     * Get API capabilities and version
     */
    getCapabilities(): Promise<APIResponse<{
      version: string;
      features: string[];
      limits: {
        maxDataPoints: number;
        maxConcurrentRequests: number;
        rateLimits: any;
      };
    }>>;

    /**
     * Get system status
     */
    getStatus(): Promise<APIResponse<{
      healthy: boolean;
      database: 'connected' | 'disconnected';
      cache: 'connected' | 'disconnected';
      performance: {
        avgResponseTime: number;
        activeRequests: number;
      };
    }>>;

    /**
     * Execute batch operations
     */
    batch(operations: Array<{
      id: string;
      method: string;
      params: any;
    }>): Promise<APIResponse<Array<{
      id: string;
      result: any;
      error?: string;
    }>>>;

    /**
     * Get operation history
     */
    getHistory(params?: {
      limit?: number;
      offset?: number;
      operations?: string[];
    }): Promise<APIResponse<Array<{
      timestamp: Date;
      operation: string;
      params: any;
      result: any;
      duration: number;
    }>>>;

    /**
     * Undo last operation
     */
    undo(): Promise<APIResponse>;

    /**
     * Redo operation
     */
    redo(): Promise<APIResponse>;
  };

  // --------------------------------------------------------------------------
  // Machine Learning & AI Integration
  // --------------------------------------------------------------------------

  ml: {
    /**
     * Get AI recommendations based on current context
     */
    getRecommendations(params?: {
      context?: 'analysis' | 'visualization' | 'data';
      limit?: number;
    }): Promise<APIResponse<Array<{
      action: string;
      description: string;
      confidence: number;
      execute?: () => Promise<any>;
    }>>>;

    /**
     * Train custom model
     */
    trainModel(params: {
      type: 'classification' | 'regression' | 'clustering';
      features: string[];
      target?: string;
      algorithm?: string;
      hyperparameters?: any;
    }): Promise<APIResponse<{
      modelId: string;
      metrics: any;
    }>>;

    /**
     * Make predictions
     */
    predict(params: {
      modelId: string;
      data: any[];
    }): Promise<APIResponse<Array<{
      input: any;
      prediction: any;
      confidence?: number;
    }>>>;

    /**
     * Explain AI decisions
     */
    explain(params: {
      operation: string;
      result: any;
    }): Promise<APIResponse<{
      explanation: string;
      factors: Array<{
        factor: string;
        impact: number;
        description: string;
      }>;
    }>>;
  };

  // --------------------------------------------------------------------------
  // View-Specific Extensions (Hybrid Architecture)
  // --------------------------------------------------------------------------

  views: {
    /**
     * DEA Analysis specific methods
     */
    dea: {
      /**
       * Configure DEA analysis parameters
       */
      configureAnalysis(params: {
        inputs: string[];
        outputs: string[];
        modelType?: 'CCR' | 'BCC';
        orientation?: 'input' | 'output';
        countries?: string[];
      }): Promise<APIResponse<{
        configured: boolean;
        inputCount: number;
        outputCount: number;
        countryCount: number;
      }>>;

      /**
       * Run DEA analysis with current configuration
       */
      runAnalysis(): Promise<APIResponse<{
        results: Array<{
          country: string;
          efficiency: number;
          peers: string[];
          weights: Record<string, number>;
          slacks: Record<string, number>;
        }>;
        summary: {
          efficientCount: number;
          avgEfficiency: number;
          benchmarks: string[];
        };
      }>>;

      /**
       * Get efficiency frontier visualization data
       */
      getEfficiencyFrontier(): Promise<APIResponse<{
        frontierPoints: Array<{ x: number; y: number; z: number }>;
        countryPoints: Array<{ x: number; y: number; z: number; country: string; efficient: boolean }>;
        surfaceData: any;
      }>>;
    };

    /**
     * Choropleth map specific methods
     */
    choropleth: {
      /**
       * Configure map visualization
       */
      configure(params: {
        indicator: string;
        colorScale?: 'reds' | 'blues' | 'greens' | 'viridis' | 'plasma';
        showLegend?: boolean;
        projection?: 'mercator' | 'natural earth' | 'orthographic';
      }): Promise<APIResponse>;

      /**
       * Set color thresholds
       */
      setThresholds(params: {
        low: number;
        medium: number;
        high: number;
        method?: 'manual' | 'quantile' | 'equal-interval';
      }): Promise<APIResponse>;
    };

    /**
     * Charts view specific methods
     */
    charts: {
      /**
       * Configure chart type and settings
       */
      configure(params: {
        chartType: 'bar' | 'line' | 'scatter' | 'area';
        aggregation?: 'sum' | 'avg' | 'max' | 'min';
        groupBy?: 'country' | 'indicator' | 'year';
        showTrend?: boolean;
      }): Promise<APIResponse>;

      /**
       * Add comparison baseline
       */
      addBaseline(params: {
        type: 'eu_average' | 'custom' | 'median';
        value?: number;
        label?: string;
      }): Promise<APIResponse>;
    };

    /**
     * 3D visualization specific methods
     */
    threeDimensional: {
      /**
       * Configure 3D scene
       */
      configure(params: {
        xAxis: string;
        yAxis: string;
        zAxis: string;
        colorBy?: string;
        showGrid?: boolean;
        cameraPosition?: { x: number; y: number; z: number };
      }): Promise<APIResponse>;

      /**
       * Control 3D settings
       */
      setDisplayOptions(params: {
        showDataLabels?: boolean;
        useLogScale?: boolean;
        emphasisMode?: boolean;
        pointSize?: number;
        transparency?: number;
      }): Promise<APIResponse>;
    };

    /**
     * Table view specific methods
     */
    table: {
      /**
       * Configure table display
       */
      configure(params: {
        columns?: string[];
        sortBy?: string;
        sortDirection?: 'asc' | 'desc';
        pageSize?: number;
        showFilters?: boolean;
      }): Promise<APIResponse>;

      /**
       * Export table data
       */
      export(params: {
        format: 'csv' | 'excel' | 'json';
        filename?: string;
        includeMetadata?: boolean;
      }): Promise<APIResponse<{ downloadUrl: string }>>;
    };
  };
}

// ============================================================================
// Function Calling Interface for AI
// ============================================================================

export interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: any[];
      required?: boolean;
    }>;
    required?: string[];
  };
  handler: (params: any) => Promise<any>;
}

export class AIAPIFunctions {
  /**
   * Register all API functions for AI to call
   */
  static getAllFunctions(): AIFunction[] {
    return [
      {
        name: 'discover_data',
        description: 'Discover available data tables, columns, and countries',
        parameters: {
          type: 'object',
          properties: {
            what: {
              type: 'string',
              enum: ['tables', 'columns', 'countries', 'years', 'schema'],
              description: 'What to discover'
            },
            filter: {
              type: 'object',
              description: 'Optional filters'
            }
          },
          required: ['what']
        },
        handler: async (params) => {
          // Implementation would call the appropriate discovery method
          return { success: true, data: [] };
        }
      },

      {
        name: 'query_data',
        description: 'Query and filter data with advanced options',
        parameters: {
          type: 'object',
          properties: {
            countries: {
              type: 'array',
              description: 'Countries to filter'
            },
            indicators: {
              type: 'array',
              description: 'Indicators to select'
            },
            aggregation: {
              type: 'string',
              enum: ['sum', 'avg', 'min', 'max'],
              description: 'Aggregation function'
            },
            groupBy: {
              type: 'array',
              description: 'Fields to group by'
            }
          }
        },
        handler: async (params) => {
          // Implementation
          return { success: true, data: [] };
        }
      },

      {
        name: 'analyze_data',
        description: 'Perform statistical analysis on data',
        parameters: {
          type: 'object',
          properties: {
            analysis: {
              type: 'string',
              enum: ['correlation', 'trend', 'outlier', 'pca', 'regression', 'dea'],
              description: 'Type of analysis',
              required: true
            },
            indicators: {
              type: 'array',
              description: 'Indicators to analyze'
            },
            countries: {
              type: 'array',
              description: 'Countries to include'
            },
            options: {
              type: 'object',
              description: 'Analysis-specific options'
            }
          },
          required: ['analysis']
        },
        handler: async (params) => {
          // Implementation
          return { success: true, data: {} };
        }
      },

      {
        name: 'visualize',
        description: 'Create or navigate to visualizations',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['navigate', 'create', 'update', 'screenshot'],
              description: 'Visualization action',
              required: true
            },
            view: {
              type: 'string',
              description: 'View to navigate to or create'
            },
            settings: {
              type: 'object',
              description: 'Visualization settings'
            }
          },
          required: ['action']
        },
        handler: async (params) => {
          // Implementation
          return { success: true };
        }
      },

      {
        name: 'manage_selection',
        description: 'Manage data selections and filters',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['set', 'get', 'clear', 'save', 'load'],
              description: 'Selection action',
              required: true
            },
            countries: {
              type: 'array',
              description: 'Countries to select'
            },
            indicators: {
              type: 'array',
              description: 'Indicators to select'
            },
            presetId: {
              type: 'string',
              description: 'Preset ID for save/load'
            }
          },
          required: ['action']
        },
        handler: async (params) => {
          // Implementation
          return { success: true };
        }
      },

      {
        name: 'export_data',
        description: 'Export data or generate reports',
        parameters: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['csv', 'json', 'excel', 'pdf', 'link'],
              description: 'Export format',
              required: true
            },
            includeData: {
              type: 'boolean',
              description: 'Include current data'
            },
            includeVisualizations: {
              type: 'boolean',
              description: 'Include visualizations'
            }
          },
          required: ['format']
        },
        handler: async (params) => {
          // Implementation
          return { success: true, data: { url: '' } };
        }
      }
    ];
  }

  /**
   * Execute a function by name
   */
  static async executeFunction(name: string, params: any): Promise<any> {
    const func = this.getAllFunctions().find(f => f.name === name);
    if (!func) {
      throw new Error(`Function ${name} not found`);
    }
    return func.handler(params);
  }
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
// Example 1: Compare countries on multiple indicators
const api: AIAPI = getAIAPI();

const result = await api.data.query({
  filter: {
    countries: ['Austria', 'Belgium'],
    indicators: ['press_freedom_2022', 'democracy_index_2022']
  }
});

await api.visualization.navigateTo('dea');

// Example 2: Complex analysis workflow
const trends = await api.analysis.trends({
  indicator: 'press_freedom',
  countries: ['Germany', 'France', 'Spain'],
  forecast: 5
});

const correlations = await api.analysis.correlations({
  indicators: ['press_freedom', 'democracy_index', 'gdp_per_capita'],
  method: 'pearson'
});

// Example 3: AI function calling
const functions = AIAPIFunctions.getAllFunctions();
const result = await AIAPIFunctions.executeFunction('query_data', {
  countries: ['Austria', 'Belgium'],
  indicators: ['press_freedom_2022']
});
*/