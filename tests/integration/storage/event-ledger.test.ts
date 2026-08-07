import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { EventSchemaRegistry } from '@browserscope/sdk/events';

import { IndexedDbEventLedger, StorageError, createInvestigationId } from '@/core/storage';
import { createStorageTestEvent, storageEventSchema } from '../../support/storage-event-fixtures';

describe('IndexedDbEventLedger', () => {
  it('atomically appends, pages, verifies, and freezes an immutable event ledger', async () => {
    const ledger = createLedger('atomic');
    const investigationId = createInvestigationId('inv_storage_atomic');
    const first = createStorageTestEvent('atomic_0001');
    const second = createStorageTestEvent('atomic_0002');

    await ledger.create(investigationId);
    const appended = await ledger.append(investigationId, [first, second]);
    const page = await ledger.read(investigationId, 1, 1);
    const report = await ledger.verify(investigationId);
    const frozen = await ledger.freeze(investigationId);

    expect(appended.entries.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(appended.checkpoint?.eventCount).toBe(2);
    expect(page.entries).toHaveLength(1);
    expect(page.nextSequence).toBe(2);
    expect(report).toMatchObject({ valid: true, checkedEvents: 2, checkedBatches: 1 });
    expect(frozen.state).toBe('frozen');
    await expect(
      ledger.append(investigationId, [createStorageTestEvent('atomic_0003')]),
    ).rejects.toThrow(StorageError);
    ledger.close();
  });

  it('treats an identical replay as idempotent but rejects reused event IDs with changed evidence', async () => {
    const ledger = createLedger('replay');
    const investigationId = createInvestigationId('inv_storage_replay');
    const first = createStorageTestEvent('replay_0001');

    await ledger.create(investigationId);
    expect((await ledger.append(investigationId, [first, first])).entries).toHaveLength(1);
    const replay = await ledger.append(investigationId, [first]);

    expect(replay).toEqual({ entries: [], checkpoint: null });
    await expect(
      ledger.append(investigationId, [createStorageTestEvent('replay_0001', 'changed')]),
    ).rejects.toThrow(StorageError);
    ledger.close();
  });

  it('recovers its state after a worker-like connection restart and identifies stored tampering', async () => {
    const factory = new IDBFactory();
    const databaseName = 'browserscope-storage-restart';
    const firstLedger = createLedger(databaseName, factory);
    const investigationId = createInvestigationId('inv_storage_restart');

    await firstLedger.create(investigationId);
    await firstLedger.append(investigationId, [createStorageTestEvent('restart_0001')]);
    firstLedger.close();

    const recoveredLedger = createLedger(databaseName, factory);
    expect((await recoveredLedger.read(investigationId)).entries).toHaveLength(1);
    await tamperStoredEvent(factory, databaseName, investigationId);

    expect(await recoveredLedger.verify(investigationId)).toMatchObject({ valid: false });
    recoveredLedger.close();
  });
});

function createLedger(
  databaseName: string,
  databaseFactory = new IDBFactory(),
): IndexedDbEventLedger {
  const schemas = new EventSchemaRegistry();
  schemas.register(storageEventSchema);
  return new IndexedDbEventLedger({
    schemas,
    databaseFactory,
    databaseName: `browserscope-test-${databaseName}`,
    clock: () => '2026-08-07T12:00:02.000Z',
  });
}

async function tamperStoredEvent(
  factory: IDBFactory,
  databaseName: string,
  investigationId: ReturnType<typeof createInvestigationId>,
): Promise<void> {
  const database = await openDatabase(factory, `browserscope-test-${databaseName}`);
  const transaction = database.transaction('events', 'readwrite');
  const store = transaction.objectStore('events');
  const entry = await requestToPromise(
    store.get([investigationId, 1]) as IDBRequest<{ event: { payload: { label: string } } }>,
  );
  entry.event.payload.label = 'tampered';
  store.put(entry);
  await transactionToPromise(transaction);
  database.close();
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
