import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../core/seo.service';
import { UiStateService } from '../core/ui-state.service';

@Component({
  selector: 'docs-not-found',
  imports: [RouterLink],
  template: `
    <main class="not-found">
      <p class="not-found__code gradient-text">404</p>
      <h1>This page doesn't exist</h1>
      <p>It may have moved when the documentation was rebuilt.</p>
      <div class="not-found__actions">
        <a class="btn btn--primary" routerLink="/">Go home</a>
        <button class="btn" type="button" (click)="ui.searchOpen.set(true)">Search the docs</button>
      </div>
    </main>
  `,
  styles: `
    .not-found {
      display: grid;
      justify-items: center;
      padding: 120px 24px;
      text-align: center;
    }
    .not-found__code {
      margin: 0;
      font-size: 96px;
      font-weight: 850;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    h1 {
      margin: 16px 0 8px;
      font-size: 28px;
    }
    p {
      margin: 0;
      color: var(--text-muted);
    }
    .not-found__actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
    }
  `,
})
export class NotFound {
  protected readonly ui = inject(UiStateService);

  constructor() {
    inject(SeoService).set({ title: 'Page not found', description: 'This page does not exist.' });
  }
}
