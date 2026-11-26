import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';

import { DBConfig } from './ngx-indexed-db.meta';
import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { provideIndexedDb } from './provide-indexed-db';

interface Person {
  id?: number;
  name: string;
  email: string;
}

const STORE = 'people';

const dbConfig: DBConfig = {
  name: 'transaction-complete-spec',
  version: 1,
  objectStoresMeta: [
    {
      store: STORE,
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [
        { name: 'name', keypath: 'name', options: { unique: false } },
        { name: 'email', keypath: 'email', options: { unique: true } },
      ],
    },
  ],
};

/**
 * Write operations must only emit once their transaction has committed (issue #402):
 * a request can succeed while its transaction later fails or aborts.
 */
describe('NgxIndexedDBService write operations', () => {
  let service: NgxIndexedDBService;
  let events: string[];
  /** Settles when every readwrite transaction opened so far has finished (committed or aborted). */
  let pending: Promise<void>[];
  const originalTransaction = IDBDatabase.prototype.transaction;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideIndexedDb(dbConfig)] });
    service = TestBed.inject(NgxIndexedDBService);
    await firstValueFrom(service.clear(STORE));

    // Record when each readwrite transaction commits, relative to when the Observable emits.
    events = [];
    pending = [];
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: Parameters<IDBDatabase['transaction']>) {
      const transaction = originalTransaction.apply(this, args);
      if (transaction.mode === 'readwrite') {
        transaction.addEventListener('complete', () => events.push('complete'));
        pending.push(
          new Promise((resolve) => {
            transaction.addEventListener('complete', () => resolve());
            transaction.addEventListener('abort', () => resolve());
          })
        );
      }
      return transaction;
    } as IDBDatabase['transaction'];
  });

  afterEach(() => {
    IDBDatabase.prototype.transaction = originalTransaction;
  });

  /** Subscribes and resolves with the emitted value once the Observable completes. */
  async function emitted<T>(source: Observable<T>): Promise<T> {
    const value = await firstValueFrom(source);
    events.push('emit');
    return value;
  }

  /** Adds one record and waits until its transaction is fully done, so it can't leak into the event log. */
  async function seed(): Promise<Person> {
    const person = await firstValueFrom(
      service.add<Person>(STORE, { name: 'Ada', email: 'ada@example.com' })
    );
    await Promise.all(pending);
    events = [];
    pending = [];
    return person;
  }

  it('add() emits after the transaction completes', async () => {
    const person = await emitted(
      service.add<Person>(STORE, { name: 'Ada', email: 'ada@example.com' })
    );
    expect(person).toEqual({ id: expect.any(Number), name: 'Ada', email: 'ada@example.com' });
    expect(events).toEqual(['complete', 'emit']);
  });

  it('update() emits after the transaction completes', async () => {
    const person = await seed();
    const updated = await emitted(
      service.update<Person>(STORE, { ...person, name: 'Ada King' })
    );
    expect(updated.name).toBe('Ada King');
    expect(events).toEqual(['complete', 'emit']);
  });

  it('bulkAdd() emits after the transaction completes', async () => {
    const keys = await emitted(
      service.bulkAdd<Person>(STORE, [
        { name: 'Ada', email: 'ada@example.com' },
        { name: 'Alan', email: 'alan@example.com' },
      ])
    );
    expect(keys).toHaveLength(2);
    expect(events).toEqual(['complete', 'emit']);
  });

  it('bulkPut() emits after the transaction completes', async () => {
    const person = await seed();
    const lastKey = await emitted(
      service.bulkPut<Person>(STORE, [
        { ...person, name: 'Ada King' },
        { id: person.id! + 1, name: 'Alan', email: 'alan@example.com' },
      ])
    );
    expect(lastKey).toBe(person.id! + 1);
    expect(events).toEqual(['complete', 'emit']);
  });

  it('deleteAllByIndex() emits after the transaction completes', async () => {
    await seed();
    await emitted(service.deleteAllByIndex(STORE, 'email', IDBKeyRange.only('ada@example.com')));
    expect(events).toEqual(['complete', 'emit']);
    expect(await firstValueFrom(service.count(STORE))).toBe(0);
  });

  it('add() errors, and does not emit, when the write is rejected', async () => {
    await seed();
    const duplicate = service.add<Person>(STORE, { name: 'Copy', email: 'ada@example.com' });
    await expect(firstValueFrom(duplicate)).rejects.toBeDefined();
    expect(await firstValueFrom(service.count(STORE))).toBe(1);
  });

  it('bulkAdd() errors and keeps nothing when one insert is rejected', async () => {
    await seed();
    const batch = service.bulkAdd<Person>(STORE, [
      { name: 'Alan', email: 'alan@example.com' },
      { name: 'Copy', email: 'ada@example.com' },
    ]);
    // Previously this never settled: a failed insert left the result pending forever.
    await expect(firstValueFrom(batch)).rejects.toBeDefined();
    expect(await firstValueFrom(service.count(STORE))).toBe(1);
  });

  it('bulkPut() with no items completes instead of never emitting', async () => {
    await expect(firstValueFrom(service.bulkPut(STORE, []))).resolves.toBeUndefined();
  });

  it('bulkPut() errors and keeps nothing when one write is rejected', async () => {
    await seed();
    const batch = service.bulkPut<Person>(STORE, [
      { name: 'Alan', email: 'alan@example.com' },
      { name: 'Copy', email: 'ada@example.com' },
    ]);
    await expect(firstValueFrom(batch)).rejects.toBeDefined();
    expect(await firstValueFrom(service.count(STORE))).toBe(1);
  });
});
