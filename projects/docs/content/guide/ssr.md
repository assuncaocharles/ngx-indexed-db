---
title: SSR & testing
description: Use ngx-indexed-db with server-side rendering, prerendering and unit tests.
section: Guides
order: 6
---

# SSR & testing

## Server-side rendering

IndexedDB only exists in browsers. When your app renders on the server, through Angular SSR or prerendering, the library swaps in a placeholder IndexedDB implementation, so injecting `NgxIndexedDBService` never throws. This documentation site is itself prerendered with `ngx-indexed-db` installed.

The placeholder never stores or returns data. **On the server, the service's Observables never emit.** Run database work in the browser only, for example with `afterNextRender()`:

```ts
import { Component, afterNextRender, inject, signal } from '@angular/core';
import { NgxIndexedDBService } from 'ngx-indexed-db';

@Component({ /* … */ })
export class PeopleComponent {
  private readonly db = inject(NgxIndexedDBService);
  readonly people = signal<Person[]>([]);

  constructor() {
    afterNextRender(() => {
      this.db.getAll<Person>('people').subscribe((people) => this.people.set(people));
    });
  }
}
```

### Using a real implementation on the server

To run queries on the server, provide any [`IDBFactory`](https://developer.mozilla.org/docs/Web/API/IDBFactory) implementation, such as an in-memory one from [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB), through the `SERVER_INDEXED_DB` token. It is only used on the server; browsers keep using `window.indexedDB`.

```ts title="app.config.server.ts"
import { SERVER_INDEXED_DB } from 'ngx-indexed-db';
import { indexedDB } from 'fake-indexeddb';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(), { provide: SERVER_INDEXED_DB, useValue: indexedDB }],
};
```

## Unit tests

In a browser test runner, such as Angular's Vitest browser mode or Karma, provide the library as usual. Tests use the browser's real IndexedDB:

```ts
TestBed.configureTestingModule({
  providers: [provideIndexedDb(dbConfig)],
});
```

Give each test file its own database `name` so tests don't share data, or call `deleteDatabase()` after each test.

In a Node test environment such as jsdom, which has no IndexedDB, replace the implementation the service uses through the `INDEXED_DB` token:

```ts
import { INDEXED_DB, provideIndexedDb } from 'ngx-indexed-db';
import { indexedDB } from 'fake-indexeddb';

TestBed.configureTestingModule({
  providers: [provideIndexedDb(dbConfig), { provide: INDEXED_DB, useValue: indexedDB }],
});
```
