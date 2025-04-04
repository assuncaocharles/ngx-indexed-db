# ngx-indexed-db

[![Known Vulnerabilities](https://snyk.io/test/github/assuncaocharles/ngx-indexed-db/badge.svg)](https://snyk.io/test/github/assuncaocharles/ngx-indexed-db) [![CodeFactor](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/badge/master)](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/overview/master) [![Build Status](https://travis-ci.com/assuncaocharles/ngx-indexed-db.svg?branch=master)](https://travis-ci.com/assuncaocharles/ngx-indexed-db) ![CI](https://github.com/assuncaocharles/ngx-indexed-db/workflows/CI/badge.svg)

`ngx-indexed-db` is a service (CSR & SSR) that wraps IndexedDB database in an Angular service combined with the power of observables.

## Installation

```bash
$ npm install ngx-indexed-db
```

OR

```bash
$ yarn add ngx-indexed-db
```

## Usage

### With Module
Import the `NgxIndexedDBModule` and initiate it:

```js
import { NgxIndexedDBModule } from 'ngx-indexed-db';

const dbConfig: DBConfig  = {
  name: 'MyDb',
  version: 1,
  objectStoresMeta: [{
    store: 'people',
    storeConfig: { keyPath: 'id', autoIncrement: true },
    storeSchema: [
      { name: 'name', keypath: 'name', options: { unique: false } },
      { name: 'email', keypath: 'email', options: { unique: false } }
    ]
  }]
};

@NgModule({
  ...
  imports: [
    ...
    NgxIndexedDBModule.forRoot(dbConfig)
  ],
  ...
})
```
### With Standalone API

Use `provideIndexedDb` and set it up:

```js
import { provideIndexedDb, DBConfig } from 'ngx-indexed-db';

const dbConfig: DBConfig  = {
  name: 'MyDb',
  version: 1,
  objectStoresMeta: [{
    store: 'people',
    storeConfig: { keyPath: 'id', autoIncrement: true },
    storeSchema: [
      { name: 'name', keypath: 'name', options: { unique: false } },
      { name: 'email', keypath: 'email', options: { unique: false } }
    ]
  }]
};

const appConfig: ApplicationConfig = {
  providers: [...,provideIndexedDb(dbConfig),...]
}

OR

@NgModule({
  ...
 providers:[
    ...
    provideIndexedDb(dbConfig)
  ],
  ...
})
```
### SSR

Starting from version 19.2.0, `ngx-indexed-db` fully supports **Server-Side Rendering (SSR)**. This enhancement prevents issues related to the absence of `window.indexedDB` in server environments.

Additionally, you can provide a custom implementation of IndexedDB using an **injection token**. This allows greater flexibility, especially when mocking IndexedDB for testing or in non-browser environments (like SSR).

```js
const SERVER_INDEXED_DB = new InjectionToken<IDBFactory>('Server Indexed Db');
```

### Migrations

```js
import { NgxIndexedDBModule, DBConfig } from 'ngx-indexed-db';

// Ahead of time compiles requires an exported function for factories
export function migrationFactory() {
  // The animal table was added with version 2 but none of the existing tables or data needed
  // to be modified so a migrator for that version is not included.
  return {
    1: (db, transaction) => {
      const store = transaction.objectStore('people');
      store.createIndex('country', 'country', { unique: false });
    },
    3: (db, transaction) => {
      const store = transaction.objectStore('people');
      store.createIndex('age', 'age', { unique: false });
    }
  };
}

const dbConfig: DBConfig  = {
  name: 'MyDb',
  version: 3,
  objectStoresMeta: [{
    store: 'people',
    storeConfig: { keyPath: 'id', autoIncrement: true },
    storeSchema: [
      { name: 'name', keypath: 'name', options: { unique: false } },
      { name: 'email', keypath: 'email', options: { unique: false } }
    ]
  }, {
    // animals added in version 2
    store: 'animals',
    storeConfig: { keyPath: 'id', autoIncrement: true },
    storeSchema: [
      { name: 'name', keypath: 'name', options: { unique: true } },
    ]
  }],
  // provide the migration factory to the DBConfig
  migrationFactory
};

@NgModule({
  ...
  imports: [
    ...
    NgxIndexedDBModule.forRoot(dbConfig)
  ],
  ...
})
```

### NgxIndexedDB service

Import and inject the service:

```js
import { NgxIndexedDBService } from 'ngx-indexed-db';

...
  export class AppComponent {
    #dbService = inject(NgxIndexedDBService);
  }
```

### API

We cover several common methods used to work with the IndexedDB

### add<T>(storeName: string, value: T, key?: any): Observable<T & {id: any}>

Adds new entry in the store and returns item added

- @param storeName The name of the store to add the item
- @param value The entry to be added
- @param key The optional key for the entry

It publishes in the observable the key value of the entry

```js
this.dbService
  .add('people', {
    name: `Bruce Wayne`,
    email: `bruce@wayne.com`,
  })
  .subscribe((key) => {
    console.log('key: ', key);
  });
```

_In the previous example I'm using undefined as the key because the key is configured in the objectStore as auto-generated._

### bulkAdd<T>(storeName: string, values: Array<T & { key?: any }>): Observable<number[]>

Adds new entries in the store and returns its key

- @param storeName The name of the store to add the item
- @param values The entries to be added containing optional key attribute

```typescript
this.dbService
  .bulkAdd('people', [
    {
      name: `charles number ${Math.random() * 10}`,
      email: `email number ${Math.random() * 10}`,
    },
    {
      name: `charles number ${Math.random() * 10}`,
      email: `email number ${Math.random() * 10}`,
    },
  ])
  .subscribe((result) => {
    console.log('result: ', result);
  });
```


### bulkDelete(storeName: string, keys: Key[]): Observable<number[]>

Delete multiple items in the store

- @param storeName The name of the store to delete the items
- @param keys The entries keys to be deleted

```typescript
  this.dbService.bulkDelete('people', [5, 6]).subscribe((result) => {
    console.log('result: ', result);
  });
```

### bulkGet<T>(storeName: string, keys: Array<IDBValidKey>): Observable<T[]>

Retrieve multiple entries in the store

- @param storeName The name of the store to retrieve the items
- @param keys The ids entries to be retrieve

```typescript
this.dbService.bulkGet('people', [1, 3, 5]).subscribe((result) => {
    console.log('results: ', result);
  });
```

### bulkPut<T>(storeName: string, values: Array<T & { key?: any }>): Observable<number[]>

Adds or updates a record in store with the given value and key. Return all items present in the store

- @param storeName The name of the store to update
- @param items The values to update in the DB

@Return The return value is an Observable with the primary key of the object that was last in given array

@error If the call to bulkPut fails the transaction will be aborted and previously inserted entities will be deleted

```typescript
this.dbService.bulkPut('people', people).subscribe((result) => {
  console.log('result: ', result);
});
```

### update<T>(storeName: string, value: T): Observable<T[]>

Adds or updates a record in store with the given value and key. Return item updated

- @param storeName The name of the store to update
- @param value The new value for the entry

```js
this.dbService
  .update('people', {
    id: 1,
    email: 'luke@skywalker.com',
    name: 'Luke Skywalker',
  })
  .subscribe((storeData) => {
    console.log('storeData: ', storeData);
  });
```

### getByKey<T>(storeName: string, key: IDBValidKey): Observable<T>

Returns entry by key.

- @param storeName The name of the store to query
- @param key The entry key

```js
this.dbService.getByKey('people', 1).subscribe((people) => {
  console.log(people);
});
```

### getAll<T>(storeName: string): Observable<T[]>

Return all elements from one store

- @param storeName The name of the store to select the items

```js
this.dbService.getAll('people').subscribe((peoples) => {
  console.log(peoples);
});
```

### getByIndex<T>(storeName: string, indexName: string, key: IDBValidKey): Observable<T>

Returns entry by index.

- @param storeName The name of the store to query
- @param indexName The index name to filter
- @param key The entry key.

```js
this.dbService.getByIndex('people', 'name', 'Dave').subscribe((people) => {
  console.log(people);
});
```

### createObjectStore(storeSchema: ObjectStoreMeta, migrationFactory?: () => { [key: number]: (db: IDBDatabase, transaction: IDBTransaction) => void }): void

Allows to crate a new object store ad-hoc

- @param storeName The name of the store to be created
- @param migrationFactory The migration factory if exists

```js
const storeSchema: ObjectStoreMeta = {
  store: 'people',
  storeConfig: { keyPath: 'id', autoIncrement: true },
  storeSchema: [
    { name: 'name', keypath: 'name', options: { unique: false } },
    { name: 'email', keypath: 'email', options: { unique: false } },
  ],
};

this.dbService.createObjectStore(storeSchema);
```

### count(storeName: string, query?: IDBValidKey | IDBKeyRange): Observable<number>

Returns the number of rows in a store.

- @param storeName The name of the store to query
- @param query The key or key range criteria to apply.

```js
this.dbService.count('people').subscribe((peopleCount) => {
  console.log(peopleCount);
});
```

### countByIndex(storeName: string, indexName: string, query?: IDBValidKey | IDBKeyRange): Observable<number>

Returns the number of records within a key range.

- @param storeName The name of the store to query
- @param indexName The index name to filter
- @param query The key or key range criteria to apply.

```js
this.dbService.countByIndex('people', 'email').subscribe((peopleCount) => {
  console.log(peopleCount);
});
```

### deleteObjectStore(storeName: string): Observable<void>

Delete the store by name.

- @param storeName The name of the store to query

```js
this.dbService.deleteObjectStore(this.storneNameToDelete);
```

### delete<T>(storeName: string, key: Key): Observable<T[]>


Returns all items from the store after delete.

- @param storeName The name of the store to have the entry deleted
- @param key The key of the entry to be deleted

```js
this.dbService.delete('people', 3).subscribe((allPeople) => {
  console.log('all people:', allPeople);
});
```

### deleteByKey(storeName: string, key: Key): Observable<void>

Returns if the delete completes successfully.

- @param storeName The name of the store to have the entry deleted
- @param key The key of the entry to be deleted

```js
this.dbService.deleteByKey('people', 3).subscribe((status) => {
  console.log('Deleted?:', status);
});
```

### openCursor<V = any, P extends IDBValidKey = IDBValidKey, K extends IDBValidKey = IDBValidKey>({
  storeName: string,
  query?: IDBValidKey | IDBKeyRange | null,
  direction?: IDBCursorDirection,
  mode: DBMode = DBMode.readonly
}): Observable<NgxIDBCursorWithValue<V, P, K>>

