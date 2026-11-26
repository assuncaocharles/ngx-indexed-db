import { Component, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { API, API_TYPES } from '../content/generated/api';
import { Heading } from '../content/content.model';
import { SeoService } from '../core/seo.service';
import { DocsLayout } from '../layout/docs-layout';
import { DocHtml } from '../shared/doc-html';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'docs-api-page',
  imports: [DocsLayout, DocHtml, RouterLink],
  template: `
    <docs-layout [headings]="headings">
      <div class="prose">
        <p class="eyebrow">Reference</p>
        <h1>API reference</h1>
        <p>
          Every method of <code>NgxIndexedDBService</code> returns a cold <code>Observable</code> (or a
          <code>Promise</code> where noted) and opens and closes its own connection. Signatures on this page are
          generated from the library's source code.
        </p>
      </div>

      @for (group of api; track group.id) {
        <section class="group">
          <h2 class="group__title" [id]="group.id">
            <a class="anchor" routerLink="/api" [fragment]="group.id" aria-hidden="true" tabindex="-1">#</a
            >{{ group.title }}
          </h2>

          @for (method of group.methods; track method.name) {
            <article class="member" [id]="method.name">
              <header class="member__header">
                <h3 class="member__name">
                  <a routerLink="/api" [fragment]="method.name">{{ method.name }}()</a>
                </h3>
                @if (method.summaryHtml) {
                  <p class="member__summary" [innerHTML]="method.summaryHtml"></p>
                }
              </header>

              <div class="code-block member__signature" [innerHTML]="method.signature"></div>

              @if (method.params.length) {
                <table class="params">
                  <thead>
                    <tr>
                      <th scope="col">Parameter</th>
                      <th scope="col">Type</th>
                      <th scope="col">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (param of method.params; track param.name) {
                      <tr>
                        <td>
                          <code class="params__name">{{ param.name }}</code>
                          @if (param.optional) {
                            <span class="badge">optional</span>
                          }
                        </td>
                        <td>
                          <code class="params__type">{{ param.type }}</code>
                        </td>
                        <td [innerHTML]="param.description || '—'"></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }

              <p class="member__returns">
                <span>Returns</span> <code>{{ method.returns }}</code>
                @if (method.returnsDoc) {
                  · {{ method.returnsDoc }}
                }
              </p>

              @if (method.bodyHtml) {
                <docs-html [html]="method.bodyHtml" />
              }
            </article>
          }
        </section>
      }

      <section class="group">
        <h2 class="group__title" id="types">
          <a class="anchor" routerLink="/api" fragment="types" aria-hidden="true" tabindex="-1">#</a>Types & tokens
        </h2>
        @for (type of types; track type.name) {
          <article class="member" [id]="type.name">
            <header class="member__header">
              <h3 class="member__name">
                <a routerLink="/api" [fragment]="type.name">{{ type.name }}</a>
                <span class="badge badge--kind">{{ type.kind }}</span>
              </h3>
              @if (type.summaryHtml) {
                <p class="member__summary" [innerHTML]="type.summaryHtml"></p>
              }
            </header>
            <div class="code-block member__signature" [innerHTML]="type.code"></div>
            @if (type.notes) {
              <docs-html [html]="type.notes" />
            }
          </article>
        }
      </section>
    </docs-layout>
  `,
  styles: `
    .group {
      margin-top: 56px;
    }
    .group__title {
      position: relative;
      margin: 0 0 8px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 26px;
      letter-spacing: -0.015em;
    }
    .group__title .anchor {
      position: absolute;
      left: -0.9em;
      color: var(--text-faint);
      font-weight: 400;
      opacity: 0;
      text-decoration: none;
    }
    .group__title:hover .anchor {
      opacity: 1;
    }
    .member {
      margin-top: 28px;
      padding: 24px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      scroll-margin-top: calc(var(--header-h) + 16px);
    }
    .member:target {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-soft);
    }
    .member__name {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 650;
    }
    .member__name a {
      color: var(--text);
      text-decoration: none;
    }
    .member__name a:hover {
      color: var(--accent-text);
    }
    .member__summary {
      margin: 8px 0 0;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .member__signature {
      margin: 16px 0;
    }
    .params {
      width: 100%;
      margin: 8px 0 12px;
      border-collapse: collapse;
      font-size: 14px;
      line-height: 1.5;
    }
    .params th {
      padding: 6px 10px 6px 0;
      border-bottom: 1px solid var(--border);
      color: var(--text-faint);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-align: left;
      text-transform: uppercase;
    }
    .params td {
      padding: 9px 10px 9px 0;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      vertical-align: top;
    }
    .params tr:last-child td {
      border-bottom: 0;
    }
    .params__name {
      color: var(--text);
      font-weight: 600;
    }
    .params__type {
      color: var(--accent-text);
      font-size: 13px;
      word-break: break-word;
    }
    .badge {
      display: inline-block;
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--bg-soft);
      color: var(--text-faint);
      font-family: var(--font-sans);
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
    }
    .badge--kind {
      margin: 0;
      background: var(--accent-soft);
      color: var(--accent-text);
    }
    .member__returns {
      margin: 4px 0 0;
      color: var(--text-muted);
      font-size: 14px;
    }
    .member__returns span {
      margin-right: 8px;
      color: var(--text-faint);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .member__returns code {
      color: var(--accent-text);
      font-size: 13px;
    }
    .member docs-html {
      margin-top: 8px;
    }
    @media (max-width: 640px) {
      .member {
        padding: 16px;
      }
      .params thead {
        display: none;
      }
      .params tr {
        display: grid;
        padding: 8px 0;
        border-bottom: 1px solid var(--border);
      }
      .params td {
        padding: 2px 0;
        border: 0;
      }
    }
  `,
})
export class ApiPage {
  private readonly sanitizer = inject(DomSanitizer);

  // Shiki output is generated at build time from this repository and needs its inline styles,
  // which Angular's sanitizer would otherwise strip.
  protected readonly api = API.map((group) => ({
    ...group,
    methods: group.methods.map((m) => ({ ...m, signature: this.sanitizer.bypassSecurityTrustHtml(m.signatureHtml) })),
  }));
  protected readonly types = API_TYPES.map((t) => ({ ...t, code: this.sanitizer.bypassSecurityTrustHtml(t.html) }));
  protected readonly headings: Heading[] = [
    ...API.map((g) => ({ id: g.id, text: g.title, level: 2 as const })),
    { id: 'types', text: 'Types & tokens', level: 2 },
  ];

  constructor() {
    inject(SeoService).set({
      title: 'API reference',
      description: 'Every method and type of ngx-indexed-db, generated from the source code.',
    });
  }
}
