// Inline style="" parity against reference/live.
//
// WHY THIS EXISTS: the nativised blog components dropped the inline colour Webflow puts
// on category pills --
//     <div style="color:white;background-color:#00ab84" class="cbfs-tag">AMA</div>
// -- costing 8,066 coloured pills across 644 pages. Every gate passed.
//
//   verify.mjs (default)  strips w-dyn-list interiors, where most pills live
//   verify.mjs --lists    compares tags, classes and TEXT -- a style attribute is none
//   test-astro-artifacts  looks for Astro-GENERATED styling, not missing Webflow styling
//   test-head-parity      <head> only
//
// Webflow puts real design in inline style attributes (pill colours, background images,
// video posters). Losing one is a visible change that structure and text cannot see, so
// count them per page and refuse to go below live.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const walk = d => readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

const count = (s) => (s.match(/\sstyle="[^"]*"/g) ?? []).length;

if (!existsSync('dist')) { console.error('dist/ missing -- run pnpm build first.'); process.exit(2); }

const BASELINE = 'reference/style-attrs-baseline.json';
const pages = walk('dist').filter(f => f.endsWith('.html') && !f.includes(`${sep}pagefind${sep}`));
const cur = {};
let tl = 0, td = 0, short = [];

for (const p of pages) {
  const rel = relative('dist', p).split(sep).join('/');
  const lv = join('reference/live', rel);
  if (!existsSync(lv)) continue;
  const d = count(readFileSync(p, 'utf8')), l = count(readFileSync(lv, 'utf8'));
  cur[rel] = d; tl += l; td += d;
  if (d < l) short.push({ rel, live: l, ours: d });
}

console.log(`inline style attributes: ours ${td} / live ${tl}`);
console.log(`  pages below live: ${short.length}`);

if (process.argv.includes('--update-baseline')) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(BASELINE, JSON.stringify({ shortPages: short.length, perPage: cur }, null, 0) + '\n');
  console.log(`baseline updated -> ${BASELINE} (records KNOWN-SHORT pages; may only go down)`);
  process.exit(0);
}
if (!existsSync(BASELINE)) { console.error(`\nNo ${BASELINE}. Create with --update-baseline`); process.exit(2); }

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const dropped = Object.keys(base.perPage).filter(k => k in cur && cur[k] < base.perPage[k]);
if (dropped.length) {
  console.error(`\nFAIL: ${dropped.length} page(s) lost inline style attributes since the last accepted build:`);
  for (const k of dropped.slice(0, 15)) console.error(`  ${k}  was=${base.perPage[k]} now=${cur[k]}`);
  process.exit(1);
}
if (short.length > base.shortPages) {
  console.error(`\nFAIL: pages below live rose ${base.shortPages} -> ${short.length}`);
  for (const s of short.slice(0, 10)) console.error(`  ${s.rel}  live=${s.live} ours=${s.ours}`);
  process.exit(1);
}
console.log('no inline style attributes lost');
