import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { openDatabase, CreateObjectStore } from './ngx-indexed-db';
import { createTransaction, optionsGenerator, validateBeforeTransaction } from '../utils';
import { CONFIG_TOKEN, DBConfig, Key, RequestEvent, ObjectStoreMeta, DBMode, DBOptions } from './ngx-indexed-db.meta';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from } from 'rxjs';
import { take } from 'rxjs/operators';

@Injectable()
export class NgxIndexedDBService {
  private isBrowser: boolean;
  private indexedDB: IDBFactory;

  constructor(@Inject(CONFIG_TOKEN) private dbConfig: Array<DBConfig>, @Inject(PLATFORM_ID) private platformId: any) {
    if (!dbConfig || (dbConfig && dbConfig.length === 0)) {
      throw new Error('NgxIndexedDB: Please, provide an array of dbConfig');
    }

    dbConfig.forEach((config: DBConfig) => {
      if (!config.name) {
        throw new Error('NgxIndexedDB: Please, provide the dbName in the configuration');
      }
      if (!config.version) {
        throw new Error('NgxIndexedDB: Please, provide the db version in the configuration');
      }
      this.isBrowser = isPlatformBrowser(this.platformId);
      if (this.isBrowser) {
        this.indexedDB =
          window.indexedDB ||
          (window as any).mozIndexedDB ||
          (window as any).webkitIndexedDB ||
          (window as any).msIndexedDB;
        CreateObjectStore(
          this.indexedDB,
          config.name,
          config.version,
          config.objectStoresMeta,
          config.migrationFactory
        );
      }
    });
  }