Opens a cursor.
If no matching data are present, the observable is completed immediately.

- @param options The options to open the cursor
- @param options.storeName The name of the store to have the entries deleted
- @param options.query The key or key range criteria to apply
- @param options.direction A string telling the cursor which direction to travel
- @param options.mode The transaction mode.

```js
this.dbService.openCursor('people', IDBKeyRange.bound("A", "F")).subscribe((cursor) => {
  console.log(cursor.value);
});
```

### openCursorByIndex<V = any, P extends IDBValidKey = IDBValidKey, K extends IDBValidKey = IDBValidKey>({
  storeName: string,
  indexName: string,
  query?: IDBValidKey | IDBKeyRange | null,
  direction?: IDBCursorDirection,
  mode: DBMode = DBMode.readonly
}): Observable<NgxIDBCursorWithValue<V, P, K>>

Open a cursor by index filter.
If no matching data are present, the observable is completed immediately.

- @param options The options to open the cursor
- @param options.storeName The name of the store to query
- @param options.indexName The index name to filter
- @param options.query The key or key range criteria to apply
- @param options.direction A string telling the cursor which direction to travel
- @param options.mode The transaction mode.

```js
this.dbService.openCursorByIndex('people', 'name', IDBKeyRange.only('john')).subscribe((cursor) => {
  console.log(cursor.value);
});
```

