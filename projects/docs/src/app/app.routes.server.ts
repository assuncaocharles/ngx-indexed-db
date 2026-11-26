import { RenderMode, ServerRoute } from '@angular/ssr';
import { GUIDE_META } from './content/generated/meta';

/** Every page is prerendered to static HTML for GitHub Pages. */
export const serverRoutes: ServerRoute[] = [
  {
    path: 'guide/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => GUIDE_META.map((g) => ({ slug: g.slug })),
  },
  { path: '**', renderMode: RenderMode.Prerender },
];
