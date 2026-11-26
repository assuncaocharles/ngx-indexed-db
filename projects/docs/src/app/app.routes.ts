import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'guide', pathMatch: 'full', redirectTo: 'guide/getting-started' },
  { path: 'guide/:slug', loadComponent: () => import('./pages/guide-page').then((m) => m.GuidePage) },
  { path: 'api', loadComponent: () => import('./pages/api-page').then((m) => m.ApiPage) },
  { path: 'playground', loadChildren: () => import('./pages/playground.routes').then((m) => m.PLAYGROUND_ROUTES) },
  // Prerendered to 404/index.html and published as GitHub Pages' 404.html.
  { path: '404', loadComponent: () => import('./pages/not-found').then((m) => m.NotFound) },
  { path: '**', loadComponent: () => import('./pages/not-found').then((m) => m.NotFound) },
];
