---
title: Querying data
description: Read records by key or index, filter with key ranges and stream large result sets with cursors.
section: Guides
order: 3
---

# Querying data

## By primary key

```ts
this.db.getByKey<Person>('people', 1).subscribe((person) => {
  // undefined when there is no record with that key
});

this.db.bulkGet<Person>('people', [1, 2, 3]).subscribe((people) => {});

this.db.getAll<Person>('people').subscribe((everyone) => {});
```

## By index

Indexes, declared in your [configuration](/guide/configuration#indexes), let you query by any property you indexed:

```ts
// First record whose email matches
this.db.getByIndex<Person>('people', 'email', 'ada@example.com').subscribe();

// Every matching record
this.db.getAllByIndex<Person>('people', 'name', IDBKeyRange.only('Ada')).subscribe();

// Only the primary and index keys, without loading the records
this.db.getAllKeysByIndex('people', 'name').subscribe((keys) => {
  // [{ primaryKey: 1, key: 'Ada' }, …]
});
```

## Key ranges

Most query methods accept an [`IDBKeyRange`](https://developer.mozilla.org/docs/Web/API/IDBKeyRange) in place of a single key:

```ts
IDBKeyRange.only('Ada'); // exactly 'Ada'
IDBKeyRange.lowerBound(18); // >= 18
IDBKeyRange.upperBound(65, true); // < 65
IDBKeyRange.bound('A', 'F', false, true); // 'A' <= key < 'F'
```

For example, to count adults through an `age` index:

```ts
this.db.countByIndex('people', 'age', IDBKeyRange.lowerBound(18)).subscribe((adults) => {});
```

## Sorting

Results come back in key order. Pass a direction to `getAllByIndex()` to reverse it, or to skip duplicate index values:

```ts
this.db.getAllByIndex<Person>('people', 'name', null, 'prev').subscribe(); // Z → A
```

The directions are `'next'` (the default), `'prev'`, `'nextunique'` and `'prevunique'`.

## Cursors

Cursors walk through records one at a time, which avoids loading a large store into memory at once. The Observable emits a cursor for each record. **Call `cursor.continue()` to move to the next one**; the Observable completes once the transaction finishes.

```ts
import { DBMode } from 'ngx-indexed-db';

this.db
  .openCursor<Person>({ storeName: 'people', mode: DBMode.readonly })
  .subscribe((cursor) => {
    console.log(cursor.primaryKey, cursor.value);
    cursor.continue();
  });
```

Open the cursor with `DBMode.readwrite` to change records as you go:

```ts
this.db
  .openCursorByIndex<Person>({
    storeName: 'people',
    indexName: 'email',
    query: IDBKeyRange.bound('a', 'n'),
    mode: DBMode.readwrite,
  })
  .subscribe((cursor) => {
    cursor.update({ ...cursor.value, verified: true });
    cursor.continue();
  });
```

> [!WARNING]
> IndexedDB transactions close automatically as soon as no requests are pending. Call `cursor.continue()` synchronously inside your subscriber: if you `await` something else first, the transaction may already be closed.
