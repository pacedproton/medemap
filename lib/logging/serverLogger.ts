/**
 * Professional Server-Side Logging for MeDeMAP API Routes
 * 
 * 4-Level System: DEBUG | INFO | WARNING | ERROR
 * Environment-aware logging behavior
 */

export enum ServerLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

// Level hierarchy for filtering
const LOG_LEVEL_PRIORITY: Record<ServerLogLevel, number> = {
  [ServerLogLevel.DEBUG]: 0,
  [ServerLogLevel.INFO]: 1,
  [ServerLogLevel.WARNING]: 2,
  [ServerLogLevel.ERROR]: 3,
};

export interface ServerLogContext {
  component?: string;
  action?: string;
  table?: string;
  duration?: number;
  error?: Error | unknown;
  [key: string]: any;
}

// Get configured log level from environment or default
function getConfiguredLogLevel(): ServerLogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  
  switch (envLevel) {
    case 'debug':
      return ServerLogLevel.DEBUG;
    case 'info':
      return ServerLogLevel.INFO;
    case 'warning':
      return ServerLogLevel.WARNING;
    case 'error':
      return ServerLogLevel.ERROR;
    default:
      // Development: DEBUG, Production: INFO
      return process.env.NODE_ENV === 'development' 
        ? ServerLogLevel.DEBUG 
        : ServerLogLevel.INFO;
  }
}

// Safe JSON stringify for server-side objects
function safeStringify(obj: any): string {
  try {
    const seen = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      return value;
    });
  } catch {
    return '[Serialization Error]';
  }
}

// Format context for logging
function formatContext(context?: ServerLogContext): string {
  if (!context) return '';
  
  const parts: string[] = [];
  
  if (context.component) parts.push(`[${context.component}]`);
  if (context.action) parts.push(`<${context.action}>`);
  if (context.table) parts.push(`{${context.table}}`);
  if (context.duration !== undefined) parts.push(`(${context.duration}ms)`);
  
  // Add other context as JSON
  const { component, action, table, duration, error, ...rest } = context;
  if (Object.keys(rest).length > 0) {
    parts.push(safeStringify(rest));
  }
  
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

// Check if we should log based on level and environment
function shouldLog(level: ServerLogLevel): boolean {
  const isTest = process.env.NODE_ENV === 'test';
  
  // Never log in test environment
  if (isTest) return false;
  
  // Check if this log level meets the minimum configured level
  const configuredLevel = getConfiguredLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
}

// Core logging function
function logInternal(
  level: ServerLogLevel,
  message: string,
  context?: ServerLogContext
): void {
  if (!shouldLog(level)) return;
  
  const contextStr = formatContext(context);
  const logMessage = `[${level.toUpperCase()}] ${message}${contextStr}`;
  
  switch (level) {
    case ServerLogLevel.ERROR:
      console.error(logMessage, context?.error || '');
      break;
    case ServerLogLevel.WARNING:
      console.warn(logMessage);
      break;
    case ServerLogLevel.INFO:
      console.info(logMessage);
      break;
    case ServerLogLevel.DEBUG:
      console.debug(logMessage);
      break;
  }
}

// Public API
export const serverLogger = {
  /**
   * DEBUG: Detailed diagnostic information
   * Use for: query details, intermediate calculations, detailed flow
   */
  debug: (message: string, context?: ServerLogContext) => {
    logInternal(ServerLogLevel.DEBUG, message, context);
  },

  /**
   * INFO: General informational messages
   * Use for: successful operations, request handling, system events
   */
  info: (message: string, context?: ServerLogContext) => {
    logInternal(ServerLogLevel.INFO, message, context);
  },

  /**
   * WARNING: Potentially harmful situations
   * Use for: deprecated endpoints, fallback behaviors, rate limits
   */
  warning: (message: string, context?: ServerLogContext) => {
    logInternal(ServerLogLevel.WARNING, message, context);
  },

  /**
   * ERROR: Error events
   * Use for: exceptions, failed operations, database errors
   */
  error: (message: string, context?: ServerLogContext) => {
    logInternal(ServerLogLevel.ERROR, message, context);
  },

  /**
   * Create a performance timer
   */
  startTimer: (label: string, context?: ServerLogContext) => {
    const startTime = Date.now();
    return {
      end: (additionalContext?: ServerLogContext) => {
        const duration = Date.now() - startTime;
        serverLogger.info(`${label} completed`, {
          ...context,
          ...additionalContext,
          duration,
        });
      },
    };
  },
};

export default serverLogger;
