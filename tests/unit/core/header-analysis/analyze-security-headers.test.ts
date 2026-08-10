import { describe, expect, it } from 'vitest';
import { analyzeSecurityHeaders } from '@/core/header-analysis';

describe('analyzeSecurityHeaders', () => {
  it('reports missing protective headers without retaining unrelated headers', () => {
    const analysis = analyzeSecurityHeaders('https://example.test', '2026-08-10T00:00:00.000Z', [
      { name: 'Set-Cookie', value: 'secret=value' },
    ]);
    expect(analysis.findings.map((finding) => finding.id)).toContain('csp_missing');
    expect(JSON.stringify(analysis)).not.toContain('secret=value');
  });
  it('recognizes CSP framing protection and flags unsafe script allowances', () => {
    const analysis = analyzeSecurityHeaders('https://example.test', '2026-08-10T00:00:00.000Z', [
      {
        name: 'Content-Security-Policy',
        value: "default-src 'self'; frame-ancestors 'none'; script-src 'unsafe-inline'",
      },
      { name: 'Strict-Transport-Security', value: 'max-age=31536000' },
      { name: 'Permissions-Policy', value: 'geolocation=()' },
      { name: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ]);
    expect(analysis.findings.map((finding) => finding.id)).toContain('csp_unsafe_script');
    expect(analysis.findings.map((finding) => finding.id)).not.toContain(
      'clickjacking_protection_missing',
    );
  });
});
