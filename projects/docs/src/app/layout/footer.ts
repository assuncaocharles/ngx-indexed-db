import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'docs-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__brand">
          <img src="favicon.svg" width="22" height="22" alt="" />
          <span>ngx-indexed-db</span>
        </div>
        <nav class="footer__links" aria-label="Footer">
          <a routerLink="/guide/getting-started">Guide</a>
          <a routerLink="/api">API</a>
          <a routerLink="/playground">Playground</a>
          <a href="https://github.com/assuncaocharles/ngx-indexed-db" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/ngx-indexed-db" target="_blank" rel="noopener">npm</a>
        </nav>
        <p class="footer__note">
          Released under the MIT License. This site is built with Angular and prerendered using ngx-indexed-db's own SSR
          support.
        </p>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      border-top: 1px solid var(--border);
      background: var(--bg-soft);
    }
    .footer__inner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px 32px;
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 24px;
    }
    .footer__brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
    }
    .footer__brand img {
      border-radius: 6px;
    }
    .footer__links {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .footer__links a {
      color: var(--text-muted);
      font-size: 14px;
    }
    .footer__links a:hover {
      color: var(--text);
    }
    .footer__note {
      flex-basis: 100%;
      margin: 0;
      color: var(--text-faint);
      font-size: 13px;
    }
  `,
})
export class Footer {}
