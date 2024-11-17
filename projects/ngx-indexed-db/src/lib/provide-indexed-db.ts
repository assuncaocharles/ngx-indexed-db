import { makeEnvironmentProviders, Provider } from '@angular/core';
import { DBConfig, CONFIG_TOKEN, INDEXED_DB, SERVER_INDEXED_DB } from './ngx-indexed-db.meta';
import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { indexedDbFactory } from '../ssr';

export const provideIndexedDb = (...dbConfigs: DBConfig[]) => {
  return makeEnvironmentProviders([..._provideIndexedDb(...dbConfigs)]);
};

export const _provideIndexedDb = (...dbConfigs: DBConfig[]): Provider[] => {
  const configs = dbConfigs.reduce<Record<string, DBConfig>>((acc, curr) => {
    acc[curr.name] = curr;
    return acc;
  }, {});
  return [
    NgxIndexedDBService,
    { provide: CONFIG_TOKEN, useValue: configs },
    { provide: INDEXED_DB, useFactory: indexedDbFactory },
  ];
};
