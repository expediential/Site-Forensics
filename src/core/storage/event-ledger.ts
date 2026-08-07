import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import {
  computeEventHash,
  type BaseEvent,
  type EventSchemaRegistry,
} from '@browserscope/sdk/events';
import { stableStringify } from '@browserscope/sdk/utilities';

import {
  browserScopeDatabaseName,
  ledgerStoreNames,
  openBrowserScopeDatabase,
  requestToPromise,
  transactionToPromise,
} from './database';
import { StorageError } from './errors';
import {
  asLedgerHash,
  assertInvestigationId,
  maximumLedgerAppendBatchSize,
  type InvestigationId,
  type InvestigationLedger,
  type LedgerAppendResult,
  type LedgerCheckpoint,
  type LedgerEntry,
  type LedgerIntegrityReport,
  type LedgerPage,
} from './types';

/** Configuration for the sole primary-event writer in one extension context. */
export interface IndexedDbEventLedgerOptions {
  readonly schemas: EventSchemaRegistry;
  readonly databaseFactory?: IDBFactory;
  readonly databaseName?: string;
  readonly clock?: () => string;
}

/** Transactional, append-only IndexedDB ledger for schema-validated BrowserScope events. */
export class IndexedDbEventLedger {
  readonly #schemas: EventSchemaRegistry;
  readonly #databaseFactory: IDBFactory;
  readonly #databaseName: string;
  readonly #clock: () => string;
  #database: Promise<IDBDatabase> | undefined;

  public constructor(options: IndexedDbEventLedgerOptions) {
    this.#schemas = options.schemas;
    const browserDatabaseFactory = (globalThis as { readonly indexedDB?: IDBFactory }).indexedDB;
    const databaseFactory = options.databaseFactory ?? browserDatabaseFactory;
    if (databaseFactory === undefined) {
      throw new StorageError(
        'DATABASE_OPEN_FAILED',
        'IndexedDB is unavailable in this browser context.',
      );
    }
    this.#databaseFactory = databaseFactory;
    this.#databaseName = options.databaseName ?? browserScopeDatabaseName;
    this.#clock = options.clock ?? (() => new Date().toISOString());
  }

  /** Creates an empty recording ledger, or returns its existing durable state on restart. */
  public async create(investigationId: InvestigationId): Promise<InvestigationLedger> {
    assertInvestigationId(investigationId);
    const database = await this.#getDatabase();
    const transaction = database.transaction(ledgerStoreNames.ledgers, 'readwrite');
    const store = transaction.objectStore(ledgerStoreNames.ledgers);

    try {
      const existing = await requestToPromise(
        store.get(investigationId) as IDBRequest<InvestigationLedger | undefined>,
      );
      if (existing !== undefined) {
        await transactionToPromise(transaction);
        return freezeLedger(existing);
      }

      const ledger: InvestigationLedger = {
        investigationId,
        state: 'recording',
        lastSequence: 0,
        latestCheckpointHash: null,
        createdAt: this.#clock(),
      };
      store.add(ledger);
      await transactionToPromise(transaction);
      return freezeLedger(ledger);
    } catch (error) {
      return await abortAndThrow(transaction, error);
    }
  }