### getAllByIndex<T>(storeName: string, indexName: string, query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): Observable<T[]>

Returns all items by an index.

- @param storeName The name of the store to query
- @param indexName The index name to filter
- @param query The key or key range criteria to apply
- @param direction A string telling the cursor which direction to travel.

```js
this.dbService.getAllByIndex('people', 'name', IDBKeyRange.only('john')).subscribe((allPeopleByIndex) => {
  console.log('All: ', allPeopleByIndex);
});
```

### getAllKeysByIndex<P extends IDBValidKey = IDBValidKey, K extends IDBValidKey = IDBValidKey>(storeName: string, indexName: string, query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): Observable<IndexKey<P, K>[]>

Returns all items by an index.

- @param storeName The name of the store to query
- @param indexName The index name to filter
- @param query The range value and criteria to apply on the index
- @param direction A string telling the cursor which direction to travel.

```js
this.dbService.getAllKeysByIndex('people', 'name', IDBKeyRange.only('john')).subscribe((keys) => {
  console.log(keys);
});
```

### getDatabaseVersion(): Observable<number>

Returns the current database version.

```js
this.dbService.getDatabaseVersion().pipe(
  tap(response => console.log('Versione database => ', response)),
  catchError(err => {
    console.error('Error recover version => ', err);
    return throwError(err);
  })
).subscribe();
```

### clear(storeName: string): Observable<void>

Returns true if successfully delete all entries from the store.

- @param storeName The name of the store to have the entries deleted

```js
this.dbService.clear('people').subscribe((successDeleted) => {
  console.log('success? ', successDeleted);
});
```

### deleteDatabase(): Observable<void>

Returns true if successfully delete the DB.

```js
this.dbService.deleteDatabase().subscribe((deleted) => {
  console.log('Database deleted successfully: ', deleted);
});

```
### getAllObjectStoreNames(): Observable<string[]>

Returns all object store names.

```js
this.dbService.getAllObjectStoreNames().subscribe((storeNames) => {
  console.log('storeNames: ', storeNames);
});
```

## License

Released under the terms of the [MIT License](LICENSE).
