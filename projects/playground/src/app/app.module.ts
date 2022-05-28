import { NgxIndexedDBModule } from './../../../ngx-indexed-db/src/lib/ngxindexeddb.module';
import { DBConfig } from './../../../ngx-indexed-db/src/lib/ngx-indexed-db.meta';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';

const dbConfig: DBConfig = {
  name: 'MyDb',
  version: 1,
  objectStoresMeta: [
    {
      store: 'people',
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [
        { name: 'name', keypath: 'name', options: { unique: false } },
        { name: 'email', keypath: 'email', options: { unique: false } },
      ],
    },
    {
      store: 'test',
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [{ name: 'name', keypath: 'name', options: { unique: true } }],
    },
  ],
};

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, NgxIndexedDBModule.forRoot(dbConfig), FormsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
