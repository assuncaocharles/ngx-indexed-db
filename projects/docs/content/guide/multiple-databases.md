---
title: Multiple databases
description: Register several databases and switch between them.
section: Guides
order: 5
---

# Multiple databases

Pass several configs to register more than one database:

```ts title="app.config.ts"
import { provideIndexedDb } from 'ngx-indexed-db';

export const appConfig: ApplicationConfig = {
  providers: [provideIndexedDb(appDbConfig, cacheDbConfig)],
};
```

`NgxIndexedDBModule.forRoot(appDbConfig, cacheDbConfig)` works the same way.

## The default database

With a single config, that database is used automatically. With several, mark one as the default:

```ts
export const appDbConfig: DBConfig = {
  name: 'app',
  version: 1,
  isDefault: true,
  objectStoresMeta: [/* … */],
};
```

Only one config can set `isDefault`; marking two as default is reported as an error.

## Switching databases

`selectDb()` switches the database that later calls run against. Called without a name, it switches back to the default database:

```ts
this.db.selectDb('cache');
this.db.getAll('responses').subscribe(); // reads from "cache"

this.db.selectDb(); // back to the default database
```

> [!WARNING]
> `NgxIndexedDBService` is a single shared instance, so `selectDb()` changes the active database for every component and service that injects it. Select the database right before the calls that need it, and switch back afterwards.

If you register several databases without a default and never call `selectDb()`, the service has no database to use, so call `selectDb()` before your first query.
