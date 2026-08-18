// Phase 0: join Webflow collections + field schemas + item counts + exported detail
// templates + live routes into the single map Phase 3 works from.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REF = 'reference/webflow';
const EXPORT = '/Volumes/Development/radix/radixdlt.com/static export';
const collections = JSON.parse(readFileSync(`${REF}/collections.json`, 'utf8'));

// Live route prefixes, counted from the published sitemap.
const sitemap = readFileSync(`${REF}/sitemap.xml`, 'utf8');
const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])
  .filter(u => u.startsWith('https://www.radixdlt.com/'))
  .map(u => u.replace('https://www.radixdlt.com/', ''));
const prefixCount = {};
for (const p of locs) {
  const parts = p.split('/');
  if (parts.length > 1) prefixCount[parts[0]] = (prefixCount[parts[0]] || 0) + 1;
}

// Ground truth for detail routes comes from probing the live site, NOT the sitemap:
// the published sitemap omits 8 collections that have working detail pages.
const probe = Object.fromEntries(
  readFileSync('reference/route-probe.tsv', 'utf8').trim().split('\n')
    .map(l => l.split('\t')).map(([slug, code]) => [slug, code]));

const out = collections.map(c => {
  const items = JSON.parse(readFileSync(`${REF}/items/${c.slug}.json`, 'utf8'));
  const live = items.filter(i => !i.isDraft && !i.isArchived);
  const schema = JSON.parse(readFileSync(`${REF}/fields/${c.slug}.json`, 'utf8'));
  const tpl = `detail_${c.slug}.html`;
  const hasTpl = existsSync(join(EXPORT, tpl));
  return {
    id: c.id,
    slug: c.slug,
    displayName: c.displayName,
    detailTemplate: hasTpl ? tpl : null,
    hasDetailRoute: probe[c.slug] === '200',
    liveRoutePrefix: probe[c.slug] === '200' ? `/${c.slug}/:slug` : null,
    inSitemap: (prefixCount[c.slug] || 0) > 0,
    liveUrlCount: prefixCount[c.slug] || 0,
    itemCount: items.length,
    liveItemCount: live.length,
    // reconciliation: does the published sitemap agree with the API's live items?
    reconciles: (prefixCount[c.slug] || 0) === live.length,
    fields: schema.fields.map(f => ({ slug: f.slug, type: f.type, displayName: f.displayName })),
  };
});

writeFileSync('reference/collection-map.json', JSON.stringify(out, null, 1));

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('collection', 30), pad('tpl', 4), pad('items', 6), pad('live', 5), pad('sitemap', 8), 'reconciles');
for (const c of out) {
  console.log(pad(c.slug, 30), pad(c.detailTemplate ? 'yes' : '-', 4), pad(c.itemCount, 6),
    pad(c.liveItemCount, 5), pad(c.liveUrlCount, 8),
    !c.hasDetailRoute ? 'list-only' : (c.inSitemap ? 'detail (in sitemap)' : 'detail (NOT in sitemap)'));
}
const refTypes = new Set(['Reference', 'MultiReference']);
console.log('\nreference fields (Phase 3 joins):');
for (const c of out) for (const f of c.fields)
  if (refTypes.has(f.type)) console.log(`  ${c.slug}.${f.slug} → ${f.type}`);
