import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { DBConfig, FindOptions } from './ngx-indexed-db.meta';
import { NgxIndexedDBService } from './ngx-indexed-db.service';
import { provideIndexedDb } from './provide-indexed-db';

const DB = 'find-spec';

interface Person {
  id?: number;
  name: string;
  email?: string;
}

const config: DBConfig = {
  name: DB,
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
    { store: 'empty', storeConfig: { keyPath: 'id', autoIncrement: true }, storeSchema: [] },
  ],
};

// Stored with ids 1..7, in this order.
const PEOPLE: Person[] = [
  { name: 'Ada', email: 'ada@example.com' },
  { name: 'Adam', email: 'adam@example.com' },
  { name: 'Adele' },
  { name: 'Alan', email: 'alan@test.org' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Carla', email: 'carla@test.org' },
  { name: 'adrian', email: 'adrian@example.com' },
];

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const hasEmail = (person: Person) => person.email !== undefined;

describe('find()', () => {
  let db: NgxIndexedDBService;

  /** Runs find() on the seeded store and returns the names it emitted, in order. */
  async function names(options: Partial<FindOptions<Person>>): Promise<string[]> {
    const found = await firstValueFrom(
      db.find<Person>({ storeName: 'people', ...options })
    );
    return found.map((person) => person.name);
  }

  beforeEach(async () => {
    await deleteDb();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideIndexedDb(config)] });
    db = TestBed.inject(NgxIndexedDBService);
    await firstValueFrom(db.bulkAdd('people', PEOPLE));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteDb();
  });

  it('returns the same records as getAll() without options', async () => {
    const found = await firstValueFrom(
      db.find<Person>({ storeName: 'people' })
    );
    expect(found).toEqual(await firstValueFrom(db.getAll<Person>('people')));
    expect(found.length).toBe(PEOPLE.length);
  });

  it('reads a key range through an index', async () => {
    expect(await names({ indexName: 'name', query: IDBKeyRange.bound('B', 'D') })).toEqual(['Bob', 'Carla']);
  });

  it('reads a key range on the primary key when no index is given', async () => {
    expect(await names({ query: IDBKeyRange.bound(2, 4) })).toEqual(['Adam', 'Adele', 'Alan']);
  });

  describe('prefix', () => {
    it('matches the keys that start with it, case-sensitively', async () => {
      expect(await names({ indexName: 'name', prefix: 'Ad' })).toEqual(['Ada', 'Adam', 'Adele']);
    });

    it('returns an empty array when nothing matches', async () => {
      expect(await names({ indexName: 'name', prefix: 'Zed' })).toEqual([]);
    });

    it('can be combined with a null query', async () => {
      expect(await names({ indexName: 'name', prefix: 'Ad', query: null })).toEqual(['Ada', 'Adam', 'Adele']);
    });

    it('reads the whole index when it is an empty string', async () => {
      expect(await names({ indexName: 'name', prefix: '' })).toEqual([
        'Ada',
        'Adam',
        'Adele',
        'Alan',
        'Bob',
        'Carla',
        'adrian',
      ]);
    });
  });

  describe('filter', () => {
    it('keeps only the records it accepts', async () => {
      expect(await names({ filter: (person) => person.email?.endsWith('@example.com') ?? false })).toEqual([
        'Ada',
        'Adam',
        'Bob',
        'adrian',
      ]);
    });

    it('combines with prefix', async () => {
      expect(await names({ indexName: 'name', prefix: 'A', filter: hasEmail })).toEqual(['Ada', 'Adam', 'Alan']);
    });

    it('is not called again once limit is reached', async () => {
      const filter = vi.fn(() => true);
      expect(await names({ filter, limit: 2 })).toEqual(['Ada', 'Adam']);
      expect(filter).toHaveBeenCalledTimes(2);
    });
  });

  describe('pagination', () => {
    it('pages through the records without filter', async () => {
      const page = (offset: number) => names({ indexName: 'name', offset, limit: 3 });
      expect(await page(0)).toEqual(['Ada', 'Adam', 'Adele']);
      expect(await page(3)).toEqual(['Alan', 'Bob', 'Carla']);
      expect(await page(6)).toEqual(['adrian']);
    });

    it('counts the offset after filter', async () => {
      const page = (offset: number) => names({ indexName: 'name', filter: hasEmail, offset, limit: 4 });
      expect(await page(0)).toEqual(['Ada', 'Adam', 'Alan', 'Bob']);
      expect(await page(4)).toEqual(['Carla', 'adrian']);
    });

    it('returns an empty array when offset is past the last record', async () => {
      expect(await names({ offset: 10 })).toEqual([]);
      expect(await names({ filter: hasEmail, offset: 10 })).toEqual([]);
    });

    it('returns every match when limit is greater than the results', async () => {
      expect(await names({ indexName: 'name', prefix: 'Ad', limit: 10 })).toEqual(['Ada', 'Adam', 'Adele']);
    });

    it('accepts Infinity as limit', async () => {
      expect((await names({ limit: Infinity })).length).toBe(PEOPLE.length);
    });

    it('skips the offset with a single advance() call when there is no filter', async () => {
      const advance = vi.spyOn(IDBCursor.prototype, 'advance');
      expect(await names({ offset: 2, limit: 2 })).toEqual(['Adele', 'Alan']);
      expect(advance).toHaveBeenCalledTimes(1);
      expect(advance).toHaveBeenCalledWith(2);
    });

    it('does not call advance() when there is a filter', async () => {
      const advance = vi.spyOn(IDBCursor.prototype, 'advance');
      expect(await names({ filter: hasEmail, offset: 2, limit: 2 })).toEqual(['Alan', 'Bob']);
      expect(advance).not.toHaveBeenCalled();
    });
  });

  it('stops reading when the subscriber unsubscribes', async () => {
    const seen: string[] = [];
    await new Promise<void>((resolve) => {
      const subscription = db
        .find<Person>({
          storeName: 'people',
          filter: (person) => {
            seen.push(person.name);
            if (seen.length === 2) {
              subscription.unsubscribe();
              // Leave time for any further cursor event to arrive.
              setTimeout(resolve, 50);
            }
            return true;
          },
        })
        .subscribe();
    });
    expect(seen).toEqual(['Ada', 'Adam']);
  });

  describe('direction', () => {
    it("reads in reverse order with 'prev'", async () => {
      expect(await names({ indexName: 'name', direction: 'prev', limit: 2 })).toEqual(['adrian', 'Carla']);
    });

    it("applies offset in reverse order with 'prev'", async () => {
      expect(await names({ indexName: 'name', direction: 'prev', offset: 1, limit: 2 })).toEqual(['Carla', 'Bob']);
    });
  });

  it('returns an empty array for an empty store', async () => {
    expect(await firstValueFrom(db.find({ storeName: 'empty' }))).toEqual([]);
  });

  describe('errors', () => {
    it('rejects prefix together with query', async () => {
      await expect(names({ indexName: 'name', prefix: 'A', query: 'Ada' })).rejects.toThrow(
        'find() accepts either query or prefix, not both'
      );
    });

    it('rejects a limit that is not an integer >= 1', async () => {
      await expect(names({ limit: 0 })).rejects.toThrow('limit must be an integer >= 1 or Infinity, got 0');
      await expect(names({ limit: 1.5 })).rejects.toThrow('got 1.5');
    });

    it('rejects an offset that is not an integer >= 0', async () => {
      await expect(names({ offset: -1 })).rejects.toThrow('offset must be an integer >= 0, got -1');
      await expect(names({ offset: 0.5 })).rejects.toThrow('got 0.5');
    });

    it('errors with the exception thrown by filter', async () => {
      const failure = new Error('filter failed');
      await expect(
        names({
          filter: () => {
            throw failure;
          },
        })
      ).rejects.toBe(failure);
    });

    it('errors for a store that does not exist', async () => {
      await expect(firstValueFrom(db.find({ storeName: 'missing' }))).rejects.toMatch(
        'objectStore does not exists: missing'
      );
    });

    it('errors for an index that does not exist', async () => {
      await expect(names({ indexName: 'missing' })).rejects.toMatchObject({ name: 'NotFoundError' });
    });
  });
});
