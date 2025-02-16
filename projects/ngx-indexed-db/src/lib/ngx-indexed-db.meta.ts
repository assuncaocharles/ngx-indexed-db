import { InjectionToken } from '@angular/core';

export interface DBConfig {
  name: string;
  version?: number;
  objectStoresMeta: ObjectStoreMeta[];
  migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void };
  isDefault?: boolean;
}

export interface ObjectStoreMeta {
  store: string;
  storeConfig: { keyPath: string | string[]; autoIncrement: boolean; [key: string]: any };
  storeSchema: ObjectStoreSchema[];
}

export interface ObjectStoreSchema {
  name: string;
  keypath: string | string[];
  options: { unique: boolean; [key: string]: any };
}

export interface IndexDetails {
  indexName: string;
  order: string;
}

export interface RequestEvent<T> extends Event {
  target: RequestEventTarget<T>;
}

export interface RequestEventTarget<T> extends EventTarget {
  result: T | T[];
}

export enum DBMode {
  readonly = 'readonly',
  readwrite = 'readwrite',
}

export type WithID = { id: number };

export type IndexKey<P extends IDBValidKey, K extends IDBValidKey> = {
  readonly primaryKey: P;
  readonly key: K;
};

type Modify<T, R> = Omit<T, keyof R> & R;

export type NgxIDBCursor<P extends IDBValidKey, K extends IDBValidKey, V = any> = Modify<IDBCursor, { key: K; primaryKey: P; update(value: V): IDBRequest<IDBValidKey>; }>;

export type NgxIDBCursorWithValue<V = any,P extends IDBValidKey = IDBValidKey, K extends IDBValidKey = IDBValidKey> = NgxIDBCursor<P, K, V> & { value: V };

export const CONFIG_TOKEN = new InjectionToken<Record<string, DBConfig>>(null);
export const INDEXED_DB = new InjectionToken<IDBFactory>('Indexed DB');
/**
 * Token used to inject the indexed db implementation on the server
 */
export const SERVER_INDEXED_DB = new InjectionToken<IDBFactory>('Server Indexed DB');
