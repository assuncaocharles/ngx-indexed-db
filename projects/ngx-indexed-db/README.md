# ngx-indexed-db

[![Greenkeeper badge](https://badges.greenkeeper.io/assuncaocharles/ngx-indexed-db.svg)](https://greenkeeper.io/) [![CodeFactor](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/badge/master)](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/overview/master) [![Build Status](https://travis-ci.com/assuncaocharles/ngx-indexed-db.svg?branch=master)](https://travis-ci.com/assuncaocharles/ngx-indexed-db) ![CI](https://github.com/assuncaocharles/ngx-indexed-db/workflows/CI/badge.svg)

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

#### add(storeName, value, key?): key

Adds new entry in the store and returns its key

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

#### addItem(storeName, value, key?): value

Adds new entry in the store and returns the new item

- @param storeName The name of the store to add the item
- @param value The entry to be added
- @param key The optional key for the entry

It publishes in the observable the item that was added

```js
this.dbService
  .addItem('people', {
    name: `Bruce Wayne`,
    email: `bruce@wayne.com`,
  })
  .subscribe((item) => {
    console.log('item: ', item);
  });
```

#### addItemWithKey(storeName, value, key): value

Adds new entry in the store and returns the new item

- @param storeName The name of the store to add the item
- @param value The entry to be added
- @param key The key for the entry

It publishes in the observable the item that was added

```js
this.dbService
  .addItemWithKey('people', {
    name: `Bruce Wayne`,
    email: `bruce@wayne.com`,
  })
  .subscribe((item) => {
    console.log('item: ', item);
  });
```

#### update(storeName, value, key?)

Updates the given value in the objectStore and returns all items from the store after update..

- @param storeName The name of the store to update
- @param value The new value for the entry
- @param key The key of the entry to update if exists

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

#### updateByKey(storeName, value, key): value

Updates the given value in the objectStore and returns the item from the store after update..

- @param storeName The name of the store to update
- @param value The new value for the entry
- @param key The key of the entry to update

```js
this.dbService
  .updateByKey('people', {
    id: 1,
    email: 'luke@skywalker.com',
    name: 'Luke Skywalker',
  })
  .subscribe((item) => {
    console.log('item: ', item);
  });
```

#### getByKey(storeName, key)

Returns entry by key.

- @param storeName The name of the store to query
- @param key The entry key

```js
this.dbService.getByKey('people', 1).subscribe((people) => {
  console.log(people);
});
```

#### getAll(storeName)

Return all elements from one store

- @param storeName The name of the store to select the items

```js
this.dbService.getAll('people').subscribe((peoples) => {
  console.log(peoples);
});
```

#### getByIndex(storeName, indexName, key)

Returns entry by index.

- @param storeName The name of the store to query
- @param indexName The index name to filter
- @param key The entry key.

```js
this.dbService.getByIndex('people', 'name', 'Dave').subscribe((people) => {
  console.log(people);
});
```

#### createObjectStore(storeSchema, migrationFactory?)

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

#### count(storeName, keyRange?)

Returns the number of rows in a store.

- @param storeName The name of the store to query
- @param keyRange The range value and criteria to apply.

```js
this.dbService.count('people').subscribe((peopleCount) => {
  console.log(peopleCount);
});
```

#### delete(storeName, key)

Returns all items from the store after delete.

- @param storeName The name of the store to have the entry deleted
- @param key The key of the entry to be deleted

```js
this.dbService.delete('people', 3).subscribe((allPeople) => {
  console.log('all people:', allPeople);
});
```

#### deleteByKey(storeName, key)

Returns true if the delete completes successfully.

- @param storeName The name of the store to have the entry deleted
- @param key The key of the entry to be deleted

```js
this.dbService.deleteByKey('people', 3).subscribe((status) => {
  console.log('Deleted?:', status);
});
```

#### openCursor(storeName, keyRange?)

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

#### openCursorByIndex(storeName, indexName, keyRange, cursorCallback)

Open a cursor by index filter.

- @param storeName The name of the store to query.
- @param indexName The index name to filter.
- @param keyRange The range value and criteria to apply on the index.

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

#### getAllByIndex(storeName, indexName, keyRange)

Returns all items by an index.

- @param storeName The name of the store to query
- @param indexName The index name to filter
- @param keyRange The range value and criteria to apply on the index.

```js
this.dbService.getAllByIndex('people', 'name', IDBKeyRange.only('john')).subscribe((allPeopleByIndex) => {
  console.log('All: ', allPeopleByIndex);
});
```

#### clear(storeName)

Returns true if successfully delete all entries from the store.

- @param storeName The name of the store to have the entries deleted

```js
this.dbService.clear('people').subscribe((successDeleted) => {
  console.log('success? ', successDeleted);
});
```

#### deleteDatabase()

Returns true if successfully delete the DB.

```js
this.dbService.deleteDatabase().subscribe((deleted) => {
  console.log('Database deleted successfully: ', deleted);
});
```

## License

Released under the terms of the [MIT License](LICENSE).
