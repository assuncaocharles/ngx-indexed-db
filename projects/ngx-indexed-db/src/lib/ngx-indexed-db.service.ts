import { Injectable, Inject } from '@angular/core';
import { CONFIG_TOKEN, DBConfig } from './ngxindexeddb.module';
import { openDatabase, DBMode, Key, RequestEvent, CreateObjectStore } from './ngx-indexed-db';
import { createTransaction, optionsGenerator, validateBeforeTransaction } from '../utils';

@Injectable()
export class NgxIndexedDBService {
	set currentStore(_currentStore: string) {
		this._currentStore = _currentStore;
	}
	private _currentStore: string;

	constructor(@Inject(CONFIG_TOKEN) private dbConfig: DBConfig) {
		if (!dbConfig.name) {
			throw new Error('NgxIndexedDB: Please, provide the dbName in the configuration');
		}
		if (!dbConfig.version) {
			throw new Error('NgxIndexedDB: Please, provide the db version in the configuration');
		}
		CreateObjectStore(dbConfig.name, dbConfig.version, dbConfig.objectStoresMeta, dbConfig.migrationFactory);
	}

	add<T>(value: T, key?: any) {
		return new Promise<number>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then((db: IDBDatabase) => {
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readwrite, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore);
				let request = objectStore.add(value, key);
				request.onsuccess = (evt: any) => {
					key = evt.target.result;
					resolve(key);
				};
			});
		});
	}

	getByKey<T>(key: any) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then((db: IDBDatabase) => {
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readonly, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore);
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

	getByID<T>(id: string | number) {
		return new Promise<T>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then((db: IDBDatabase) => {
				validateBeforeTransaction(db, this._currentStore, reject);
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readonly, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore),
					request: IDBRequest;
				request = objectStore.get(+id);
				request.onsuccess = function(event: Event) {
					resolve((event.target as any).result as T);
				};
			});
		});
	}

	getAll<T>() {
		return new Promise<T[]>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, this._currentStore, reject);
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readonly, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore),
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

	update<T>(value: T, key?: any) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, this._currentStore, reject);
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readwrite, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore);
				transaction.oncomplete = event => {
					resolve(event);
				};
				objectStore.put(value, key);
			});
		});
	}

	deleteRecord(key: Key) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, this._currentStore, reject);
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readwrite, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore);
				let request = objectStore.delete(key);
				request.onsuccess = event => {
					resolve(event);
				};
			});
		});
	}

	clear() {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, this._currentStore, reject);
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readwrite, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore);
				objectStore.clear();
				transaction.oncomplete = event => {
					resolve();
				};
			});
		});
	}

	delete(key: any) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, this._currentStore, reject);
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readwrite, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore);
				objectStore['delete'](key);
			});
		});
	}

	openCursor(cursorCallback: (event: Event) => void, keyRange?: IDBKeyRange) {
		return new Promise<void>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, this._currentStore, reject);
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readonly, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore),
					request = objectStore.openCursor(keyRange);

				request.onsuccess = (event: Event) => {
					cursorCallback(event);
					resolve();
				};
			});
		});
	}

	getByIndex(indexName: string, key: any) {
		return new Promise<any>((resolve, reject) => {
			openDatabase(this.dbConfig.name, this.dbConfig.version).then(db => {
				validateBeforeTransaction(db, this._currentStore, reject);
				let transaction = createTransaction(
						db,
						optionsGenerator(DBMode.readonly, this._currentStore, reject, resolve)
					),
					objectStore = transaction.objectStore(this._currentStore),
					index = objectStore.index(indexName),
					request = index.get(key);
				request.onsuccess = (event: Event) => {
					resolve((<IDBOpenDBRequest>event.target).result);
				};
			});
		});
	}
}
