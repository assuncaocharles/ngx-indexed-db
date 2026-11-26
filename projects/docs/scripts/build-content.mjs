// Builds the docs content into a TypeScript module consumed by the Angular app.
//
// - Guides:  projects/docs/content/guide/*.md  (frontmatter + Markdown)
// - API:     extracted from the library's TypeScript source, merged with the
//            hand-written examples in projects/docs/content/api.md
//
// Everything (Markdown rendering and Shiki syntax highlighting) happens here at
// build time, so the browser ships plain HTML strings and no highlighter.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { createHighlighter } from 'shiki';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, '..');
const libSrc = resolve(docsRoot, '../ngx-indexed-db/src/lib');
const contentDir = join(docsRoot, 'content');
const outDir = join(docsRoot, 'src/app/content/generated');
const libVersion = JSON.parse(readFileSync(resolve(docsRoot, '../ngx-indexed-db/package.json'), 'utf8')).version;

/** Service methods grouped for the API reference. Every public method must be listed. */
const API_GROUPS = [
  { id: 'writing', title: 'Writing data', methods: ['add', 'bulkAdd', 'update', 'bulkPut'] },
  {
    id: 'reading',
    title: 'Reading data',
    methods: ['getByKey', 'getByID', 'bulkGet', 'getAll', 'getByIndex', 'getAllByIndex', 'getAllKeysByIndex'],
  },
  { id: 'counting', title: 'Counting', methods: ['count', 'countByIndex'] },
  {
    id: 'deleting',
    title: 'Deleting data',
    methods: ['delete', 'deleteByKey', 'bulkDelete', 'deleteAllByIndex', 'clear'],
  },
  { id: 'cursors', title: 'Cursors', methods: ['openCursor', 'openCursorByIndex'] },
  {
    id: 'schema',
    title: 'Schema & database',
    methods: [
      'selectDb',
      'getDatabaseVersion',
      'getAllObjectStoreNames',
      'createObjectStore',
      'createDynamicObjectStore',
      'deleteObjectStore',
      'deleteDatabase',
    ],
  },
];

/** Exported types documented in the reference, in display order. */
const API_TYPES = [
  'DBConfig',
  'ObjectStoreMeta',
  'ObjectStoreSchema',
  'DBMode',
  'WithID',
  'IndexKey',
  'NgxIDBCursor',
  'NgxIDBCursorWithValue',
  'INDEXED_DB',
  'SERVER_INDEXED_DB',
];

const highlighter = await createHighlighter({
  themes: ['github-light', 'github-dark'],
  langs: ['typescript', 'javascript', 'bash', 'json', 'html', 'css'],
});

const LANG_ALIASES = { ts: 'typescript', js: 'javascript', sh: 'bash', shell: 'bash' };
const LANG_LABELS = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  bash: 'Terminal',
  json: 'JSON',
  html: 'HTML',
};

function highlight(code, lang = 'typescript') {
  const resolved = LANG_ALIASES[lang] ?? lang;
  const language = highlighter.getLoadedLanguages().includes(resolved) ? resolved : 'text';
  return highlighter.codeToHtml(code, {
    lang: language,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function codeBlock(code, lang, title) {
  const resolved = LANG_ALIASES[lang] ?? lang ?? 'text';
  const label = title ?? LANG_LABELS[resolved] ?? resolved;
  return (
    `<div class="code-block">` +
    `<div class="code-block__bar"><span class="code-block__title">${escapeHtml(label)}</span>` +
    `<button type="button" class="code-block__copy" data-copy aria-label="Copy code">Copy</button></div>` +
    highlight(code.replace(/\n$/, ''), resolved) +
    `</div>`
  );
}

/** Splits `---\nkey: value\n---` frontmatter from the body. */
function parseFrontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return { data: {}, body: source };
  const data = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0)
      data[line.slice(0, idx).trim()] = line
        .slice(idx + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
  }
  return { data, body: source.slice(match[0].length) };
}

const ALERTS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };

