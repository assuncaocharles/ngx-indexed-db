import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SITE = 'ngx-indexed-db';

/** Sets the document title and description meta tags for the current page. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  set(page: { title?: string; description: string }): void {
    const title = page.title ? `${page.title} · ${SITE}` : `${SITE}: IndexedDB for Angular`;
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
  }
}
