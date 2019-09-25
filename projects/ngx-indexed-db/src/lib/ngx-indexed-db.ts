export class NgxIndexedDB {
	utils: Utils;
	dbWrapper: DbWrapper;

	constructor(dbName: string, version: number) {
		this.utils = new Utils();
		this.dbWrapper = new DbWrapper(dbName, version);
	}

	openDatabase(version: number, upgradeCallback?: Function) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.dbVersion = version;
			let request = this.utils.indexedDB.open(this.dbWrapper.dbName, version);
			request.onsuccess = e => {
				this.dbWrapper.db = request.result;
				resolve();
			};

			request.onerror = e => {
				reject(
					'IndexedDB error: ' + (<any>e.target).errorCode
						? (<any>e.target).errorCode + ' (' + (<any>e.target).error + ')'
						: (<any>e.target).errorCode
				);
			};

			if (typeof upgradeCallback === 'function') {
				request.onupgradeneeded = e => {
					upgradeCallback(e, this.dbWrapper.db);
				};
			}
		});
	}

	getByKey(storeName: string, key: any) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);

			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readonly, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName),
				request: IDBRequest;

			request = objectStore.get(key);
			request.onsuccess = function (event: Event) {
				resolve((<any>event.target).result);
			};
		});
	}

	getAll(storeName: string, keyRange?: IDBKeyRange, indexDetails?: IndexDetails) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);

			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readonly, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName),
				result: Array<any> = [],
				request: IDBRequest;
			if (indexDetails) {
				let index = objectStore.index(indexDetails.indexName),
					order = indexDetails.order === 'desc' ? 'prev' : 'next';
				request = index.openCursor(keyRange, <IDBCursorDirection>order);
			} else {
				request = objectStore.openCursor(keyRange);
			}

			request.onerror = function (e) {
				reject(e);
			};

			request.onsuccess = function (evt: Event) {
				let cursor = (<IDBOpenDBRequest>evt.target).result;
				if (cursor) {
					result.push(cursor['value']);
					cursor['continue']();
				} else {
					resolve(result);
				}
			};
		});
	}

	add(storeName: string, value: any, key?: any) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);
			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readwrite, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName);

			let request = objectStore.add(value, key);
			request.onsuccess = (evt: any) => {
				key = evt.target.result;
				resolve(evt);
			};
		});
	}

	count(storeName: string, keyRange?: IDBValidKey | IDBKeyRange) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);

			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readonly, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName),
				request: IDBRequest;

			request = objectStore.count(keyRange);

			request.onerror = e => reject(e);
			request.onsuccess = e => resolve((<any>e.target).result);
		});
	}

	update(storeName: string, value: any, key?: any) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);

			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readwrite, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName);

			objectStore.put(value, key);
		});
	}

	delete(storeName: string, key: any) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);

			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readwrite, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName);

			objectStore['delete'](key);
		});
	}

	deleteDatabase() {
		return new Promise((resolve, reject) => {
			this.dbWrapper.db.close();
			const deleteDBRequest = this.utils.indexedDB.deleteDatabase(this.dbWrapper.dbName);
			deleteDBRequest.onsuccess = resolve;
			deleteDBRequest.onerror = reject;
			deleteDBRequest.onblocked = () => {
				throw new Error("Unable to delete database because it's blocked");
			};
		});
	}

	openCursor(storeName: string, cursorCallback: (evt: Event) => void, keyRange?: IDBKeyRange) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);
			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readonly, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName),
				request = objectStore.openCursor(keyRange);

			request.onsuccess = (evt: Event) => {
				cursorCallback(evt);
				resolve();
			};
		});
	}

	clear(storeName: string) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);
			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readwrite, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName);
			objectStore.clear();
			resolve();
		});
	}

	getByIndex(storeName: string, indexName: string, key: any) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);
			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readonly, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName),
				index = objectStore.index(indexName),
				request = index.get(key);
			request.onsuccess = event => {
				resolve((<IDBOpenDBRequest>event.target).result);
			};
		});
	}

	getAllByIndex(storeName: string, indexName: string, key: any) {
		return new Promise<any>((resolve, reject) => {
			this.dbWrapper.validateBeforeTransaction(storeName, reject);
			let transaction = this.dbWrapper.createTransaction(
				this.dbWrapper.optionsGenerator(DBMode.readonly, storeName, reject, resolve)
				),
				objectStore = transaction.objectStore(storeName),
				index = objectStore.index(indexName),
				request = index.getAll(key);
			request.onsuccess = event => {
				resolve((<IDBOpenDBRequest>event.target).result);
			};
			request.onerror = event => {
				reject((<IDBOpenDBRequest>event.target).error);
			};
		});
	}
}

export class Utils {
	indexedDB: IDBFactory;

	constructor() {
		this.indexedDB =
			window.indexedDB ||
			(<any>window).mozIndexedDB ||
			(<any>window).webkitIndexedDB ||
			(<any>window).msIndexedDB;
	}
}

export interface IndexDetails {
	indexName: string;
	order: string;
}

export class DbWrapper {
	dbName: string;
	dbVersion: number;
	db: IDBDatabase;

	constructor(dbName: string, version: number) {
		this.dbName = dbName;
		this.dbVersion = version || 1;
	}

	validateStoreName(storeName: string) {
		return this.db.objectStoreNames.contains(storeName);
	}

	validateBeforeTransaction(storeName: string, reject: Function) {
		if (!this.db) {
			reject('You need to use the openDatabase function to create a database before you query it!');
		}
		if (!this.validateStoreName(storeName)) {
			reject('objectStore does not exists: ' + storeName);
		}
	}

	createTransaction(options: Options): IDBTransaction {
		let trans: IDBTransaction = this.db.transaction(options.storeName, options.dbMode);
		trans.onerror = options.error;
		trans.oncomplete = options.complete;
		trans.onabort = options.abort;
		return trans;
	}

	optionsGenerator(type: any, storeName: any, reject: Function, resolve: Function): Options {
		return {
			storeName: storeName,
			dbMode: type,
			error: (e: Event) => {
				reject(e);
			},
			complete: (e: Event) => {
				resolve();
			},
			abort: (e: Event) => {
				reject(e);
			}
		};
	}
}

export interface Options {
	storeName: string;
	dbMode: IDBTransactionMode;
	error: (e: Event) => any;
	complete: (e: Event) => any;
	abort?: any;
}

export enum DBMode {
	readonly = 'readonly',
	readwrite = 'readwrite'
}
