import { Inject, Injectable, isDevMode } from '@angular/core';
import { Observable, Subject, Subscriber, combineLatest, from } from 'rxjs';
import { take } from 'rxjs/operators';
import { createTransaction, optionsGenerator, validateBeforeTransaction } from '../utils';
import { CloseDbConnection } from './decorators';
import { CreateObjectStore, DeleteObjectStore, openDatabase } from './ngx-indexed-db';
import {
  CONFIG_TOKEN,
  DBConfig,
  DBMode,
  INDEXED_DB,
  Key,
  ObjectStoreMeta,
  RequestEvent,
  WithID,
} from './ngx-indexed-db.meta';

@Injectable()
export class NgxIndexedDBService {
  private defaultDatabaseName?: string = null;
  private selectedDb: string;

  constructor(
    @Inject(CONFIG_TOKEN) private dbConfigs: Record<string, DBConfig>,
    @Inject(INDEXED_DB) private indexedDB: IDBFactory
  ) {
    Object.values(this.dbConfigs).forEach((dbConfig, _, ref) => this.instanciateConfig(dbConfig, ref.length === 1));
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

    await CreateObjectStore(
      this.indexedDB,
      dbConfig.name,
      dbConfig.version,
      dbConfig.objectStoresMeta,
      dbConfig.migrationFactory
    );

    openDatabase(this.indexedDB, dbConfig.name).then((db) => {
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
    });
  }

  private get dbConfig(): DBConfig {
    return this.dbConfigs[this.selectedDb];
  }

