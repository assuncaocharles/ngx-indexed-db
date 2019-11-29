export interface ObjectStoreMeta {
	store: string;
	storeConfig: { keyPath: string; autoIncrement: boolean; [key: string]: any };
	storeSchema: ObjectStoreSchema[];
}

export interface ObjectStoreSchema {
	name: string;
	keypath: string | string[];
	options: { unique: boolean; [key: string]: any };
}
export type Key = string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange;
export interface IndexDetails {
	indexName: string;
	order: string;
}
export interface RequestEventTarget<T> extends EventTarget {
	result: T | T[];
}

export interface RequestEvent<T> extends Event {
	target: RequestEventTarget<T>;
}

const indexedDB: IDBFactory =
	window.indexedDB || (<any>window).mozIndexedDB || (<any>window).webkitIndexedDB || (<any>window).msIndexedDB;

export function openDatabase(dbName: string, version: number, upgradeCallback?: Function) {
	return new Promise<IDBDatabase>((resolve, reject) => {
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
				console.log('checkout');
				upgradeCallback(event, db);
			};
		}
	});
}

export function CreateObjectStore(
	dbName: string,
	version: number,
	storeSchemas: ObjectStoreMeta[],
	migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }
) {
	const request: IDBOpenDBRequest = indexedDB.open(dbName, version);

	request.onupgradeneeded = function(event: IDBVersionChangeEvent) {
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
				.map(k => parseInt(k, 10))
				.filter(v => v > event.oldVersion)
				.sort((a, b) => a - b)
				.forEach(v => {
					storeMigrations[v](database, request.transaction);
				});
		}

		database.close();
	};

	request.onsuccess = function(e: any) {
		e.target.result.close();
	};
}

export enum DBMode {
	readonly = 'readonly',
	readwrite = 'readwrite'
}
