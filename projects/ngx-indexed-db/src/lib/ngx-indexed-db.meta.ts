import { InjectionToken } from '@angular/core';

export interface DBConfig {
  name: string;
  version: number;
  objectStoresMeta: ObjectStoreMeta[];
  migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void };
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

export interface DBOptions {
  name: string;
  version: number;
}

export interface IGetAllKeysByIndexReq {
  dbOptions: DBOptions;
  storeName: string;
  indexName: string;
  keyRange: IDBKeyRange;
}

export type Key = string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange;

export const CONFIG_TOKEN = new InjectionToken<DBConfig>(null);
