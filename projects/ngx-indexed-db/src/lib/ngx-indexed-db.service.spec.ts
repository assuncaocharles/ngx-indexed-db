import { TestBed } from '@angular/core/testing';

import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { NgxIndexedDBModule } from './ngxindexeddb.module';

const dbConfig = {
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
  ],
};

describe('NgxIndexedDBService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [NgxIndexedDBModule.forRoot(dbConfig)],
    })
  );

  it('should be created', () => {
    const service: NgxIndexedDBService = TestBed.get(NgxIndexedDBService);
    expect(service).toBeTruthy();
  });
});