  /**
   * Allows to crate a new object store ad-hoc
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to be created
   * @param migrationFactory The migration factory if exists
   */
  createObjectStore(
    dbOptions: DBOptions,
    storeSchema: ObjectStoreMeta,
    migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }
  ): void {
    const storeSchemas: ObjectStoreMeta[] = [storeSchema];
    CreateObjectStore(this.indexedDB, dbOptions?.name, ++dbOptions.version, storeSchemas, migrationFactory);
  }

  /**
   * Adds new entry in the store and returns its key
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to add the item
   * @param value The entry to be added
   * @param key The optional key for the entry
   */
  add<T>(dbOptions: DBOptions, storeName: string, value: T, key?: any): Observable<number> {
    return from(
      new Promise<number>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db: IDBDatabase) => {
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const request: IDBRequest<IDBValidKey> = Boolean(key)
              ? objectStore.add(value, key)
              : objectStore.add(value);

            request.onsuccess = (evt: Event) => {
              const result = (evt.target as IDBOpenDBRequest).result;
              resolve((result as unknown) as number);
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns entry by key.
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to query
   * @param key The entry key
   */
  getByKey<T>(dbOptions: DBOptions, storeName: string, key: IDBValidKey): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db: IDBDatabase) => {
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const request = objectStore.get(key) as IDBRequest<T>;
            request.onsuccess = (event: Event) => {
              resolve((event.target as IDBRequest<T>).result);
            };
            request.onerror = (event: Event) => {
              reject(event);
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns entry by id.
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to query
   * @param id The entry id
   */
  getByID<T>(dbOptions: DBOptions, storeName: string, id: string | number): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db: IDBDatabase) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const request: IDBRequest = objectStore.get(id) as IDBRequest<T>;
            request.onsuccess = (event: Event) => {
              resolve((event.target as IDBRequest<T>).result);
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns entry by index.
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param key The entry key.
   */
  getByIndex<T>(dbOptions: DBOptions, storeName: string, indexName: string, key: IDBValidKey): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const index = objectStore.index(indexName);
            const request = index.get(key) as IDBRequest<T>;
            request.onsuccess = (event: Event) => {
              resolve((event.target as IDBRequest<T>).result);
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Return all elements from one store
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to select the items
   */
  getAll<T>(dbOptions: DBOptions, storeName: string): Observable<T[]> {
    return from(
      new Promise<T[]>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);

            const request: IDBRequest = objectStore.getAll();

            request.onerror = (evt: Event) => {
              reject(evt);
            };

            request.onsuccess = ({ target: { result: ResultAll } }: RequestEvent<T>) => {
              resolve(ResultAll as T[]);
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns all items from the store after update.
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to update
   * @param value The new value for the entry
   * @param key The key of the entry to update if exists
   */
  update<T>(dbOptions: DBOptions, storeName: string, value: T, key?: any): Observable<T[]> {
    return from(
      new Promise<T[]>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);

            transaction.oncomplete = () => {
              this.getAll(dbOptions, storeName)
                .pipe(take(1))
                .subscribe((newValues) => {
                  resolve(newValues as T[]);
                });
            };

            key ? objectStore.put(value, key) : objectStore.put(value);
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns all items from the store after delete.
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to have the entry deleted
   * @param key The key of the entry to be deleted
   */
  delete<T>(dbOptions: DBOptions, storeName: string, key: Key): Observable<T[]> {
    return from(
      new Promise<T[]>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            objectStore.delete(key);

            transaction.oncomplete = () => {
              this.getAll(dbOptions, storeName)
                .pipe(take(1))
                .subscribe((newValues) => {
                  resolve(newValues as T[]);
                });
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns true if successfully delete all entries from the store.
   * @param dbOptions Name and version of the database.
   * @param storeName The name of the store to have the entries deleted
   */
  clear(dbOptions: DBOptions, storeName: string): Observable<boolean> {
    return from(
      new Promise<boolean>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            objectStore.clear();
            transaction.oncomplete = () => {
              resolve(true);
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns true if successfully delete the DB.
   * @param dbOptions Name and version of the database.
   */
  deleteDatabase(dbOptions: DBOptions): Observable<boolean> {
    return from(
      new Promise<boolean>(async (resolve, reject) => {
        try {
          const db = await openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version);
          await db.close();
          const deleteDBRequest = this.indexedDB.deleteDatabase(dbOptions?.name);
          deleteDBRequest.onsuccess = () => {
            resolve(true);
          };
          deleteDBRequest.onerror = reject;
          deleteDBRequest.onblocked = () => {
            throw new Error(`Unable to delete database because it's blocked`);
          };
        } catch (evt) {
          reject(evt);
        }
      })
    );
  }

  /**
   * Returns the open cursor event
   * @param dbOptions Name and version of the database.
   * @param storeName The name of the store to have the entries deleted
   * @param keyRange The key range which the cursor should be open on
   */
  openCursor(dbOptions: DBOptions, storeName: string, keyRange?: IDBKeyRange): Observable<Event> {
    return from(
      new Promise<Event>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const request = keyRange === undefined ? objectStore.openCursor() : objectStore.openCursor(keyRange);

            request.onsuccess = (event: Event) => {
              resolve(event);
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Open a cursor by index filter.
   * @param dbOptions Name and version of the database.
   * @param storeName The name of the store to query.
   * @param indexName The index name to filter.
   * @param keyRange The range value and criteria to apply on the index.
   */
  openCursorByIndex(
    dbOptions: DBOptions,
    storeName: string,
    indexName: string,
    keyRange: IDBKeyRange,
    mode: DBMode = DBMode.readonly
  ): Observable<Event> {
    return from(
      new Promise<Event>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(mode, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const index = objectStore.index(indexName);
            const request = index.openCursor(keyRange);

            request.onsuccess = (event: Event) => {
              resolve(event);
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns all items by an index.
   * @param dbOptions Name and version of the database.
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param keyRange  The range value and criteria to apply on the index.
   */
  getAllByIndex<T>(dbOptions: DBOptions, storeName: string, indexName: string, keyRange: IDBKeyRange): Observable<T[]> {
    const data: T[] = [];
    return from(
      new Promise<T[]>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const index = objectStore.index(indexName);
            const request = index.openCursor(keyRange);
            request.onsuccess = (event) => {
              const cursor: IDBCursorWithValue = (event.target as IDBRequest<IDBCursorWithValue>).result;
              if (cursor) {
                data.push(cursor.value);
                cursor.continue();
              } else {
                resolve(data);
              }
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns all primary keys by an index.
   * @param dbOptions Name and version of the database.
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param keyRange  The range value and criteria to apply on the index.
   */
  getAllKeysByIndex(dbOptions: DBOptions, storeName: string, indexName: string, keyRange: IDBKeyRange): Observable<{primaryKey: any, key: any}[]> {
    const data: {primaryKey: any, key: any}[] = [];
    return from(
      new Promise<{primaryKey: any, key: any}[]>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const index = objectStore.index(indexName);
            const request = index.openKeyCursor(keyRange);
            request.onsuccess = (event) => {
              const cursor: IDBCursor = (event.target as IDBRequest<IDBCursor>).result;
              if (cursor) {
                data.push({primaryKey: cursor.primaryKey, key: cursor.key});
                cursor.continue();
              } else {
                resolve(data);
              }
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns the number of rows in a store.
   * @param dbOptions Name and version of the database
   * @param storeName The name of the store to query
   * @param keyRange  The range value and criteria to apply.
   */
  count(dbOptions: DBOptions, storeName: string, keyRange?: IDBValidKey | IDBKeyRange): Observable<number> {
    return from(
      new Promise<number>((resolve, reject) => {
        openDatabase(this.indexedDB, dbOptions?.name, dbOptions?.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const request: IDBRequest = objectStore.count(keyRange);
            request.onerror = (e) => reject(e);
            request.onsuccess = (e) => resolve(((e.target as IDBOpenDBRequest).result as unknown) as number);
          })
          .catch((reason) => reject(reason));
      })
    );
  }
}
