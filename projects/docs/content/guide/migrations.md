---
title: Migrations
description: Evolve your schema across versions without losing users' data.
section: Guides
order: 4
---

# Migrations

Your users keep their IndexedDB data between visits, so schema changes have to upgrade the database they already have. IndexedDB does this through **versions**: when your config's `version` is higher than the one in the browser, the database is upgraded before any query runs.

## What happens automatically

During an upgrade, any object store listed in `objectStoresMeta` that doesn't exist yet is created, together with its indexes. Indexes declared in a store's `storeSchema` that the store doesn't have yet are added too. Adding a store or an index only takes two steps:

1. Add it to `objectStoresMeta`, or the index to the store's `storeSchema`.
2. Increase `version`.

## Writing migrations

For anything else, such as changing or removing an index, or transforming data, provide a `migrationFactory`. It returns one function per version. Each function receives the database and the upgrade transaction:

```ts title="db.config.ts"
import { DBConfig } from 'ngx-indexed-db';

export function migrationFactory() {
  return {
    // v2 added the "animals" store. It is created automatically, so no entry is needed.
    3: (db: IDBDatabase, transaction: IDBTransaction) => {
      // Make "email" unique: an existing index can't be changed, so it is recreated.
      const people = transaction.objectStore('people');
      people.deleteIndex('email');
      people.createIndex('email', 'email', { unique: true });
    },
    4: (db: IDBDatabase, transaction: IDBTransaction) => {
      // Drop an index that is no longer used. First-time visitors never had it.
      const people = transaction.objectStore('people');
      if (people.indexNames.contains('nickname')) people.deleteIndex('nickname');
    },
  };
}

export const dbConfig: DBConfig = {
  name: 'MyDb',
  version: 4,
  objectStoresMeta: [
    {
      store: 'people',
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [
        { name: 'name', keypath: 'name', options: { unique: false } },
        { name: 'email', keypath: 'email', options: { unique: true } },
      ],
    },
    {
      store: 'animals',
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [{ name: 'name', keypath: 'name', options: { unique: true } }],
    },
  ],
  migrationFactory,
};
```

## Which migrations run

Only migrations for versions **newer than the user's current database** run, in ascending order. With the config above:

| User's current version | Migrations that run |
| ---------------------- | ------------------- |
| none (first visit)     | 3, 4                |
| 1 or 2                 | 3, 4                |
| 3                      | 4                   |
| 4                      | none                |

> [!TIP]
> Write each migration so it works no matter which version the user starts from. A first-time visitor runs every migration, right after the stores have been created from `objectStoresMeta`.

## Migrating data

The upgrade transaction can read and write records too, so you can reshape existing data while upgrading:

```ts
5: (db: IDBDatabase, transaction: IDBTransaction) => {
  const people = transaction.objectStore('people');
  people.openCursor().onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
    if (!cursor) return;
    const { firstName, lastName, ...rest } = cursor.value;
    cursor.update({ ...rest, name: `${firstName} ${lastName}` });
    cursor.continue();
  };
},
```
