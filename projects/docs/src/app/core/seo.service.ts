import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SITE = 'ngx-indexed-db';
/** Public URL of the deployed docs; social previews and canonical links need absolute URLs. */
export const SITE_URL = 'https://assuncaocharles.github.io/ngx-indexed-db';

/** Sets the title, description, canonical URL and social preview tags for the current page. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  set(page: { title?: string; description: string }): void {
    const title = page.title ? `${page.title} · ${SITE}` : `${SITE}: IndexedDB for Angular`;
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
  }

  /** Points og:url and the canonical link at the current route, e.g. `/guide/migrations`. */
  setUrl(path: string): void {
    const clean = path.split(/[?#]/)[0].replace(/\/$/, '');
    const url = `${SITE_URL}${clean}/`.replace(/\/\/$/, '/');
    this.meta.updateTag({ property: 'og:url', content: url });

    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }
}
