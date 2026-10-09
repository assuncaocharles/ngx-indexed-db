import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

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
    const service = TestBed.inject(NgxIndexedDBService);
    expect(service).toBeTruthy();
  });

  it('should error and add nothing when bulkAdd fails', async () => {
    const service = TestBed.inject(NgxIndexedDBService);
    await firstValueFrom(service.clear('people'));
    const duplicates = [
      { id: 1, name: 'alice', email: 'a@test.dev' },
      { id: 1, name: 'bob', email: 'b@test.dev' },
    ];

    await expectAsync(firstValueFrom(service.bulkAdd('people', duplicates))).toBeRejected();
    // The transaction is aborted as a whole, so the first entry is rolled back too.
    expect(await firstValueFrom(service.count('people'))).toBe(0);
  });
});
