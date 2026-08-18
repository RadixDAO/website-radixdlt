// Phase 3: derive a CMS binding map for a detail template by aligning the exported
// shell against real live pages, then matching the live values back to CMS fieldData.
//
//   node tools/derive-bindings.mjs <collection> [sampleCount]
//
// Emits src/bindings/<collection>.json as a PROPOSAL. A human reviews it; the
// acceptance test is that rendering it diffs clean against reference/live.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { enumerate, signature } from './lib/dom-slots.mjs';
import { collapseLists } from './lib/html-slice.mjs';
import { rewriteUrl } from './lib/rewrite-urls.mjs';

const collection = process.argv[2];
const sampleCount = Number(process.argv[3] ?? 3);
if (!collection) { console.error('usage: derive-bindings.mjs <collection> [n]'); process.exit(1); }

const map = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
const meta = map.find(c => c.slug === collection);
if (!meta) { console.error(`unknown collection ${collection}`); process.exit(1); }

const items = JSON.parse(readFileSync(`reference/webflow/items/${collection}.json`, 'utf8'));
const live = items.filter(i => !i.isDraft && !i.isArchived);
const assetMap = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));

// Referenced collections, for resolving Reference / MultiReference to display values.
const refCache = new Map();
const loadRef = slug => {
  if (!refCache.has(slug)) {
    const p = `reference/webflow/items/${slug}.json`;
    refCache.set(slug, existsSync(p)
      ? new Map(JSON.parse(readFileSync(p, 'utf8')).map(i => [i.id, i]))
      : new Map());
  }
  return refCache.get(slug);
};
const allRefItems = new Map();          // id -> item, across every collection
for (const c of map) for (const i of loadRef(c.slug).values()) allRefItems.set(i.id, i);

const shellPath = `/Volumes/Development/radix/radixdlt.com/static export/${meta.detailTemplate}`;
const shellRaw = readFileSync(shellPath, 'utf8');
const shellHead = shellRaw.slice(shellRaw.search(/<head[^>]*>/), shellRaw.indexOf('</head>'));
const shellBody = shellRaw.slice(shellRaw.search(/<body[^>]*>/), shellRaw.lastIndexOf('</body>'));
const shellEls = enumerate(shellBody);
const shellSig = shellEls.map(signature);

// Elements inside a w-dyn-list bind per LIST ITEM, not per detail item. They belong to
// a nested-list binding, so flag them rather than mixing them into the page map.
const listRanges = shellEls.filter(e => e.cls.split(/\s+/).includes('w-dyn-list'))
  .map(e => [e.start, e.end]);
const inList = (e) => listRanges.some(([s0, e0]) => e.start > s0 && e.end <= e0);

// Webflow marks bound elements. Structure is everything else -- without this filter,
// every ancestor of a real slot looks like a binding too.
const isLeaf = (e) => !shellBody.slice(e.innerStart, e.innerEnd).includes('<');
const isBindCandidate = (e) => {
  const c = e.cls.split(/\s+/);
  return c.includes('w-dyn-bind-empty') || c.includes('w-richtext') || isLeaf(e);
};

/** Every scalar the item can produce, flattened to candidate strings. */
function candidates(item) {
  const out = [];
  const push = (value, field, transform) => { if (value) out.push({ value: String(value), field, transform }); };
  for (const [field, v] of Object.entries(item.fieldData ?? {})) {
    if (v == null) continue;
    if (typeof v === 'string') {
      push(v, field, 'text');
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
        const d = new Date(v);
        push(d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }), field, 'date:MMMM D, YYYY');
        push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), field, 'date:D MMMM YYYY');
      }
    } else if (typeof v === 'object' && v.url) {
      push(v.url, field, 'asset');
      push(assetMap[v.url] ?? '', field, 'asset');
    } else if (Array.isArray(v)) {
      for (const id of v) { const r = allRefItems.get(id); if (r) push(r.fieldData?.name ?? r.fieldData?.title, field, 'ref[].name'); }
    } else if (typeof v === 'boolean' || typeof v === 'number') push(v, field, 'text');
    if (typeof v === 'string' && allRefItems.has(v)) {
      const r = allRefItems.get(v);
      push(r.fieldData?.name ?? r.fieldData?.title, field, 'ref.name');
      push(r.fieldData?.slug, field, 'ref.slug');
      if (r.fieldData?.image?.url) { push(r.fieldData.image.url, field, 'ref.image'); push(assetMap[r.fieldData.image.url] ?? '', field, 'ref.image'); }
    }
  }
  return out;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', '#39': "'" };
const decodeEnt = s => s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
  if (ENTITIES[e]) return ENTITIES[e];
  if (e[0] === '#') return String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10));
  return m;
});
const norm = s => decodeEnt(s).replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
const stripTags = s => norm(s.replace(/<[^>]*>/g, ''));

// Align each sample live page against the shell and collect evidence per slot.
const evidence = new Map();   // slotIndex -> Map<"field|transform", count>
const seen = new Map();       // slotIndex -> example live value
let sampled = 0;

