import { Injectable, signal } from '@angular/core';

/** Cross-component UI state: the mobile navigation drawer and the search dialog. */
@Injectable({ providedIn: 'root' })
export class UiStateService {
  readonly navOpen = signal(false);
  readonly searchOpen = signal(false);
}
