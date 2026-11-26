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

export type NgxIDBCursor<P extends IDBValidKey, K extends IDBValidKey, V = any> = Modify<
  IDBCursor,
  { key: K; primaryKey: P; update(value: V): IDBRequest<IDBValidKey> }
>;

export type NgxIDBCursorWithValue<
  V = any,
  P extends IDBValidKey = IDBValidKey,
  K extends IDBValidKey = IDBValidKey
> = NgxIDBCursor<P, K, V> & { value: V };

/** Options for `find()`. */
export interface FindOptions<T> {
  /** The name of the store to query. */
  storeName: string;
  /** The index to read through. When omitted, the object store itself is read in primary key order. */
  indexName?: string;
  /** The key or key range to read. `null` is the same as leaving it out. Cannot be combined with `prefix`. */
  query?: IDBValidKey | IDBKeyRange | null;
  /**
   * Matches the string keys that start with this value (case-sensitive), using the index.
   * An empty string is the same as leaving it out. Cannot be combined with `query`.
   */
  prefix?: string;
  /**
   * Keeps only the records for which it returns `true`. It is called on every record in the range,
   * so it does not use the index, and it must be synchronous.
   */
  filter?: (value: T) => boolean;
  /** A string telling the cursor which direction to travel. Defaults to `'next'`. */
  direction?: IDBCursorDirection;
  /** How many matching records to skip, counted after `filter`. An integer >= 0, defaults to 0. */
  offset?: number;
  /** The maximum number of records to return. An integer >= 1, or `Infinity` (the default) for no limit. */
  limit?: number;
}

export const CONFIG_TOKEN = new InjectionToken<Record<string, DBConfig>>('NgxIndexedDB DB Config');
export const INDEXED_DB = new InjectionToken<IDBFactory>('Indexed DB');
/**
 * Token used to inject the indexed db implementation on the server
 */
export const SERVER_INDEXED_DB = new InjectionToken<IDBFactory>('Server Indexed DB');
