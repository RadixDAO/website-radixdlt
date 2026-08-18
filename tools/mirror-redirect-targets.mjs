// Phase 0/4 (late): the Webflow 301 table points at ~26 legal PDFs (EULAs, T&Cs,
// privacy notices, grant terms) that NOTHING else on the site references. They are
// invisible to a content/HTML scan and would be lost silently at cutover.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const assetMap = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));
const byTail = new Map();
for (const [u, p] of Object.entries(assetMap)) {
  if (u === '__byTail') continue;
  const t = decodeURIComponent(u).split('/').filter(Boolean).pop();
  if (t && !byTail.has(t)) byTail.set(t, p);
}

const WEBFLOW = /(uploads-ssl\.webflow\.com|website-files\.com|webflow-prod-assets)/;
const rows = readFileSync('reference/webflow/301-redirects.csv', 'utf8').trim().split('\n').slice(1)
  .map(l => { const i = l.indexOf(','); return { source: l.slice(0, i).trim(), target: l.slice(i + 1).trim() }; });

const sanitize = (n) => decodeURIComponent(n).replace(/[%\s]+/g, '-')
  .replace(/[^A-Za-z0-9._-]/g, '').replace(/-+/g, '-');

mkdirSync('public/assets', { recursive: true });
const todo = [];
for (const { target } of rows) {
  if (!WEBFLOW.test(target)) continue;
  const tail = decodeURIComponent(target).split('/').filter(Boolean).pop();
  if (assetMap[target] || byTail.has(tail)) continue;
  todo.push({ url: target, name: sanitize(tail) });
}
console.log(`redirect targets needing mirror: ${todo.length}`);

const failures = [];
let done = 0;
for (const { url, name } of todo) {
  const dest = `public/assets/${name}`;
  if (existsSync(dest)) { assetMap[url] = `/assets/${name}`; continue; }
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error('empty');
    writeFileSync(dest, buf);
    assetMap[url] = `/assets/${name}`;
    done++;
    console.log(`  ${String(buf.length).padStart(9)}  ${name}`);
  } catch (e) {
    failures.push({ url, error: String(e.message ?? e) });
    console.error(`  FAILED ${name}: ${e.message ?? e}`);
  }
}
delete assetMap.__byTail;
writeFileSync('reference/asset-map.json', JSON.stringify(assetMap, null, 1));
writeFileSync('reference/redirect-target-failures.json', JSON.stringify(failures, null, 1));
console.log(`mirrored ${done}, failed ${failures.length}`);
