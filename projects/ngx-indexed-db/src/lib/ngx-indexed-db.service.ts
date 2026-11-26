import { Injectable, isDevMode, inject } from '@angular/core';
import { Observable, Subscriber, combineLatest, from } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { createTransaction, optionsGenerator, validateBeforeTransaction } from '../utils';
import { CloseDbConnection } from './decorators';
import { CreateObjectStore, DeleteObjectStore, openDatabase } from './ngx-indexed-db';
import {
  CONFIG_TOKEN,
  DBConfig,
  DBMode,
  FindOptions,
  INDEXED_DB,
  IndexKey,
  NgxIDBCursor,
  NgxIDBCursorWithValue,
  ObjectStoreMeta,
  RequestEvent,
  WithID,
} from './ngx-indexed-db.meta';
import { ServerIndexedDB } from '../ssr/server-indexed-db';

@Injectable()
export class NgxIndexedDBService {
  private dbConfigs = inject<Record<string, DBConfig>>(CONFIG_TOKEN);
  private indexedDB = inject<IDBFactory>(INDEXED_DB);

  private defaultDatabaseName?: string;
  private selectedDb?: string;
  /** Settles once each database has been created or upgraded; every operation waits for it. */
  private readonly setup = new Map<string, Promise<void>>();

  constructor() {
    Object.values(this.dbConfigs).forEach((dbConfig, _, ref) => {
      const setup = this.instanciateConfig(dbConfig, ref.length === 1);
      // Surface setup failures right away; ready() and every operation still reject with them.
      setup.catch((error) => console.error(error));
      this.setup.set(dbConfig.name, setup);
    });
  }

  /**
   * Resolves once the database has been created or upgraded and is ready to use.
   * Operations already wait for this on their own; use it to hold app startup or a route until the
   * database exists, for example with `provideAppInitializer()`. On the server it resolves immediately.
   * @param databaseName The database to wait for. Defaults to the selected database.
   */
  ready(databaseName?: string): Promise<void> {
    const name = databaseName ?? this.selectedDb ?? this.defaultDatabaseName;
    const setup = name ? this.setup.get(name) : undefined;
    if (!setup) {
      return Promise.reject(new Error(`NgxIndexedDB: Database ${name ?? '(none selected)'} is not initialized.`));
    }
    return setup;
  }

  /** Opens the selected database once its setup has finished, at its current version. */
  private open(): Promise<IDBDatabase> {
    const config = this.dbConfig;
    return this.ready(config.name).then(() => openDatabase(this.indexedDB, config.name, config.version));
  }

  private async instanciateConfig(dbConfig: DBConfig, isOnlyConfig: boolean): Promise<void> {
    if (!dbConfig.name) {
      throw new Error('NgxIndexedDB: Please, provide the dbName in the configuration');
    }
    // if (!dbConfig.version) {
    //   throw new Error('NgxIndexedDB: Please, provide the db version in the configuration');
    // }
    if ((dbConfig.isDefault ?? false) && this.defaultDatabaseName) {
      // A default DB is already configured, throw an error
      throw new Error('NgxIndexedDB: Only one database can be set as default');
    }
    if (((dbConfig.isDefault ?? false) && !this.defaultDatabaseName) || isOnlyConfig) {
      this.defaultDatabaseName = dbConfig.name;
      this.selectedDb = dbConfig.name;
    }

    // The server-side placeholder never answers requests, so there is nothing to wait for.
    if (this.indexedDB instanceof ServerIndexedDB) {
      return;
    }

    try {
      await CreateObjectStore(
        this.indexedDB,
        dbConfig.name,
        dbConfig.version,
        dbConfig.objectStoresMeta,
        dbConfig.migrationFactory
      );
    } catch (error) {
      // The browser already has a newer version (e.g. after createObjectStore() or a newer deployment):
      // adopt that version below instead of failing every later operation.
      if (!isVersionError(error)) {
        throw error;
      }
    }

    const db = await openDatabase(this.indexedDB, dbConfig.name);
    if (db.version !== dbConfig.version) {
      if (isDevMode()) {
        console.warn(`
            Your DB Config doesn't match the most recent version of the DB with name ${dbConfig.name}, please update it
            DB current version: ${db.version};
            Your configuration: ${dbConfig.version};
            `);
        console.warn(`Using latest version ${db.version}`);
      }
      this.dbConfigs[dbConfig.name].version = db.version;
    }
    db.close();
  }

