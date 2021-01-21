# ngx-indexed-db

[![Greenkeeper badge](https://badges.greenkeeper.io/assuncaocharles/ngx-indexed-db.svg)](https://greenkeeper.io/) [![CodeFactor](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/badge/master)](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/overview/master) [![Build Status](https://travis-ci.com/assuncaocharles/ngx-indexed-db.svg?branch=master)](https://travis-ci.com/assuncaocharles/ngx-indexed-db) ![CI](https://github.com/assuncaocharles/ngx-indexed-db/workflows/CI/badge.svg)

ngx-indexed-db is a service that wraps IndexedDB database in an Angular service.
It exposes a very simple service with promises based methods to enable the usage of IndexedDB without most of its plumbing.

## Installation

```
npm install ngx-indexed-db
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

First, import the service:

```js
import { NgxIndexedDBService } from 'ngx-indexed-db';

...
  export class AppComponent {
    constructor(private dbService: NgxIndexedDBService){
    }
  }
```

### DB Service Methods

Use the APIs that the NgxIndexedDB service exposes to use indexeddb.
In the API the following functions:

#### getByKey(storeName, key)

Returns the object that is stored in the objectStore by its key.
The first parameter is the store name to query and the second one is the object's key.
**getByKey** returns a promise that is resolved when we have the object or rejected if an error occurred.

Usage example:

```js
this.dbService.getByKey('people', 1).then(
  (person) => {
    console.log(person);
  },
  (error) => {
    console.log(error);
  }
);
```

#### getAll(storeName)

Returns an array of all the items in the given objectStore.
The first parameter is the store name to query.
**getAll** returns a promise that is resolved when we have the array of items or rejected if an error occurred.

Usage example:

```js
this.dbService.getAll('people').then(
  (people) => {
    console.log(people);
  },
  (error) => {
    console.log(error);
  }
);
```

#### getByIndex(storeName, indexName, key)

Returns an stored item using an objectStore's index.
The first parameter is the store name to query, the second parameter is the index and third parameter is the item to query.
**getByIndex** returns a promise that is resolved when the item successfully returned or rejected if an error occurred.

Usage example:

```js
this.dbService.getByIndex('people', 'name', 'Dave').then(
  (person) => {
    console.log(person);
  },
  (error) => {
    console.log(error);
  }
);
```

#### createObjectStore(storeSchema, migrationFactory?)

Create object store with given Store Schema and Migration Factory.
The first parameter is the store schema of type ObjectStoreMeta, the second parameter is the migration factory.

Usage example:

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

#### add(storeName, value, key)

Adds to the given objectStore the key and value pair.
The first parameter is the store name to modify, the second parameter is the value and the third parameter is the key (if not auto-generated).
**add** returns a promise that is resolved when the value was added or rejected if an error occurred.

Usage example (add without a key):

```js
this.dbService.add('people', { name: 'name', email: 'email' }).then(
  () => {
    // Do something after the value was added
  },
  (error) => {
    console.log(error);
  }
);
```

#### addItem(storeName, value, key): value

Adds to the given objectStore the key and value pair.
The first parameter is the store name to modify, the second parameter is the value and the third parameter is the key (if not auto-generated).
**addItem** returns a promise that is resolved when the value was added or rejected if an error occurred.

Usage example (add without a key):

```js
this.dbService.addItem('people', { name: 'name', email: 'email' }).then(
  (addedItem) => {
    // Do something with the value that was added
  },
  (error) => {
    console.log(error);
  }
);
```

_In the previous examples I'm using undefined as the key because the key is configured in the objectStore as auto-generated._

#### addItemWithKey(storeName, value, key): value

Adds to the given objectStore the key and value pair.
The first parameter is the store name to modify, the second parameter is the value and the third parameter is the key (if not auto-generated).
**addItemWithKey** returns a promise that is resolved when the value was added or rejected if an error occurred.

Usage example:

```js
this.dbService.addItemWithKey('people', { name: 'name', email: 'email' }, 42).then(
  (addedItem) => {
    // Do something with the value that was added
  },
  (error) => {
    console.log(error);
  }
);
```

#### count(storeName, keyRange?)

Returns number of rows in the object store.
First parameter is the store name to count rows of.
Second parameter is an optional IDBKeyRange object or a number value (e.g. to test for the key's existence).

Usage example:

```js
this.dbService.count('people').then(
  (peopleCount) => {
    console.log(peopleCount);
  },
  (error) => {
    console.log(error);
  }
);
```

#### update(storeName, value, key?)

Updates the given value in the objectStore.
The first parameter is the value to update, the second parameter is the key (if there is no key don't provide it).
**update** returns a promise that is resolved when the value was updated or rejected if an error occurred.

Usage example (update without a key):

```js
this.dbService.update('people', { id: 3, name: 'name', email: 'email' }).then(
  () => {
    // Do something after update
  },
  (error) => {
    console.log(error);
  }
);
```

#### updateByKey(storeName, value, key): value

Updates the given value in the objectStore.
The first parameter is the value to update, the second parameter is the key.
**updateByKey** returns a promise that is resolved when the value was updated or rejected if an error occurred.

Usage example:

```js
this.dbService.updateByKey('people', { id: 3, name: 'name', email: 'email' }, 42).then(
  (updatedItem) => {
    // Do something with the item after update
  },
  (error) => {
    console.log(error);
  }
);
```

#### delete(storeName, key)

Deletes the object that correspond with the key from the objectStore.
The first parameter is the store name to modify and the second parameter is the key to delete.
**delete** returns a promise that is resolved when the value was deleted or rejected if an error occurred.

Usage example:

```js
this.dbService.delete('people', 3).then(
  () => {
    // Do something after delete
  },
  (error) => {
    console.log(error);
  }
);
```

#### deleteByKey(storeName, key): boolean

Deletes the object that correspond with the key from the objectStore.
The first parameter is the store name to modify and the second parameter is the key to delete.
**deleteByKey** returns a promise that is resolved when the value was deleted or rejected if an error occurred.

Usage example:

```js
this.dbService.deleteByKey('people', 3).then(
  (status) => {
    // Do something with the status (true if successful) after delete
  },
  (error) => {
    console.log(error);
  }
);
```

#### openCursor(storeName, cursorCallback, keyRange)

Opens an objectStore cursor to enable iterating on the objectStore.
The first parameter is the store name, the second parameter is a callback function to run when the cursor succeeds to be opened and the third parameter is optional IDBKeyRange object.
**openCursor** returns a promise that is resolved when the cursor finishes running or rejected if an error occurred.

Usage example:

```js
this.dbService.openCursor('people', (evt) => {
    var cursor = (<any>evt.target).result;
    if(cursor) {
        console.log(cursor.value);
        cursor.continue();
    } else {
        console.log('Entries all displayed.');
    }
}, IDBKeyRange.bound("A", "F"));
```

#### openCursorByIndex(storeName, indexName, keyRange, cursorCallback)

Opens an index cursor to enable iterating on the objectStore.
The first parameter is the store name, the second parameter is the index on which to filter, the third parameter is an IDBKeyRange object for criteria and the last parameter is a callback function to run when the cursor succeeds to be opened.
**openCursorByIndex** returns a promise that is resolved when the cursor finishes running or rejected if an error occurred.

Usage example:

```js
this.dbService.openCursorByIndex('people', 'name', IDBKeyRange.only('john'), (evt) => {
    var cursor = (<any>evt.target).result;
    if(cursor) {
        console.log(cursor.value);
        cursor.continue();
    } else {
        console.log('Entries all displayed.');
    }
});
```

#### getAllByIndex(storeName, indexName, keyRange)

Returns an array of all the items in the given objectStore matching the key range for the specified index.
The first parameter is the store name to query.
The second parameter is an index details which must include index name and an optional order parameter.
The third parameter is an `IDBKeyRange` object.
**getAllByIndex** returns a promise that is resolved when we have the array of items or rejected if an error occurred.

Usage example:

```js
this.dbService.getAllByIndex('people', 'name', IDBKeyRange.only('john')).then(
  (array) => {
    // Do something with the array
  },
  (error) => {
    console.log(error);
  }
);
```

#### clear(storeName)

Clears all the data in an objectStore.
The first parameter is the store name to clear.
**clear** returns a promise that is resolved when the objectStore was cleared or rejected if an error occurred.

Usage example:

```js
this.dbService.clear('people').then(
  () => {
    // Do something after clear
  },
  (error) => {
    console.log(error);
  }
);
```

#### deleteDatabase()

**Deletes the entire database.**

Usage example:

```js
this.dbService.deleteDatabase().then(
  () => {
    console.log('Database deleted successfully');
  },
  (error) => {
    console.log(error);
  }
);
```

## License

Released under the terms of the [MIT License](LICENSE).