/** Creates a Markdown renderer that records headings for the table of contents. */
function createRenderer() {
  const headings = [];
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const id = slugify(html);
        if (depth === 2 || depth === 3) headings.push({ id, text: html.replace(/<[^>]+>/g, ''), level: depth });
        if (depth === 1) return `<h1>${html}</h1>`;
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${html}</h${depth}>`;
      },
      code({ text, lang }) {
        const [language, ...rest] = (lang ?? '').split(/\s+/);
        const title = /title="([^"]+)"/.exec(rest.join(' '))?.[1];
        return codeBlock(text, language || 'text', title);
      },
      blockquote({ tokens, text }) {
        // GitHub-style alerts: "> [!NOTE]" followed by the callout body.
        const alert = /^\[!(\w+)\]\s*/.exec(text);
        if (alert && ALERTS[alert[1]]) {
          const body = marked.parse(text.slice(alert[0].length));
          return `<aside class="callout callout--${alert[1].toLowerCase()}"><p class="callout__title">${
            ALERTS[alert[1]]
          }</p>${body}</aside>`;
        }
        return `<blockquote>${this.parser.parse(tokens)}</blockquote>`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        // Internal links are written root-relative ("/guide/x") and emitted relative to <base href>.
        const target = !external && href.startsWith('/') ? href.slice(1) : href;
        const attrs = external ? ' target="_blank" rel="noopener"' : ' data-internal';
        return `<a href="${escapeHtml(target)}"${title ? ` title="${escapeHtml(title)}"` : ''}${attrs}>${text}</a>`;
      },
      table(token) {
        return `<div class="table-wrap">${marked.Renderer.prototype.table.call(this, token)}</div>`;
      },
    },
  });
  return { render: (md) => marked.parse(md), headings };
}

const inlineMarked = new Marked({ gfm: true });
/** Renders a doc-comment string as inline HTML (backticks, links, emphasis). */
function inline(text) {
  return text ? inlineMarked.parseInline(text.replace(/\n/g, ' ')) : '';
}

function plainText(html) {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

const guides = readdirSync(join(contentDir, 'guide'))
  .filter((f) => f.endsWith('.md'))
  .map((file) => {
    const { data, body } = parseFrontmatter(readFileSync(join(contentDir, 'guide', file), 'utf8'));
    const { render, headings } = createRenderer();
    const html = render(body);
    for (const key of ['title', 'description', 'order', 'section']) {
      if (!data[key]) throw new Error(`content/guide/${file}: missing frontmatter "${key}"`);
    }
    return {
      slug: file.replace(/\.md$/, ''),
      title: data.title,
      description: data.description,
      section: data.section,
      order: Number(data.order),
      html,
      headings,
    };
  })
  .sort((a, b) => a.order - b.order);

// ---------------------------------------------------------------------------
// API reference (from TypeScript source)
// ---------------------------------------------------------------------------

function sourceFile(name) {
  const path = join(libSrc, name);
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}

function jsDoc(node) {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  const doc = docs[docs.length - 1];
  if (!doc) return { summary: '', params: {}, returns: '' };
  const text = (c) => (typeof c === 'string' ? c : (c ?? []).map((p) => p.text).join('')).trim();
  const params = {};
  let returns = '';
  for (const tag of doc.tags ?? []) {
    if (ts.isJSDocParameterTag(tag)) params[tag.name.getText()] = text(tag.comment).replace(/^-\s*/, '');
    else if (/^return/i.test(tag.tagName.text)) returns = text(tag.comment);
  }
  return { summary: text(doc.comment), params, returns };
}

const service = sourceFile('ngx-indexed-db.service.ts');
const serviceClass = service.statements.find((s) => ts.isClassDeclaration(s) && s.name?.text === 'NgxIndexedDBService');
const methods = new Map();

for (const member of serviceClass.members) {
  if (!ts.isMethodDeclaration(member) || !member.name) continue;
  const mods = ts.getModifiers(member) ?? [];
  if (mods.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) continue;
  const name = member.name.getText();
  const isAsync = mods.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  const typeParams = member.typeParameters ? `<${member.typeParameters.map((t) => t.getText()).join(', ')}>` : '';
  const params = member.parameters.map((p) => p.getText().replace(/\s+/g, ' ').replace(/;\s*}/g, ' }'));
  const returnType = member.type?.getText().replace(/\s+/g, ' ') ?? 'void';
  const oneLine = `${name}${typeParams}(${params.join(', ')}): ${returnType}`;
  const signature =
    oneLine.length > 88 ? `${name}${typeParams}(\n  ${params.join(',\n  ')}\n): ${returnType}` : oneLine;
  const doc = jsDoc(member);
  methods.set(name, {
    name,
    signature: (isAsync ? 'async ' : '') + signature,
    summary: plainText(inline(doc.summary)),
    summaryHtml: inline(doc.summary),
    params: member.parameters.map((p) => ({
      name: p.name.getText().replace(/\s+/g, ' '),
      type: p.type?.getText().replace(/\s+/g, ' ') ?? 'unknown',
      optional: Boolean(p.questionToken || p.initializer),
      description: inline(doc.params[p.name.getText()] ?? ''),
    })),
    returns: returnType,
    returnsDoc: doc.returns,
  });
}

const grouped = new Set(API_GROUPS.flatMap((g) => g.methods));
const missing = [...methods.keys()].filter((m) => !grouped.has(m));
if (missing.length) {
  throw new Error(`API reference is missing public service methods: ${missing.join(', ')}. Add them to API_GROUPS.`);
}
const unknown = [...grouped].filter((m) => !methods.has(m));
if (unknown.length) throw new Error(`API_GROUPS lists methods that do not exist: ${unknown.join(', ')}`);

// Hand-written prose and examples, one "## methodName" section per method.
const apiMd = readFileSync(join(contentDir, 'api.md'), 'utf8');
const apiSections = {};
for (const part of apiMd.split(/^## /m).slice(1)) {
  const [heading, ...rest] = part.split('\n');
  apiSections[heading.trim()] = rest.join('\n').trim();
}

const meta = sourceFile('ngx-indexed-db.meta.ts');
const types = API_TYPES.map((name) => {
  const node = meta.statements.find((s) => {
    if (ts.isVariableStatement(s)) return s.declarationList.declarations.some((d) => d.name.getText() === name);
    return 'name' in s && s.name?.getText() === name;
  });
  if (!node) throw new Error(`Type ${name} not found in ngx-indexed-db.meta.ts`);
  const doc = jsDoc(node);
  return {
    name,
    kind: ts.isInterfaceDeclaration(node)
      ? 'interface'
      : ts.isEnumDeclaration(node)
        ? 'enum'
        : ts.isVariableStatement(node)
          ? 'token'
          : 'type',
    summary: plainText(inline(doc.summary)),
    summaryHtml: inline(doc.summary),
    html: highlight(node.getText().replace(/^\/\*\*[\s\S]*?\*\/\s*/, '')),
    notes: apiSections[name] ? createRenderer().render(apiSections[name]) : '',
  };
});

const api = API_GROUPS.map((group) => ({
  id: group.id,
  title: group.title,
  methods: group.methods.map((name) => {
    const m = methods.get(name);
    return {
      ...m,
      signatureHtml: highlight(m.signature),
      bodyHtml: apiSections[name] ? createRenderer().render(apiSections[name]) : '',
    };
  }),
}));

// ---------------------------------------------------------------------------
// Landing page snippets: content/snippets/<name>.<lang>
// ---------------------------------------------------------------------------

const snippets = {};
for (const file of readdirSync(join(contentDir, 'snippets'))) {
  const [name, lang] = file.split('.');
  snippets[name] = highlight(readFileSync(join(contentDir, 'snippets', file), 'utf8').trimEnd(), lang);
}

// ---------------------------------------------------------------------------
// Search index
// ---------------------------------------------------------------------------

const search = [];
for (const g of guides) {
  search.push({ title: g.title, section: g.section, url: `guide/${g.slug}`, text: g.description });
  for (const h of g.headings)
    search.push({ title: h.text, section: g.title, url: `guide/${g.slug}#${h.id}`, text: '' });
}
for (const group of api) {
  for (const m of group.methods) {
    search.push({ title: `${m.name}()`, section: `API · ${group.title}`, url: `api#${m.name}`, text: m.summary });
  }
}
for (const t of types) search.push({ title: t.name, section: 'API · Types', url: `api#${t.name}`, text: t.summary });
search.push({ title: 'Playground', section: 'Try it', url: 'playground', text: 'Live demo running in your browser' });

