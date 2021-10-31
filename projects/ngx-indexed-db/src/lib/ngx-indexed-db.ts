import { ObjectStoreMeta, ObjectStoreSchema } from './ngx-indexed-db.meta';
import { Observable, Subscriber } from 'rxjs';

export function openDatabase(
  indexedDB: IDBFactory,
  dbName: string,
  version?: number,
  upgradeCallback?: (a: Event, b: IDBDatabase) => void
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!indexedDB) {
      reject('IndexedDB not available');
    }
    const request = indexedDB.open(dbName, version);
    let db: IDBDatabase;
    request.onsuccess = (event: Event) => {
      db = request.result;
      resolve(db);
    };
    request.onerror = (event: Event) => {
      reject(`IndexedDB error: ${request.error}`);
    };
    if (typeof upgradeCallback === 'function') {
      request.onupgradeneeded = (event: Event) => {
        upgradeCallback(event, db);
      };
    }
  });
}

export function CreateObjectStore(
  indexedDB: IDBFactory,
  dbName: string,
  version: number,
  storeSchemas: ObjectStoreMeta[],
  migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }
): void {
  if (!indexedDB) {
    return;
  }
  const request: IDBOpenDBRequest = indexedDB.open(dbName, version);

  request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
    const database: IDBDatabase = (event.target as any).result;

    storeSchemas.forEach((storeSchema: ObjectStoreMeta) => {
      if (!database.objectStoreNames.contains(storeSchema.store)) {
        const objectStore = database.createObjectStore(storeSchema.store, storeSchema.storeConfig);
        storeSchema.storeSchema.forEach((schema: ObjectStoreSchema) => {
          objectStore.createIndex(schema.name, schema.keypath, schema.options);
        });
      }
    });

    const storeMigrations = migrationFactory && migrationFactory();
    if (storeMigrations) {
      Object.keys(storeMigrations)
        .map((k) => parseInt(k, 10))
        .filter((v) => v > event.oldVersion)
        .sort((a, b) => a - b)
        .forEach((v) => {
          storeMigrations[v](database, request.transaction);
        });
    }

    database.close();
  };

  request.onsuccess = (e: any) => {
    e.target.result.close();
  };
}

export function DeleteObjectStore(dbName: string, version: number, storeName: string): Observable<boolean> {
  if (!dbName || !version || !storeName) {
    throw Error('Params: "dbName", "version", "storeName" are mandatory.');
  }

  return new Observable<boolean>((obs: Subscriber<boolean>) => {
    try {
      const newVersion = version + 1;
      const request: IDBOpenDBRequest = indexedDB.open(dbName, newVersion);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const database: IDBDatabase = (event.target as any).result;

        database.deleteObjectStore(storeName);
        database.close();
        console.log('onupgradeneeded');
        obs.next(true);
        obs.complete();
      };

      request.onerror = (e) => obs.error(e);
    } catch (error) {
      obs.error(error);
    }
  });


}
