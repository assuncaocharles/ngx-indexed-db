import { NgxIndexedDBModule } from '../../../ngx-indexed-db/src/lib/ngxindexeddb.module';
import { DBConfig } from '../../../ngx-indexed-db/src/lib/ngx-indexed-db.meta';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
import { dbConfigs } from '../helpers/DBconfig-helpers';

const dbConfig: Array<DBConfig> = dbConfigs();

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, NgxIndexedDBModule.forRoot(dbConfig), FormsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
