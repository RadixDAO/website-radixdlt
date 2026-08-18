// Compare built pages against the live mirror (reference/live/).
//
// Two modes, because they fail for different reasons:
//   --chrome (default) ignores the interior of every w-dyn-list. This isolates page
//     structure/layout, which is what Phases 1-2 own. CMS lists are empty until Phase 3,
//     so including them would drown the signal.
//   --lists compares list interiors too. Meaningful only once Phase 3 has run.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { elementRange, findTopLevelByClass } from './lib/html-slice.mjs';

const mode = process.argv.includes('--lists') ? 'lists' : 'chrome';
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));

/** Remove the interior of every w-dyn-list so CMS content can't affect the comparison. */
function stripLists(html) {
  const ranges = findTopLevelByClass(html, 'w-dyn-list');
  let out = '', cur = 0;
  for (const [s, e] of ranges) { out += html.slice(cur, s) + '<!--DYNLIST-->'; cur = e; }
  return out + html.slice(cur);
}

/** Tag + class skeleton of <body>, normalised for things that legitimately differ. */
function skeleton(html) {
  let h = html.slice(html.search(/<body[^>]*>/i));
  if (mode === 'chrome') h = stripLists(h);
  const out = [];
  for (const m of h.matchAll(/<([a-zA-Z][\w:-]*)([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    if (tag === 'script' || tag === 'style') continue;   // runtime differs by design
    const cls = /class="([^"]*)"/.exec(m[2])?.[1] ?? '';
    const norm = cls.split(/\s+/).filter(Boolean)
      .filter(c => c !== 'w-dyn-bind-empty' && c !== 'w-condition-invisible')
      .sort().join(' ');
    out.push(`${tag}.${norm}`);
  }
  return out;
}

function lcsRatio(a, b) {
  // Myers-ish similarity via simple LCS on hashed lines, adequate for reporting.
  const m = a.length, n = b.length;
  if (!m && !n) return 1;
  const prev = new Uint32Array(n + 1); const cur = new Uint32Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur.fill(0);
    for (let j = 1; j <= n; j++)
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev.set(cur);
  }
  return (2 * prev[n]) / (m + n);
}

const walk = d => existsSync(d) ? readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]) : [];

let built = walk('dist').filter(f => f.endsWith('.html')).map(f => relative('dist', f));
if (only.length) built = built.filter(f => only.some(o => f === o || f === `${o}.html`));

const results = [];
for (const rel of built) {
  const route = rel.replace(/\.html$/, '');
  const livePath = join('reference/live', route === 'index' ? 'index.html' : `${route}.html`);
  if (!existsSync(livePath)) { results.push({ route, status: 'NO-LIVE' }); continue; }
  const a = skeleton(readFileSync(livePath, 'utf8'));
  const b = skeleton(readFileSync(join('dist', rel), 'utf8'));
  results.push({ route, status: 'ok', ratio: lcsRatio(a, b), live: a.length, built: b.length });
}

results.sort((x, y) => (x.ratio ?? 2) - (y.ratio ?? 2));
const scored = results.filter(r => r.status === 'ok');
console.log(`mode=${mode}  pages=${results.length}`);
if (scored.length) {
  const exact = scored.filter(r => r.ratio === 1).length;
  const good = scored.filter(r => r.ratio >= 0.98).length;
  console.log(`  exact match : ${exact}/${scored.length}`);
  console.log(`  >= 0.98     : ${good}/${scored.length}`);
  console.log(`  worst       : ${scored[0].route} ${scored[0].ratio.toFixed(4)} (live ${scored[0].live} vs built ${scored[0].built} tags)`);
  console.log('\nlowest 15:');
  for (const r of scored.slice(0, 15))
    console.log(`  ${r.ratio.toFixed(4)}  ${r.route}  (live ${r.live} / built ${r.built})`);
}
const noLive = results.filter(r => r.status === 'NO-LIVE');
if (noLive.length) console.log(`\nno live reference (${noLive.length}): ${noLive.slice(0, 10).map(r => r.route).join(', ')}`);
