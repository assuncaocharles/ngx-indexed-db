import { makeEnvironmentProviders, Provider } from '@angular/core';
import { DBConfig, CONFIG_TOKEN } from './ngx-indexed-db.meta';
import { NgxIndexedDBService } from './ngx-indexed-db.service';

export const provideIndexedDb = (...dbConfigs: DBConfig[]) => {
  return makeEnvironmentProviders([..._provideIndexedDb(...dbConfigs)]);
};

export const _provideIndexedDb = (...dbConfigs: DBConfig[]): Provider[] => {
  const configs = dbConfigs.reduce<Record<string, DBConfig>>((acc, curr) => {
    acc[curr.name] = curr;
    return acc;
  }, {});
  return [NgxIndexedDBService, { provide: CONFIG_TOKEN, useValue: configs }];
};
