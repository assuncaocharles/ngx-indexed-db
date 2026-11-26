import { Component, DestroyRef, PLATFORM_ID, afterRenderEffect, inject, input, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Heading } from '../content/content.model';

/** "On this page" navigation that highlights the section currently in view. */
@Component({
  selector: 'docs-toc',
  imports: [RouterLink],
  template: `
    @if (headings().length) {
      <nav class="toc" aria-label="On this page">
        <p class="toc__title">On this page</p>
        <ul>
          @for (h of headings(); track h.id) {
            <li [class.toc__sub]="h.level === 3">
              <a [routerLink]="[]" [fragment]="h.id" [class.is-active]="active() === h.id">{{ h.text }}</a>
            </li>
          }
        </ul>
      </nav>
    }
  `,
  styles: `
    .toc {
      padding: 32px 0 48px;
    }
    .toc__title {
      margin: 0 0 10px;
      color: var(--text);
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    ul {
      margin: 0;
      padding: 0;
      border-left: 1px solid var(--border);
      list-style: none;
    }
    a {
      display: block;
      margin-left: -1px;
      padding: 4px 0 4px 14px;
      border-left: 2px solid transparent;
      color: var(--text-muted);
      font-size: 13.5px;
      line-height: 1.45;
      text-decoration: none;
      transition:
        color 0.15s,
        border-color 0.15s;
    }
    .toc__sub a {
      padding-left: 26px;
      font-size: 13px;
    }
    a:hover {
      color: var(--text);
    }
    a.is-active {
      border-left-color: var(--accent);
      color: var(--accent-text);
      font-weight: 600;
    }
  `,
})
export class Toc {
  readonly headings = input.required<Heading[]>();
  protected readonly active = signal<string | null>(null);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer?: IntersectionObserver;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());

    // Re-observe whenever the page (and so the list of headings) changes.
    afterRenderEffect(() => {
      const headings = this.headings();
      if (!this.isBrowser) return;
      this.observer?.disconnect();
      const visible = new Set<string>();
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target.id);
            else visible.delete(entry.target.id);
          }
          const first = headings.find((h) => visible.has(h.id));
          if (first) this.active.set(first.id);
        },
        { rootMargin: '-72px 0px -65% 0px' },
      );
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el) this.observer.observe(el);
      }
      this.active.set(headings[0]?.id ?? null);
    });
  }
}
