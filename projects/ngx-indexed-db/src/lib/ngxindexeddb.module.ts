import { NgModule, ModuleWithProviders } from '@angular/core';
import { DBConfig } from './ngx-indexed-db.meta';
import { _provideIndexedDb } from './provide-indexed-db';

/**
 * @deprecated Use the standalone {@link provideIndexedDb} provider function instead,
 * e.g. `providers: [provideIndexedDb(dbConfig)]`.
 */
@NgModule()
export class NgxIndexedDBModule {
  static forRoot(...dbConfigs: DBConfig[]): ModuleWithProviders<NgxIndexedDBModule> {
    return {
      ngModule: NgxIndexedDBModule,
      providers: [..._provideIndexedDb(...dbConfigs)],
    };
  }
}
