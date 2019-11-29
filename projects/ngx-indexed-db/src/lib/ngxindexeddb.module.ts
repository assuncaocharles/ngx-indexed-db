import { NgModule, ModuleWithProviders, InjectionToken } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { CreateObjectStore } from './ngx-indexed-db';

export interface DBConfig {
	name: string;
	version: number;
	objectStoresMeta: ObjectStoreMeta[];
	migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void };
}

export interface ObjectStoreMeta {
	store: string;
	storeConfig: { keyPath: string; autoIncrement: boolean; [key: string]: any };
	storeSchema: ObjectStoreSchema[];
}

export interface ObjectStoreSchema {
	name: string;
	keypath: string;
	options: { unique: boolean; [key: string]: any };
}

export const CONFIG_TOKEN = new InjectionToken<DBConfig>(null);

@NgModule({
	declarations: [],
	imports: [CommonModule]
})
export class NgxIndexedDBModule {
	static forRoot(dbConfig: DBConfig): ModuleWithProviders<NgxIndexedDBModule> {
		return {
			ngModule: NgxIndexedDBModule,
			providers: [NgxIndexedDBService, { provide: CONFIG_TOKEN, useValue: dbConfig }]
		};
	}
}
