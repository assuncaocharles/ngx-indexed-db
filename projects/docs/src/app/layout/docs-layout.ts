import { Component, inject, input } from '@angular/core';
import { Heading } from '../content/content.model';
import { UiStateService } from '../core/ui-state.service';
import { Sidebar } from './sidebar';
import { Toc } from './toc';

/** Three-column documentation layout: navigation, article, table of contents. */
@Component({
  selector: 'docs-layout',
  imports: [Sidebar, Toc],
  template: `
    <div class="layout">
      <aside class="layout__sidebar" [class.is-open]="ui.navOpen()">
        <docs-sidebar />
      </aside>
      @if (ui.navOpen()) {
        <button
          class="layout__scrim"
          type="button"
          aria-label="Close navigation"
          (click)="ui.navOpen.set(false)"
        ></button>
      }
      <main class="layout__main" id="main">
        <ng-content />
      </main>
      <aside class="layout__toc">
        <docs-toc [headings]="headings()" />
      </aside>
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: var(--sidebar-w) minmax(0, 1fr) var(--toc-w);
      gap: 48px;
      max-width: 1440px;
      margin: 0 auto;
      padding: 0 24px;
    }
    .layout__sidebar,
    .layout__toc {
      position: sticky;
      top: var(--header-h);
      align-self: start;
      max-height: calc(100vh - var(--header-h));
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    .layout__main {
      min-width: 0;
      max-width: var(--content-max);
      padding: 40px 0 96px;
    }
    .layout__scrim {
      display: none;
    }
    @media (max-width: 1200px) {
      .layout {
        grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
      }
      .layout__toc {
        display: none;
      }
    }
    @media (max-width: 960px) {
      .layout {
        display: block;
        padding: 0 20px;
      }
      .layout__main {
        margin: 0 auto;
        padding-top: 28px;
      }
      .layout__sidebar {
        position: fixed;
        top: var(--header-h);
        bottom: 0;
        left: 0;
        z-index: 40;
        width: min(300px, 85vw);
        max-height: none;
        /* The desktop rule's align-self: start would size the fixed drawer to its content
           (and shift it under the header) instead of stretching it between top and bottom. */
        align-self: stretch;
        padding-left: 16px;
        border-right: 1px solid var(--border);
        background: var(--bg);
        box-shadow: var(--shadow-lg);
        transform: translateX(-105%);
        transition: transform 0.22s ease;
      }
      .layout__sidebar.is-open {
        transform: none;
      }
      .layout__scrim {
        display: block;
        position: fixed;
        inset: var(--header-h) 0 0;
        z-index: 39;
        border: 0;
        background: rgb(0 0 0 / 35%);
      }
    }
    @media (max-width: 640px) {
      .layout {
        padding: 0 16px;
      }
    }
  `,
})
export class DocsLayout {
  readonly headings = input<Heading[]>([]);
  protected readonly ui = inject(UiStateService);
}
