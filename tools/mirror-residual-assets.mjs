// Sweep dist/ for any Webflow CDN URL that survived rewriting, mirror it, and add it
// to the asset map. Run after a build; re-run the build afterwards so the new map
// entries take effect. Idempotent.
//
// These are assets that no earlier scan could see: they live inside rich-text field
// values whose filenames contain characters (parentheses, apostrophes) that naive URL
// extraction truncates.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

const assetMap = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));
const HOSTS = '(?:uploads-ssl\\.webflow\\.com|cdn\\.prod\\.website-files\\.com|assets(?:-global)?\\.website-files\\.com)';
// Only take URLs from inside a quoted attribute, so filenames containing ( ) survive.
const ATTR = new RegExp(`(?:src|href|content)="(https?://${HOSTS}/[^"]+)"`, 'g');
const CSSURL = new RegExp(`url\\((?:&quot;|["'])?(https?://${HOSTS}/[^"')]+)`, 'g');

const found = new Set();
for (const f of walk('dist').filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(ATTR)) found.add(m[1].replace(/&quot;$/, ''));
  for (const m of html.matchAll(CSSURL)) found.add(m[1].replace(/&quot;$/, ''));
}
console.log(`residual CDN URLs in dist: ${found.size}`);

const sanitize = (n) => decodeURIComponent(n).replace(/[%\s]+/g, '-')
  .replace(/[^A-Za-z0-9._-]/g, '').replace(/-+/g, '-');

let mirrored = 0, reused = 0;
const failures = [];
for (const url of found) {
  if (assetMap[url]) { reused++; continue; }
  const name = sanitize(url.split('/').filter(Boolean).pop());
  const dest = `public/assets/${name}`;
  if (existsSync(dest)) { assetMap[url] = `/assets/${name}`; reused++; continue; }
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error('empty');
    writeFileSync(dest, buf);
    assetMap[url] = `/assets/${name}`;
    mirrored++;
  } catch (e) {
    failures.push({ url, error: String(e.message ?? e) });
  }
}
writeFileSync('reference/asset-map.json', JSON.stringify(assetMap, null, 1));
writeFileSync('reference/residual-asset-failures.json', JSON.stringify(failures, null, 1));
console.log(`mapped from existing files: ${reused} | newly downloaded: ${mirrored} | failed: ${failures.length}`);
for (const f of failures.slice(0, 10)) console.error(`  FAIL ${f.error}  ${f.url.slice(0, 110)}`);
