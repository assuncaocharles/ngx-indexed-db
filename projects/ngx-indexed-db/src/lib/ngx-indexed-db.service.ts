import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { openDatabase, CreateObjectStore, DeleteObjectStore } from './ngx-indexed-db';
import { createTransaction, optionsGenerator, validateBeforeTransaction } from '../utils';
import { CONFIG_TOKEN, DBConfig, Key, RequestEvent, ObjectStoreMeta, DBMode, WithID } from './ngx-indexed-db.meta';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, combineLatest, from } from 'rxjs';
import { take } from 'rxjs/operators';

@Injectable()
export class NgxIndexedDBService {
  private readonly isBrowser: boolean;
  private indexedDB: IDBFactory;
  private defaultDatabaseName?: string = null;

  constructor(
    @Inject(CONFIG_TOKEN) private dbConfigs: Record<string, DBConfig>,
    @Inject(PLATFORM_ID) private platformId: any
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.indexedDB =
        window.indexedDB ||
        (window as any).mozIndexedDB ||
        (window as any).webkitIndexedDB ||
        (window as any).msIndexedDB;

      const dbConfigs = Object.values(this.dbConfigs);
      const isOnlyConfig = dbConfigs.length === 1
      for (const dbConfig of dbConfigs) {
        this.instanciateConfig(dbConfig, isOnlyConfig);
      }
    }
  }

  private instanciateConfig(dbConfig: DBConfig, isOnlyConfig: boolean): void {
    if (!dbConfig.name) {
      throw new Error('NgxIndexedDB: Please, provide the dbName in the configuration');
    }
    if (!dbConfig.version) {
      throw new Error('NgxIndexedDB: Please, provide the db version in the configuration');
    }
    if ((dbConfig.isDefault ?? false) && this.defaultDatabaseName) {
      // A default DB is already configured, throw an error
      throw new Error('NgxIndexedDB: Only one database can be set as default')
    }
    if (((dbConfig.isDefault ?? false) && !this.defaultDatabaseName) || isOnlyConfig) {
      this.defaultDatabaseName = dbConfig.name;
    }
    CreateObjectStore(
      this.indexedDB,
      dbConfig.name,
      dbConfig.version,
      dbConfig.objectStoresMeta,
      dbConfig.migrationFactory
    );

    openDatabase(this.indexedDB, dbConfig.name).then((db) => {
      if (db.version !== dbConfig.version) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`
            Your DB Config doesn't match the most recent version of the DB with name ${dbConfig.name}, please update it
            DB current version: ${db.version};
            Your configuration: ${dbConfig.version};
            `);
          console.warn(`Using latest version ${db.version}`);
        }
        this.dbConfigs[dbConfig.name].version = db.version;
      }
    });
  }

  private getDbConfig(databaseName?: string): DBConfig {
    databaseName = databaseName ?? this.defaultDatabaseName;
    if (!databaseName) {
      // Name is still null, it means that there is no default database set
      // and the database name was not specified while calling a method
      throw new Error(`No database name specified and no default database set.`);
    }
    if (!Object.keys(this.dbConfigs).includes(databaseName)) {
      throw new Error(`NgxIndexedDB: Database ${databaseName} is not initialized.`);
    }
    return this.dbConfigs[databaseName];
  }

  /**
   * Allows to crate a new object store ad-hoc
   * @param storeName The name of the store to be created
   * @param migrationFactory The migration factory if exists
   * @param {string} [databaseName=undefined] The name of the database to create a store on
   */
  createObjectStore(
    storeSchema: ObjectStoreMeta,
    migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void },
    databaseName?: string,
  ): void {
    const dbConfig = this.getDbConfig(databaseName);
    const storeSchemas: ObjectStoreMeta[] = [storeSchema];
    CreateObjectStore(this.indexedDB, dbConfig.name, ++dbConfig.version, storeSchemas, migrationFactory);
  }

  /**
   * Adds new entry in the store and returns its key
   * @param storeName The name of the store to add the item
   * @param value The entry to be added
   * @param key The optional key for the entry
   * @param {string} [databaseName=undefined] Optional database to store the item into
   */
  add<T>(storeName: string, value: T, key?: any, databaseName?: string): Observable<T & WithID> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db: IDBDatabase) => {
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          const request: IDBRequest<IDBValidKey> = Boolean(key) ? objectStore.add(value, key) : objectStore.add(value);

          request.onsuccess = async (evt: Event) => {
            const result: any = (evt.target as IDBOpenDBRequest).result;
            const getRequest: IDBRequest = objectStore.get(result) as IDBRequest<T>;
            getRequest.onsuccess = (event: Event) => {
              obs.next((event.target as IDBRequest<T & WithID>).result);
              obs.complete();
            };
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Adds new entries in the store and returns its key
   * @param storeName The name of the store to add the item
   * @param values The entries to be added containing optional key attribute
   * @param {string} [databaseName=undefined] The name of the database to add items on
   */
  bulkAdd<T>(storeName: string, values: Array<T & { key?: any }>, databaseName?: string): Observable<number[]> {
    const dbConfig = this.getDbConfig(databaseName);
    const promises = new Promise<number[]>((resolve, reject) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db: IDBDatabase) => {
          const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, resolve, reject));
          const objectStore = transaction.objectStore(storeName);

          const results = values.map((value) => {
            return new Promise<number>((resolve1, reject1) => {
              const key = value.key;
              delete value.key;

              const request: IDBRequest<IDBValidKey> = Boolean(key)
                ? objectStore.add(value, key)
                : objectStore.add(value);

              request.onsuccess = (evt: Event) => {
                const result = (evt.target as IDBOpenDBRequest).result;
                resolve1((result as unknown) as number);
              };
            });
          });

          resolve(Promise.all(results));
        })
        .catch((reason) => reject(reason));
    });

    return from(promises);
  }

  /**
   * Delete entries in the store and returns current entries in the store
   * @param storeName The name of the store to add the item
   * @param keys The keys to be deleted
   * @param {string} [databaseName=undefined] The name of the database to delete items of
   */
  bulkDelete(storeName: string, keys: Key[], databaseName?: string): Observable<number[]> {
    const dbConfig = this.getDbConfig(databaseName);
    const promises = keys.map((key) => {
      return new Promise<number>((resolve, reject) => {
        openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
          .then((db: IDBDatabase) => {
            const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve));
            const objectStore = transaction.objectStore(storeName);
            objectStore.delete(key);

            transaction.oncomplete = () => {
              this.getAll(storeName)
                .pipe(take(1))
                .subscribe((newValues) => {
                  resolve(newValues as any);
                });
            };
          })
          .catch((reason) => reject(reason));
      });
    });
    return from(Promise.all(promises));
  }

  /**
   * Returns entry by key.
   * @param storeName The name of the store to query
   * @param key The entry key
   * @param {string} [databaseName=undefined] The name of the database to get items of
   */
  getByKey<T>(storeName: string, key: IDBValidKey, databaseName?: string): Observable<T> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable<T>((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db: IDBDatabase) => {
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const request = objectStore.get(key) as IDBRequest<T>;
          request.onsuccess = (event: Event) => {
            obs.next((event.target as IDBRequest<T>).result);
            obs.complete();
          };
          request.onerror = (event: Event) => {
            obs.error(event);
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Retrieve multiple entries in the store
   * @param storeName The name of the store to retrieve the items
   * @param keys The ids entries to be retrieve
   * @param {string} [databaseName=undefined] The name of the database to get items of
   */
  bulkGet<T>(storeName: string, keys: Array<IDBValidKey>, databaseName?: string): any {
    const observables = keys.map((key) => this.getByKey(storeName, key, databaseName));

    return new Observable((obs) => {
      combineLatest(observables).subscribe((values) => {
        obs.next(values);
        obs.complete();
      });
    });
  }

  /**
   * Returns entry by id.
   * @param storeName The name of the store to query
   * @param id The entry id
   * @param {string} [databaseName=undefined] The name of the database to get items of
   */
  getByID<T>(storeName: string, id: string | number, databaseName?: string): Observable<T> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db: IDBDatabase) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error, obs.next));
          const objectStore = transaction.objectStore(storeName);
          const request: IDBRequest = objectStore.get(id) as IDBRequest<T>;
          request.onsuccess = (event: Event) => {
            obs.next((event.target as IDBRequest<T>).result);
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Returns entry by index.
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param key The entry key.
   * @param {string} [databaseName=undefined] The name of the database to get items of
   */
  getByIndex<T>(storeName: string, indexName: string, key: IDBValidKey, databaseName?: string): Observable<T> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);
          const request = index.get(key) as IDBRequest<T>;
          request.onsuccess = (event: Event) => {
            obs.next((event.target as IDBRequest<T>).result);
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Return all elements from one store
   * @param storeName The name of the store to select the items
   * @param {string} [databaseName=undefined] The name of the database to get items of
   */
  getAll<T>(storeName: string, databaseName?: string): Observable<T[]> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error, obs.next));
          const objectStore = transaction.objectStore(storeName);

          const request: IDBRequest = objectStore.getAll();

          request.onerror = (evt: Event) => {
            obs.error(evt);
          };

          request.onsuccess = ({ target: { result: ResultAll } }: RequestEvent<T>) => {
            obs.next(ResultAll as T[]);
            obs.complete();
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Adds or updates a record in store with the given value and key. Return all items present in the store
   * @param storeName The name of the store to update
   * @param value The new value for the entry
   * @param {string} [databaseName=undefined] The name of the database to update the items of
   */
  update<T>(storeName: string, value: T, databaseName?: string): Observable<T> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);

          const request: IDBRequest<IDBValidKey> = objectStore.put(value);

          request.onsuccess = async (evt: Event) => {
            const result: any = (evt.target as IDBOpenDBRequest).result;

            const getRequest: IDBRequest = objectStore.get(result) as IDBRequest<T>;
            getRequest.onsuccess = (event: Event) => {
              obs.next((event.target as IDBRequest<T & WithID>).result);
              obs.complete();
            };
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns all items from the store after delete.
   * @param storeName The name of the store to have the entry deleted
   * @param key The key of the entry to be deleted
   * @param {string} [databaseName=undefined] The name of the database to delete items of
   */
  delete<T>(storeName: string, key: Key, databaseName?: string): Observable<T[]> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          objectStore.delete(key);

          transaction.oncomplete = () => {
            this.getAll(storeName)
              .pipe(take(1))
              .subscribe((newValues) => {
                obs.next(newValues as T[]);
                obs.complete();
              });
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns true from the store after a successful delete.
   * @param storeName The name of the store to have the entry deleted
   * @param key The key of the entry to be deleted
   * @param {string} [databaseName=undefined] The name of the database to delete items of
   */
  deleteByKey(storeName: string, key: Key, databaseName?: string): Observable<boolean> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);

          transaction.oncomplete = () => {
            obs.next(true);
            obs.complete();
          };

          objectStore.delete(key);
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns true if successfully delete all entries from the store.
   * @param storeName The name of the store to have the entries deleted
   * @param {string} [databaseName=undefined] The name of the database to clear
   */
  clear(storeName: string, databaseName?: string): Observable<boolean> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          objectStore.clear();
          transaction.oncomplete = () => {
            obs.next(true);
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns true if successfully delete the DB.
   *
   * @param {string} databaseName The name of the database to delete
   */
  deleteDatabase(databaseName?: string): Observable<boolean> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then(async (db) => {
          await db.close();
          const deleteDBRequest = this.indexedDB.deleteDatabase(dbConfig.name);
          deleteDBRequest.onsuccess = () => {
            obs.next(true);
            obs.complete();
          };
          deleteDBRequest.onerror = (error) => obs.error(error);
          deleteDBRequest.onblocked = () => {
            throw new Error(`Unable to delete database because it's blocked`);
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Returns the open cursor event
   * @param storeName The name of the store to have the entries deleted
   * @param keyRange The key range which the cursor should be open on
   * @param {string} [databaseName=undefined] The name of the database to open the cursor on
   */
  openCursor(storeName: string, keyRange?: IDBKeyRange, databaseName?: string): Observable<Event> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const request = keyRange === undefined ? objectStore.openCursor() : objectStore.openCursor(keyRange);

          request.onsuccess = (event: Event) => {
            obs.next(event);
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Open a cursor by index filter.
   * @param storeName The name of the store to query.
   * @param indexName The index name to filter.
   * @param keyRange The range value and criteria to apply on the index.
   * @param {string} [databaseName=undefined] The name of the database to open the cursor on
   */
  openCursorByIndex(
    storeName: string,
    indexName: string,
    keyRange: IDBKeyRange,
    mode: DBMode = DBMode.readonly,
    databaseName?: string,
  ): Observable<Event> {
    const obs = new Subject<Event>();
    const dbConfig = this.getDbConfig(databaseName);

    openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
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
   * @param {string} [databaseName=undefined] The name of the database to get items of
   */
  getAllByIndex<T>(storeName: string, indexName: string, keyRange: IDBKeyRange, databaseName?: string): Observable<T[]> {
    const data: T[] = [];
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);
          const request = index.openCursor(keyRange);
          request.onsuccess = (event) => {
            const cursor: IDBCursorWithValue = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              data.push(cursor.value);
              cursor.continue();
            } else {
              obs.next(data);
              obs.complete();
            }
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns all primary keys by an index.
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param keyRange  The range value and criteria to apply on the index.
   * @param {string} [databaseName=undefined] The name of the database to get keys of
   */
  getAllKeysByIndex(
    storeName: string,
    indexName: string,
    keyRange: IDBKeyRange,
    databaseName?: string,
  ): Observable<{ primaryKey: any; key: any }[]> {
    const data: { primaryKey: any; key: any }[] = [];
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);
          const request = index.openKeyCursor(keyRange);
          request.onsuccess = (event) => {
            const cursor: IDBCursor = (event.target as IDBRequest<IDBCursor>).result;
            if (cursor) {
              data.push({ primaryKey: cursor.primaryKey, key: cursor.key });
              cursor.continue();
            } else {
              obs.next(data);
              obs.complete();
            }
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns the number of rows in a store.
   * @param storeName The name of the store to query
   * @param keyRange  The range value and criteria to apply.
   * @param {string} [databaseName=undefined] The name of the database to count the items of
   */
  count(storeName: string, keyRange?: IDBValidKey | IDBKeyRange, databaseName?: string): Observable<number> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const request: IDBRequest = objectStore.count(keyRange);
          request.onerror = (e) => obs.error(e);
          request.onsuccess = (e) => {
            obs.next(((e.target as IDBOpenDBRequest).result as unknown) as number);
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns the number of rows in a store.
   * @param storeName The name of the store to query
   * @param keyRange  The range value and criteria to apply.
   * @param {string} [databaseName=undefined] The name of the database to count the items of
   */
  countByIndex(storeName: string, indexName: string, keyRange?: IDBValidKey | IDBKeyRange, databaseName?: string): Observable<number> {
    const dbConfig = this.getDbConfig(databaseName);
    return new Observable((obs) => {
      openDatabase(this.indexedDB, dbConfig.name, dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);
          const request: IDBRequest = index.count(keyRange);
          request.onerror = (e) => obs.error(e);
          request.onsuccess = (e) => {
            obs.next(((e.target as IDBOpenDBRequest).result as unknown) as number);
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Delete the store by name.
   * @param storeName The name of the store to query
   * @param {string} [databaseName=undefined] The name of the database to delete the store of
   */
  deleteObjectStore(storeName: string, databaseName?: string): Observable<boolean> {
    const dbConfig = this.getDbConfig(databaseName);
    return DeleteObjectStore(dbConfig.name, ++dbConfig.version, storeName);
  }
}
