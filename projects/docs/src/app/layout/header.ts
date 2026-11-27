import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { ThemeService } from '../core/theme.service';
import { UiStateService } from '../core/ui-state.service';
import { VERSION } from '../content/generated/meta';

@Component({
  selector: 'docs-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="header__inner">
        @if (showMenu()) {
          <button
            class="icon-btn header__menu"
            type="button"
            aria-label="Open navigation"
            [attr.aria-expanded]="ui.navOpen()"
            (click)="ui.navOpen.set(!ui.navOpen())"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        }

        <a class="brand" routerLink="/" aria-label="ngx-indexed-db home">
          <img src="favicon.svg" width="28" height="28" alt="" />
          <span class="brand__name">ngx-indexed-db</span>
          <span class="brand__version">v{{ version }}</span>
        </a>

        <nav class="nav" aria-label="Main">
          <a routerLink="/guide/getting-started" [class.is-active]="inGuide()">Guide</a>
          <a routerLink="/api" routerLinkActive="is-active">API</a>
          <a routerLink="/playground" routerLinkActive="is-active">Playground</a>
        </nav>

        <div class="header__actions">
          <button
            class="search-trigger"
            type="button"
            (click)="ui.searchOpen.set(true)"
            aria-label="Search documentation"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span class="search-trigger__label">Search</span>
            <kbd class="search-trigger__kbd">⌘K</kbd>
          </button>

          <button
            class="icon-btn"
            type="button"
            (click)="theme.toggle()"
            [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          >
            @if (theme.theme() === 'dark') {
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <circle cx="12" cy="12" r="4.5" />
                <path
                  d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                />
              </svg>
            } @else {
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
              </svg>
            }
          </button>

          <a
            class="icon-btn"
            href="https://github.com/assuncaocharles/ngx-indexed-db"
            target="_blank"
            rel="noopener"
            aria-label="GitHub repository"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"
              />
            </svg>
          </a>
        </div>
      </div>
    </header>
  `,
  styles: `
    /* The host is the element in the page flow, so it is the one that has to stick:
       a sticky child of a 64px-tall host would scroll away with it. */
    :host {
      position: sticky;
      top: 0;
      z-index: 50;
      display: block;
    }
    .header {
      height: var(--header-h);
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--bg) 82%, transparent);
      backdrop-filter: saturate(180%) blur(14px);
      -webkit-backdrop-filter: saturate(180%) blur(14px);
    }
    .header__inner {
      display: flex;
      align-items: center;
      gap: 24px;
      height: 100%;
      max-width: 1440px;
      margin: 0 auto;
      padding: 0 24px;
    }
    .header__menu {
      display: none;
      margin-left: -8px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text);
      text-decoration: none !important;
    }
    .brand img {
      border-radius: 7px;
    }
    .brand__name {
      font-size: 16px;
      font-weight: 750;
      letter-spacing: -0.01em;
    }
    .brand__version {
      padding: 1px 7px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 11.5px;
    }
    .nav {
      display: flex;
      gap: 4px;
    }
    .nav a {
      padding: 6px 12px;
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 14.5px;
      font-weight: 550;
      text-decoration: none;
      transition:
        color 0.15s,
        background 0.15s;
    }
    .nav a:hover {
      color: var(--text);
      background: var(--bg-soft);
    }
    .nav a.is-active {
      color: var(--accent-text);
    }
    .header__actions {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
    }
    .search-trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 220px;
      height: 36px;
      margin-right: 8px;
      padding: 0 8px 0 12px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: var(--bg-soft);
      color: var(--text-faint);
      font-size: 14px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .search-trigger:hover {
      border-color: var(--border-strong);
    }
    .search-trigger__kbd {
      margin-left: auto;
    }
    @media (max-width: 960px) {
      .header__menu {
        display: inline-grid;
      }
      .search-trigger {
        width: auto;
        margin-right: 0;
        padding: 0 10px;
        border-color: transparent;
        background: transparent;
      }
      .search-trigger__label,
      .search-trigger__kbd {
        display: none;
      }
    }
    @media (max-width: 720px) {
      .header__inner {
        gap: 12px;
        padding: 0 12px;
      }
      .nav {
        display: none;
      }
      .brand__version {
        display: none;
      }
    }
  `,
})
export class Header {
  /** Shows the hamburger that opens the sidebar on small screens (docs pages only). */
  readonly showMenu = input(false);

  protected readonly theme = inject(ThemeService);
  protected readonly ui = inject(UiStateService);
  protected readonly version = VERSION;

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly inGuide = computed(() => this.url().startsWith('/guide'));
}
