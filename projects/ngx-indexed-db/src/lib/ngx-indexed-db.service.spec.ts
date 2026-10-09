import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';

import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { NgxIndexedDBModule } from './ngxindexeddb.module';
import { provideIndexedDb } from './provide-indexed-db';
import { DBConfig } from './ngx-indexed-db.meta';

interface Person {
  id?: number;
  name: string;
  email: string;
}

let dbCounter = 0;

function createDbConfig(): DBConfig {
  return {
    // A unique name per test keeps the in-memory databases isolated from each other.
    name: `MyDb_${++dbCounter}`,
    version: 1,
    objectStoresMeta: [
      {
        store: 'people',
        storeConfig: { keyPath: 'id', autoIncrement: true },
        storeSchema: [
          { name: 'name', keypath: 'name', options: { unique: false } },
          { name: 'email', keypath: 'email', options: { unique: false } },
        ],
      },
    ],
  };
}

describe('NgxIndexedDBService', () => {
  describe('with NgxIndexedDBModule', () => {
    it('should be created', () => {
      TestBed.configureTestingModule({
        imports: [NgxIndexedDBModule.forRoot(createDbConfig())],
      });

      expect(TestBed.inject(NgxIndexedDBService)).toBeTruthy();
    });
  });

  describe('with provideIndexedDb', () => {
    let service: NgxIndexedDBService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideIndexedDb(createDbConfig())],
      });
      service = TestBed.inject(NgxIndexedDBService);
    });

    it('should add an entry and return it with its generated id', async () => {
      const person = await firstValueFrom(service.add<Person>('people', { name: 'charles', email: 'c@test.dev' }));

      expect(person).toEqual({ id: 1, name: 'charles', email: 'c@test.dev' });
    });

    it('should read entries back by key, by index and in bulk', async () => {
      await firstValueFrom(
        service.bulkAdd<Person>('people', [
          { name: 'alice', email: 'a@test.dev' },
          { name: 'bob', email: 'b@test.dev' },
        ])
      );

      expect(await firstValueFrom(service.getByKey<Person>('people', 2))).toEqual({
        id: 2,
        name: 'bob',
        email: 'b@test.dev',
      });
      expect(await firstValueFrom(service.getByIndex<Person>('people', 'name', 'alice'))).toEqual({
        id: 1,
        name: 'alice',
        email: 'a@test.dev',
      });
      expect(await firstValueFrom(service.getAll<Person>('people'))).toHaveLength(2);
      expect(await firstValueFrom(service.count('people'))).toBe(2);
    });

    it('should update and delete entries', async () => {
      await firstValueFrom(service.add<Person>('people', { name: 'charles', email: 'c@test.dev' }));

      const updated = await firstValueFrom(
        service.update<Person>('people', { id: 1, name: 'charles', email: 'new@test.dev' })
      );
      expect(updated.email).toBe('new@test.dev');

      const remaining = await firstValueFrom(service.delete<Person>('people', 1));
      expect(remaining).toEqual([]);
    });

    it('should iterate entries with a cursor', async () => {
      await firstValueFrom(
        service.bulkAdd<Person>('people', [
          { name: 'alice', email: 'a@test.dev' },
          { name: 'bob', email: 'b@test.dev' },
        ])
      );

      const names = await firstValueFrom(
        service.getAllByIndex<Person>('people', 'name', IDBKeyRange.bound('a', 'z')).pipe(toArray())
      );
      expect(names.flat().map((p) => p.name)).toEqual(['alice', 'bob']);
    });

    it('should clear the store', async () => {
      await firstValueFrom(service.add<Person>('people', { name: 'charles', email: 'c@test.dev' }));
      await firstValueFrom(service.clear('people'));

      expect(await firstValueFrom(service.count('people'))).toBe(0);
    });

    it('should list the object store names', async () => {
      expect(await firstValueFrom(service.getAllObjectStoreNames())).toEqual(['people']);
    });
  });

  describe('without a configured version', () => {
    let service: NgxIndexedDBService;

    beforeEach(() => {
      const config = createDbConfig();
      delete config.version;
      TestBed.configureTestingModule({
        providers: [provideIndexedDb(config)],
      });
      service = TestBed.inject(NgxIndexedDBService);
    });

    it('should refuse a schema change while the version is still unknown', async () => {
      const storeSchema = { store: 'pets', storeConfig: { keyPath: 'id', autoIncrement: true }, storeSchema: [] };

      await expect(service.createObjectStore(storeSchema)).rejects.toThrow(/version of database .* is unknown/);
      expect(() => service.deleteObjectStore('people')).toThrow(/version of database .* is unknown/);
    });
  });
});
