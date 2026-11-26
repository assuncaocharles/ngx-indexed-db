import { Routes } from '@angular/router';
import { provideIndexedDb } from 'ngx-indexed-db';
import { PLAYGROUND_DB } from './playground.config';
import { Playground } from './playground';

/** The playground is the only page that talks to IndexedDB, so the library is only loaded here. */
export const PLAYGROUND_ROUTES: Routes = [
  { path: '', providers: [provideIndexedDb(PLAYGROUND_DB)], component: Playground },
];
