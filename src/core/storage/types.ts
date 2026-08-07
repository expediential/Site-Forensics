import type { BaseEvent } from '@browserscope/sdk/events';

import { StorageError } from './errors';

declare const investigationIdBrand: unique symbol;
declare const ledgerHashBrand: unique symbol;

/** Locally generated investigation identifier used to partition the evidence ledger. */
export type InvestigationId = string & { readonly [investigationIdBrand]: 'InvestigationId' };

/** SHA-256 integrity digest for one immutable append batch. */
export type LedgerHash = string & { readonly [ledgerHashBrand]: 'LedgerHash' };

/** Durable state of the primary-event ledger for one investigation. */
export type LedgerState = 'recording' | 'frozen';

/** Event plus the sequence assigned by the sole persistent ledger writer. */
export interface LedgerEntry {
  readonly investigationId: InvestigationId;
  readonly sequence: number;
  readonly event: BaseEvent;
}

/** Hash checkpoint covering one contiguous, transactionally appended event range. */
export interface LedgerCheckpoint {
  readonly investigationId: InvestigationId;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly eventCount: number;
  readonly previousBatchHash: LedgerHash | null;
  readonly batchHash: LedgerHash;
  readonly createdAt: string;
}

/** Current durable ledger state suitable for service-worker recovery. */
export interface InvestigationLedger {
  readonly investigationId: InvestigationId;
  readonly state: LedgerState;
  readonly lastSequence: number;
  readonly latestCheckpointHash: LedgerHash | null;
  readonly createdAt: string;
  readonly frozenAt?: string;
}

/** Result of one idempotent append request. */
export interface LedgerAppendResult {
  readonly entries: readonly LedgerEntry[];
  readonly checkpoint: LedgerCheckpoint | null;
}

/** Bounded, ordered event page for timeline and replay consumers. */
export interface LedgerPage {
  readonly entries: readonly LedgerEntry[];
  readonly nextSequence: number | null;
}

/** Result of replaying ledger hashes and event integrity checks. */
export interface LedgerIntegrityReport {
  readonly valid: boolean;
  readonly checkedEvents: number;
  readonly checkedBatches: number;
  readonly latestCheckpointHash: LedgerHash | null;
  readonly issue?: string;
}

/** Maximum event count accepted by one atomic append transaction. */
export const maximumLedgerAppendBatchSize = 250;

/** Creates a branded investigation ID after enforcing a portable identifier format. */
export function createInvestigationId(value: string): InvestigationId {
  if (!isInvestigationId(value)) {
    throw new StorageError(
      'INVALID_INVESTIGATION_ID',
      'Investigation ID must use the inv_ prefix and 8-128 portable characters.',
    );
  }

  return value as InvestigationId;
}

/** Returns whether a runtime value is a portable investigation identifier. */
export function isInvestigationId(value: unknown): value is InvestigationId {
  return typeof value === 'string' && /^inv_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/u.test(value);
}

/** Rejects untrusted values before they are used as persistent ledger partition keys. */
export function assertInvestigationId(value: unknown): asserts value is InvestigationId {
  if (!isInvestigationId(value)) {
    throw new StorageError(
      'INVALID_INVESTIGATION_ID',
      'Investigation ID must use the inv_ prefix and 8-128 portable characters.',
    );
  }
}

/** Narrows a stored hash to the same stable SHA-256 representation used by event hashes. */
export function asLedgerHash(value: string): LedgerHash {
  return value as LedgerHash;
}