  /**
   * The function return the current version of database
   *
   * @Return the current version of database as number
   */
  @CloseDbConnection()
  getDatabaseVersion(): Observable<number | string> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * @param storeName The name of the store to be created
   * @param migrationFactory The migration factory if exists
   */
  async createObjectStore(
    storeSchema: ObjectStoreMeta,
    migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }
  ): Promise<void> {
    const storeSchemas: ObjectStoreMeta[] = [storeSchema];
    await CreateObjectStore(
      this.indexedDB,
      this.dbConfig.name,
      ++this.dbConfig.version,
      storeSchemas,
      migrationFactory
    );
  }

  /**
  * Create dynamic store if not already without incrementing version
  * For Dynamic store
  * @param storeName The name of the store to create
  */
   async createDynamicObjectStore(
      storeSchema: ObjectStoreMeta,
      migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }
    ): Promise<void> {
      const storeSchemas: ObjectStoreMeta[] = [storeSchema];
      await CreateObjectStore(
        this.indexedDB,
        this.dbConfig.name,
        this.dbConfig.version,
        storeSchemas,
        migrationFactory
      );
    }


  /**
   * Adds new entry in the store and returns its key
   * @param storeName The name of the store to add the item
   * @param value The entry to be added
   * @param key The optional key for the entry
   */
  @CloseDbConnection()
  add<T>(storeName: string, value: T, key?: any): Observable<T & WithID> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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

            getRequest.onerror = (event: Event) => {
              obs.error(event);
            };
          };

          request.onerror = (event: Event) => {
            obs.error(event);
          };
        })
        .catch((error) => obs.error(error));
    });
  }

  /**
   * Adds new entries in the store and returns its key
   * @param storeName The name of the store to add the item
   * @param values The entries to be added containing optional key attribute
   */
  @CloseDbConnection()
  bulkAdd<T>(storeName: string, values: Array<T & { key?: any }>): Observable<number[]> {
    const promises = new Promise<number[]>((resolve, reject) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
        .then((db: IDBDatabase) => {
          const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, resolve, reject));
          const objectStore = transaction.objectStore(storeName);

          const results = values.map((value) => {
            return new Promise<number>((resolve1) => {
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
   */
  @CloseDbConnection()
  bulkDelete(storeName: string, keys: Key[]): Observable<number[]> {
    const promises = keys.map((key) => {
      return new Promise<number>((resolve, reject) => {
        openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  @CloseDbConnection()
  getByIndex<T>(storeName: string, indexName: string, key: IDBValidKey): Observable<T> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  @CloseDbConnection()
  update<T>(storeName: string, value: T): Observable<T> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   * Adds or updates a record in store with the given value and key. Return all items present in the store
   * @param storeName The name of the store to update
   * @param items The values to update in the DB
   *
   * @Return The return value is an Observable with the primary key of the object that was last in given array
   *
   * @error If the call to bulkPut fails the transaction will be aborted and previously inserted entities will be deleted
   */
  @CloseDbConnection()
  public bulkPut<T>(storeName: string, items: Array<T>): Observable<Key> {
    let transaction: IDBTransaction;
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          transaction = createTransaction(
            db,
            optionsGenerator(DBMode.readwrite, storeName, (e) => obs.error(e))
          );
          const objectStore = transaction.objectStore(storeName);

          items.forEach((item, index: number) => {
            const request: IDBRequest<IDBValidKey> = objectStore.put(item);

            if (index === items.length - 1) {
              request.onsuccess = (evt: Event) => {
                transaction.commit();
                obs.next((evt.target as IDBRequest<Key>).result);
                obs.complete();
              };
            }

            request.onerror = (evt: Event) => {
              transaction.abort();
              obs.error(evt);
            };
          });
        })
        .catch((reason) => {
          transaction?.abort();
          obs.error(reason);
        });
    });
  }

  /**
   * Returns all items from the store after delete.
   * @param storeName The name of the store to have the entry deleted
   * @param key The key of the entry to be deleted
   */
  @CloseDbConnection()
  delete<T>(storeName: string, key: Key): Observable<T[]> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  @CloseDbConnection()
  deleteByKey(storeName: string, key: Key): Observable<boolean> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  @CloseDbConnection()
  clear(storeName: string): Observable<boolean> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  @CloseDbConnection()
  deleteDatabase(): Observable<boolean> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
        .then(async (db) => {
          await db.close();
          const deleteDBRequest = this.indexedDB.deleteDatabase(this.dbConfig.name);
          deleteDBRequest.onsuccess = () => {
            obs.next(true);
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
   * Returns the open cursor event
   * @param storeName The name of the store to have the entries deleted
   * @param keyRange The key range which the cursor should be open on
   * @param direction A string telling the cursor which direction to travel. The default is next
   */
  @CloseDbConnection()
  openCursor(storeName: string, keyRange?: IDBKeyRange, direction: IDBCursorDirection = 'next'): Observable<Event> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
        .then((db) => {
          validateBeforeTransaction(db, storeName, (e) => obs.error(e));
          const transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, obs.error));
          const objectStore = transaction.objectStore(storeName);
          const request =
            keyRange === undefined ? objectStore.openCursor() : objectStore.openCursor(keyRange, direction);

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
   */
  @CloseDbConnection()
  openCursorByIndex(
    storeName: string,
    indexName: string,
    keyRange: IDBKeyRange,
    direction: IDBCursorDirection = 'next',
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
        const request = index.openCursor(keyRange, direction);

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
  @CloseDbConnection()
  getAllByIndex<T>(storeName: string, indexName: string, keyRange: IDBKeyRange): Observable<T[]> {
    const data: T[] = [];
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  @CloseDbConnection()
  getAllKeysByIndex(
    storeName: string,
    indexName: string,
    keyRange: IDBKeyRange
  ): Observable<{ primaryKey: any; key: any }[]> {
    const data: { primaryKey: any; key: any }[] = [];
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  @CloseDbConnection()
  count(storeName: string, keyRange?: IDBValidKey | IDBKeyRange): Observable<number> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  @CloseDbConnection()
  countByIndex(storeName: string, indexName: string, keyRange?: IDBValidKey | IDBKeyRange): Observable<number> {
    return new Observable((obs) => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
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
   */
  deleteObjectStore(storeName: string): Observable<boolean> {
    return DeleteObjectStore(this.dbConfig.name, ++this.dbConfig.version, storeName);
  }

  /**
   * Get all object store names.
   */
  @CloseDbConnection()
  getAllObjectStoreNames(): Observable<string[]> {
    return new Observable((obs: Subscriber<string[]>): void => {
      openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version)
        .then((db: IDBDatabase): void => {
          obs.next([...((db.objectStoreNames as unknown) as Iterable<string>)]);
          obs.complete();
        })
        .catch((reason: unknown): void => obs.error(reason));
    });
  }
}
