import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SeoService } from './core/seo.service';
import { UiStateService } from './core/ui-state.service';
import { Footer } from './layout/footer';
import { Header } from './layout/header';
import { SearchDialog } from './layout/search-dialog';

@Component({
  selector: 'docs-root',
  imports: [RouterOutlet, Header, Footer, SearchDialog],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <docs-header [showMenu]="isDocsPage()" />
    <router-outlet />
    <docs-footer />
    <docs-search-dialog />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    router-outlet + * {
      flex: 1;
    }
    .skip-link {
      position: absolute;
      top: -100px;
      left: 16px;
      z-index: 100;
      padding: 8px 14px;
      border-radius: 8px;
      background: var(--accent);
      color: #fff;
    }
    .skip-link:focus {
      top: 12px;
    }
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly ui = inject(UiStateService);
  private readonly seo = inject(SeoService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => {
        this.ui.navOpen.set(false);
        this.seo.setUrl(e.urlAfterRedirects);
        return e.urlAfterRedirects;
      }),
    ),
    { initialValue: this.router.url },
  );

  protected isDocsPage(): boolean {
    const url = this.url();
    return url.startsWith('/guide') || url.startsWith('/api');
  }
}
