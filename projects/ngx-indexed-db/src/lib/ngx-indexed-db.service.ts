import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { openDatabase, CreateObjectStore } from './ngx-indexed-db';
import { createTransaction, optionsGenerator, validateBeforeTransaction } from '../utils';
import { CONFIG_TOKEN, DBConfig, Key, RequestEvent, ObjectStoreMeta, DBMode } from './ngx-indexed-db.meta';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from, Subject } from 'rxjs';
import { take } from 'rxjs/operators';

@Injectable()
export class NgxIndexedDBService {
  private readonly isBrowser: boolean;
  private indexedDB: IDBFactory;

  constructor(@Inject(CONFIG_TOKEN) private dbConfig: DBConfig, @Inject(PLATFORM_ID) private platformId: any) {
    if (!dbConfig.name) {
      throw new Error('NgxIndexedDB: Please, provide the dbName in the configuration');
    }
    if (!dbConfig.version) {
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
        dbConfig.name,
        dbConfig.version,
        dbConfig.objectStoresMeta,
        dbConfig.migrationFactory
      );
    }
  }

  /**
   * Allows to crate a new object store ad-hoc
   * @param storeName The name of the store to be created
   * @param migrationFactory The migration factory if exists
   */
  createObjectStore(
    storeSchema: ObjectStoreMeta,
    migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }
  ): void {
    const storeSchemas: ObjectStoreMeta[] = [storeSchema];
    CreateObjectStore(this.indexedDB, this.dbConfig.name, ++this.dbConfig.version, storeSchemas, migrationFactory);
  }

  /**
   * Adds new entry in the store and returns its key
   * @param storeName The name of the store to add the item
   * @param value The entry to be added
   * @param key The optional key for the entry
   */
  add<T>(storeName: string, value: T, key?: any): Observable<number> {
    return from(
      new Promise<number>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * Adds new entries in the store and returns its key
   * @param storeName The name of the store to add the item
   * @param values The entries to be added containing optional key attribute
   */
  bulkAdd<T>(storeName: string, values: T & { key?: any }[]): Observable<number[]> {
    const promises = values.map((value) => {
      return new Promise<number>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
          .then((db: IDBDatabase) => {
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);

            const key = value.key;
            delete value.key;

            const request: IDBRequest<IDBValidKey> = Boolean(key)
              ? objectStore.add(value, key)
              : objectStore.add(value);

            request.onsuccess = (evt: Event) => {
              const result = (evt.target as IDBOpenDBRequest).result;
              resolve((result as unknown) as number);
            };
          })
          .catch((reason) => reject(reason));
      });
    });
    return from(Promise.resolve(Promise.all(promises)));
  }

  /**
   * Adds new entry in the store and returns the item that was added
   * @param storeName The name of the store to add the item
   * @param value The entry to be added
   * @param key The optional key for the entry
   */
  addItem<T>(storeName: string, value: T, key?: any): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
          .then((db: IDBDatabase) => {
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const hasKey = Boolean(key);
            const request: IDBRequest<IDBValidKey> = hasKey ? objectStore.add(value, key) : objectStore.add(value);

            request.onsuccess = (evt: Event) => {
              const result = (evt.target as IDBOpenDBRequest).result;
              const itemKey = hasKey ? key : ((result as unknown) as number);
              this.getByKey(storeName, itemKey).subscribe((newValue) => {
                resolve(newValue as T);
              });
            };
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Adds new entry in the store and returns the item that was added
   * @param storeName The name of the store to add the item
   * @param value The entry to be added
   * @param key The key for the entry
   */
  addItemWithKey<T>(storeName: string, value: T, key: IDBValidKey): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
          .then((db: IDBDatabase) => {
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);

            transaction.oncomplete = () => {
              this.getByKey(storeName, key).subscribe((newValue) => {
                resolve(newValue as T);
              });
            };

            objectStore.add(value, key);
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns entry by key.
   * @param storeName The name of the store to query
   * @param key The entry key
   */
  getByKey<T>(storeName: string, key: IDBValidKey): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * Retrieve multiple entries in the store
   * @param storeName The name of the store to retrieve the items
   * @param keys The ids entries to be retrieve
   */
  bulkGet<T>(storeName: string, keys: Array<IDBValidKey>): Observable<unknown[]> {
    const promises = keys.map(key => this.getByKey(storeName, key).toPromise());
    return from(Promise.resolve(Promise.all(promises)));
  }

  /**
   * Returns entry by id.
   * @param storeName The name of the store to query
   * @param id The entry id
   */
  getByID<T>(storeName: string, id: string | number): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param key The entry key.
   */
  getByIndex<T>(storeName: string, indexName: string, key: IDBValidKey): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * @param storeName The name of the store to select the items
   */
  getAll<T>(storeName: string): Observable<T[]> {
    return from(
      new Promise<T[]>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * @param storeName The name of the store to update
   * @param value The new value for the entry
   * @param key The key of the entry to update if exists
   */
  update<T>(storeName: string, value: T, key?: any): Observable<T[]> {
    return from(
      new Promise<T[]>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);

            transaction.oncomplete = () => {
              this.getAll(storeName)
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
   * Returns the item you updated from the store after the update.
   * @param storeName The name of the store to update
   * @param value The new value for the entry
   * @param key The key of the entry to update
   */
  updateByKey<T>(storeName: string, value: T, key: IDBValidKey): Observable<T> {
    return from(
      new Promise<T>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);

            transaction.oncomplete = () => {
              this.getByKey(storeName, key).subscribe((newValue) => {
                resolve(newValue as T);
              });
            };

            objectStore.put(value, key);
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns all items from the store after delete.
   * @param storeName The name of the store to have the entry deleted
   * @param key The key of the entry to be deleted
   */
  delete<T>(storeName: string, key: Key): Observable<T[]> {
    return from(
      new Promise<T[]>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            objectStore.delete(key);

            transaction.oncomplete = () => {
              this.getAll(storeName)
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
   * Returns true from the store after a successful delete.
   * @param storeName The name of the store to have the entry deleted
   * @param key The key of the entry to be deleted
   */
  deleteByKey(storeName: string, key: Key): Observable<boolean> {
    return from(
      new Promise<boolean>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);

            transaction.oncomplete = () => {
              resolve(true);
            };

            objectStore.delete(key);
          })
          .catch((reason) => reject(reason));
      })
    );
  }

  /**
   * Returns true if successfully delete all entries from the store.
   * @param storeName The name of the store to have the entries deleted
   */
  clear(storeName: string): Observable<boolean> {
    return from(
      new Promise<boolean>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  deleteDatabase(): Observable<boolean> {
    return from(
      new Promise<boolean>(async (resolve, reject) => {
        try {
          const db = await openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version);
          await db.close();
          const deleteDBRequest = this.indexedDB.deleteDatabase(this.dbConfig.name);
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
   * @param storeName The name of the store to have the entries deleted
   * @param keyRange The key range which the cursor should be open on
   */
  openCursor(storeName: string, keyRange?: IDBKeyRange): Observable<Event> {
    return from(
      new Promise<Event>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * @param storeName The name of the store to query.
   * @param indexName The index name to filter.
   * @param keyRange The range value and criteria to apply on the index.
   */
  openCursorByIndex(
    storeName: string,
    indexName: string,
    keyRange: IDBKeyRange,
    mode: DBMode = DBMode.readonly
  ): Observable<Event> {
    const obs = new Subject<Event>();

    openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
      .then((db) => {
        validateBeforeTransaction(db, storeName, (reason) => {
          obs.error(reason);
        });
        const transaction = createTransaction(
          db,
          optionsGenerator(
            mode,
            storeName,
            (reason) => {
              obs.error(reason);
            },
            () => {
              obs.next();
            }
          )
        );
        const objectStore = transaction.objectStore(storeName);
        const index = objectStore.index(indexName);
        const request = index.openCursor(keyRange);

        request.onsuccess = (event: Event) => {
          obs.next(event);
        };
      })
      .catch((reason) => obs.error(reason));

    return obs;
  }

  /**
   * Returns all items by an index.
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param keyRange  The range value and criteria to apply on the index.
   */
  getAllByIndex<T>(storeName: string, indexName: string, keyRange: IDBKeyRange): Observable<T[]> {
    const data: T[] = [];
    return from(
      new Promise<T[]>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param keyRange  The range value and criteria to apply on the index.
   */
  getAllKeysByIndex(
    storeName: string,
    indexName: string,
    keyRange: IDBKeyRange
  ): Observable<{ primaryKey: any; key: any }[]> {
    const data: { primaryKey: any; key: any }[] = [];
    return from(
      new Promise<{ primaryKey: any; key: any }[]>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
          .then((db) => {
            validateBeforeTransaction(db, storeName, reject);
            const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            const index = objectStore.index(indexName);
            const request = index.openKeyCursor(keyRange);
            request.onsuccess = (event) => {
              const cursor: IDBCursor = (event.target as IDBRequest<IDBCursor>).result;
              if (cursor) {
                data.push({ primaryKey: cursor.primaryKey, key: cursor.key });
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
   * @param storeName The name of the store to query
   * @param keyRange  The range value and criteria to apply.
   */
  count(storeName: string, keyRange?: IDBValidKey | IDBKeyRange): Observable<number> {
    return from(
      new Promise<number>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
