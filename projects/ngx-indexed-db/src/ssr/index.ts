import { assertInInjectionContext, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { SERVER_INDEXED_DB } from '../lib/ngx-indexed-db.meta';
import { ServerIndexedDB } from './server-indexed-db';

/**
 * Factory function for creating an instance of IDBFactory.
 *
 * It determines the platform using the {@link PLATFORM_ID} to decide whether to use the
 * browser's IndexedDB or a server-side implementation.
 *
 * @returns {IDBFactory} IDBFactory.
 */
export function indexedDbFactory(): IDBFactory {
  assertInInjectionContext(indexedDbFactory);
  const platformId = inject(PLATFORM_ID);
  const serverIndexedDB = inject(SERVER_INDEXED_DB, { optional: true }) ?? new ServerIndexedDB();
  return isPlatformBrowser(platformId) ? inject(DOCUMENT).defaultView.indexedDB : serverIndexedDB;
}
