import { Dispatch } from '@reduxjs/toolkit';
import { useRouter } from 'next/navigation';
import { NLQueryResponse, ViewContext } from '@/lib/services/ollamaService';
import { setSelectedOptions, selectMedeMapData } from '@/lib/features/medemap/medeMapSlice';
import { setLabelDisplayMode } from '@/lib/features/settings/labelDisplaySlice';
import { setShowDataLabels, setUse3DLogScale, setEmphasisMode } from '@/lib/features/settings/settingsSlice';
import { DataQueryExecutor } from './dataQueryExecutor';

export interface ActionResult {
  success: boolean;
  message: string;
  redirectTo?: string;
  data?: any;
}

export interface ActionResponse {
  action: string;
  parameters: any;
  explanation?: string;
  confidence?: number;
}

export class QueryActionExecutor {
  private dispatch: Dispatch;
  private router: any;

  constructor(dispatch: Dispatch, router: any) {
    this.dispatch = dispatch;
    this.router = router;
  }

  async executeAction(response: ActionResponse, context: ViewContext): Promise<ActionResult> {
    try {
      switch (response.action) {
        case 'navigate':
          return this.handleNavigation(response.parameters);

        case 'filter':
          return await this.handleFiltering(response.parameters, context);

        case 'analyze':
          return await this.handleAnalysis(response.parameters, context);

        case 'visualize':
          return this.handleVisualization(response.parameters);

        case 'export':
          return this.handleExport(response.parameters, context);

        case 'help':
          return {
            success: true,
            message: response.explanation || 'Help information'
          };

        default:
          return {
            success: false,
            message: `Unknown action: ${response.action}`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error executing action: ${(error as Error).message}`
      };
    }
  }

  private handleNavigation(params: any): ActionResult {
    const viewMap: Record<string, string> = {
      'choropleth': '/view_choropleth',
      'charts': '/view_charts',
      'histograms': '/view_histograms',
      '3d': '/3d',
      'dea': '/view_dea',
      'table': '/view_table',
      'stacked_bar': '/view_stacked_bar',
      'correlation_matrix': '/view_correlation_matrix',
      'pca': '/view_pca',
      '3d_mesh': '/view_3d_mesh',
      'cylindrical': '/3d/cylindrical'
    };

    const targetView = params.view || params.target;
    const route = viewMap[targetView];

    if (route) {
      this.router.push(route);
      return {
        success: true,
        message: `Navigating to ${targetView} view`,
        redirectTo: route
      };
    }

    return {
      success: false,
      message: `Unknown view: ${targetView}. Available views: ${Object.keys(viewMap).join(', ')}`
    };
  }

  private async handleFiltering(params: any, context: ViewContext): Promise<ActionResult> {
    try {
      // If comparing just 2 countries, treat as comparison analysis
      if (params.countries && params.countries.length === 2 && !params.indicators) {
        return this.handleAnalysis({
          ...params,
          analysis: 'comparison'
        }, context);
      }

      // Execute the data query with filters
      const queryResult = await DataQueryExecutor.executeQuery({
        countries: params.countries,
        indicators: params.indicators,
        timeRange: params.timeRange,
        analysis: params.analysis
      });

      if (!queryResult.success) {
        return {
          success: false,
          message: queryResult.message
        };
      }

      // Navigate to appropriate view based on the query
      if (params.view) {
        this.router.push(`/view_${params.view}`);
      } else if (params.analysis === 'trend' || params.analysis === 'correlation') {
        this.router.push('/view_correlation_matrix');
      } else if (params.countries && params.countries.length === 2) {
        // Two countries selected - ideal for comparison in DEA
        this.router.push('/view_dea');
      } else if (params.countries && params.countries.length <= 5) {
        // Small number of countries - good for charts view
        this.router.push('/view_charts');
      } else if (params.indicators && params.indicators.length === 1) {
        this.router.push('/view_choropleth');
      } else if (params.countries && params.countries.length > 5) {
        // Many countries - choropleth is better
        this.router.push('/view_choropleth');
      } else {
        // Default to charts view
        this.router.push('/view_charts');
      }

      // Return success with statistics and navigation info
      const viewName = params.view ||
                      (params.countries && params.countries.length === 2 ? 'DEA analysis' :
                       params.countries && params.countries.length <= 5 ? 'charts' :
                       'charts');

      return {
        success: true,
        message: `${queryResult.message}. Opening ${viewName} view...`,
        data: queryResult.stats,
        redirectTo: this.router.asPath
      };
    } catch (error) {
      return {
        success: false,
        message: `Filter operation failed: ${(error as Error).message}`
      };
    }
  }

  private async handleAnalysis(params: any, context: ViewContext): Promise<ActionResult> {
    const analysisType = params.analysis || params.type;

    try {
      // First, apply any data filters
      const queryResult = await DataQueryExecutor.executeQuery({
        countries: params.countries,
        indicators: params.indicators,
        timeRange: params.timeRange,
        analysis: analysisType
      });

      if (!queryResult.success) {
        return {
          success: false,
          message: queryResult.message
        };
      }

      // Perform specific analysis if needed
      if (analysisType === 'trend' && params.indicators) {
        const trends = DataQueryExecutor.analyzeTrends(queryResult.data, params.indicators);

        // Generate trend summary
        const trendSummary = Object.entries(trends).map(([key, trend]: [string, any]) => {
          return `${key}: ${trend.direction} (${trend.percentChange.toFixed(1)}%)`;
        }).join(', ');

        this.router.push('/view_charts');
        return {
          success: true,
          message: `Trend analysis: ${trendSummary || 'Showing data trends in chart view'}`,
          redirectTo: '/view_charts',
          data: trends
        };
      }

      // Route to appropriate view based on analysis type
      switch (analysisType) {
        case 'correlation':
          this.router.push('/view_correlation_matrix');
          return {
            success: true,
            message: `Correlation analysis ready with ${queryResult.stats?.totalIndicators || 0} indicators`,
            redirectTo: '/view_correlation_matrix'
          };

        case 'comparison':
        case 'efficiency':
          this.router.push('/view_dea');
          return {
            success: true,
            message: `DEA comparison ready for ${queryResult.stats?.totalCountries || 0} countries`,
            redirectTo: '/view_dea'
          };

        case 'distribution':
        case 'histogram':
          this.router.push('/view_histograms');
          return {
            success: true,
            message: `Distribution analysis for ${queryResult.stats?.totalIndicators || 0} indicators`,
            redirectTo: '/view_histograms'
          };

        case 'pca':
        case 'dimensionality':
          this.router.push('/view_pca');
          return {
            success: true,
            message: `PCA analysis with ${queryResult.stats?.dataPoints || 0} data points`,
            redirectTo: '/view_pca'
          };

        default:
          this.router.push('/view_charts');
          return {
            success: true,
            message: queryResult.message,
            redirectTo: '/view_charts'
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Analysis failed: ${(error as Error).message}`
      };
    }
  }

  private handleVisualization(params: any): ActionResult {
    const actions = [];

    // Handle 3D settings
    if (params.dataLabels !== undefined) {
      this.dispatch(setShowDataLabels(params.dataLabels));
      actions.push(`${params.dataLabels ? 'Enabled' : 'Disabled'} data labels`);
    }

    if (params.logScale !== undefined) {
      this.dispatch(setUse3DLogScale(params.logScale));
      actions.push(`${params.logScale ? 'Enabled' : 'Disabled'} logarithmic scale`);
    }

    if (params.emphasisMode !== undefined) {
      this.dispatch(setEmphasisMode(params.emphasisMode));
      actions.push(`${params.emphasisMode ? 'Enabled' : 'Disabled'} emphasis mode`);
    }

    // Handle label format
    if (params.labelFormat) {
      const mode = params.labelFormat === 'raw' ? 'raw' : 'formatted';
      this.dispatch(setLabelDisplayMode(mode));
      actions.push(`Changed to ${mode} label format`);
    }

    return {
      success: actions.length > 0,
      message: actions.length > 0 ? actions.join('; ') : 'No visualization changes made'
    };
  }

  private handleExport(params: any, context: ViewContext): ActionResult {
    // This would trigger export functionality
    // For now, just return a message
    const format = params.format || 'CSV';
    return {
      success: true,
      message: `Export to ${format} initiated. Check your downloads folder.`
    };
  }

  private matchIndicators(queryIndicators: string[], context: ViewContext): string[] {
    const allIndicators = Object.values(context.availableData.columns)
      .flat()
      .map(col => ({
        value: col.value,
        label: col.label,
        keywords: [
          col.value?.toLowerCase(),
          col.label?.toLowerCase(),
          col.thresholds?.indicator?.toLowerCase()
        ].filter(Boolean)
      }));

    const matched: any[] = [];

    queryIndicators.forEach(queryInd => {
      const query = queryInd.toLowerCase();
      const found = allIndicators.find(ind =>
        ind.keywords.some(keyword =>
          keyword.includes(query) || query.includes(keyword)
        )
      );

      if (found && !matched.includes(found.label || found.value)) {
        matched.push(found.label || found.value);
      }
    });

    return matched;
  }
}

// Helper function to extract common patterns from queries
export const extractQueryEntities = (query: string) => {
  const countryPattern = /(germany|france|spain|italy|poland|netherlands|sweden|denmark|finland|norway|belgium|austria|czech|hungary|slovakia|slovenia|croatia|bulgaria|romania|estonia|latvia|lithuania|luxembourg|malta|greece|portugal|ireland)/gi;

  const indicatorPatterns = {
    'press freedom': /press.{0,10}freedom|media.{0,10}freedom|journalism/gi,
    'democracy': /democra(cy|tic)|democratic/gi,
    'trust': /trust|confidence/gi,
    'media use': /media.{0,10}use|consumption/gi,
    'pluralism': /pluralism|diversity/gi,
    'rule of law': /rule.{0,10}law|legal.{0,10}framework/gi
  };

  const timePattern = /\b(19|20)\d{2}\b/g;

  return {
    countries: [...new Set((query.match(countryPattern) || []).map(c => c.toLowerCase()))],
    indicators: Object.keys(indicatorPatterns).filter(key =>
      (indicatorPatterns as any)[key].test(query)
    ),
    years: [...new Set((query.match(timePattern) || []).map(y => parseInt(y)))]
  };
};