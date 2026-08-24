// Whitespace between inline elements is RENDERED. `</a> <a>` shows a space; `</a><a>`
// does not. Astro's compiler collapses whitespace when it emits markup, so every
// nativised template risks silently closing up gaps the design depends on -- and nothing
// else would notice: verify.mjs normalises whitespace out of its text comparison by
// design, and diff-dist only says "these bytes differ", which is expected in Phase 4.
//
// Two checks, because one alone is not enough:
//
//   FLOOR   gaps(dist) >= gaps(live), for every page. Catches catastrophic collapse.
//           Coarse on its own: 966 of 1,202 pages have MORE gaps than live (our markup is
//           pretty-printed, live is minified), so those carry slack and can lose gaps
//           without ever dropping below live. Verified: collapsing every `</a> <a>` on a
//           page did not trip it.
//
//   BASELINE  no page may have FEWER gaps than the last accepted build
//             (reference/inline-gaps.json). This is the precise signal -- it is exactly
//             "this change closed up a space that used to render".
//
// Counts, not positions: our markup is pretty-printed where live is minified, so the two
// cannot be aligned positionally.
//
// Refresh the baseline deliberately with --update-baseline when a drop is understood and
// intended; that leaves a reviewable commit.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const INLINE = 'a|span|strong|em|b|i|small|code|label|button|img|sub|sup|u|mark';
const RE = new RegExp(`</(${INLINE})>\\s+<(${INLINE})\\b`, 'gi');
const gaps = (s) => (s.match(RE) ?? []).length;

const walk = d => readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

if (!existsSync('dist')) { console.error('dist/ missing -- run pnpm build first.'); process.exit(2); }

const pages = walk('dist').filter(f => f.endsWith('.html') && !f.includes(`${sep}pagefind${sep}`));
const worse = [];
let compared = 0;

for (const p of pages) {
  const rel = relative('dist', p);
  const live = join('reference/live', rel);
  if (!existsSync(live)) continue;
  compared++;
  const d = gaps(readFileSync(p, 'utf8'));
  const l = gaps(readFileSync(live, 'utf8'));
  if (d < l) worse.push({ rel, live: l, dist: d });
}

console.log(`inline whitespace: ${compared} pages compared against reference/live`);

// BASELINE -- the sensitive check.
const BASELINE = 'reference/inline-gaps.json';
const current = {};
for (const p of pages) current[relative('dist', p).split(sep).join('/')] = gaps(readFileSync(p, 'utf8'));

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 0) + '\n');
  console.log(`baseline updated: ${Object.keys(current).length} pages -> ${BASELINE}`);
  process.exit(0);
}
if (existsSync(BASELINE)) {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const dropped = Object.keys(base).filter(k => k in current && current[k] < base[k]);
  console.log(`baseline           : ${Object.keys(base).length} pages, ${dropped.length} lost gaps since last accepted build`);
  if (dropped.length) {
    console.error(`\nFAIL: ${dropped.length} page(s) closed up whitespace that used to render:`);
    for (const k of dropped.slice(0, 20)) console.error(`  ${k}  was=${base[k]} now=${current[k]}`);
    process.exit(1);
  }
} else {
  console.log(`baseline           : none yet -- create with --update-baseline`);
}

if (worse.length) {
  console.error(`\nFAIL: ${worse.length} page(s) lost rendered space between inline elements.`);
  console.error(`Astro collapsed whitespace the original document rendered as a gap.`);
  for (const w of worse.slice(0, 20)) console.error(`  ${w.rel}  live=${w.live} dist=${w.dist}`);
  if (worse.length > 20) console.error(`  ... and ${worse.length - 20} more`);
  process.exit(1);
}
console.log('no page lost rendered inline whitespace');