for (const item of live) {
  if (sampled >= sampleCount) break;
  const slug = item.fieldData?.slug;
  const p = `reference/live/${collection}/${slug}.html`;
  if (!slug || !existsSync(p)) continue;
  const raw = readFileSync(p, 'utf8');
  // Collapse populated lists to one item so the live DOM is 1:1 with the shell --
  // otherwise LCS absorbs the extra items by mis-pairing nav elements.
  const body = collapseLists(raw.slice(raw.search(/<body[^>]*>/), raw.lastIndexOf('</body>')));
  const liveEls = enumerate(body);
  const liveSig = liveEls.map(signature);

  // LCS alignment on signatures
  const n = shellSig.length, m2 = liveSig.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m2 + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m2 - 1; j >= 0; j--)
      dp[i][j] = shellSig[i] === liveSig[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m2;) {
    if (shellSig[i] === liveSig[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }

  const cands = candidates(item);
  for (const [si, li] of pairs) {
    const s = shellEls[si], l = liveEls[li];
    const sInner = norm(shellBody.slice(s.innerStart, s.innerEnd));
    const lInner = norm(body.slice(l.innerStart, l.innerEnd));
    // Compare TEXT, not raw markup: the shell still carries the export's relative
    // URLs (../blog.html) where live has /blog, so raw inner differs on every element
    // containing a link -- which is not a binding.
    if (stripTags(sInner) === stripTags(lInner)) continue;
    if (!lInner) continue;                                 // live empty too
    if (s.tag === 'style' || s.tag === 'script') continue;  // never a CMS binding
    if (!isBindCandidate(s)) continue;                     // structural container

    const lText = stripTags(lInner);
    if (!lText) continue;                                  // markup-only (svg, video, embed)
    let hit = cands.find(c => norm(c.value) === lText && c.transform !== 'asset');
    let kind = 'inner';
    if (!hit && lText.length >= 80) {
      // rich text: compare a substantial prefix, never an empty one
      const probe = lText.slice(0, 60);
      hit = cands.find(c => c.transform === 'text' && norm(stripTags(c.value)).startsWith(probe));
      if (hit) kind = 'html';
    }
    if (!hit) { if (isBindCandidate(s)) seen.set(si, lText.slice(0, 70)); continue; }
    const key = [kind, hit.field, hit.transform].join('\u0000');
    const e = evidence.get(si) ?? new Map();
    e.set(key, (e.get(key) ?? 0) + 1);
    evidence.set(si, e);
  }

  // attribute bindings: style/href/src that differ between shell and live
  for (const [si, li] of pairs) {
    const s = shellEls[si], l = liveEls[li];
    for (const attr of ['style', 'href', 'src', 'srcset']) {
      if (attr === 'style' && !/background/i.test(l.attrs)) continue;
      const svRaw = new RegExp(`${attr}="([^"]*)"`).exec(s.attrs)?.[1] ?? '';
      const lv = new RegExp(`${attr}="([^"]*)"`).exec(l.attrs)?.[1] ?? '';
      // Normalise the shell's export-relative URL the same way the build does.
      const sv = svRaw && (attr === 'href' || attr === 'src') ? rewriteUrl(svRaw, '') : svRaw;
      if (sv === lv || !lv) continue;
      const lvDec = decodeEnt(lv);
      const url = /url\(["']?([^"')]+)/.exec(lvDec)?.[1] ?? lvDec;
      const dec = (x) => { try { return decodeURI(x); } catch { return x; } };
      // Webflow serves the same asset from several CDN hostnames, so compare the
      // <24-hex-id>_<filename> tail rather than the full URL.
      const tail = (x) => dec(String(x)).split('/').filter(Boolean).pop() ?? '';
      const hit = cands.find(c => c.value === url || dec(c.value) === dec(url)
        || (tail(c.value) && tail(c.value) === tail(url))
        || (c.transform.startsWith('ref.slug') && lvDec.endsWith('/' + c.value)));
      if (!hit) { continue; }
      const key = [`attr:${attr}`, hit.field, hit.transform].join('\u0000');
      const e = evidence.get(si) ?? new Map();
      e.set(key, (e.get(key) ?? 0) + 1);
      evidence.set(si, e);
    }
  }
  sampled++;
}

// ---- <head> bindings -------------------------------------------------------------
// SEO metadata is CMS-bound too, and matters more than most body slots. The head is
// small and highly patterned, so derive it directly rather than by DOM alignment.
const headEvidence = new Map();
let headSampled = 0;
const HEAD_TARGETS = [
  ['title',            h => /<title>([\s\S]*?)<\/title>/i.exec(h)?.[1]],
  ['meta:description', h => /<meta[^>]+name="description"[^>]*content="([^"]*)"/i.exec(h)?.[1]],
  ['meta:og:title',    h => /<meta[^>]+property="og:title"[^>]*content="([^"]*)"/i.exec(h)?.[1]],
  ['meta:og:description', h => /<meta[^>]+property="og:description"[^>]*content="([^"]*)"/i.exec(h)?.[1]],
  ['meta:og:image',    h => /<meta[^>]+property="og:image"[^>]*content="([^"]*)"/i.exec(h)?.[1]],
  ['meta:twitter:title', h => /<meta[^>]+name="twitter:title"[^>]*content="([^"]*)"/i.exec(h)?.[1]],
  ['meta:twitter:description', h => /<meta[^>]+name="twitter:description"[^>]*content="([^"]*)"/i.exec(h)?.[1]],
  ['meta:twitter:image', h => /<meta[^>]+name="twitter:image"[^>]*content="([^"]*)"/i.exec(h)?.[1]],
  ['link:canonical',   h => /<link[^>]+rel="canonical"[^>]*href="([^"]*)"/i.exec(h)?.[1]],
];
for (const item of live) {
  if (headSampled >= sampleCount) break;
  const slug = item.fieldData?.slug;
  const fp = `reference/live/${collection}/${slug}.html`;
  if (!slug || !existsSync(fp)) continue;
  const lh = readFileSync(fp, 'utf8');
  const liveHead = lh.slice(lh.search(/<head[^>]*>/), lh.indexOf('</head>'));
  const cands = candidates(item);
  const tail = (x) => { try { return decodeURI(String(x)).split('/').filter(Boolean).pop(); } catch { return String(x); } };
  for (const [name, get] of HEAD_TARGETS) {
    const lv = get(liveHead); if (!lv) continue;
    const sv = get(shellHead);
    const lvN = norm(lv);
    // template? e.g. "<name> | The Radix Blog"
    let hit = cands.find(c => norm(c.value) === lvN);
    let pattern = '{}';
    if (!hit) {
      // Longest candidate that appears inside the live value wins -- a short field can
      // coincidentally substring-match and truncate the surrounding template.
      const contained = cands
        .filter(c => c.value && c.transform === 'text' && norm(c.value).length > 8 && lvN.includes(norm(c.value)))
        .sort((a, b) => norm(b.value).length - norm(a.value).length);
      hit = contained[0];
      if (hit) {
        const needle = norm(hit.value);
        const at = lvN.indexOf(needle);
        pattern = lvN.slice(0, at) + '{}' + lvN.slice(at + needle.length);
      }
    }
    if (!hit) hit = cands.find(c => c.transform === 'asset' && tail(c.value) === tail(lv));
    if (!hit && lvN === norm(sv ?? '')) continue;                    // static, unchanged
    if (!hit) { continue; }
    const key = [name, hit.field, hit.transform, pattern].join('\u0000');
    headEvidence.set(key, (headEvidence.get(key) ?? 0) + 1);
  }
  // canonical is always the page's own URL
  headSampled++;
}
const headSlots = [];
const byTarget = new Map();
for (const [key, count] of headEvidence) {
  const [name] = key.split('\u0000');
  if (!byTarget.has(name) || byTarget.get(name)[1] < count) byTarget.set(name, [key, count]);
}
for (const [name, [key, count]] of byTarget) {
  const [, field, transform, pattern] = key.split('\u0000');
  headSlots.push({ target: name, field, transform, pattern, confidence: `${count}/${headSampled}` });
}

