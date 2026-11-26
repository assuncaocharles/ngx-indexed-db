import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { DBConfig, INDEXED_DB } from './ngx-indexed-db.meta';
import { ServerIndexedDB } from '../ssr/server-indexed-db';
import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { provideIndexedDb } from './provide-indexed-db';

const DB = 'startup-spec';

const config = (version: number): DBConfig => ({
  name: DB,
  version,
  objectStoresMeta: [{ store: 'people', storeConfig: { keyPath: 'id', autoIncrement: true }, storeSchema: [] }],
});

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

/** Database setup runs asynchronously from the service constructor (issue #134). */
describe('Database startup', () => {
  beforeEach(deleteDb);
  afterAll(deleteDb);

  it('queries made right after injection wait for the database to be created', async () => {
    const service = serviceFor(config(1));
    await firstValueFrom(service.add('people', { name: 'Ada' }));
    expect(await firstValueFrom(service.count('people'))).toBe(1);
  });

  it('works when the browser already has a newer version than the config', async () => {
    // e.g. createObjectStore() bumped the version at runtime, or an older deployment is serving.
    await firstValueFrom(serviceFor(config(3)).count('people'));

    const older = serviceFor(config(1));
    expect(await firstValueFrom(older.count('people'))).toBe(0);
  });

  it('keeps working later when the browser has a newer version than the config', async () => {
    await firstValueFrom(serviceFor(config(3)).count('people'));

    const older = serviceFor(config(1));
    await new Promise((r) => setTimeout(r, 300));
    expect(await firstValueFrom(older.count('people'))).toBe(0);
  });

  it('ready() resolves once the database and its stores exist', async () => {
    const service = serviceFor(config(1));
    await service.ready();

    const names = await new Promise<string[]>((resolve) => {
      const request = indexedDB.open(DB);
      request.onsuccess = () => {
        resolve(Array.from(request.result.objectStoreNames));
        request.result.close();
      };
    });
    expect(names).toEqual(['people']);
  });

  it('ready() resolves at the browser version when it is newer than the config', async () => {
    await firstValueFrom(serviceFor(config(3)).count('people'));

    const older = serviceFor(config(1));
    await older.ready();
    expect(await firstValueFrom(older.getDatabaseVersion())).toBe(3);
  });

  it('ready() rejects for a database that is not registered', async () => {
    const service = serviceFor(config(1));
    await expect(service.ready('unknown')).rejects.toThrow('Database unknown is not initialized');
  });

  it('ready() resolves immediately with the server-side placeholder', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideIndexedDb(config(1)), { provide: INDEXED_DB, useValue: new ServerIndexedDB() }],
    });
    // Must not hang: SSR apps may await ready() in an app initializer.
    await expect(TestBed.inject(NgxIndexedDBService).ready()).resolves.toBeUndefined();
  });
});
