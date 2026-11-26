<!--
  Examples and notes for the API reference. Signatures, parameters and summaries
  come from the TypeScript source; each "## name" section below is attached to the
  service method or type with that name.
-->

## add

When the store generates keys (`autoIncrement`), leave out `key`. The emitted record includes the generated key.

```ts
this.db.add<Person>('people', { name: 'Ada Lovelace', email: 'ada@example.com' }).subscribe((person) => {
  console.log(person.id); // 1
});
```

## bulkAdd

Each value may carry a `key` property, used as an explicit key and removed before the value is stored.

```ts
this.db
  .bulkAdd<Person>('people', [
    { name: 'Ada Lovelace', email: 'ada@example.com' },
    { name: 'Alan Turing', email: 'alan@example.com' },
  ])
  .subscribe((keys) => console.log(keys)); // [1, 2]
```

## update

Writes the whole record, creating it if it doesn't exist yet. Include the primary key in `value`.

```ts
this.db.update<Person>('people', { id: 1, name: 'Ada King', email: 'ada@example.com' }).subscribe((person) => {
  console.log(person.name); // 'Ada King'
});
```

## bulkPut

```ts
this.db.bulkPut<Person>('people', people).subscribe((lastKey) => {
  console.log('Last written key', lastKey);
});
```

## getByKey

Emits `undefined` when no record has that key.

```ts
this.db.getByKey<Person>('people', 1).subscribe((person) => console.log(person));
```

## getByID

The same lookup as `getByKey()`, limited to string and number keys.

```ts
this.db.getByID<Person>('people', 1).subscribe((person) => console.log(person));
```

## bulkGet

Emits the records in the same order as `keys`, with `undefined` for missing keys.

```ts
this.db.bulkGet<Person>('people', [1, 2, 3]).subscribe((people) => console.log(people));
```

## getAll

```ts
this.db.getAll<Person>('people').subscribe((people) => console.log(people));
```

## getByIndex

Emits the **first** record whose index value matches, or `undefined`.

```ts
this.db.getByIndex<Person>('people', 'email', 'ada@example.com').subscribe((person) => console.log(person));
```

## getAllByIndex

Leave out `query` to read every record in index order.

```ts
this.db
  .getAllByIndex<Person>('people', 'name', IDBKeyRange.bound('A', 'M'))
  .subscribe((people) => console.log(people));
```

## getAllKeysByIndex

Reads only keys, which is cheaper than loading full records.

```ts
this.db.getAllKeysByIndex('people', 'email').subscribe((keys) => {
  // [{ primaryKey: 1, key: 'ada@example.com' }, …]
});
```

## count

```ts
this.db.count('people').subscribe((total) => console.log(total));
this.db.count('people', IDBKeyRange.lowerBound(100)).subscribe(); // keys >= 100
```

## countByIndex

```ts
this.db.countByIndex('people', 'age', IDBKeyRange.lowerBound(18)).subscribe((adults) => console.log(adults));
```

## delete

```ts
this.db.delete<Person>('people', 3).subscribe((remaining) => console.log(remaining));
```

## deleteByKey

Like `delete()`, without reading the store back afterwards.

```ts
this.db.deleteByKey('people', IDBKeyRange.bound(10, 20)).subscribe(() => console.log('Deleted'));
```

## bulkDelete

Use it as a completion signal: despite the `number[]` type, the emitted values are not deleted keys.

```ts
this.db.bulkDelete('people', [5, 6]).subscribe(() => console.log('Deleted'));
```

## deleteAllByIndex

```ts
this.db.deleteAllByIndex('people', 'email', IDBKeyRange.only('old@example.com')).subscribe();
```

## clear

Removes every record and keeps the store and its indexes.

```ts
this.db.clear('people').subscribe(() => console.log('Store is empty'));
```

## openCursor

Emits one cursor per record. Call `cursor.continue()` to advance; the Observable completes when the transaction finishes. See [Cursors](/guide/querying#cursors).

```ts
this.db.openCursor<Person>({ storeName: 'people', mode: DBMode.readonly }).subscribe((cursor) => {
  console.log(cursor.value);
  cursor.continue();
});
```

## openCursorByIndex

```ts
this.db
  .openCursorByIndex<Person>({
    storeName: 'people',
    indexName: 'name',
    query: IDBKeyRange.only('Ada'),
    mode: DBMode.readwrite,
  })
  .subscribe((cursor) => {
    cursor.update({ ...cursor.value, verified: true });
    cursor.continue();
  });
```

## ready

Every method already waits for the database to be set up, so you only need this to hold something else until the database exists, such as app startup, a route, or a test. It also works in lazy-loaded routes and modules. See [Waiting until the database is ready](/guide/configuration#waiting-until-the-database-is-ready).

```ts
bootstrapApplication(App, {
  providers: [
    provideIndexedDb(dbConfig),
    provideAppInitializer(() => inject(NgxIndexedDBService).ready()),
  ],
});
```

## selectDb

Only needed when you register more than one database. See [Multiple databases](/guide/multiple-databases).

```ts
this.db.selectDb('cache');
```

## getDatabaseVersion

```ts
this.db.getDatabaseVersion().subscribe((version) => console.log(version));
```

## getAllObjectStoreNames

```ts
this.db.getAllObjectStoreNames().subscribe((names) => console.log(names)); // ['people']
```

## createObjectStore

Creates a store at runtime by upgrading the database to the next version. Prefer declaring stores in your `DBConfig`, which is easier to reason about.

```ts
await this.db.createObjectStore({
  store: 'notes',
  storeConfig: { keyPath: 'id', autoIncrement: true },
  storeSchema: [{ name: 'title', keypath: 'title', options: { unique: false } }],
});
```

## createDynamicObjectStore

Creates the store only if it doesn't exist, without increasing the version. It only takes effect during an upgrade, for example on a user's first visit.

```ts
await this.db.createDynamicObjectStore(notesSchema);
```

## deleteObjectStore

Deletes a store and all its records by upgrading the database to a new version.

```ts
this.db.deleteObjectStore('notes').subscribe();
```

## deleteDatabase

Fails with an error if another tab or connection keeps the database open.

```ts
this.db.deleteDatabase().subscribe(() => console.log('Database deleted'));
```

## DBMode

Pass it as `mode` when opening cursors. Use `readwrite` to update or delete records through the cursor.

## INDEXED_DB

The `IDBFactory` the service uses. Override it to supply your own implementation, for example in tests. See [SSR & testing](/guide/ssr).

## SERVER_INDEXED_DB

An `IDBFactory` to use during server-side rendering instead of the built-in placeholder. See [SSR & testing](/guide/ssr).
