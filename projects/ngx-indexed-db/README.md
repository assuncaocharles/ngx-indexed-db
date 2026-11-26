# ngx-indexed-db

[![npm](https://img.shields.io/npm/v/ngx-indexed-db)](https://www.npmjs.com/package/ngx-indexed-db) [![Docs](https://img.shields.io/badge/docs-github%20pages-6246ea)](https://assuncaocharles.github.io/ngx-indexed-db/) [![Build](https://github.com/assuncaocharles/ngx-indexed-db/actions/workflows/buid.yml/badge.svg?branch=master)](https://github.com/assuncaocharles/ngx-indexed-db/actions/workflows/buid.yml) [![Known Vulnerabilities](https://snyk.io/test/github/assuncaocharles/ngx-indexed-db/badge.svg)](https://snyk.io/test/github/assuncaocharles/ngx-indexed-db) [![CodeFactor](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/badge/master)](https://www.codefactor.io/repository/github/assuncaocharles/ngx-indexed-db/overview/master)

IndexedDB for Angular, without the plumbing. Describe your database once and get a typed, Observable-based service that opens connections, creates stores and indexes, runs migrations and works with server-side rendering.

## 📖 Documentation

**https://assuncaocharles.github.io/ngx-indexed-db/**

Guides, the full API reference (generated from the source) and a live playground that runs the library in your browser:

- [Getting started](https://assuncaocharles.github.io/ngx-indexed-db/guide/getting-started)
- [Configuration](https://assuncaocharles.github.io/ngx-indexed-db/guide/configuration): stores, indexes, waiting until the database is ready
- [Querying data](https://assuncaocharles.github.io/ngx-indexed-db/guide/querying): keys, indexes, key ranges, cursors
- [Migrations](https://assuncaocharles.github.io/ngx-indexed-db/guide/migrations)
- [Multiple databases](https://assuncaocharles.github.io/ngx-indexed-db/guide/multiple-databases)
- [SSR & testing](https://assuncaocharles.github.io/ngx-indexed-db/guide/ssr)
- [API reference](https://assuncaocharles.github.io/ngx-indexed-db/api)
- [Playground](https://assuncaocharles.github.io/ngx-indexed-db/playground)

## Features

- **Observable API**: every operation returns a cold `Observable`; writes emit once their transaction has committed.
- **Typed**: generic methods carry your record types through reads, writes, cursors and index keys.
- **Schema as config**: stores and indexes are created from your config, including indexes added to existing stores in a new version.
- **Migrations**: version your schema and run only the upgrades each user needs.
- **SSR safe**: renders on the server without IndexedDB, with an optional server-side implementation.
- **Standalone or NgModule**: `provideIndexedDb()` or `NgxIndexedDBModule.forRoot()`, with one or several databases.

## Installation

```bash
npm install ngx-indexed-db
```

| ngx-indexed-db | Angular     |
| -------------- | ----------- |
| 23.x           | 16.x – 22.x |

## Quick start

Describe your database and register it:

```ts
import { ApplicationConfig } from '@angular/core';
import { DBConfig, provideIndexedDb } from 'ngx-indexed-db';

const dbConfig: DBConfig = {
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

export const appConfig: ApplicationConfig = {
  providers: [provideIndexedDb(dbConfig)],
};
```

With NgModules, use `NgxIndexedDBModule.forRoot(dbConfig)` in `imports` instead.

Then inject the service and use it:

```ts
import { Injectable, inject } from '@angular/core';
import { NgxIndexedDBService } from 'ngx-indexed-db';

interface Person {
  id?: number;
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly db = inject(NgxIndexedDBService);

  add(person: Person) {
    return this.db.add<Person>('people', person); // emits the stored record, with its id
  }

  findByEmail(email: string) {
    return this.db.getByIndex<Person>('people', 'email', email);
  }

  all() {
    return this.db.getAll<Person>('people');
  }
}
```

Every method and its options are in the [API reference](https://assuncaocharles.github.io/ngx-indexed-db/api).

## License

Released under the terms of the [MIT License](https://github.com/assuncaocharles/ngx-indexed-db/blob/master/LICENSE).
