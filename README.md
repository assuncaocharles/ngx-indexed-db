# ngx-indexed-db
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![Known Vulnerabilities](https://snyk.io/test/github/assuncaocharles/ngx-indexed-db/badge.svg)](https://snyk.io/test/github/assuncaocharles/ngx-indexed-db) [![CodeFactor](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/badge/master)](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/overview/master) [![Build Status](https://travis-ci.com/assuncaocharles/ngx-indexed-db.svg?branch=master)](https://travis-ci.com/assuncaocharles/ngx-indexed-db) ![CI](https://github.com/assuncaocharles/ngx-indexed-db/workflows/CI/badge.svg)

`ngx-indexed-db` is a service that wraps IndexedDB database in an Angular service combined with the power of observables.

## Installation

```bash
$ npm install ngx-indexed-db
```

OR

```bash
$ yarn add ngx-indexed-db
```

## Usage

Import the `NgxIndexedDBModule` and set up it:

```js
import { NgxIndexedDBModule, DBConfig } from 'ngx-indexed-db';

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
    constructor(private dbService: NgxIndexedDBService){
    }
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

### count(storeName: string, keyRange?: IDBValidKey | IDBKeyRange): Observable<number>

Returns the number of rows in a store.

- @param storeName The name of the store to query
- @param keyRange The range value and criteria to apply.

```js
this.dbService.count('people').subscribe((peopleCount) => {
  console.log(peopleCount);
});
```

### deleteObjectStore(storeName: string): Observable<boolean>

Delete the store by name, return true or false. 

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

### deleteByKey(storeName: string, key: Key): Observable<boolean>

Returns true if the delete completes successfully.

- @param storeName The name of the store to have the entry deleted
- @param key The key of the entry to be deleted

```js
this.dbService.deleteByKey('people', 3).subscribe((status) => {
  console.log('Deleted?:', status);
});
```

### openCursor(storeName: string, keyRange?: IDBKeyRange): Observable<Event>

Returns the open cursor event

- @param storeName The name of the store to have the entries deleted
- @param keyRange The key range which the cursor should be open on

```js
this.dbService.openCursor('people', IDBKeyRange.bound("A", "F")).subscribe((evt) => {
    var cursor = (evt.target as IDBOpenDBRequest).result;
    if(cursor) {
        console.log(cursor.value);
        cursor.continue();
    } else {
        console.log('Entries all displayed.');
    }
});
```

### openCursorByIndex(storeName: string, indexName: string, keyRange: IDBKeyRange, mode?: DBMode): Observable<Event>

Open a cursor by index filter.

- @param storeName The name of the store to query.
- @param indexName The index name to filter.
- @param keyRange The range value and criteria to apply on the index.
- @param mode DB Mode to work with, default to `readonly`

```js
this.dbService.openCursorByIndex('people', 'name', IDBKeyRange.only('john')).subscribe((evt) => {
    var cursor = (evt.target as IDBOpenDBRequest).result;
    if(cursor) {
        console.log(cursor.value);
        cursor.continue();
    } else {
        console.log('Entries all displayed.');
    }
});
```

### getAllByIndex<T>(storeName: string, indexName: string, keyRange: IDBKeyRange): Observable<T[]>

Returns all items by an index.

- @param storeName The name of the store to query
- @param indexName The index name to filter
- @param keyRange The range value and criteria to apply on the index.

```js
this.dbService.getAllByIndex('people', 'name', IDBKeyRange.only('john')).subscribe((allPeopleByIndex) => {
  console.log('All: ', allPeopleByIndex);
});
```

### clear(storeName: string): Observable<boolean>

Returns true if successfully delete all entries from the store.

- @param storeName The name of the store to have the entries deleted

```js
this.dbService.clear('people').subscribe((successDeleted) => {
  console.log('success? ', successDeleted);
});
```

### deleteDatabase(): Observable<boolean> 

Returns true if successfully delete the DB.

```js
this.dbService.deleteDatabase().subscribe((deleted) => {
  console.log('Database deleted successfully: ', deleted);
});
```

## License

Released under the terms of the [MIT License](LICENSE).

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="http://www.angeloparziale.it"><img src="https://avatars.githubusercontent.com/u/16490359?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Angelo Parziale</b></sub></a><br /><a href="#maintenance-aparzi" title="Maintenance">🚧</a> <a href="https://github.com/assuncaocharles/ngx-indexed-db/commits?author=aparzi" title="Code">💻</a></td>
    <td align="center"><a href="https://charlesassuncao.tech/"><img src="https://avatars.githubusercontent.com/u/8545105?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Charles Assunção</b></sub></a><br /><a href="https://github.com/assuncaocharles/ngx-indexed-db/commits?author=assuncaocharles" title="Code">💻</a> <a href="https://github.com/assuncaocharles/ngx-indexed-db/commits?author=assuncaocharles" title="Documentation">📖</a> <a href="#maintenance-assuncaocharles" title="Maintenance">🚧</a></td>
    <td align="center"><a href="https://github.com/coolweb"><img src="https://avatars.githubusercontent.com/u/3740250?v=4?s=100" width="100px;" alt=""/><br /><sub><b>coolweb</b></sub></a><br /><a href="#maintenance-coolweb" title="Maintenance">🚧</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!