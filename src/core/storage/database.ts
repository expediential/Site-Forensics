import { StorageError } from './errors';

/** IndexedDB database name defined by the BrowserScope local-data architecture. */
export const browserScopeDatabaseName = 'browserscope-v1';

/** Current additive IndexedDB schema version. */
export const browserScopeDatabaseVersion = 1;

export const ledgerStoreNames = {
  batches: 'ledgerBatches',
  events: 'events',
  ledgers: 'investigations',
} as const;

/** Opens the additive storage schema; upgrade work is transactional under IndexedDB semantics. */
export function openBrowserScopeDatabase(
  databaseFactory: IDBFactory,
  databaseName: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = databaseFactory.open(databaseName, browserScopeDatabaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ledgerStoreNames.ledgers)) {
        database.createObjectStore(ledgerStoreNames.ledgers, { keyPath: 'investigationId' });
      }

      if (!database.objectStoreNames.contains(ledgerStoreNames.events)) {
        const events = database.createObjectStore(ledgerStoreNames.events, {
          keyPath: ['investigationId', 'sequence'],
        });
        events.createIndex('byInvestigationEventId', ['investigationId', 'event.id'], {
          unique: true,
        });
      }

      if (!database.objectStoreNames.contains(ledgerStoreNames.batches)) {
        database.createObjectStore(ledgerStoreNames.batches, {
          keyPath: ['investigationId', 'lastSequence'],
        });
      }
    };

    request.onblocked = () => {
      reject(
        new StorageError(
          'DATABASE_BLOCKED',
          'BrowserScope storage is blocked by another open database connection.',
        ),
      );
    };
    request.onerror = () => {
      reject(
        new StorageError('DATABASE_OPEN_FAILED', 'BrowserScope storage could not be opened.', {
          name: request.error?.name ?? 'UnknownError',
        }),
      );
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

/** Converts an IndexedDB request into a promise while preserving its result type. */
export function requestToPromise<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/** Waits until an IndexedDB transaction commits or fails. */
export function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
