import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { openDatabase, DBMode, Key, RequestEvent, CreateObjectStore } from './ngx-indexed-db';
import { createTransaction, optionsGenerator, validateBeforeTransaction } from '../utils';
import { CONFIG_TOKEN, DBConfig } from './ngx-indexed-db.meta';
import { isPlatformBrowser } from '@angular/common';

@Injectable()
export class NgxIndexedDBService {
	private readonly isBrowser: boolean;
	indexedDB;

	constructor(@Inject(CONFIG_TOKEN) private dbConfig: DBConfig, @Inject(PLATFORM_ID) private platformId: any) {
		if (!dbConfig.name) {
			throw new Error('NgxIndexedDB: Please, provide the dbName in the configuration');
		}
		if (!dbConfig.version) {
			throw new Error('NgxIndexedDB: Please, provide the db version in the configuration');
		}
		this.isBrowser = isPlatformBrowser(platformId);
		if (this.isBrowser) {
			this.indexedDB =
				window.indexedDB ||
				(<any>window).mozIndexedDB ||
				(<any>window).webkitIndexedDB ||
				(<any>window).msIndexedDB;
			CreateObjectStore(
				this.indexedDB,
				dbConfig.name,
				dbConfig.version,
				dbConfig.objectStoresMeta,
				dbConfig.migrationFactory
			);
		}
	}

	add<T>(storeName: string, value: T, key?: any) {
		return new Promise<number>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then((db: IDBDatabase) => {
				let transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName);

				let request: IDBRequest;
				if (key) {
					request = objectStore.add(value, key);
				} else {
					request = objectStore.add(value);
				}

				request.onsuccess = (evt: any) => {
					key = evt.target.result;
					resolve(key);
				};
			});
		});
	}

	getByKey<T>(storeName: string, key: any) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then((db: IDBDatabase) => {
				let transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName);
				let request = objectStore.get(key);
				request.onsuccess = function(event: Event) {
					resolve((<any>event.target).result);
				};
				request.onerror = function(event: Event) {
					reject(event);
				};
			});
		});
	}

	getByID<T>(storeName: string, id: string | number) {
		return new Promise<T>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then((db: IDBDatabase) => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName),
					request: IDBRequest;
				request = objectStore.get(+id);
				request.onsuccess = function(event: Event) {
					resolve((event.target as any).result as T);
				};
			});
		});
	}

	getAll<T>(storeName: string) {
		return new Promise<T[]>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName),
					result: Array<any> = [];

				const request: IDBRequest = objectStore.getAll();

				request.onerror = function(e) {
					reject(e);
				};
				request.onsuccess = function({ target: { result: ResultAll } }: RequestEvent<T>) {
					resolve(ResultAll as T[]);
				};
			});
		});
	}

	update<T>(storeName: string, value: T, key?: any) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName);
				transaction.oncomplete = event => {
					resolve(event);
				};
				if (key) {
					objectStore.put(value, key);
				} else {
					objectStore.put(value);
				}
			});
		});
	}

	deleteRecord(storeName: string, key: Key) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName);
				let request = objectStore.delete(key);
				request.onsuccess = event => {
					resolve(event);
				};
			});
		});
	}

	clear(storeName: string) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName);
				objectStore.clear();
				transaction.oncomplete = event => {
					resolve();
				};
			});
		});
	}

	delete(storeName: string, key: any) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readwrite, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName);
				objectStore['delete'](key);
			});
		});
	}

	deleteDatabase() {
		return new Promise(async (resolve, reject) => {
			const db = await openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version);
			await db.close();
			const deleteDBRequest = this.indexedDB.deleteDatabase(this.dbConfig.name);
			deleteDBRequest.onsuccess = resolve;
			deleteDBRequest.onerror = reject;
			deleteDBRequest.onblocked = () => {
				throw new Error("Unable to delete database because it's blocked");
			};
		});
	}

	openCursor(storeName: string, cursorCallback: (event: Event) => void, keyRange?: IDBKeyRange) {
		return new Promise<void>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName),
					request = objectStore.openCursor(keyRange);

				request.onsuccess = (event: Event) => {
					cursorCallback(event);
					resolve();
				};
			});
		});
	}

	/**
	 * Open a cursor by index filter.
	 * @param storeName The name of the store to query.
	 * @param indexName The index name to filter.
	 * @param keyRange The range value and criteria to apply on the index.
	 * @param cursorCallback A callback called when done.
	 */
	openCursorByIndex(
		storeName: string,
		indexName: string,
		keyRange: IDBKeyRange,
		cursorCallback: (event: Event) => void
	) {
		return new Promise<void>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName),
					index = objectStore.index(indexName),
					request = index.openCursor(keyRange);

				request.onsuccess = (event: Event) => {
					cursorCallback(event);
					resolve();
				};
			});
		});
	}

	getByIndex(storeName: string, indexName: string, key: any) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName),
					index = objectStore.index(indexName),
					request = index.get(key);
				request.onsuccess = (event: Event) => {
					resolve((<IDBOpenDBRequest>event.target).result);
				};
			});
		});
	}

	count(storeName: string, keyRange?: IDBValidKey | IDBKeyRange) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.indexedDB, this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, storeName, reject);
				let transaction = createTransaction(db, optionsGenerator(DBMode.readonly, storeName, reject, resolve)),
					objectStore = transaction.objectStore(storeName),
					request: IDBRequest;

				request = objectStore.count(keyRange);
				request.onerror = e => reject(e);
				request.onsuccess = e => resolve((<any>e.target).result);
			});
		});
	}
}
