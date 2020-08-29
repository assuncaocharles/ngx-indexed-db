import { InjectionToken } from '@angular/core';

export interface DBConfig {
  name: string;
  version: number;
  objectStoresMeta: ObjectStoreMeta[];
  migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void };
}

export interface ObjectStoreMeta {
  store: string;
  storeConfig: { keyPath?: string; autoIncrement: boolean; [key: string]: any };
  storeSchema: ObjectStoreSchema[];
}

export interface ObjectStoreSchema {
  name: string;
  keypath: string;
  options: { unique: boolean; [key: string]: any };
}

export const CONFIG_TOKEN = new InjectionToken<DBConfig>(null);
