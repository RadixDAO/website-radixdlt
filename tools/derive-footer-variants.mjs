// Derive the canonical footer block per variant from the BUILT site (REBUILD-PLAN.md
// Task 2.3). Reusable: rerun any time dist/ changes to re-check that every
// footer-bearing page still reduces to one of the known variants.
//
//   node tools/derive-footer-variants.mjs [--write]
//
// Without --write: reports the variant groups found in dist/ and FAILS if any page's
// footer doesn't match a known variant (tools/lib/footer-variants.mjs) or if two pages
// claiming the same variant aren't byte-identical after stripping current-marking.
// With --write: also (re)writes src/chrome/footer.<name>.html from the first page seen
// in each group.
//
// Never reparses/reserialises: every canonical block is a verbatim substring of a
// real dist/ page.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { findFooterRange } from './lib/find-footer.mjs';
import { VARIANT_NAMES, stripCurrentMarking } from './lib/footer-variants.mjs';

const DIST = 'dist';
const CHROME_DIR = 'src/chrome';
const WRITE = process.argv.includes('--write');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = walk(DIST);
const groups = new Map(); // hash -> { canon, pages: [] }
let noFooter = 0;
let ok = true;

for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const rel = '/' + relative(DIST, f).split(sep).join('/');
  const range = findFooterRange(html);
  if (!range) { noFooter++; continue; }
  const canon = stripCurrentMarking(html.slice(range[0], range[1]));
  const hash = createHash('sha1').update(canon).digest('hex').slice(0, 8);
  if (!groups.has(hash)) groups.set(hash, { canon, pages: [] });
  const g = groups.get(hash);
  if (g.canon !== canon) {
    console.error(`FAIL: two pages hash to ${hash} but aren't byte-identical (${rel})`);
    ok = false;
  }
  g.pages.push(rel);
}

console.log(`${files.length} pages built; ${files.length - noFooter} footer-bearing, ${noFooter} without a footer\n`);

const sorted = [...groups.entries()].sort((a, b) => b[1].pages.length - a[1].pages.length);
for (const [hash, g] of sorted) {
  const name = VARIANT_NAMES[hash];
  if (!name) {
    console.error(`FAIL: unnamed variant ${hash} (n=${g.pages.length}, ${g.canon.length} bytes, e.g. ${g.pages[0]}). Add it to tools/lib/footer-variants.mjs.`);
    ok = false;
    continue;
  }
  console.log(`${hash}  ${name.padEnd(20)} n=${String(g.pages.length).padEnd(4)} bytes=${g.canon.length}  e.g. ${g.pages[0]}`);
}

const namedHashes = new Set(Object.keys(VARIANT_NAMES));
for (const hash of namedHashes) {
  if (!groups.has(hash)) {
    console.error(`FAIL: named variant ${hash} (${VARIANT_NAMES[hash]}) not found in the current build.`);
    ok = false;
  }
}

if (WRITE) {
  mkdirSync(CHROME_DIR, { recursive: true });
  for (const [hash, g] of sorted) {
    const name = VARIANT_NAMES[hash];
    if (!name) continue;
    writeFileSync(join(CHROME_DIR, `footer.${name}.html`), g.canon);
  }
  console.log(`\nwrote ${namedHashes.size} canonical blocks to ${CHROME_DIR}/`);
}

if (!ok) {
  console.error('\nFAILED -- see above.');
  process.exit(1);
}
console.log('\nOK -- every footer-bearing page reduces to a known, named variant.');
