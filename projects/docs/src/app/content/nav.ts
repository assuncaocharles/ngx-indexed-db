import { API_INDEX, GUIDE_META } from './generated/meta';

export interface NavLink {
  label: string;
  path: string;
  fragment?: string;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

const guideSections = [...new Set(GUIDE_META.map((g) => g.section))];

/** Sidebar navigation, derived from the generated content so it never drifts. */
export const NAV: NavSection[] = [
  ...guideSections.map((section) => ({
    title: section,
    links: GUIDE_META.filter((g) => g.section === section).map((g) => ({ label: g.title, path: `/guide/${g.slug}` })),
  })),
  {
    title: 'API reference',
    links: [
      ...API_INDEX.map((group) => ({ label: group.title, path: '/api', fragment: group.id })),
      { label: 'Types & tokens', path: '/api', fragment: 'types' },
    ],
  },
  { title: 'Try it', links: [{ label: 'Playground', path: '/playground' }] },
];

/** Guides in reading order, for previous/next links. */
export const GUIDE_ORDER = GUIDE_META.map((g) => ({ label: g.title, path: `/guide/${g.slug}` }));