  /** Appends a bounded event batch atomically, assigning durable sequences and a hash checkpoint. */
  public async append(
    investigationId: InvestigationId,
    events: readonly BaseEvent[],
  ): Promise<LedgerAppendResult> {
    assertInvestigationId(investigationId);
    if (events.length > maximumLedgerAppendBatchSize) {
      throw new StorageError(
        'INVALID_APPEND_BATCH',
        `An append batch may contain at most ${maximumLedgerAppendBatchSize} events.`,
      );
    }

    const validatedEvents = events.map((event) => this.#validateEvent(event));
    if (validatedEvents.length === 0) {
      return { entries: [], checkpoint: null };
    }

    const database = await this.#getDatabase();
    const transaction = database.transaction(
      [ledgerStoreNames.ledgers, ledgerStoreNames.events, ledgerStoreNames.batches],
      'readwrite',
    );

    try {
      const ledgerStore = transaction.objectStore(ledgerStoreNames.ledgers);
      const eventStore = transaction.objectStore(ledgerStoreNames.events);
      const batchStore = transaction.objectStore(ledgerStoreNames.batches);
      const ledger = await this.#requireLedger(ledgerStore, investigationId);
      if (ledger.state === 'frozen') {
        throw new StorageError(
          'INVESTIGATION_FROZEN',
          'Primary events cannot be appended after an investigation is frozen.',
          { investigationId },
        );
      }

      const appendedEvents: BaseEvent[] = [];
      const batchEventHashes = new Map<string, string>();
      for (const event of validatedEvents) {
        const batchHash = batchEventHashes.get(event.id);
        if (batchHash !== undefined) {
          if (batchHash !== event.hash) {
            throw new StorageError(
              'EVENT_ALREADY_EXISTS',
              'An append batch cannot reuse an event ID with different immutable evidence content.',
              { investigationId, eventId: event.id },
            );
          }
          continue;
        }
        const existing = await requestToPromise(
          eventStore.index('byInvestigationEventId').get([investigationId, event.id]) as IDBRequest<
            LedgerEntry | undefined
          >,
        );
        if (existing === undefined) {
          appendedEvents.push(event);
          batchEventHashes.set(event.id, event.hash);
          continue;
        }

        if (existing.event.hash !== event.hash) {
          throw new StorageError(
            'EVENT_ALREADY_EXISTS',
            'An event ID already exists with different immutable evidence content.',
            { investigationId, eventId: event.id },
          );
        }
      }

      if (appendedEvents.length === 0) {
        await transactionToPromise(transaction);
        return { entries: [], checkpoint: null };
      }

      const firstSequence = ledger.lastSequence + 1;
      const entries = appendedEvents.map((event, index) =>
        freezeEntry({ investigationId, sequence: firstSequence + index, event }),
      );
      const checkpoint = freezeCheckpoint({
        investigationId,
        firstSequence,
        lastSequence: entries.at(-1)?.sequence ?? firstSequence,
        eventCount: entries.length,
        previousBatchHash: ledger.latestCheckpointHash,
        batchHash: computeBatchHash(investigationId, ledger.latestCheckpointHash, appendedEvents),
        createdAt: this.#clock(),
      });

      for (const entry of entries) {
        eventStore.add(entry);
      }
      batchStore.add(checkpoint);
      ledgerStore.put({
        ...ledger,
        lastSequence: checkpoint.lastSequence,
        latestCheckpointHash: checkpoint.batchHash,
      });
      await transactionToPromise(transaction);
      return { entries, checkpoint };
    } catch (error) {
      return await abortAndThrow(transaction, error);
    }
  }

  /** Reads an ordered, bounded event page without exposing mutable stored objects. */
  public async read(
    investigationId: InvestigationId,
    fromSequence = 1,
    limit = maximumLedgerAppendBatchSize,
  ): Promise<LedgerPage> {
    assertInvestigationId(investigationId);
    if (
      !Number.isSafeInteger(fromSequence) ||
      fromSequence < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > maximumLedgerAppendBatchSize
    ) {
      throw new StorageError(
        'INVALID_READ_PAGE',
        'Ledger page bounds are outside supported limits.',
      );
    }

    const database = await this.#getDatabase();
    const transaction = database.transaction(
      [ledgerStoreNames.ledgers, ledgerStoreNames.events],
      'readonly',
    );
    try {
      const ledgerStore = transaction.objectStore(ledgerStoreNames.ledgers);
      const eventStore = transaction.objectStore(ledgerStoreNames.events);
      const ledger = await this.#requireLedger(ledgerStore, investigationId);
      const range = IDBKeyRange.bound(
        [investigationId, fromSequence],
        [investigationId, Number.MAX_SAFE_INTEGER],
      );
      const persistedEntries = await requestToPromise(
        eventStore.getAll(range, limit) as IDBRequest<LedgerEntry[]>,
      );
      const entries = persistedEntries.map((entry) =>
        freezeEntry({
          investigationId: entry.investigationId,
          sequence: entry.sequence,
          event: this.#validateEvent(entry.event),
        }),
      );
      await transactionToPromise(transaction);
      const finalSequence = entries.at(-1)?.sequence ?? 0;
      return {
        entries,
        nextSequence:
          finalSequence > 0 && finalSequence < ledger.lastSequence ? finalSequence + 1 : null,
      };
    } catch (error) {
      return await abortAndThrow(transaction, error);
    }
  }

  /** Freezes a ledger permanently and retains its latest integrity checkpoint for replay/export. */
  public async freeze(investigationId: InvestigationId): Promise<InvestigationLedger> {
    assertInvestigationId(investigationId);
    const database = await this.#getDatabase();
    const transaction = database.transaction(ledgerStoreNames.ledgers, 'readwrite');
    try {
      const store = transaction.objectStore(ledgerStoreNames.ledgers);
      const ledger = await this.#requireLedger(store, investigationId);
      const frozen =
        ledger.state === 'frozen'
          ? ledger
          : { ...ledger, state: 'frozen' as const, frozenAt: this.#clock() };
      store.put(frozen);
      await transactionToPromise(transaction);
      return freezeLedger(frozen);
    } catch (error) {
      return await abortAndThrow(transaction, error);
    }
  }

  /** Replays event and checkpoint hashes to detect accidental local corruption or mutation. */
  public async verify(investigationId: InvestigationId): Promise<LedgerIntegrityReport> {
    assertInvestigationId(investigationId);
    const database = await this.#getDatabase();
    const transaction = database.transaction(
      [ledgerStoreNames.ledgers, ledgerStoreNames.events, ledgerStoreNames.batches],
      'readonly',
    );
    try {
      const ledger = await this.#requireLedger(
        transaction.objectStore(ledgerStoreNames.ledgers),
        investigationId,
      );
      const range = IDBKeyRange.bound(
        [investigationId, 0],
        [investigationId, Number.MAX_SAFE_INTEGER],
      );
      const entries = await requestToPromise(
        transaction.objectStore(ledgerStoreNames.events).getAll(range) as IDBRequest<LedgerEntry[]>,
      );
      const checkpoints = await requestToPromise(
        transaction.objectStore(ledgerStoreNames.batches).getAll(range) as IDBRequest<
          LedgerCheckpoint[]
        >,
      );
      await transactionToPromise(transaction);

      let expectedSequence = 1;
      for (const entry of entries) {
        if (
          entry.sequence !== expectedSequence ||
          computeEventHash(entry.event) !== entry.event.hash
        ) {
          return integrityFailure(
            entries.length,
            checkpoints.length,
            ledger.latestCheckpointHash,
            'Event sequence or hash mismatch.',
          );
        }

        const validated = this.#schemas.validate(entry.event);
        if (!validated.success) {
          return integrityFailure(
            entries.length,
            checkpoints.length,
            ledger.latestCheckpointHash,
            'Stored event no longer satisfies its schema.',
          );
        }
        expectedSequence += 1;
      }

      let previousBatchHash = null;
      let entryOffset = 0;
      for (const checkpoint of checkpoints) {
        const batchEntries = entries.slice(entryOffset, entryOffset + checkpoint.eventCount);
        const batchEvents = batchEntries.map((entry) => entry.event);
        if (
          checkpoint.previousBatchHash !== previousBatchHash ||
          batchEvents.length !== checkpoint.eventCount ||
          batchEntries[0]?.sequence !== checkpoint.firstSequence ||
          batchEntries.at(-1)?.sequence !== checkpoint.lastSequence ||
          computeBatchHash(investigationId, previousBatchHash, batchEvents) !== checkpoint.batchHash
        ) {
          return integrityFailure(
            entries.length,
            checkpoints.length,
            ledger.latestCheckpointHash,
            'Ledger checkpoint mismatch.',
          );
        }
        entryOffset += checkpoint.eventCount;
        previousBatchHash = checkpoint.batchHash;
      }

      if (
        entryOffset !== entries.length ||
        ledger.lastSequence !== entries.length ||
        ledger.latestCheckpointHash !== previousBatchHash
      ) {
        return integrityFailure(
          entries.length,
          checkpoints.length,
          ledger.latestCheckpointHash,
          'Ledger state mismatch.',
        );
      }
      return freezeReport({
        valid: true,
        checkedEvents: entries.length,
        checkedBatches: checkpoints.length,
        latestCheckpointHash: ledger.latestCheckpointHash,
      });
    } catch (error) {
      return await abortAndThrow(transaction, error);
    }
  }

  /** Closes this instance's cached connection; primarily useful for deterministic teardown. */
  public close(): void {
    this.#database?.then((database) => database.close()).catch(() => undefined);
    this.#database = undefined;
  }

  async #getDatabase(): Promise<IDBDatabase> {
    this.#database ??= openBrowserScopeDatabase(this.#databaseFactory, this.#databaseName);
    return this.#database;
  }

