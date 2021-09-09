export interface Options {
  storeName: string;
  dbMode: IDBTransactionMode;
  error: (e: Event) => any;
  complete?: (e: Event) => any;
  abort?: any;
}

export function validateStoreName(db: IDBDatabase, storeName: string): boolean {
  return db.objectStoreNames.contains(storeName);
}

export function validateBeforeTransaction(db: IDBDatabase, storeName: string, reject: (message: string) => void): void {
  if (!db) {
    reject('You need to use the openDatabase function to create a database before you query it!');
  }
  if (!validateStoreName(db, storeName)) {
    reject(`objectStore does not exists: ${storeName}`);
  }
}

export function createTransaction(db: IDBDatabase, options: Options): IDBTransaction {
  const trans: IDBTransaction = db.transaction(options.storeName, options.dbMode);
  trans.onerror = options.error;
  trans.onabort = options.abort;
  return trans;
}

export function optionsGenerator(
  type: any,
  storeName: any,
  reject: (reason?: any) => void,
  resolve?: (e: any) => void
): Options {
  return {
    storeName,
    dbMode: type,
    error: (e: Event) => {
      reject(e);
    },
    abort: (e: Event) => {
      reject(e);
    },
  };
}
