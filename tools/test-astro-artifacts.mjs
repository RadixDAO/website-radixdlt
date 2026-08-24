// Two checks that would have caught the dead-carousel bug in commit bdb7345.
//
// The blog nativisation passed verify.mjs at struct 1.0000 / text 0.9999 while shipping
// a style that could never match: Astro SCOPED a Webflow-authored rule, emitting
// `.active[data-astro-cid-x] .dot[data-astro-cid-x]` against elements that carry no such
// attribute because they are rendered outside the component. verify.mjs compares
// tag/class skeleton and text -- a stylesheet is neither -- and diff-dist reported it
// only as "1 file added", which reads as routine.
//
// Both symptoms are cheap to detect directly, so detect them directly.
//
//   1. No data-astro-cid in any emitted page. Its presence means Astro scoped a
//      component's styles, which silently rewrites selectors the design depends on.
//      The fix is is:inline (matching where Webflow put the style) or is:global.
//   2. No CSS emitted under dist/_astro/. The design is public/css/radix-web.css plus
//      components.css and normalize.css. A generated bundle means styling has entered
//      the build that was not in the original document.
//
// Neither is a style preference. Both are "the design changed and nothing else noticed".
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const walk = d => readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

if (!existsSync('dist')) {
  console.error('dist/ does not exist -- run pnpm build first.');
  process.exit(2);
}

let failed = false;

// 1 -- scoped-style attributes in output
const pages = walk('dist').filter(f => f.endsWith('.html') && !f.includes(`${sep}pagefind${sep}`));
const scoped = pages.filter(f => readFileSync(f, 'utf8').includes('data-astro-cid'));
console.log(`scoped-style attributes : ${scoped.length} of ${pages.length} pages carry data-astro-cid`);
if (scoped.length) {
  failed = true;
  console.error(`\nFAIL: Astro scoped a component's styles. Scoping rewrites selectors, so any`);
  console.error(`rule targeting elements rendered outside that component silently stops matching.`);
  console.error(`Use <style is:inline> where the original document had the style inline.`);
  for (const f of scoped.slice(0, 15)) console.error(`  ${relative('dist', f)}`);
  if (scoped.length > 15) console.error(`  ... and ${scoped.length - 15} more`);
}

// 2 -- generated stylesheets
const astroDir = join('dist', '_astro');
const css = existsSync(astroDir) ? walk(astroDir).filter(f => f.endsWith('.css')) : [];
console.log(`generated stylesheets   : ${css.length} under dist/_astro/`);
if (css.length) {
  failed = true;
  console.error(`\nFAIL: the build emitted CSS. The design is radix-web.css / components.css /`);
  console.error(`normalize.css -- a generated bundle means styling entered the build that was not`);
  console.error(`in the original document.`);
  for (const f of css) {
    console.error(`  ${relative('dist', f)}  (${readFileSync(f, 'utf8').length} bytes)`);
    console.error(`    ${readFileSync(f, 'utf8').slice(0, 160)}`);
  }
}

if (failed) process.exit(1);
console.log('no Astro-generated styling artifacts');