const slots = [];
for (const [si, e] of [...evidence].sort((a, b) => a[0] - b[0])) {
  const [key, count] = [...e].sort((a, b) => b[1] - a[1])[0];
  const [kind, field, transform] = key.split('\u0000');
  slots.push({
    slot: si, tag: shellEls[si].tag, class: shellEls[si].cls,
    kind, field, transform, confidence: `${count}/${sampled}`,
    ...(inList(shellEls[si]) ? { inList: true } : {}),
  });
}

mkdirSync('src/bindings', { recursive: true });
const outPath = `src/bindings/${collection}.json`;
writeFileSync(outPath, JSON.stringify({
  collection, template: meta.detailTemplate, route: `/${collection}/:slug`,
  samples: sampled, head: headSlots, slots,
}, null, 1));

console.log(`${collection}: sampled ${sampled} live pages, ${slots.length} body slots + ${headSlots.length} head slots -> ${outPath}`);
for (const h of headSlots) console.log(`  HEAD ${h.target.padEnd(24)} ${h.field} (${h.transform}) pattern="${h.pattern}" ${h.confidence}`);
for (const s of slots) console.log(`  #${String(s.slot).padStart(3)} ${(s.inList ? 'LIST ' : 'page ')}${s.kind.padEnd(9)} ${(s.tag + '.' + s.class).slice(0, 38).padEnd(40)} ${s.field} (${s.transform}) ${s.confidence}`);
if (seen.size) {
  console.log(`\nUNRESOLVED (live has content, no field matched) -- ${seen.size}:`);
  for (const [si, v] of [...seen].slice(0, 20)) console.log(`  #${String(si).padStart(3)} ${(shellEls[si].tag + '.' + shellEls[si].cls).slice(0, 40).padEnd(42)} "${v}"`);
}