  async #requireLedger(
    store: IDBObjectStore,
    investigationId: InvestigationId,
  ): Promise<InvestigationLedger> {
    const ledger = await requestToPromise(
      store.get(investigationId) as IDBRequest<InvestigationLedger | undefined>,
    );
    if (ledger === undefined) {
      throw new StorageError('INVESTIGATION_NOT_FOUND', 'Investigation ledger does not exist.', {
        investigationId,
      });
    }
    return ledger;
  }

  #validateEvent(event: BaseEvent): BaseEvent {
    const validation = this.#schemas.validate(event);
    if (!validation.success) {
      throw new StorageError(
        'EVENT_INVALID',
        'Ledger accepts only schema-validated immutable events.',
        {
          issues: validation.issues.map((issue) => ({
            path: [...issue.path],
            code: issue.code,
            message: issue.message,
          })),
        },
      );
    }
    return validation.value;
  }
}

function computeBatchHash(
  investigationId: InvestigationId,
  previousBatchHash: string | null,
  events: readonly BaseEvent[],
) {
  const canonical = stableStringify({
    investigationId,
    previousBatchHash,
    eventHashes: events.map((event) => event.hash),
    version: 1,
  });
  return asLedgerHash(`sha256:${bytesToHex(sha256(utf8ToBytes(canonical)))}`);
}

