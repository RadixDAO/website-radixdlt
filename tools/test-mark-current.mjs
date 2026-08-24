// Proves tools/lib/mark-current.mjs + the canonical blocks in src/chrome/ reproduce
// EVERY nav-bearing and footer-bearing page in the built site byte-for-byte
// (REBUILD-PLAN.md Tasks 2.2 and 2.3).
//
//   node tools/test-mark-current.mjs
//
// For each of the 1,202 built pages: locate its nav and footer (tools/lib/find-nav.mjs
// and tools/lib/find-footer.mjs), derive the page's own URL path, load that variant's
// canonical blocks from src/chrome/, run markCurrent(canonical, path), and assert the
// result equals the raw nav/footer bytes from dist/ exactly. This is a build artifact
// check (run `pnpm build` first) -- it proves the transforms are correct, independent
// of whether the shells have been hoisted yet.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { findNavRange } from './lib/find-nav.mjs';
import { findFooterRange } from './lib/find-footer.mjs';
import { markCurrent } from './lib/mark-current.mjs';
import { VARIANT_NAMES as NAV_VARIANT_NAMES, stripCurrentMarking as stripNavMarking } from './lib/nav-variants.mjs';
import { VARIANT_NAMES as FOOTER_VARIANT_NAMES, stripCurrentMarking as stripFooterMarking } from './lib/footer-variants.mjs';

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

const navCanonCache = new Map();
function canonicalNav(name) {
  if (!navCanonCache.has(name)) {
    navCanonCache.set(name, readFileSync(`src/chrome/nav.${name}.html`, 'utf8'));
  }
  return navCanonCache.get(name);
}

const footerCanonCache = new Map();
function canonicalFooter(name) {
  if (!footerCanonCache.has(name)) {
    footerCanonCache.set(name, readFileSync(`src/chrome/footer.${name}.html`, 'utf8'));
  }
  return footerCanonCache.get(name);
}

const files = walk(DIST);
let navPass = 0, navFail = 0, noNav = 0;
let footerPass = 0, footerFail = 0, noFooter = 0;
const failures = [];

for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const rel = relative(DIST, f).split(sep).join('/');
  const currentPath = pathFor(rel);

  // Test nav
  const navRange = findNavRange(html);
  if (!navRange) {
    noNav++;
  } else {
    const raw = html.slice(navRange[0], navRange[1]);
    const canon = stripNavMarking(raw);
    const hash = createHash('sha1').update(canon).digest('hex').slice(0, 8);
    const name = NAV_VARIANT_NAMES[hash];
    if (!name) {
      navFail++;
      failures.push(`/${rel}: unknown nav variant ${hash}`);
    } else {
      const reproduced = markCurrent(canonicalNav(name), currentPath);
      if (reproduced === raw) {
        navPass++;
      } else {
        navFail++;
        let i = 0;
        while (i < Math.min(reproduced.length, raw.length) && reproduced[i] === raw[i]) i++;
        failures.push(`/${rel} [nav]: (${name}, path=${currentPath}) diverges at byte ${i}\n` +
          `    expected: ${JSON.stringify(raw.slice(Math.max(0, i - 40), i + 40))}\n` +
          `    got:      ${JSON.stringify(reproduced.slice(Math.max(0, i - 40), i + 40))}`);
      }
    }
  }

  // Test footer
  const footerRange = findFooterRange(html);
  if (!footerRange) {
    noFooter++;
  } else {
    const raw = html.slice(footerRange[0], footerRange[1]);
    const canon = stripFooterMarking(raw);
    const hash = createHash('sha1').update(canon).digest('hex').slice(0, 8);
    const name = FOOTER_VARIANT_NAMES[hash];
    if (!name) {
      footerFail++;
      failures.push(`/${rel}: unknown footer variant ${hash}`);
    } else {
      const reproduced = markCurrent(canonicalFooter(name), currentPath);
      if (reproduced === raw) {
        footerPass++;
      } else {
        footerFail++;
        let i = 0;
        while (i < Math.min(reproduced.length, raw.length) && reproduced[i] === raw[i]) i++;
        failures.push(`/${rel} [footer]: (${name}, path=${currentPath}) diverges at byte ${i}\n` +
          `    expected: ${JSON.stringify(raw.slice(Math.max(0, i - 40), i + 40))}\n` +
          `    got:      ${JSON.stringify(reproduced.slice(Math.max(0, i - 40), i + 40))}`);
      }
    }
  }
}

// Canonical chrome blocks must be stored UNMARKED. A block that keeps its source page's
// current-marking still passes the byte gate whenever that variant has exactly one page
// -- it is only wrong later, when the variant is shared or re-derived. Fail loudly.
const chrome = readdirSync('src/chrome').filter(f => f.endsWith('.html'));
const marked = chrome.filter(f => /w--current|aria-current/.test(readFileSync(`src/chrome/${f}`, 'utf8')));
console.log(`  chrome: ${chrome.length} canonical blocks, ${marked.length} carrying stale marking`);
if (marked.length) {
  console.error(`FAIL: canonical chrome blocks must be unmarked: ${marked.join(', ')}`);
  process.exit(1);
}

console.log(`${files.length} pages checked:`);
console.log(`  nav: ${navPass} reproduced exactly, ${navFail} failed, ${noNav} had no nav`);
console.log(`  footer: ${footerPass} reproduced exactly, ${footerFail} failed, ${noFooter} had no footer`);
if (failures.length) {
  console.log('\nfailures (first 20):');
  for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
  process.exit(1);
}
process.exit(0);
