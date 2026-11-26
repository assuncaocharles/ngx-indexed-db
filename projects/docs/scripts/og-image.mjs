// Renders projects/docs/scripts/og-image.html to projects/docs/public/og.png (1200×630),
// the social preview image used in the docs site's Open Graph and Twitter card tags.
//
// Usage: npm run docs:og
// Needs a Chromium for Playwright: run `npx playwright install chromium` once, or point
// CHROME_BIN at an installed Chrome/Chromium.

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const template = pathToFileURL(join(here, 'og-image.html')).href;
const output = join(here, '../public/og.png');

const browser = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(template, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output, type: 'png' });
  console.log(`docs og image: wrote ${output}`);
} finally {
  await browser.close();
}