function freezeLedger(ledger: InvestigationLedger): InvestigationLedger {
  return Object.freeze({ ...ledger });
}

function freezeEntry(entry: LedgerEntry): LedgerEntry {
  return Object.freeze({ ...entry });
}

function freezeCheckpoint(checkpoint: LedgerCheckpoint): LedgerCheckpoint {
  return Object.freeze({ ...checkpoint });
}

function freezeReport(report: LedgerIntegrityReport): LedgerIntegrityReport {
  return Object.freeze({ ...report });
}

function integrityFailure(
  checkedEvents: number,
  checkedBatches: number,
  latestCheckpointHash: LedgerIntegrityReport['latestCheckpointHash'],
  issue: string,
): LedgerIntegrityReport {
  return freezeReport({ valid: false, checkedEvents, checkedBatches, latestCheckpointHash, issue });
}

function abortAndThrow(transaction: IDBTransaction, error: unknown): never {
  try {
    transaction.abort();
  } catch {
    // The transaction may already have completed or aborted; the original error remains authoritative.
  }
  if (error instanceof StorageError) {
    throw error;
  }
  throw new StorageError('DATABASE_TRANSACTION_FAILED', 'IndexedDB transaction failed.', {
    name: error instanceof Error ? error.name : 'UnknownError',
  });
}
