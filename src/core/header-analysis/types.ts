export type HeaderSeverity = 'info' | 'caution' | 'important';

export interface SecurityHeaderEvidence {
  readonly name: string;
  readonly value: string;
}

export interface SecurityHeaderFinding {
  readonly id: string;
  readonly severity: HeaderSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly evidence: readonly SecurityHeaderEvidence[];
}

export interface SecurityHeaderAnalysis {
  readonly observedAt: string;
  readonly url: string;
  readonly findings: readonly SecurityHeaderFinding[];
  readonly limitations: readonly string[];
}

export interface ResponseHeader {
  readonly name?: string | undefined;
  readonly value?: string | undefined;
}
