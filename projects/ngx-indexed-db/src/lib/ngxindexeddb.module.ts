import { NgModule, ModuleWithProviders, InjectionToken } from '@angular/core';
import { DBConfig } from './ngx-indexed-db.meta';
import { _provideIndexedDb } from './provide-indexed-db';

@NgModule()
export class NgxIndexedDBModule {
  static forRoot(...dbConfigs: DBConfig[]): ModuleWithProviders<NgxIndexedDBModule> {
    return {
      ngModule: NgxIndexedDBModule,
      providers: [..._provideIndexedDb(...dbConfigs)],
    };
  }
}
