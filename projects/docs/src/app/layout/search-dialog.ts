import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { SEARCH } from '../content/generated/meta';
import { SearchEntry } from '../content/content.model';
import { UiStateService } from '../core/ui-state.service';

const MAX_RESULTS = 12;

/** Ranks an entry for a query: exact/prefix title matches first, then substring, then description. */
function score(entry: SearchEntry, terms: string[]): number {
  const title = entry.title.toLowerCase();
  const haystack = `${title} ${entry.section.toLowerCase()} ${entry.text.toLowerCase()}`;
  let total = 0;
  for (const term of terms) {
    if (title === term || title === `${term}()`) total += 100;
    else if (title.startsWith(term)) total += 40;
    else if (title.includes(term)) total += 20;
    else if (haystack.includes(term)) total += 5;
    else return 0;
  }
  return total;
}

@Component({
  selector: 'docs-search-dialog',
  host: {
    '(document:keydown)': 'onGlobalKeydown($event)',
    // Option clicks and backdrop clicks are delegated here. Keyboard users drive the list from the input
    // (combobox pattern with aria-activedescendant), so options are intentionally not focusable.
    '(click)': 'onClick($event)',
  },
  template: `
    <dialog #dialog class="search" aria-label="Search documentation" (close)="ui.searchOpen.set(false)">
      <div class="search__panel">
        <div class="search__field">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            #input
            type="search"
            placeholder="Search guides and API…"
            autocomplete="off"
            spellcheck="false"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            [attr.aria-activedescendant]="results().length ? 'search-result-' + selected() : null"
            [value]="query()"
            (input)="onInput($event)"
            (keydown)="onKeydown($event)"
          />
          <kbd>Esc</kbd>
        </div>

        <ul class="search__results" id="search-results" role="listbox">
          @for (result of results(); track result.url; let i = $index) {
            <li
              role="option"
              [id]="'search-result-' + i"
              [attr.aria-selected]="i === selected()"
              [class.is-selected]="i === selected()"
              [attr.data-index]="i"
              (mouseenter)="selected.set(i)"
            >
              <span class="search__section">{{ result.section }}</span>
              <span class="search__title">{{ result.title }}</span>
              @if (result.text) {
                <span class="search__text">{{ result.text }}</span>
              }
            </li>
          } @empty {
            <li class="search__empty">
              @if (query()) {
                No results for “{{ query() }}”
              } @else {
                Type to search the guides and every API method.
              }
            </li>
          }
        </ul>

        <footer class="search__footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to open</span>
        </footer>
      </div>
    </dialog>
  `,
  styles: `
    .search {
      width: min(640px, calc(100vw - 32px));
      max-height: min(560px, calc(100vh - 120px));
      margin: 12vh auto auto;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface-raised);
      color: var(--text);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }
    .search::backdrop {
      background: rgb(8 10 16 / 45%);
      backdrop-filter: blur(3px);
    }
    .search__panel {
      display: flex;
      flex-direction: column;
      max-height: inherit;
    }
    .search__field {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border);
      color: var(--text-faint);
    }
    input {
      flex: 1;
      height: 56px;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 17px;
    }
    input::-webkit-search-cancel-button {
      display: none;
    }
    .search__results {
      flex: 1;
      margin: 0;
      padding: 8px;
      overflow-y: auto;
      list-style: none;
    }
    li[role='option'] {
      display: grid;
      gap: 2px;
      padding: 10px 12px;
      border-radius: 9px;
      cursor: pointer;
    }
    li.is-selected {
      background: var(--accent-soft);
    }
    .search__section {
      color: var(--text-faint);
      font-size: 12px;
      font-weight: 600;
    }
    .search__title {
      font-weight: 600;
    }
    li.is-selected .search__title {
      color: var(--accent-text);
    }
    .search__text {
      overflow: hidden;
      color: var(--text-muted);
      font-size: 13.5px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search__empty {
      padding: 32px 12px;
      color: var(--text-muted);
      text-align: center;
    }
    .search__footer {
      display: flex;
      gap: 20px;
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      color: var(--text-faint);
      font-size: 12.5px;
    }
    @media (max-width: 640px) {
      .search {
        margin-top: 16px;
      }
      .search__footer {
        display: none;
      }
    }
  `,
})
export class SearchDialog {
  protected readonly ui = inject(UiStateService);
  private readonly router = inject(Router);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly query = signal('');
  protected readonly selected = signal(0);

  protected readonly results = computed(() => {
    const terms = this.query().toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return SEARCH.filter((e) => e.section === 'Introduction' || e.section === 'Guides').slice(0, 8);
    return SEARCH.map((entry) => ({ entry, score: score(entry, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.entry);
  });

  constructor() {
    // Opening from elsewhere (header button, 404 page) goes through UI state.
    effect(() => {
      if (this.ui.searchOpen()) this.open();
      else if (this.dialog().nativeElement.open) this.dialog().nativeElement.close();
    });
  }

  /** Opens and focuses synchronously, so keystrokes typed right after the shortcut aren't lost. */
  private open(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    this.query.set('');
    this.input().nativeElement.value = '';
    this.selected.set(0);
    dialog.showModal();
    this.input().nativeElement.focus();
    this.ui.searchOpen.set(true);
  }

  protected onGlobalKeydown(event: KeyboardEvent): void {
    const typing = (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]');
    if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
      event.preventDefault();
      this.open();
    }
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.selected.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selected.update((i) => (i + 1) % Math.max(count, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selected.update((i) => (i - 1 + count) % Math.max(count, 1));
    } else if (event.key === 'Enter') {
      const result = this.results()[this.selected()];
      if (result) this.go(result);
    }
  }

  protected onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Clicks on the ::backdrop land on the <dialog> element itself.
    if (target === this.dialog().nativeElement) {
      this.ui.searchOpen.set(false);
      return;
    }
    const option = target.closest<HTMLElement>('[data-index]');
    const result = option && this.results()[Number(option.dataset['index'])];
    if (result) this.go(result);
  }

  protected go(entry: SearchEntry): void {
    this.ui.searchOpen.set(false);
    const [path, fragment] = entry.url.split('#');
    void this.router.navigate(['/' + path], { fragment });
  }
}
