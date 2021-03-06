import { NgModule, ModuleWithProviders, InjectionToken } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { DBConfig, CONFIG_TOKEN } from './ngx-indexed-db.meta';

@NgModule({
  declarations: [],
  imports: [CommonModule]
})
export class NgxIndexedDBModule {
  static forRoot(dbConfig: Array<DBConfig>): ModuleWithProviders<NgxIndexedDBModule> {
    return {
      ngModule: NgxIndexedDBModule,
      providers: [NgxIndexedDBService, { provide: CONFIG_TOKEN, useValue: dbConfig }]
    };
  }
}
