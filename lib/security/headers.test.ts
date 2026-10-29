import { securityHeaders } from './headers';

describe('securityHeaders', () => {
  const h = securityHeaders();

  it('stops MIME sniffing, framing and leaky referrers', () => {
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('forces https for six months', () => {
    expect(h['Strict-Transport-Security']).toBe('max-age=15552000; includeSubDomains');
  });

  it('keeps the microphone for same-origin speech input and turns off the rest', () => {
    const p = h['Permissions-Policy'];
    expect(p).toContain('microphone=(self)');
    expect(p).toContain('camera=()');
    expect(p).toContain('geolocation=()');
  });

  it('adds only the CSP directives that cannot break scripts or styles', () => {
    const csp = h['Content-Security-Policy'];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toMatch(/script-src|default-src|style-src/);
  });
});
