import type {
  ResponseHeader,
  SecurityHeaderAnalysis,
  SecurityHeaderEvidence,
  SecurityHeaderFinding,
} from './types';

const retainedHeaders = new Set([
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'permissions-policy',
  'referrer-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
]);

/** Analyzes a captured top-level response using only an allowlisted policy-header set. */
export function analyzeSecurityHeaders(
  url: string,
  observedAt: string,
  responseHeaders: readonly ResponseHeader[],
): SecurityHeaderAnalysis {
  const headers = normalizeHeaders(responseHeaders);
  const findings: SecurityHeaderFinding[] = [];
  const csp = headers.get('content-security-policy');
  const hsts = headers.get('strict-transport-security');
  const frameOptions = headers.get('x-frame-options');
  const permissionsPolicy = headers.get('permissions-policy');
  const referrerPolicy = headers.get('referrer-policy');

  if (csp === undefined)
    findings.push(
      missing(
        'csp_missing',
        'Content Security Policy is not present.',
        'The observed document response did not include a Content-Security-Policy header.',
      ),
    );
  else if (/\bunsafe-(inline|eval)\b/iu.test(csp))
    findings.push(
      finding(
        'csp_unsafe_script',
        'important',
        'CSP permits inline or evaluated script.',
        'The observed CSP contains unsafe-inline or unsafe-eval. This weakens script injection protection.',
        evidence('content-security-policy', csp),
      ),
    );
  if (url.startsWith('https://') && hsts === undefined)
    findings.push(
      missing(
        'hsts_missing',
        'HTTP Strict Transport Security is not present.',
        'The observed HTTPS response did not include Strict-Transport-Security.',
      ),
    );
  else if (hsts !== undefined && maxAge(hsts) < 15_552_000)
    findings.push(
      finding(
        'hsts_short_max_age',
        'caution',
        'HSTS duration is short.',
        'The observed Strict-Transport-Security max-age is below 180 days.',
        evidence('strict-transport-security', hsts),
      ),
    );
  if (frameOptions === undefined && !hasFrameAncestors(csp))
    findings.push(
      missing(
        'clickjacking_protection_missing',
        'No framing restriction was observed.',
        'Neither X-Frame-Options nor CSP frame-ancestors was observed on this response.',
      ),
    );
  if (permissionsPolicy === undefined)
    findings.push(
      missing(
        'permissions_policy_missing',
        'Permissions-Policy is not present.',
        'The observed response did not declare a Permissions-Policy.',
      ),
    );
  if (referrerPolicy === undefined)
    findings.push(
      missing(
        'referrer_policy_missing',
        'Referrer-Policy is not present.',
        'The observed response did not declare a Referrer-Policy.',
      ),
    );
  for (const name of [
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
    'cross-origin-resource-policy',
  ])
    if (!headers.has(name))
      findings.push(
        finding(
          `${name}_not_observed`,
          'info',
          `${displayName(name)} was not observed.`,
          'This header was not present on the observed document response; its absence is context-dependent.',
          [],
        ),
      );

  return Object.freeze({
    observedAt,
    url,
    findings: Object.freeze(findings),
    limitations: Object.freeze([
      'Only the response observed after BrowserScope initiated this reload was analyzed.',
      'Only the top-level document response was observed; subresource headers are not covered.',
      'Header presence is evidence, not a security verdict.',
    ]),
  });
}

function normalizeHeaders(headers: readonly ResponseHeader[]): Map<string, string> {
  const output = new Map<string, string>();
  for (const header of headers) {
    const name = header.name?.toLowerCase();
    if (name !== undefined && retainedHeaders.has(name) && typeof header.value === 'string')
      output.set(name, header.value);
  }
  return output;
}
function missing(id: string, title: string, explanation: string): SecurityHeaderFinding {
  return finding(id, 'caution', title, explanation, []);
}
function finding(
  id: string,
  severity: SecurityHeaderFinding['severity'],
  title: string,
  explanation: string,
  evidence: readonly SecurityHeaderEvidence[],
): SecurityHeaderFinding {
  return Object.freeze({
    id,
    severity,
    title,
    explanation,
    evidence: Object.freeze([...evidence]),
  });
}
function evidence(name: string, value: string): readonly SecurityHeaderEvidence[] {
  return [Object.freeze({ name, value })];
}
function hasFrameAncestors(csp: string | undefined): boolean {
  return csp !== undefined && /(?:^|;)\s*frame-ancestors\s+/iu.test(csp);
}
function maxAge(value: string): number {
  const match = /max-age\s*=\s*(\d+)/iu.exec(value);
  return match === null ? 0 : Number(match[1]);
}
function displayName(name: string): string {
  return name
    .split('-')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('-');
}
