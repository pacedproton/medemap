/**
 * Professional Structured Logging Utility for MeDeMAP
 * 
 * 4-Level System: DEBUG | INFO | WARNING | ERROR
 * Configurable destinations: Console | Database
 * Redux-integrated configuration
 */

import { store } from '../store';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

// Level hierarchy for filtering
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARNING]: 2,
  [LogLevel.ERROR]: 3,
};

export interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  duration?: number;
  error?: Error | unknown;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  url?: string;
  userAgent?: string;
}

// Keep original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

// Safe JSON stringify that handles circular references and special objects
function safeStringify(obj: any): string {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (value instanceof Element || value instanceof Node) {
        return '[DOM Element]';
      }
      if (value._owner) {
        return '[React Component]';
      }
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
  }, 2);
}

// Serialize context for logging
function serializeContext(context?: LogContext): string {
  if (!context) return '';
  
  try {
    if (context.error) {
      const error = context.error;
      if (error instanceof Error) {
        context.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }
    }
    
    return safeStringify(context);
  } catch (error) {
    return `[Context serialization error: ${error instanceof Error ? error.message : 'unknown'}]`;
  }
}

// Safe localStorage access for SSR compatibility
const getLocalStorageItem = (key: string, defaultValue: string = ''): string => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch {
    return defaultValue;
  }
};

// Get logging configuration from Redux
function getLogConfig(): {
  level: LogLevel;
  toConsole: boolean;
  toDatabase: boolean;
  verboseMode: boolean;
} {
  try {
    const state = store.getState();
    return {
      level: (state.settings?.logLevel || 'info') as LogLevel,
      toConsole: state.settings?.logToConsole ?? true,
      toDatabase: state.settings?.logToDatabase ?? true,
      verboseMode: state.settings?.verboseLogging ?? false,
    };
  } catch {
    // Fallback to localStorage if Redux is not available
    try {
      return {
        level: (getLocalStorageItem('logLevel', 'info')) as LogLevel,
        toConsole: JSON.parse(getLocalStorageItem('logToConsole', 'true')),
        toDatabase: JSON.parse(getLocalStorageItem('logToDatabase', 'true')),
        verboseMode: JSON.parse(getLocalStorageItem('verboseLogging', 'false')),
      };
    } catch {
      // Final fallback
      return {
        level: LogLevel.INFO,
        toConsole: true,
        toDatabase: true,
        verboseMode: false,
      };
    }
  }
}

// Send log to server API
async function sendLogToServer(entry: LogEntry): Promise<void> {
  // Skip server logging in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    const response = await fetch('/api/serversidelogging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        url: entry.url || (typeof window !== 'undefined' ? window.location.pathname : ''),
        userAgent: entry.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        context: entry.context,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (err) {
    // Use original console to avoid recursive logging
    originalConsole.error('[Logger] Failed to send log to server:', err);
  }
}

// Determine if a log should be processed based on level and config
function shouldLog(level: LogLevel): { console: boolean; database: boolean } {
  const config = getLogConfig();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Check if this log level meets the minimum configured level
  const meetsLevelThreshold = LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.level];
  
  if (!meetsLevelThreshold) {
    return { console: false, database: false };
  }

  return {
    console: config.toConsole,
    database: config.toDatabase && !isDevelopment, // Don't spam DB in development
  };
}

// Core logging function
function logInternal(
  level: LogLevel,
  message: string,
  context?: LogContext
): void {
  const shouldProcess = shouldLog(level);
  
  if (!shouldProcess.console && !shouldProcess.database) {
    return; // Skip completely
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    url: typeof window !== 'undefined' ? window.location.pathname : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  // Console logging
  if (shouldProcess.console) {
    const contextStr = context ? ` ${serializeContext(context)}` : '';
    const logMessage = `[${level.toUpperCase()}] ${message}${contextStr}`;
    
    switch (level) {
      case LogLevel.ERROR:
        originalConsole.error(logMessage, context?.error || '');
        break;
      case LogLevel.WARNING:
        originalConsole.warn(logMessage);
        break;
      case LogLevel.INFO:
        originalConsole.info(logMessage);
        break;
      case LogLevel.DEBUG:
        originalConsole.debug(logMessage);
        break;
    }
  }

  // Database logging
  if (shouldProcess.database) {
    sendLogToServer(entry).catch(err => {
      originalConsole.error('[Logger] Failed to log to database:', err);
    });
  }
}

// Public API
export const logger = {
  /**
   * DEBUG: Detailed diagnostic information for development
   * Use for: variable values, state dumps, detailed execution flow
   */
  debug: (message: string, context?: LogContext) => {
    logInternal(LogLevel.DEBUG, message, context);
  },

  /**
   * INFO: General informational messages about application operation
   * Use for: successful operations, user actions, system events
   */
  info: (message: string, context?: LogContext) => {
    logInternal(LogLevel.INFO, message, context);
  },

  /**
   * WARNING: Potentially harmful situations that don't prevent operation
   * Use for: deprecated features, fallback behaviors, recoverable issues
   */
  warning: (message: string, context?: LogContext) => {
    logInternal(LogLevel.WARNING, message, context);
  },

  /**
   * ERROR: Error events that might still allow the application to continue
   * Use for: exceptions, failed operations, data validation errors
   */
  error: (message: string, context?: LogContext) => {
    logInternal(LogLevel.ERROR, message, context);
  },

  /**
   * Create a performance logger that automatically tracks duration
   */
  startTimer: (label: string, context?: LogContext) => {
    const startTime = performance.now();
    return {
      end: (additionalContext?: LogContext) => {
        const duration = Math.round(performance.now() - startTime);
        logger.info(`${label} completed`, {
          ...context,
          ...additionalContext,
          duration,
        });
      },
    };
  },
};

export default logger;
