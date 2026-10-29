const LEVELS: Record<string, string> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
};

export interface CleanLogEntry {
  timestamp: string;
  level: string;
  message: string;
  url: string;
  userAgent: string;
  loadTime: number | null;
  domReadyTime: number | null;
}

// control characters plus the Unicode line and paragraph separators
const CONTROL = new RegExp(`[\\x00-\\x1f\\x7f${String.fromCharCode(0x2028, 0x2029)}]+`, 'g');

const text = (v: unknown, max: number) =>
  (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(CONTROL, ' ').slice(0, max);

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Client-supplied log lines are untrusted: bound them and strip anything that could forge log lines. */
export function sanitizeLogEntry(raw: unknown): CleanLogEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const ts = typeof r.timestamp === 'string' ? Date.parse(r.timestamp) : NaN;
  const level = typeof r.level === 'string' ? LEVELS[r.level.toLowerCase()] ?? 'info' : 'info';
  return {
    timestamp: new Date(Number.isNaN(ts) ? Date.now() : ts).toISOString(),
    level,
    message: text(r.message, 2000),
    url: text(r.url, 2000),
    userAgent: text(r.userAgent, 500),
    loadTime: num(r.loadTime),
    domReadyTime: num(r.domReadyTime),
  };
}
