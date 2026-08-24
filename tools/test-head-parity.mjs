// <head> parity against reference/live.
//
// THE BLIND SPOT THIS CLOSES: tools/verify.mjs compares the <body> only -- its skeleton
// and text both start at <body>. Nothing in this project ever checked <head>. That let
// two serious defects sit undetected through a "1,194/1,202 exact" verification and an
// entire nativisation phase:
//
//   * 1,109 pages carried rel=canonical pointing at https://www.radixdlt.com/detail_<coll>
//     -- a Webflow CMS-template placeholder that is not a real URL. Webflow substitutes it
//     at publish time; the converter never did. Every CMS detail page was telling search
//     engines its canonical version was a page that does not exist. PRE-EXISTING, inherited
//     from the export.
//   * ~648 pages lost meta description / og:* / twitter:* entirely during nativisation --
//     the old pipeline emitted them from the manifest head object, the rewritten pages
//     passed only `title` to SiteHead. A PHASE 4 REGRESSION.
//
// Compares the set of meta names/properties and link rels, and the canonical URL value.
// Content of individual meta tags is not compared -- CMS text legitimately differs between
// the snapshot and a current build -- but presence and canonical target are exact.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const walk = d => readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

const head = (s) => {
  const a = s.indexOf('<head'); if (a < 0) return '';
  const o = s.indexOf('>', a); const b = s.indexOf('</head>');
  return (o < 0 || b < 0) ? '' : s.slice(o + 1, b);
};
const keys = (h) => {
  const out = new Set();
  for (const m of h.matchAll(/<meta\b[^>]*>/g)) {
    const k = /(?:property|name)="([^"]+)"/.exec(m[0]);
    if (k) out.add(`meta:${k[1]}`);
  }
  for (const m of h.matchAll(/<link\b[^>]*>/g)) {
    const k = /rel="([^"]+)"/.exec(m[0]);
    if (k) out.add(`link:${k[1]}`);
  }
  return out;
};
const canonical = (h) => {
  const m = /<link[^>]*rel="canonical"[^>]*>/.exec(h);
  return m ? (/href="([^"]*)"/.exec(m[0])?.[1] ?? null) : null;
};

if (!existsSync('dist')) { console.error('dist/ missing -- run pnpm build first.'); process.exit(2); }

const BASELINE = 'reference/head-parity-baseline.json';
const pages = walk('dist').filter(f => f.endsWith('.html') && !f.includes(`${sep}pagefind${sep}`));
const missing = {}, canonBad = [];
let compared = 0;

for (const p of pages) {
  const rel = relative('dist', p).split(sep).join('/');
  const lv = join('reference/live', rel);
  if (!existsSync(lv)) continue;
  compared++;
  const hd = head(readFileSync(p, 'utf8')), hl = head(readFileSync(lv, 'utf8'));
  const kd = keys(hd), kl = keys(hl);
  for (const k of kl) if (!kd.has(k)) (missing[k] ??= []).push(rel);
  const cd = canonical(hd), cl = canonical(hl);
  if (cd && cl && cd !== cl) canonBad.push({ rel, live: cl, ours: cd });
}

const report = {
  canonicalMismatched: canonBad.length,
  missingTags: Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, v.length])),
};
console.log(`head parity: ${compared} pages compared against reference/live`);
console.log(`  canonical URL mismatched : ${report.canonicalMismatched}`);
const miss = Object.entries(report.missingTags).sort((a, b) => b[1] - a[1]);
console.log(`  head tags on live but missing from ours: ${miss.length} kind(s)`);
for (const [k, n] of miss.slice(0, 12)) console.log(`      ${String(n).padStart(5)}  ${k}`);

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, JSON.stringify(report, null, 1) + '\n');
  console.log(`\nbaseline updated -> ${BASELINE}`);
  console.log(`NOTE: this records KNOWN-BAD counts. They are defects to drive to zero,`);
  console.log(`not an acceptable state. Lower is the only allowed direction.`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`\nNo ${BASELINE}. Create with: node tools/test-head-parity.mjs --update-baseline`);
  process.exit(2);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
let failed = false;
if (report.canonicalMismatched > base.canonicalMismatched) {
  console.error(`\nFAIL: canonical mismatches rose ${base.canonicalMismatched} -> ${report.canonicalMismatched}`);
  for (const c of canonBad.slice(0, 5)) console.error(`  ${c.rel}\n    live ${c.live}\n    ours ${c.ours}`);
  failed = true;
}
for (const [k, n] of Object.entries(report.missingTags)) {
  const was = base.missingTags[k] ?? 0;
  if (n > was) {
    console.error(`\nFAIL: pages missing ${k} rose ${was} -> ${n}`);
    console.error(`  e.g. ${missing[k].slice(0, 3).join(', ')}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('\nno head-parity regression against the baseline');
