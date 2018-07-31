export declare class AngularIndexedDB {
	utils: Utils;
	dbWrapper: DbWrapper;
	constructor(dbName: string, version: number);
	openDatabase(version: number, upgradeCallback?: Function): Promise<any>;
	getByKey(storeName: string, key: any): Promise<any>;
	getAll(storeName: string, keyRange?: IDBKeyRange, indexDetails?: IndexDetails): Promise<any>;
	add(storeName: string, value: any, key?: any): Promise<any>;
	update(storeName: string, value: any, key?: any): Promise<any>;
	delete(storeName: string, key: any): Promise<any>;
	openCursor(storeName: string, cursorCallback: (evt: Event) => void, keyRange?: IDBKeyRange): Promise<any>;
	clear(storeName: string): Promise<any>;
	getByIndex(storeName: string, indexName: string, key: any): Promise<any>;
}
export declare class Utils {
	indexedDB: IDBFactory;
	constructor();
}
export interface IndexDetails {
	indexName: string;
	order: string;
}
export declare class DbWrapper {
	dbName: string;
	dbVersion: number;
	db: IDBDatabase;
	constructor(dbName: string, version: number);
	validateStoreName(storeName: string): boolean;
	validateBeforeTransaction(storeName: string, reject: Function): void;
	createTransaction(options: {
		storeName: string;
		dbMode: IDBTransactionMode;
		error: (e: Event) => any;
		complete: (e: Event) => any;
		abort?: (e: Event) => any;
	}): IDBTransaction;
}
