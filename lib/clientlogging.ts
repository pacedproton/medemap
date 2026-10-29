const originalConsole = { ...console };
let verboseLogging = false;
let consoleLogLevel: LogLevel = 'info';
let databaseLogLevel: LogLevel = 'error';

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug' | 'debug-detail';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  'none': 0,
  'error': 1,
  'warn': 2,
  'info': 3,
  'debug': 4,
  'debug-detail': 5,
};

// Safe JSON stringify that handles circular references
function safeStringify(obj: any): string {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      // Skip DOM elements and React fibers
      if (value instanceof Element || value instanceof Node) {
        return '[DOM Element]';
      }
      if (typeof value === 'object' && value._owner) {
        return '[React Component]';
      }
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    return value;
  }, 2);
}

async function sendLogToServer(level: string, ...args: any[]) {
  // Skip server logging in development for better performance
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return safeStringify(arg);
      } catch (error) {
        return `[Object - stringify error: ${(error as Error).message}]`;
      }
    }
    return String(arg);
  }).join(' ');

  const timestamp = new Date().toISOString();

  // Simplified log data for better performance
  const logData = {
    timestamp,
    level,
    message,
    url: window.location.pathname, // Only pathname, not full URL
  };

  try {
    const response = await fetch('/api/serversidelogging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (err) {
    originalConsole.error('[ERROR] Failed to send log to server:', err);
  }
}

export function setVerboseLogging(enabled: boolean) {
  verboseLogging = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('verboseLogging', JSON.stringify(enabled));
  }
}

export function setConsoleLogLevel(level: LogLevel) {
  consoleLogLevel = level;
  if (typeof window !== 'undefined') {
    localStorage.setItem('consoleLogLevel', JSON.stringify(level));
  }
}

export function setDatabaseLogLevel(level: LogLevel) {
  databaseLogLevel = level;
  if (typeof window !== 'undefined') {
    localStorage.setItem('databaseLogLevel', JSON.stringify(level));
  }
}

export function getConsoleLogLevel(): LogLevel {
  return consoleLogLevel;
}

export function getDatabaseLogLevel(): LogLevel {
  return databaseLogLevel;
}

function shouldLog(level: LogLevel, target: 'console' | 'database'): boolean {
  const targetLevel = target === 'console' ? consoleLogLevel : databaseLogLevel;
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[targetLevel];
}

export function setupClientLogging() {
  if (typeof window !== 'undefined') {
    console.log = (...args) => {
      if (shouldLog('info', 'console')) {
        originalConsole.log('[INFO]', ...args);
      }
      if (shouldLog('info', 'database')) {
        sendLogToServer('info', ...args).catch(err =>
          originalConsole.error('[ERROR] Failed to send log to server:', err)
        );
      }
    };

    console.error = (...args) => {
      if (shouldLog('error', 'console')) {
        originalConsole.error('[ERROR]', ...args);
      }
      if (shouldLog('error', 'database')) {
        sendLogToServer('error', ...args).catch(err =>
          originalConsole.error('[ERROR] Failed to send log to server:', err)
        );
      }
    };

    console.warn = (...args) => {
      if (shouldLog('warn', 'console')) {
        originalConsole.warn('[WARN]', ...args);
      }
      if (shouldLog('warn', 'database')) {
        sendLogToServer('warn', ...args).catch(err =>
          originalConsole.error('[ERROR] Failed to send log to server:', err)
        );
      }
    };

    console.info = (...args) => {
      if (shouldLog('info', 'console')) {
        originalConsole.info('[INFO]', ...args);
      }
      if (shouldLog('info', 'database')) {
        sendLogToServer('info', ...args).catch(err =>
          originalConsole.error('[ERROR] Failed to send log to server:', err)
        );
      }
    };

    console.debug = (...args) => {
      if (shouldLog('debug', 'console')) {
        originalConsole.debug('[DEBUG]', ...args);
      }
      if (shouldLog('debug', 'database')) {
        sendLogToServer('debug-detail', ...args).catch(err =>
          originalConsole.error('[ERROR] Failed to send log to server:', err)
        );
      }
    };
  }
}

export function logVerbose(tag: string, ...args: any[]) {
  if (verboseLogging) {
    const message = `[DEBUG-DETAIL][${tag}] ${args.join(' ')}`;
    originalConsole.debug(message);
    sendLogToServer('debug-detail', message);
  }
}

export function initializeLogging() {
  if (typeof window !== 'undefined') {
    const storedVerboseLogging = localStorage.getItem('verboseLogging');
    if (storedVerboseLogging !== null) {
      verboseLogging = JSON.parse(storedVerboseLogging);
    }

    const storedConsoleLogLevel = localStorage.getItem('consoleLogLevel');
    if (storedConsoleLogLevel !== null) {
      consoleLogLevel = JSON.parse(storedConsoleLogLevel);
    }

    const storedDatabaseLogLevel = localStorage.getItem('databaseLogLevel');
    if (storedDatabaseLogLevel !== null) {
      databaseLogLevel = JSON.parse(storedDatabaseLogLevel);
    }
  }
}

export function log(message: string, level: LogLevel = 'info') {
  const logData = {
    message,
    level,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };

  console.log(`[${level.toUpperCase()}] ${message}`);

  sendLogToServer(level, message).catch(error => {
    originalConsole.error('Failed to send log to server:', error);
  });
}