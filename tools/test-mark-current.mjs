// Proves tools/lib/mark-current.mjs + the canonical blocks in src/chrome/ reproduce
// EVERY nav-bearing page in the built site byte-for-byte (REBUILD-PLAN.md Task 2.2:
// "Add a test asserting it reproduces the exact original nav for every one of the
// 958 [962, measured] nav-bearing pages").
//
//   node tools/test-mark-current.mjs
//
// For each of the 1,202 built pages: locate its nav (tools/lib/find-nav.mjs), derive
// the page's own URL path, load that variant's canonical block from src/chrome/, run
// markCurrent(canonical, path), and assert the result equals the raw nav bytes from
// dist/ exactly. This is a build artifact check (run `pnpm build` first) -- it proves
// the transform is correct, independent of whether the shells have been hoisted yet.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { findNavRange } from './lib/find-nav.mjs';
import { markCurrent } from './lib/mark-current.mjs';
import { VARIANT_NAMES, stripCurrentMarking } from './lib/nav-variants.mjs';

const DIST = 'dist';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** dist/foo/bar.html -> /foo/bar ; dist/index.html -> / */
function pathFor(relPath) {
  let p = '/' + relPath.replace(/\.html$/, '');
  p = p.replace(/\/index$/, '') || '/';
  if (p === '/index') p = '/';
  return p;
}

const canonCache = new Map();
function canonicalBlock(name) {
  if (!canonCache.has(name)) {
    canonCache.set(name, readFileSync(`src/chrome/nav.${name}.html`, 'utf8'));
  }
  return canonCache.get(name);
}

const files = walk(DIST);
let pass = 0, fail = 0, noNav = 0;
const failures = [];

for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const rel = relative(DIST, f).split(sep).join('/');
  const range = findNavRange(html);
  if (!range) { noNav++; continue; }

  const raw = html.slice(range[0], range[1]);
  const canon = stripCurrentMarking(raw);
  const hash = createHash('sha1').update(canon).digest('hex').slice(0, 8);
  const name = VARIANT_NAMES[hash];
  if (!name) {
    fail++; failures.push(`/${rel}: unknown variant ${hash}`); continue;
  }

  const currentPath = pathFor(rel);
  const reproduced = markCurrent(canonicalBlock(name), currentPath);
  if (reproduced === raw) {
    pass++;
  } else {
    fail++;
    let i = 0;
    while (i < Math.min(reproduced.length, raw.length) && reproduced[i] === raw[i]) i++;
    failures.push(`/${rel}: (${name}, path=${currentPath}) diverges at byte ${i}\n` +
      `    expected: ${JSON.stringify(raw.slice(Math.max(0, i - 40), i + 40))}\n` +
      `    got:      ${JSON.stringify(reproduced.slice(Math.max(0, i - 40), i + 40))}`);
  }
}

console.log(`${files.length} pages checked: ${pass} reproduced exactly, ${fail} failed, ${noNav} had no nav`);
if (failures.length) {
  console.log('\nfailures (first 20):');
  for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
  process.exit(1);
}
process.exit(0);
