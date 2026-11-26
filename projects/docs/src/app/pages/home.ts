import { Component, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { API_INDEX, VERSION } from '../content/generated/meta';
import { SNIPPETS } from '../content/generated/snippets';
import { SeoService } from '../core/seo.service';
import { copyCode } from '../shared/doc-html';

interface Feature {
  title: string;
  text: string;
  link: string;
  fragment?: string;
  icon: string;
}

@Component({
  selector: 'docs-home',
  imports: [RouterLink],
  template: `
    <main>
      <section class="hero">
        <div class="hero__glow" aria-hidden="true"></div>
        <div class="container hero__grid">
          <div class="hero__copy">
            <a class="pill" routerLink="/guide/getting-started">
              <span class="pill__tag">v{{ version }}</span>
              Angular 16 – 22, standalone & SSR ready
              <span aria-hidden="true">→</span>
            </a>
            <h1 class="hero__title">IndexedDB for Angular, <span class="gradient-text">without the plumbing.</span></h1>
            <p class="hero__lede">
              Describe your database once. Get a typed, Observable-based service that opens connections, creates stores
              and indexes, runs migrations and works safely with server-side rendering.
            </p>
            <div class="hero__actions">
              <a class="btn btn--primary" routerLink="/guide/getting-started">Get started</a>
              <a class="btn" routerLink="/playground">Try the playground</a>
            </div>
            <div class="code-block install">
              <div class="install__row">
                <span class="install__prompt" aria-hidden="true">$</span>
                <pre class="install__cmd">npm install ngx-indexed-db</pre>
                <button type="button" class="code-block__copy" data-copy (click)="copy($event)">Copy</button>
              </div>
            </div>
          </div>

          <div class="window" aria-label="Code example">
            <div class="window__bar">
              <span class="window__dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <div class="window__tabs" role="tablist">
                @for (tab of tabs; track tab.id) {
                  <button
                    type="button"
                    role="tab"
                    [attr.aria-selected]="activeTab() === tab.id"
                    [class.is-active]="activeTab() === tab.id"
                    (click)="activeTab.set(tab.id)"
                  >
                    {{ tab.label }}
                  </button>
                }
              </div>
            </div>
            @for (tab of tabs; track tab.id) {
              <div class="window__code" role="tabpanel" [hidden]="activeTab() !== tab.id" [innerHTML]="tab.html"></div>
            }
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <p class="eyebrow">Why ngx-indexed-db</p>
          <h2 class="section__title">The browser database, the Angular way</h2>
          <div class="features">
            @for (feature of features; track feature.title) {
              <a class="feature" [routerLink]="feature.link" [fragment]="feature.fragment">
                <span class="feature__icon" [innerHTML]="feature.icon" aria-hidden="true"></span>
                <h3>{{ feature.title }}</h3>
                <p>{{ feature.text }}</p>
              </a>
            }
          </div>
        </div>
      </section>

      <section class="section section--soft">
        <div class="container">
          <p class="eyebrow">One method per operation</p>
          <h2 class="section__title">Everything you need, nothing you don't</h2>
          <p class="section__lede">
            {{ methodCount }} methods covering reads, writes, indexes, key ranges, cursors and schema changes.
          </p>
          <div class="methods">
            @for (method of methods; track method) {
              <a class="method" routerLink="/api" [fragment]="method">{{ method }}()</a>
            }
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="cta">
            <div>
              <h2>See it running in your browser</h2>
              <p>
                The playground uses the real library against your browser's IndexedDB. Add, query and delete records,
                and watch every call.
              </p>
            </div>
            <a class="btn btn--primary" routerLink="/playground">Open the playground</a>
          </div>
        </div>
      </section>
    </main>
  `,
  styleUrl: './home.css',
})
export class Home {
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly version = VERSION;
  protected readonly activeTab = signal('config');
  protected readonly tabs = [
    { id: 'config', label: 'app.config.ts', html: this.sanitizer.bypassSecurityTrustHtml(SNIPPETS['config']) },
    { id: 'usage', label: 'people.service.ts', html: this.sanitizer.bypassSecurityTrustHtml(SNIPPETS['usage']) },
  ];

  protected readonly methods = API_INDEX.flatMap((g) => g.methods);
  protected readonly methodCount = this.methods.length;

  protected readonly features = FEATURES.map((f) => ({ ...f, icon: this.sanitizer.bypassSecurityTrustHtml(f.icon) }));

  constructor() {
    inject(SeoService).set({
      description:
        'A typed, Observable-based Angular service for IndexedDB, with migrations, SSR support and a tiny API.',
    });
  }

  protected copy(event: MouseEvent): void {
    copyCode(event.currentTarget as HTMLElement);
  }
}

const FEATURES: Feature[] = [
  {
    title: 'Observable API',
    text: 'Every operation returns a cold Observable, ready for the async pipe, toSignal() or RxJS operators.',
    link: '/guide/getting-started',
    icon: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  },
  {
    title: 'Fully typed',
    text: 'Generic methods carry your record types through reads, writes, cursors and index keys.',
    link: '/api',
    icon: '<svg viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
  },
  {
    title: 'Schema migrations',
    text: 'Version your schema and ship upgrade functions. Only the migrations a user needs are run.',
    link: '/guide/migrations',
    icon: '<svg viewBox="0 0 24 24"><path d="M4 7h11l-3-3M20 17H9l3 3"/></svg>',
  },
  {
    title: 'SSR & prerender safe',
    text: 'A server-side IndexedDB placeholder keeps universal apps rendering, or plug in your own.',
    link: '/guide/ssr',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
  },
  {
    title: 'Standalone or NgModule',
    text: 'provideIndexedDb() for standalone apps, NgxIndexedDBModule.forRoot() for module-based ones.',
    link: '/guide/getting-started',
    fragment: 'register-the-provider',
    icon: '<svg viewBox="0 0 24 24"><path d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5"/></svg>',
  },
  {
    title: 'Multiple databases',
    text: 'Register several databases, mark a default and switch between them with selectDb().',
    link: '/guide/multiple-databases',
    icon: '<svg viewBox="0 0 24 24"><ellipse cx="9" cy="6" rx="6" ry="2.5"/><path d="M3 6v6c0 1.4 2.7 2.5 6 2.5M15 6v3"/><ellipse cx="15" cy="13" rx="6" ry="2.5"/><path d="M9 13v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5"/></svg>',
  },
];
