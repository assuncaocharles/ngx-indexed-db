import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { DBConfig } from './ngx-indexed-db.meta';
import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { provideIndexedDb } from './provide-indexed-db';

const DB = 'indexes-spec';

function config(version: number, indexes: string[], migrationFactory?: DBConfig['migrationFactory']): DBConfig {
  return {
    name: DB,
    version,
    objectStoresMeta: [
      {
        store: 'people',
        storeConfig: { keyPath: 'id', autoIncrement: true },
        storeSchema: indexes.map((name) => ({ name, keypath: name, options: { unique: false } })),
      },
    ],
    migrationFactory,
  };
}

/** Starts a fresh service for the given config, as an app does after a new deployment. */
function serviceFor(dbConfig: DBConfig): NgxIndexedDBService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideIndexedDb(dbConfig)] });
  return TestBed.inject(NgxIndexedDBService);
}

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function indexNames(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB);
    request.onsuccess = () => {
      const db = request.result;
      const names = Array.from(db.transaction('people').objectStore('people').indexNames);
      db.close();
      resolve(names.sort());
    };
    request.onerror = () => reject(request.error);
  });
}

/** Indexes declared in storeSchema are created on existing stores too (issue #369). */
describe('Indexes declared in storeSchema', () => {
  beforeEach(deleteDb);
  afterAll(deleteDb);

  it('are created on an existing store when the version increases', async () => {
    const v1 = serviceFor(config(1, ['name']));
    await firstValueFrom(v1.add('people', { name: 'Ada', email: 'ada@example.com' }));

    const v2 = serviceFor(config(2, ['name', 'email']));
    const found = await firstValueFrom(v2.getAllByIndex('people', 'email', IDBKeyRange.only('ada@example.com')));

    // The new index covers records stored before it existed.
    expect(found).toEqual([{ id: 1, name: 'Ada', email: 'ada@example.com' }]);
    expect(await indexNames()).toEqual(['email', 'name']);
  });

  it('do not conflict with a migration that already creates the same index', async () => {
    const v1 = serviceFor(config(1, ['name']));
    await firstValueFrom(v1.count('people'));

    // Before this feature, adding an index to an existing store required a migration like this one.
    const v2 = serviceFor(
      config(2, ['name', 'email'], () => ({
        2: (_db: IDBDatabase, transaction: IDBTransaction) =>
          transaction.objectStore('people').createIndex('email', 'email', { unique: false }),
      }))
    );

    expect(await firstValueFrom(v2.count('people'))).toBe(0);
    expect(await indexNames()).toEqual(['email', 'name']);
  });

  it('are left alone when the version does not change', async () => {
    const v1 = serviceFor(config(1, ['name']));
    await firstValueFrom(v1.count('people'));

    // Without a version bump IndexedDB never upgrades, so nothing can be created.
    const same = serviceFor(config(1, ['name', 'email']));
    await firstValueFrom(same.count('people'));
    expect(await indexNames()).toEqual(['name']);
  });
});
