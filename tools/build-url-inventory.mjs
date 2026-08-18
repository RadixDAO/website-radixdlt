// Phase 0: the published sitemap is NOT a complete page inventory. Build the real one
// from every source we have, so the mirror and Phase 5 baseline are complete.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const EXPORT = '/Volumes/Development/radix/radixdlt.com/static export';
const urls = new Set();
const source = {};
const add = (u, s) => { u = '/' + u.replace(/^\/+|\/+$/g, ''); if (u === '/') u = '/'; urls.add(u); (source[u] ||= new Set()).add(s); };

// 1. published sitemap
for (const m of readFileSync('reference/webflow/sitemap.xml', 'utf8').matchAll(/<loc>(.*?)<\/loc>/g))
  if (m[1].startsWith('https://www.radixdlt.com')) add(m[1].replace('https://www.radixdlt.com', '') || '/', 'sitemap');

// 2. every live CMS item under collections that probe 200 on their detail route
const probe = Object.fromEntries(readFileSync('reference/route-probe.tsv', 'utf8').trim().split('\n')
  .map(l => l.split('\t')).map(([slug, code]) => [slug, code]));
const cm = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
for (const c of cm) {
  if (probe[c.slug] !== '200') continue;
  const items = JSON.parse(readFileSync(`reference/webflow/items/${c.slug}.json`, 'utf8'));
  for (const i of items) if (!i.isDraft && !i.isArchived && i.fieldData?.slug) add(`${c.slug}/${i.fieldData.slug}`, 'cms');
}

// 3. every non-archived page in the static export, mapped to its live route
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
for (const f of walk(EXPORT)) {
  if (!f.endsWith('.html')) continue;
  const rel = relative(EXPORT, f);
  if (rel.startsWith('archived/') || rel.startsWith('detail_')) continue;
  add(rel.replace(/\.html$/, '').replace(/(^|\/)index$/, ''), 'export');
}

// 4. endpoints found by hand that no source lists
for (const e of ['/blog/rss.xml', '/podcast', '/sitemap.xml', '/robots.txt']) add(e, 'manual');

const out = [...urls].sort();
writeFileSync('reference/all-urls.txt', out.join('\n') + '\n');
const bySrc = {};
for (const u of out) { const k = [...source[u]].sort().join('+'); bySrc[k] = (bySrc[k] || 0) + 1; }
console.log('total distinct URLs:', out.length);
console.log('sitemap-only URLs :', out.filter(u => [...source[u]].join() === 'sitemap').length);
console.log('\nby source combination:');
for (const [k, v] of Object.entries(bySrc).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
