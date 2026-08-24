// One-off (but reusable) split of the shared Webflow <head> boilerplate out of
// src/shells/_detail/<collection>/head.html and into
// src/shells/_detail/manifest.json's per-collection `head` object, consumed by
// src/components/site/SiteHead.astro via DetailPage.astro.
//
// Same approach as tools/split-site-head.mjs (Task 2.1), applied to the detail
// pipeline (Task 2.1b) instead of the WebflowPage shells. See that script's
// header comment for the extraction philosophy: every byte kept is a verbatim
// substring, sliced by exact literal matching, with a reconstruction proof
// before anything is written -- correctness never depends on this script
// recognising every case, only on failing closed when it doesn't.
//
// Difference from the static pipeline: <title> here can be per-CMS-item at
// *render* time (src/bindings/<collection>.json's `head` entry with
// target:"title"), not per-shell at *build* time. This script does not touch
// that -- it only extracts the shell's literal (unfilled) title text, same as
// every other SEO field, into manifest head.title. DetailPage.astro is
// responsible for overriding it with the resolved per-item title when a
// binding exists (see render-detail.mjs's resolveHeadTitle).
//
// Usage: node tools/split-detail-head.mjs [--dry-run]
//
// Rewrites:
//   - src/shells/_detail/manifest.json        (adds a `head` object per collection)
//   - src/shells/_detail/<collection>/head.html  (rewritten to hold only the unique tail)

import { readFileSync, writeFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry-run');

const MANIFEST_PATH = 'src/shells/_detail/manifest.json';
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

const PREFIX_RE = /^\n {2}<meta charset="utf-8">\n {2}<title>([\s\S]*?)<\/title>\n/;

// [propName, build-regex, isBoolean(value is constant, presence-only)]
const SEO_FIELDS = [
  ['description', /^ {2}<meta content="([\s\S]*?)" name="description">\n/, false],
  ['ogTitle', /^ {2}<meta content="([\s\S]*?)" property="og:title">\n/, false],
  ['ogDescription', /^ {2}<meta content="([\s\S]*?)" property="og:description">\n/, false],
  ['ogImage', /^ {2}<meta content="([\s\S]*?)" property="og:image">\n/, false],
  ['twitterTitle', /^ {2}<meta content="([\s\S]*?)" name="twitter:title">\n/, false],
  ['twitterDescription', /^ {2}<meta content="([\s\S]*?)" name="twitter:description">\n/, false],
  ['twitterImage', /^ {2}<meta content="([\s\S]*?)" name="twitter:image">\n/, false],
  ['ogType', /^ {2}<meta property="og:type" content="website">\n/, true],
  ['twitterCard', /^ {2}<meta content="summary_large_image" name="twitter:card">\n/, true],
];

const INVARIANT =
  '  <meta content="width=device-width, initial-scale=1" name="viewport">\n' +
  '  <meta content="PLH4k2tg1NsSyflI190jsJtrcx6z3PAjcGhI2lBcQEw" name="google-site-verification">\n' +
  '  <link href="/css/normalize.css" rel="stylesheet" type="text/css">\n' +
  '  <link href="/css/components.css" rel="stylesheet" type="text/css">\n' +
  '  <link href="/css/radix-web.css" rel="stylesheet" type="text/css">\n' +
  '  <link href="https://fonts.googleapis.com" rel="preconnect">\n' +
  '  <link href="https://fonts.gstatic.com" rel="preconnect" crossorigin="anonymous">\n';

// Measured (see REBUILD-PLAN.md Task 2.1b prep): unlike the static pipeline's 5
// interleaved exceptions, every one of the 20 detail collections keeps the
// invariant block contiguous right after the SEO subset. Assert that stays true.
const EXPECTED_EXCEPTIONS = new Set();

const results = [];
let ok = true;

for (const [key, entry] of Object.entries(manifest)) {
  const collection = entry.collection ?? key;
  const path = `src/shells/_detail/${collection}/head.html`;
  const original = readFileSync(path, 'utf8');

  const m = PREFIX_RE.exec(original);
  if (!m) {
    console.error(`FAIL ${collection}: head.html does not start with the expected charset+title prefix`);
    ok = false;
    continue;
  }
  const title = m[1];
  let rest = original.slice(m[0].length);
  let consumed = m[0];

  const head = { title };
  for (const [prop, re, isBool] of SEO_FIELDS) {
    const fm = re.exec(rest);
    if (!fm) continue;
    head[prop] = isBool ? true : fm[1];
    rest = rest.slice(fm[0].length);
    consumed += fm[0];
  }

  let tail = rest;
  let skipInvariant;
  if (rest.startsWith(INVARIANT)) {
    skipInvariant = false;
    tail = rest.slice(INVARIANT.length);
    consumed += INVARIANT;
  } else {
    skipInvariant = true;
    tail = rest;
  }
  if (skipInvariant) head.skipInvariant = true;
  consumed += tail;

  // Reconstruction proof: what we captured + the unconsumed tail must equal the
  // original byte-for-byte. This is the actual safety net, not the pattern list.
  if (consumed !== original) {
    console.error(`FAIL ${collection}: reconstruction mismatch (should be impossible)`);
    ok = false;
    continue;
  }

  const isException = EXPECTED_EXCEPTIONS.has(collection);
  if (skipInvariant !== isException) {
    console.error(
      `FAIL ${collection}: skipInvariant=${skipInvariant} but expected-exception=${isException} ` +
      `(measurements said exactly {${[...EXPECTED_EXCEPTIONS].join(', ')}})`
    );
    ok = false;
    continue;
  }

  results.push({ key, collection, path, head, tail });
}

if (!ok) {
  console.error('\nAborting: fix the mismatches above before writing anything.');
  process.exit(1);
}

const actualExceptions = results.filter(r => r.head.skipInvariant).map(r => r.collection).sort();
console.log('Exception collections (skipInvariant):', actualExceptions.join(', ') || '(none)');
console.log(`Parsed ${results.length} detail shells OK.`);

if (DRY) {
  console.log('--dry-run: not writing anything.');
  process.exit(0);
}

for (const r of results) {
  manifest[r.key].head = r.head;
  writeFileSync(r.path, r.tail);
}
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 1));
console.log(`Wrote ${MANIFEST_PATH} and ${results.length} head.html tails.`);
