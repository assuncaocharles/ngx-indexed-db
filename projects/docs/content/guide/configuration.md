---
title: Configuration
description: Every option of DBConfig, object stores and indexes.
section: Guides
order: 2
---

# Configuration

Everything about your database is declared in a `DBConfig` object, which you pass to `provideIndexedDb()` or `NgxIndexedDBModule.forRoot()`.

## DBConfig

| Option             | Type                | Description                                                                                       |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------- |
| `name`             | `string`            | **Required.** The IndexedDB database name.                                                        |
| `version`          | `number`            | The schema version. Increase it whenever you add stores or indexes.                               |
| `objectStoresMeta` | `ObjectStoreMeta[]` | **Required.** The object stores to create.                                                        |
| `migrationFactory` | `() => Migrations`  | Upgrade functions keyed by version. See [Migrations](/guide/migrations).                          |
| `isDefault`        | `boolean`           | Marks the default database when you register several. See [Multiple databases](/guide/multiple-databases). |

## Object stores

An object store is like a table. `store` is its name, and `storeConfig` is passed straight to [`IDBDatabase.createObjectStore()`](https://developer.mozilla.org/docs/Web/API/IDBDatabase/createObjectStore):

```ts
{
  store: 'people',
  storeConfig: { keyPath: 'id', autoIncrement: true },
  storeSchema: [],
}
```

- **`keyPath`** is the property that holds each record's primary key. It can be a single property (`'id'`) or several properties combined into one key (`['firstName', 'lastName']`).
- **`autoIncrement: true`** lets IndexedDB generate numeric keys. Records you `add()` without a key get the next number, written to `keyPath`.

## Indexes

Every entry in `storeSchema` creates an index, which lets you look records up by something other than their primary key:

```ts
storeSchema: [
  { name: 'email', keypath: 'email', options: { unique: true } },
  { name: 'tags', keypath: 'tags', options: { unique: false, multiEntry: true } },
  { name: 'fullName', keypath: ['firstName', 'lastName'], options: { unique: false } },
];
```

- **`name`** is how you refer to the index in queries such as `getAllByIndex('people', 'email', …)`.
- **`keypath`** is the property, or properties, that are indexed.
- **`options`** are passed to [`IDBObjectStore.createIndex()`](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/createIndex). `unique` rejects duplicate values, and `multiEntry` indexes each element of an array property separately.

> [!NOTE]
> Stores and indexes are only created while IndexedDB upgrades the database, which happens when `version` goes up. If you add a store or an index to an existing app, bump `version`.

### Adding an index later

To index a store that users already have, add the index to its `storeSchema` and increase `version`:

```ts
export const dbConfig: DBConfig = {
  name: 'MyDb',
  version: 2, // was 1
  objectStoresMeta: [
    {
      store: 'people',
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [
        { name: 'name', keypath: 'name', options: { unique: false } },
        { name: 'email', keypath: 'email', options: { unique: false } }, // new
      ],
    },
  ],
};
```

During the upgrade, every index declared in `storeSchema` that's missing from its store is created, and IndexedDB fills it from the records already stored. Existing indexes are never changed or removed automatically: to change an index's `keypath` or `options`, or to drop one, write a [migration](/guide/migrations).

## Version mismatches

If the database in the browser has a higher version than your config, for example after a newer deployment of your app ran in the same browser, the library uses the browser's version. In development mode it also logs a warning so you can bring the config up to date.
