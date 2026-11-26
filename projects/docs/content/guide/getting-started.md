---
title: Getting started
description: Install ngx-indexed-db, describe your database and run your first query.
section: Introduction
order: 1
---

# Getting started

`ngx-indexed-db` wraps the browser's [IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API) in an Angular service with an Observable API. You describe your database once, and the library opens connections, creates object stores and indexes, runs migrations and closes connections for you.

## Installation

```bash
npm install ngx-indexed-db
```

| ngx-indexed-db | Angular     |
| -------------- | ----------- |
| 23.x           | 16.x – 22.x |

## Describe your database

A `DBConfig` names the database, sets its version and lists the object stores to create. Each store has a primary key and any number of indexes you want to query by.

```ts title="db.config.ts"
import { DBConfig } from 'ngx-indexed-db';

export const dbConfig: DBConfig = {
  name: 'MyDb',
  version: 1,
  objectStoresMeta: [
    {
      store: 'people',
      storeConfig: { keyPath: 'id', autoIncrement: true },
      storeSchema: [
        { name: 'name', keypath: 'name', options: { unique: false } },
        { name: 'email', keypath: 'email', options: { unique: true } },
      ],
    },
  ],
};
```

See [Configuration](/guide/configuration) for every option.

## Register the provider

### Standalone applications

```ts title="app.config.ts"
import { ApplicationConfig } from '@angular/core';
import { provideIndexedDb } from 'ngx-indexed-db';
import { dbConfig } from './db.config';

export const appConfig: ApplicationConfig = {
  providers: [provideIndexedDb(dbConfig)],
};
```

### NgModule applications

```ts title="app.module.ts"
import { NgModule } from '@angular/core';
import { NgxIndexedDBModule } from 'ngx-indexed-db';
import { dbConfig } from './db.config';

@NgModule({
  imports: [NgxIndexedDBModule.forRoot(dbConfig)],
})
export class AppModule {}
```

## Use the service

Inject `NgxIndexedDBService` and call its methods. Each one returns an `Observable` that emits once and completes. Methods that write data emit only after their transaction has committed, so when you get the result, the data is saved.

```ts title="people.component.ts"
import { Component, inject } from '@angular/core';
import { NgxIndexedDBService } from 'ngx-indexed-db';

interface Person {
  id?: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-people',
  template: `<button (click)="addPerson()">Add</button>`,
})
export class PeopleComponent {
  private readonly db = inject(NgxIndexedDBService);

  addPerson() {
    this.db
      .add<Person>('people', { name: 'Ada Lovelace', email: 'ada@example.com' })
      .subscribe((person) => console.log('Stored with id', person.id));
  }
}
```

> [!IMPORTANT]
> The Observables are **cold**: nothing touches the database until you subscribe. Use `subscribe()`, the `async` pipe, `toSignal()` or `firstValueFrom()`, depending on how you consume the result.

## Next steps

- [Querying data](/guide/querying): keys, indexes, key ranges and cursors.
- [Migrations](/guide/migrations): change your schema between versions.
- [API reference](/api): every method and type.
- [Playground](/playground): try the API live, in your browser.