// ---------------------------------------------------------------------------

const banner = '// AUTO-GENERATED by projects/docs/scripts/build-content.mjs. Do not edit.\n';
const json = (value) => JSON.stringify(value, null, 1);

// Split so that the app shell only loads metadata; each page lazily loads its own content.
const files = {
  'meta.ts':
    `import type { ApiIndexGroup, GuideMeta, SearchEntry } from '../content.model';\n\n` +
    `export const VERSION = ${JSON.stringify(libVersion)};\n\n` +
    `export const GUIDE_META: GuideMeta[] = ${json(
      guides.map(({ slug, title, description, section }) => ({ slug, title, description, section })),
    )};\n\n` +
    `export const API_INDEX: ApiIndexGroup[] = ${json(
      api.map((g) => ({ id: g.id, title: g.title, methods: g.methods.map((m) => m.name) })),
    )};\n\n` +
    `export const SEARCH: SearchEntry[] = ${json(search)};\n`,
  'guides.ts':
    `import type { GuidePage } from '../content.model';\n\n` +
    `export const GUIDES: GuidePage[] = ${json(guides.map(({ order, ...g }) => g))};\n`,
  'api.ts':
    `import type { ApiGroup, ApiType } from '../content.model';\n\n` +
    `export const API: ApiGroup[] = ${json(api)};\n\n` +
    `export const API_TYPES: ApiType[] = ${json(types)};\n`,
  'snippets.ts': `export const SNIPPETS: Record<string, string> = ${json(snippets)};\n`,
};

mkdirSync(outDir, { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(join(outDir, name), banner + body);
console.log(
  `docs content: ${guides.length} guides, ${methods.size} API methods, ${types.length} types, ${search.length} search entries`,
);
