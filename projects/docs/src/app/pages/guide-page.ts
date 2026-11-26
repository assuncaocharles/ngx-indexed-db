import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDES } from '../content/generated/guides';
import { GUIDE_ORDER } from '../content/nav';
import { SeoService } from '../core/seo.service';
import { DocsLayout } from '../layout/docs-layout';
import { DocHtml } from '../shared/doc-html';
import { NotFound } from './not-found';

const EDIT_BASE = 'https://github.com/assuncaocharles/ngx-indexed-db/edit/master/projects/docs/content/guide/';

@Component({
  selector: 'docs-guide-page',
  imports: [DocsLayout, DocHtml, RouterLink, NotFound],
  template: `
    @if (page(); as page) {
      <docs-layout [headings]="page.headings">
        <p class="eyebrow">{{ page.section }}</p>
        <docs-html [html]="page.html" />

        <footer class="page-footer">
          <a class="page-footer__edit" [href]="editUrl()" target="_blank" rel="noopener">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Edit this page on GitHub
          </a>

          <nav class="pager" aria-label="Pagination">
            @if (prev(); as prev) {
              <a class="pager__link" [routerLink]="prev.path">
                <span class="pager__label">Previous</span>
                <span class="pager__title">← {{ prev.label }}</span>
              </a>
            } @else {
              <span></span>
            }
            @if (next(); as next) {
              <a class="pager__link pager__link--next" [routerLink]="next.path">
                <span class="pager__label">Next</span>
                <span class="pager__title">{{ next.label }} →</span>
              </a>
            } @else {
              <a class="pager__link pager__link--next" routerLink="/api">
                <span class="pager__label">Next</span>
                <span class="pager__title">API reference →</span>
              </a>
            }
          </nav>
        </footer>
      </docs-layout>
    } @else {
      <docs-not-found />
    }
  `,
  styles: `
    .page-footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .page-footer__edit {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-muted);
      font-size: 14px;
    }
    .pager {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 28px;
    }
    .pager__link {
      display: grid;
      gap: 2px;
      padding: 14px 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      text-decoration: none !important;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }
    .pager__link:hover {
      border-color: var(--accent);
      box-shadow: var(--shadow-md);
    }
    .pager__link--next {
      text-align: right;
    }
    .pager__label {
      color: var(--text-faint);
      font-size: 12.5px;
    }
    .pager__title {
      color: var(--accent-text);
      font-weight: 600;
    }
    @media (max-width: 560px) {
      .pager {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class GuidePage {
  /** Bound from the `:slug` route parameter. */
  readonly slug = input.required<string>();

  protected readonly page = computed(() => GUIDES.find((g) => g.slug === this.slug()));
  private readonly index = computed(() => GUIDE_ORDER.findIndex((g) => g.path === `/guide/${this.slug()}`));
  protected readonly prev = computed(() => GUIDE_ORDER[this.index() - 1]);
  protected readonly next = computed(() => GUIDE_ORDER[this.index() + 1]);
  protected readonly editUrl = computed(() => `${EDIT_BASE}${this.slug()}.md`);

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const page = this.page();
      seo.set(page ? { title: page.title, description: page.description } : { title: 'Not found', description: '' });
    });
  }
}
