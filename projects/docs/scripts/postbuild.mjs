// Finishes the static build for GitHub Pages.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist/docs/browser';
const notFound = join(out, '404/index.html');
if (!existsSync(notFound)) throw new Error(`Expected a prerendered ${notFound}`);

// GitHub Pages serves 404.html for unknown paths.
copyFileSync(notFound, join(out, '404.html'));
// Serve files as-is (no Jekyll processing).
writeFileSync(join(out, '.nojekyll'), '');
console.log('docs postbuild: wrote 404.html and .nojekyll');