  private get dbConfig(): DBConfig {
    return this.dbConfigs[this.selectedDb!];
  }

  /** Increments the selected database version and returns the new value. */
  private nextVersion(): number {
    this.dbConfig.version = (this.dbConfig.version ?? 0) + 1;
    return this.dbConfig.version;
  }

  /**
   * Returns the current version of the database.
   * @returns The database version
   */
  @CloseDbConnection()
  getDatabaseVersion(): Observable<number | string> {
    return new Observable((obs) => {
      this.open()
        .then((db: IDBDatabase) => {
          obs.next(db.version);
          obs.complete();
        })
        .catch((err) => obs.error(`error during get version of database => ${err} `));
    });
  }

  /**
   * Selects a database for the current context.
   * @param {string} [databaseName=undefined] Database name to select.
   */
  public selectDb(databaseName?: string): void {
    databaseName = databaseName ?? this.defaultDatabaseName;
    if (!databaseName) {
      // Name is still null, it means that there is no default database set
      // and the database name was not specified while calling a method
      throw new Error(`No database name specified and no default database set.`);
    }
    if (!Object.keys(this.dbConfigs).includes(databaseName)) {
      throw new Error(`NgxIndexedDB: Database ${databaseName} is not initialized.`);
    }

    this.selectedDb = databaseName;
  }

