// Phase 1/2: convert exported Webflow HTML into Astro pages WITHOUT letting Astro
// parse the markup. Each page becomes:
//   src/shells/<route>/head.html      raw <head> inner
//   src/shells/<route>/body.<n>.html  raw literal chunks
//   src/shells/<route>/list.<n>.html  raw w-dyn-list elements (CMS slots)
//   src/pages/<route>.astro           a 4-line file that renders the above
// plus src/shells/manifest.json describing every page.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { documentParts, findTopLevelByClass, splitAt } from './lib/html-slice.mjs';
import { rewriteHtml } from './lib/rewrite-urls.mjs';

const EXPORT = '/Volumes/Development/radix/radixdlt.com/static export';
const only = process.argv.slice(2).filter(a => !a.startsWith('-'));

const excluded = new Set(
  readFileSync('reference/excluded-pages.txt', 'utf8').trim().split('\n')
    .map(s => s.trim().replace(/^\//, '')).filter(Boolean));

const walk = d => readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

let pages = walk(EXPORT).filter(f => f.endsWith('.html'))
  .map(f => relative(EXPORT, f))
  .filter(rel => !rel.startsWith('archived/'))     // dead Webflow scratch, decision 1
  .filter(rel => !rel.startsWith('detail_'))       // CMS templates -> Phase 3
  .filter(rel => !excluded.has(rel.replace(/\.html$/, '')));  // unpublished on live

if (only.length) pages = pages.filter(p => only.includes(p) || only.includes(p.replace(/\.html$/, '')));

rmSync('src/shells', { recursive: true, force: true });
mkdirSync('src/shells', { recursive: true });

const manifest = {};
for (const rel of pages) {
  const route = rel.replace(/\.html$/, '').replace(/(^|\/)index$/, '') || 'index';
  const pageDir = dirname(rel) === '.' ? '' : dirname(rel);
  const raw = readFileSync(join(EXPORT, rel), 'utf8');

  let d;
  try { d = documentParts(raw); }
  catch (e) { console.error(`SKIP ${rel}: ${e.message}`); continue; }

  const head = rewriteHtml(d.head, pageDir, { absolutise: true });
  const body = rewriteHtml(d.body, pageDir);
  const lists = findTopLevelByClass(body, 'w-dyn-list');
  const parts = splitAt(body, lists);

  const dir = join('src/shells', route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'head.html'), head);

  const order = [];
  let hi = 0, li = 0;
  for (const p of parts) {
    if (p.kind === 'html') {
      if (!p.text) continue;
      writeFileSync(join(dir, `body.${hi}.html`), p.text);
      order.push({ kind: 'html', file: `body.${hi}.html` }); hi++;
    } else {
      writeFileSync(join(dir, `list.${li}.html`), p.text);
      order.push({ kind: 'list', file: `list.${li}.html`, index: li }); li++;
    }
  }

  manifest[route] = {
    route, source: rel,
    htmlAttrs: d.htmlAttrs, bodyAttrs: d.bodyAttrs,
    listCount: li, order,
  };

  // The .astro page is deliberately trivial: all fidelity lives in the shells.
  const astroPath = join('src/pages', route === 'index' ? 'index.astro' : `${route}.astro`);
  mkdirSync(dirname(astroPath), { recursive: true });
  writeFileSync(astroPath,
`---
import WebflowPage from '@layouts/WebflowPage.astro';
---
<WebflowPage route="${route}" />
`);
}

writeFileSync('src/shells/manifest.json', JSON.stringify(manifest, null, 1));
const withLists = Object.values(manifest).filter(m => m.listCount > 0);
console.log(`converted ${Object.keys(manifest).length} pages`);
console.log(`  with CMS lists: ${withLists.length} (${withLists.reduce((a, m) => a + m.listCount, 0)} lists total)`);
