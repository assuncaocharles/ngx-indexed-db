import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAV } from '../content/nav';
import { UiStateService } from '../core/ui-state.service';

@Component({
  selector: 'docs-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar" aria-label="Documentation">
      @for (section of nav; track section.title) {
        <div class="sidebar__section">
          <p class="sidebar__title">{{ section.title }}</p>
          <ul>
            @for (link of section.links; track link.label) {
              <li>
                @if (link.fragment) {
                  <a [routerLink]="link.path" [fragment]="link.fragment" (click)="ui.navOpen.set(false)">{{
                    link.label
                  }}</a>
                } @else {
                  <a
                    [routerLink]="link.path"
                    routerLinkActive="is-active"
                    ariaCurrentWhenActive="page"
                    (click)="ui.navOpen.set(false)"
                    >{{ link.label }}</a
                  >
                }
              </li>
            }
          </ul>
        </div>
      }
    </nav>
  `,
  styles: `
    .sidebar {
      padding: 32px 16px 48px 0;
    }
    .sidebar__section + .sidebar__section {
      margin-top: 28px;
    }
    .sidebar__title {
      margin: 0 0 8px;
      padding-left: 12px;
      color: var(--text);
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    a {
      display: block;
      padding: 6px 12px;
      border-radius: 7px;
      color: var(--text-muted);
      font-size: 14.5px;
      line-height: 1.4;
      text-decoration: none;
      transition:
        color 0.15s,
        background 0.15s;
    }
    a:hover {
      color: var(--text);
      background: var(--bg-soft);
    }
    a.is-active {
      color: var(--accent-text);
      background: var(--accent-soft);
      font-weight: 600;
    }
  `,
})
export class Sidebar {
  protected readonly nav = NAV;
  protected readonly ui = inject(UiStateService);
}
