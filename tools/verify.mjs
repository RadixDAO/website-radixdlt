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

/**
 * Visible text of <body>, normalised. Structure matching is NOT enough: a page with
 * every tag right and every CMS field empty scores 1.0 on skeleton alone. Text is what
 * actually proves the bindings fired.
 */
function textOf(html) {
  let h = html.slice(html.search(/<body[^>]*>/i));
  if (mode === 'chrome') h = stripLists(h);
  h = h.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  h = h.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (ENT[e]) return ENT[e];
    if (e[0] === '#') { try { return String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10)); } catch { return m; } }
    return m;
  });
  return h.replace(/\s+/g, ' ').trim();
}

/** Character-level similarity via word-bag overlap -- cheap and adequate for triage. */
function textRatio(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const bag = (s) => { const m = new Map(); for (const w of s.toLowerCase().split(/\s+/)) m.set(w, (m.get(w) ?? 0) + 1); return m; };
  const A = bag(a), B = bag(b);
  let inter = 0, total = 0;
  for (const [w, n] of A) { inter += Math.min(n, B.get(w) ?? 0); total += n; }
  for (const [w, n] of B) total += n;
  return (2 * inter) / total;
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
  const liveHtml = readFileSync(livePath, 'utf8');
  const builtHtml = readFileSync(join('dist', rel), 'utf8');
  const a = skeleton(liveHtml), b = skeleton(builtHtml);
  const lt = textOf(liveHtml), bt = textOf(builtHtml);
  results.push({
    route, status: 'ok', ratio: lcsRatio(a, b), live: a.length, built: b.length,
    text: textRatio(lt, bt), liveChars: lt.length, builtChars: bt.length,
  });
}

results.sort((x, y) => ((x.ratio ?? 2) + (x.text ?? 2)) - ((y.ratio ?? 2) + (y.text ?? 2)));
const scored = results.filter(r => r.status === 'ok');
console.log(`mode=${mode}  pages=${results.length}`);
if (scored.length) {
  const exact = scored.filter(r => r.ratio === 1 && r.text >= 0.995).length;
  const good = scored.filter(r => r.ratio >= 0.98 && r.text >= 0.98).length;
  console.log(`  exact match : ${exact}/${scored.length}`);
  console.log(`  >= 0.98     : ${good}/${scored.length}`);
  console.log(`  worst       : ${scored[0].route} struct=${scored[0].ratio.toFixed(4)} text=${scored[0].text.toFixed(4)}`);
  console.log('\nlowest 15:');
  for (const r of scored.slice(0, 15))
    console.log(`  struct=${r.ratio.toFixed(4)} text=${r.text.toFixed(4)}  ${r.route}  (chars live ${r.liveChars} / built ${r.builtChars})`);
}
// per-collection breakdown: a missing binding map shows up as one whole collection
// sitting low, which is very different from a scattered handful of bad pages.
const byCol = new Map();
for (const r of scored) {
  const col = r.route.includes('/') ? r.route.split('/')[0] : '(static)';
  const a = byCol.get(col) ?? []; a.push(r); byCol.set(col, a);
}
console.log('\nby collection:');
const rows = [...byCol].map(([c, rs]) => ({
  c, n: rs.length,
  exact: rs.filter(x => x.ratio === 1 && x.text >= 0.995).length,
  avg: rs.reduce((a, b) => a + b.ratio, 0) / rs.length,
  txt: rs.reduce((a, b) => a + b.text, 0) / rs.length,
  minTxt: Math.min(...rs.map(x => x.text)),
})).sort((a, b) => (a.txt + a.avg) - (b.txt + b.avg));
for (const r of rows)
  console.log(`  ${r.c.padEnd(30)} n=${String(r.n).padStart(4)}  exact=${String(r.exact).padStart(4)}  struct=${r.avg.toFixed(4)}  TEXT=${r.txt.toFixed(4)}  minTxt=${r.minTxt.toFixed(4)}`);

const noLive = results.filter(r => r.status === 'NO-LIVE');
if (noLive.length) console.log(`\nno live reference (${noLive.length}): ${noLive.slice(0, 10).map(r => r.route).join(', ')}`);
