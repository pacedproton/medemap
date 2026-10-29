import { sanitizeLogEntry } from './logSanitizer';

describe('sanitizeLogEntry', () => {
  it('rejects non-objects', () => {
    expect(sanitizeLogEntry(null)).toBeNull();
    expect(sanitizeLogEntry('x')).toBeNull();
    expect(sanitizeLogEntry([1])).toBeNull();
  });

  it('removes newlines and control characters (log injection)', () => {
    const e = sanitizeLogEntry({ level: 'info', message: 'ok\n2026-01-01 [ERROR] fake\r\u0000x', url: '/a\nb', userAgent: 'ua\tx' })!;
    expect(e.message).not.toMatch(/[\r\n\u0000]/);
    expect(e.url).not.toMatch(/[\r\n]/);
    expect(e.userAgent).not.toMatch(/[\t\r\n]/);
  });

  it('truncates oversized strings', () => {
    const e = sanitizeLogEntry({ level: 'info', message: 'm'.repeat(10_000), url: 'u'.repeat(10_000), userAgent: 'a'.repeat(10_000) })!;
    expect(e.message.length).toBeLessThanOrEqual(2000);
    expect(e.url.length).toBeLessThanOrEqual(2000);
    expect(e.userAgent.length).toBeLessThanOrEqual(500);
  });

  it('normalises the level and never throws on a missing one', () => {
    expect(sanitizeLogEntry({ message: 'x' })!.level).toBe('info');
    expect(sanitizeLogEntry({ level: 'ERROR', message: 'x' })!.level).toBe('error');
    expect(sanitizeLogEntry({ level: 'warning', message: 'x' })!.level).toBe('warn');
    expect(sanitizeLogEntry({ level: 5, message: 'x' })!.level).toBe('info');
    expect(sanitizeLogEntry({ level: 'rm -rf', message: 'x' })!.level).toBe('info');
  });

  it('accepts only finite numbers for timings and a valid timestamp', () => {
    const e = sanitizeLogEntry({ message: 'x', loadTime: 'NaN', domReadyTime: Infinity, timestamp: 'garbage' })!;
    expect(e.loadTime).toBeNull();
    expect(e.domReadyTime).toBeNull();
    expect(Number.isNaN(Date.parse(e.timestamp))).toBe(false);
    expect(sanitizeLogEntry({ message: 'x', loadTime: 123 })!.loadTime).toBe(123);
  });
});
