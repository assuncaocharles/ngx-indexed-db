import { InjectionToken } from '@angular/core';

export interface DBConfig {
  name: string;
  version: number;
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

export type Key = string | number | Date | ArrayBufferView | ArrayBuffer | IDBValidKey | IDBKeyRange;

export type WithID = { id: number };

export type BulkAdd<T> = T & { key?: any };

export const CONFIG_TOKEN = new InjectionToken<Record<string, DBConfig>>(null);
export const INDEXED_DB = new InjectionToken<IDBFactory>('Indexed DB');
/**
 * Token used to inject the indexed db implementation on the server
 */
export const SERVER_INDEXED_DB = new InjectionToken<IDBFactory>('Server Indexed DB');
