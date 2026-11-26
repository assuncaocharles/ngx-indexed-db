import { Component, ElementRef, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';

/**
 * Renders build-time generated HTML (Markdown + Shiki) and wires up its interactive bits:
 * copy buttons on code blocks, client-side navigation for internal links and in-page anchors.
 */
@Component({
  selector: 'docs-html',
  // Clicks are delegated from the rendered links and copy buttons, which are natively keyboard accessible.
  host: { '(click)': 'onClick($event)' },
  template: `<div [class]="cssClass()" [innerHTML]="safeHtml()"></div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
})
export class DocHtml {
  readonly html = input.required<string>();
  readonly cssClass = input('prose');

  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // The HTML is produced at build time from this repository's own content, so it is trusted.
  // Shiki relies on inline style attributes, which Angular's sanitizer would otherwise strip.
  protected readonly safeHtml = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.html()));

  protected onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    const copy = target.closest<HTMLButtonElement>('[data-copy]');
    if (copy) {
      copyCode(copy);
      return;
    }

    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
      return;
    }
    const href = link.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      // With <base href>, a bare "#id" would resolve against the site root; keep it on this page.
      event.preventDefault();
      void this.router.navigate([], { fragment: href.slice(1), replaceUrl: false });
      this.host.nativeElement.querySelector(`[id="${CSS.escape(href.slice(1))}"]`)?.scrollIntoView();
    } else if (link.hasAttribute('data-internal')) {
      event.preventDefault();
      void this.router.navigateByUrl('/' + href);
    }
  }
}

/** Copies the code next to a code-block copy button and briefly confirms it. */
export function copyCode(button: HTMLElement): void {
  const code = button.closest('.code-block')?.querySelector('pre')?.textContent ?? '';
  navigator.clipboard?.writeText(code).then(
    () => {
      button.textContent = 'Copied';
      button.classList.add('is-copied');
      setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('is-copied');
      }, 1600);
    },
    () => (button.textContent = 'Press ⌘C'),
  );
}