  /**
   * Allows to create a new object store ad-hoc
   * @param storeSchema The schema of the store to be created
   * @param migrationFactory The migration factory if exists
   */
  async createObjectStore(
    storeSchema: ObjectStoreMeta,
    migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }
  ): Promise<void> {
    const storeSchemas: ObjectStoreMeta[] = [storeSchema];
    await this.ready(this.dbConfig.name);
    await CreateObjectStore(this.indexedDB, this.dbConfig.name, this.nextVersion(), storeSchemas, migrationFactory);
  }

  /**
   * Create dynamic store if not already without incrementing version
   * For Dynamic store
   * @param storeSchema The schema of the store to create
   */
  async createDynamicObjectStore(
    storeSchema: ObjectStoreMeta,
    migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }
  ): Promise<void> {
    const storeSchemas: ObjectStoreMeta[] = [storeSchema];
    await this.ready(this.dbConfig.name);
    await CreateObjectStore(this.indexedDB, this.dbConfig.name, this.dbConfig.version, storeSchemas, migrationFactory);
  }

  /**
   * Adds a new entry to the store and returns the stored entry, including its key.
   * @param storeName The name of the store to add the item
   * @param value The entry to be added
   * @param key The optional key for the entry
   */
  @CloseDbConnection()
  add<T>(storeName: string, value: T, key?: any): Observable<T & WithID> {
    return new Observable((obs) => {
      this.open()
        .then((db: IDBDatabase) => {
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          const hasKey = Boolean(key);
          const request: IDBRequest<IDBValidKey> = hasKey ? objectStore.add(value, key) : objectStore.add(value);
          let stored: T & WithID;

          request.onsuccess = (evt: Event) => {
            const result = (evt.target as IDBRequest<IDBValidKey>).result;
            const getRequest = objectStore.get(result) as IDBRequest<T & WithID>;
            getRequest.onsuccess = () => (stored = getRequest.result);
            getRequest.onerror = (event: Event) => obs.error(event);
          };

          request.onerror = (event: Event) => {
            obs.error(event);
          };

          // Only report success once the write is committed (#402).
          transaction.oncomplete = () => {
            obs.next(stored);
            obs.complete();
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Adds several entries in a single transaction and returns their keys.
   * @param storeName The name of the store to add the items
   * @param values The entries to be added, each with an optional `key` attribute
   */
  @CloseDbConnection()
  bulkAdd<T>(storeName: string, values: Array<T & { key?: any }>): Observable<number[]> {
    const promises = new Promise<number[]>((resolve, reject) => {
      this.open()
        .then((db: IDBDatabase) => {
          // A failed insert aborts the transaction, which rejects through its error/abort handlers.
          const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject));
          const objectStore = transaction.objectStore(storeName);
          const keys: number[] = new Array(values.length);

          values.forEach((value, index) => {
            const key = value.key;
            delete value.key;

            const hasKey = Boolean(key);
            const request: IDBRequest<IDBValidKey> = hasKey ? objectStore.add(value, key) : objectStore.add(value);
            request.onsuccess = () => (keys[index] = request.result as number);
          });

          // Only report success once the writes are committed (#402).
          transaction.oncomplete = () => resolve(keys);
        })
        .catch((reason) => reject(reason));
    });

    return from(promises);
  }

  /**
   * Deletes the entries with the given keys.
   * @param storeName The name of the store to delete the items from
   * @param keys The keys to be deleted
   */
  @CloseDbConnection()
  bulkDelete(storeName: string, keys: IDBValidKey[]): Observable<number[]> {
    const promises = keys.map((key) => {
      return new Promise<number>((resolve, reject) => {
        this.open()
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
   */
  @CloseDbConnection()
  getByKey<T>(storeName: string, key: IDBValidKey): Observable<T> {
    return new Observable<T>((obs) => {
      this.open()
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
   */
  @CloseDbConnection()
  bulkGet<T>(storeName: string, keys: Array<IDBValidKey>): Observable<T[]> {
    const observables = keys.map((key) => this.getByKey<T>(storeName, key));

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
   */
  @CloseDbConnection()
  getByID<T>(storeName: string, id: string | number): Observable<T> {
    return new Observable((obs) => {
      this.open()
        .then((db: IDBDatabase) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error, obs.next));
          const objectStore = transaction.objectStore(storeName);
          const request: IDBRequest = objectStore.get(id) as IDBRequest<T>;
          request.onsuccess = (event: Event) => {
            obs.next((event.target as IDBRequest<T>).result);
            obs.complete();
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
   */
  @CloseDbConnection()
  getByIndex<T>(storeName: string, indexName: string, key: IDBValidKey): Observable<T> {
    return new Observable((obs) => {
      this.open()
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
   */
  @CloseDbConnection()
  getAll<T>(storeName: string): Observable<T[]> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error, obs.next));
          const objectStore = transaction.objectStore(storeName);

          const request: IDBRequest = objectStore.getAll();

          request.onerror = (evt: Event) => {
            obs.error(evt);
          };

          request.onsuccess = (event: Event) => {
            obs.next((event as RequestEvent<T>).target.result as T[]);
            obs.complete();
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Adds or updates an entry (an IndexedDB `put`) and returns the stored entry.
   * @param storeName The name of the store to update
   * @param value The new value for the entry
   */
  @CloseDbConnection()
  update<T>(storeName: string, value: T): Observable<T> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);

          const request: IDBRequest<IDBValidKey> = objectStore.put(value);
          let stored: T;

          request.onsuccess = (evt: Event) => {
            const result = (evt.target as IDBRequest<IDBValidKey>).result;
            const getRequest = objectStore.get(result) as IDBRequest<T>;
            getRequest.onsuccess = () => (stored = getRequest.result);
            getRequest.onerror = (event: Event) => obs.error(event);
          };
          request.onerror = (event: Event) => obs.error(event);

          // Only report success once the write is committed (#402).
          transaction.oncomplete = () => {
            obs.next(stored);
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Adds or updates several entries in a single transaction.
   * If any write fails, the transaction is aborted and none of the writes are kept.
   * @param storeName The name of the store to update
   * @param items The values to write
   * @returns The primary key of the last entry in `items`
   */
  @CloseDbConnection()
  public bulkPut<T>(storeName: string, items: T[]): Observable<IDBValidKey> {
    let transaction: IDBTransaction;
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          let lastKey: IDBValidKey;

          items.forEach((item, index: number) => {
            const request = objectStore.put(item);

            if (index === items.length - 1) {
              request.onsuccess = (evt: Event) => {
                lastKey = (evt.target as IDBRequest<IDBValidKey>).result;
                transaction.commit();
              };
            }

            request.onerror = (evt: Event) => {
              transaction.abort();
              obs.error(evt);
            };
          });

          // Only report success once the writes are committed (#402).
          transaction.oncomplete = () => {
            obs.next(lastKey);
            obs.complete();
          };
        })
        .catch((reason) => {
          transaction?.abort();
          obs.error(reason);
        });
    });
  }

  /**
   * Deletes the matching entries and returns every entry left in the store.
   * @param storeName The name of the store to have the entry deleted
   * @param query The key or key range criteria to apply
   */
  @CloseDbConnection()
  delete<T>(storeName: string, query: IDBValidKey | IDBKeyRange): Observable<T[]> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          objectStore.delete(query);

          transaction.onerror = (e) => obs.error(e);
          transaction.oncomplete = () => {
            this.getAll<T>(storeName)
              .pipe(take(1))
              .subscribe({
                next: (newValues) => {
                  obs.next(newValues);
                },
                error: (e) => obs.error(e),
                complete: () => obs.complete(),
              });
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Deletes the matching entries and completes once the deletion is committed.
   * @param storeName The name of the store to have the entry deleted
   * @param query The key or key range criteria to apply
   */
  @CloseDbConnection()
  deleteByKey(storeName: string, query: IDBValidKey | IDBKeyRange): Observable<void> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          objectStore.delete(query);

          transaction.onerror = (e) => obs.error(e);
          transaction.oncomplete = () => {
            obs.next();
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Delete all items by an index.
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param query The key or key range criteria to apply
   * @param direction A string telling the cursor which direction to travel.
   */
  @CloseDbConnection()
  deleteAllByIndex<T>(
    storeName: string,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange | null,
    direction?: IDBCursorDirection
  ): Observable<void> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);
          const request = index.openCursor(query, direction);

          request.onerror = (e) => obs.error(e);
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<NgxIDBCursorWithValue<T>>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };

          // Only report success once the deletions are committed (#402).
          transaction.oncomplete = () => {
            obs.next();
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Clear the data in the objectStore.
   * @param storeName The name of the store to have the entries deleted
   */
  @CloseDbConnection()
  clear(storeName: string): Observable<void> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          objectStore.clear();

          transaction.onerror = (e) => obs.error(e);
          transaction.oncomplete = () => {
            obs.next();
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Delete database.
   */
  @CloseDbConnection()
  deleteDatabase(): Observable<void> {
    return new Observable((obs) => {
      this.open()
        .then(async (db) => {
          db.close();
          const deleteDBRequest = this.indexedDB.deleteDatabase(this.dbConfig.name);
          deleteDBRequest.onsuccess = () => {
            obs.next();
            obs.complete();
          };
          deleteDBRequest.onerror = (error) => obs.error(error);
          deleteDBRequest.onblocked = () => {
            console.warn(
              'Delete blocked: Ensure all tabs, instances, or connections are closed. Database name:',
              this.dbConfig.name
            );
            obs.error(new Error("Unable to delete database because it's blocked"));
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Returns the open cursor
   * If no matching data are present, the observable is completed immediately.
   * @param options The options to open the cursor
   * @param options.storeName The name of the store to have the entries deleted
   * @param options.query The key or key range criteria to apply
   * @param options.direction A string telling the cursor which direction to travel
   * @param options.mode The transaction mode.
   */
  @CloseDbConnection()
  openCursor<V = any, P extends IDBValidKey = IDBValidKey, K extends IDBValidKey = IDBValidKey>(options: {
    storeName: string;
    query?: IDBValidKey | IDBKeyRange | null;
    direction?: IDBCursorDirection;
    mode: DBMode;
  }): Observable<NgxIDBCursorWithValue<V, P, K>> {
    const { storeName, query, direction, mode = DBMode.readonly } = options;

    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(mode, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const request = objectStore.openCursor(query, direction);

          transaction.oncomplete = () => obs.complete();
          request.onerror = (e) => obs.error(e);
          request.onsuccess = (event: Event) => {
            const cursor = (event.target as IDBRequest<NgxIDBCursorWithValue<V, P, K>>).result;
            if (cursor) {
              obs.next(cursor);
            }
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Open a cursor by index filter
   * If no matching data are present, the observable is completed immediately.
   * @param options The options to open the cursor
   * @param options.storeName The name of the store to query
   * @param options.indexName The index name to filter
   * @param options.query The key or key range criteria to apply
   * @param options.direction A string telling the cursor which direction to travel
   * @param options.mode The transaction mode.
   */
  @CloseDbConnection()
  openCursorByIndex<V, P extends IDBValidKey = IDBValidKey, K extends IDBValidKey = IDBValidKey>(options: {
    storeName: string;
    indexName: string;
    query?: IDBValidKey | IDBKeyRange | null;
    direction?: IDBCursorDirection;
    mode?: DBMode;
  }): Observable<NgxIDBCursorWithValue<V, P, K>> {
    const { storeName, indexName, query, direction, mode = DBMode.readonly } = options;

    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(mode, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);
          const request = index.openCursor(query, direction);

          transaction.oncomplete = () => obs.complete();
          request.onerror = (e) => obs.error(e);
          request.onsuccess = (event: Event) => {
            const cursor = (event.target as IDBRequest<NgxIDBCursorWithValue<V, P, K>>).result;
            if (cursor) {
              obs.next(cursor);
            }
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns all items by an index.
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param query The key or key range criteria to apply
   * @param direction A string telling the cursor which direction to travel.
   */
  @CloseDbConnection()
  getAllByIndex<T>(
    storeName: string,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange | null,
    direction?: IDBCursorDirection
  ): Observable<T[]> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);
          const request = index.openCursor(query, direction);

          const data: T[] = [];
          request.onerror = (e) => obs.error(e);
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<NgxIDBCursorWithValue<T>>).result;
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
   * Returns the records of a store or an index that match a key range or a string prefix,
   * optionally filtered and paginated, reading them with a single cursor.
   * `query` and `prefix` use the index (or the primary key), so only the matching range is read.
   * `filter` is called on every record in that range, which makes it a scan of the whole range; it must be
   * synchronous, because the transaction closes on its own while you `await`.
   * Reading stops as soon as `limit` records are collected, or when you unsubscribe.
   * The Observable errors if `prefix` and `query` are both given, if `offset` is not an integer >= 0,
   * if `limit` is not an integer >= 1 or `Infinity`, or if `filter` throws.
   * @param options The options of the query
   * @param options.storeName The name of the store to query
   * @param options.indexName The index to read through. When omitted, the store is read in primary key order
   * @param options.query The key or key range criteria to apply
   * @param options.prefix Matches the string keys that start with this value (case-sensitive)
   * @param options.filter A synchronous predicate applied to each record in the range
   * @param options.direction A string telling the cursor which direction to travel
   * @param options.offset How many matching records to skip, counted after `filter`
   * @param options.limit The maximum number of records to return
   */
  @CloseDbConnection()
  find<T>(options: FindOptions<T>): Observable<T[]> {
    const { storeName, indexName, query, prefix, filter, direction, offset = 0, limit = Infinity } = options;

    return new Observable((obs: Subscriber<T[]>) => {
      const invalid = findOptionsError(options);
      if (invalid) {
        obs.error(invalid);
        return;
      }

      this.open()
        .then((db: IDBDatabase) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          if (obs.closed) {
            return;
          }

          const transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readonly, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);
          const source: IDBObjectStore | IDBIndex =
            indexName === undefined ? objectStore : objectStore.index(indexName);
          const range = prefix ? IDBKeyRange.bound(prefix, prefix + '\uffff') : query;
          const request = source.openCursor(range, direction);

          const data: T[] = [];
          let advancePending = !filter && offset > 0;
          let toSkip = filter ? offset : 0;

          request.onerror = (e) => obs.error(e);
          request.onsuccess = () => {
            if (obs.closed) {
              return;
            }

            const cursor = request.result;
            if (!cursor) {
              obs.next(data);
              obs.complete();
              return;
            }

            if (advancePending) {
              advancePending = false;
              cursor.advance(offset);
              return;
            }

            const value: T = cursor.value;
            let matches = true;
            if (filter) {
              try {
                matches = filter(value);
              } catch (error) {
                obs.error(error);
                return;
              }
            }

            if (matches) {
              if (toSkip > 0) {
                toSkip--;
              } else if (data.push(value) >= limit) {
                obs.next(data);
                obs.complete();
                return;
              }
            }
            cursor.continue();
          };
        })
        .catch((reason: unknown) => obs.error(reason));
    });
  }

  /**
   * Returns all primary keys by an index.
   * @param storeName The name of the store to query
   * @param query The key or key range criteria to apply
   * @param direction A string telling the cursor which direction to travel.
   */
  @CloseDbConnection()
  getAllKeysByIndex<P extends IDBValidKey = IDBValidKey, K extends IDBValidKey = IDBValidKey>(
    storeName: string,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange | null,
    direction?: IDBCursorDirection
  ): Observable<IndexKey<P, K>[]> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);

          const data: IndexKey<P, K>[] = [];
          const request = index.openKeyCursor(query, direction);
          request.onerror = (e) => obs.error(e);
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<NgxIDBCursor<P, K>>).result;
            if (cursor) {
              const { primaryKey, key } = cursor;
              data.push({
                primaryKey,
                key,
              });
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
   * @param query The key or key range criteria to apply.
   */
  @CloseDbConnection()
  count(storeName: string, query?: IDBValidKey | IDBKeyRange): Observable<number> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const request = objectStore.count(query);
          request.onerror = (e) => obs.error(e);
          request.onsuccess = (e) => {
            obs.next((e.target as IDBRequest<number>).result);
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Returns the number of records within a key range.
   * @param storeName The name of the store to query
   * @param indexName The index name to filter
   * @param query The key or key range criteria to apply.
   */
  @CloseDbConnection()
  countByIndex(storeName: string, indexName: string, query?: IDBValidKey | IDBKeyRange): Observable<number> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const index = objectStore.index(indexName);
          const request: IDBRequest = index.count(query);
          request.onerror = (e) => obs.error(e);
          request.onsuccess = (e) => {
            obs.next((e.target as IDBRequest<number>).result);
            obs.complete();
          };
        })
        .catch((reason) => obs.error(reason));
    });
  }

  /**
   * Delete the store by name.
   * @param storeName The name of the store to query
   */
  deleteObjectStore(storeName: string): Observable<void> {
    const config = this.dbConfig;
    return from(this.ready(config.name)).pipe(
      switchMap(() => DeleteObjectStore(config.name, this.nextVersion(), storeName))
    );
  }

  /**
   * Get all object store names.
   */
  @CloseDbConnection()
  getAllObjectStoreNames(): Observable<string[]> {
    return new Observable((obs) => {
      this.open()
        .then((db) => {
          obs.next(Array.from(db.objectStoreNames));
          obs.complete();
        })
        .catch((reason) => obs.error(reason));
    });
  }
}

/** Returns the error for invalid {@link FindOptions}, or `undefined` when they are valid. */
function findOptionsError<T>(options: FindOptions<T>): Error | undefined {
  const { query, prefix, offset = 0, limit = Infinity } = options;
  if (prefix && query !== undefined && query !== null) {
    return new Error('NgxIndexedDB: find() accepts either query or prefix, not both');
  }

  if (!Number.isInteger(offset) || offset < 0) {
    return new Error(`NgxIndexedDB: find() offset must be an integer >= 0, got ${offset}`);
  }

  if (limit !== Infinity && (!Number.isInteger(limit) || limit < 1)) {
    return new Error(`NgxIndexedDB: find() limit must be an integer >= 1 or Infinity, got ${limit}`);
  }

  return undefined;
}

/** Whether an `indexedDB.open()` failure means the browser already has a newer version. */
function isVersionError(error: unknown): boolean {
  const target = (error as Event | undefined)?.target as IDBOpenDBRequest | undefined;
  return target?.error?.name === 'VersionError';
}
