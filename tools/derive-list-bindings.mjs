// Phase 3: derive bindings for the w-dyn-list slots on static pages.
//
// Rather than reverse-engineering each list's Webflow filter/sort/limit (which the
// export does not record), we materialise the exact item sequence the live page
// renders. That reproduces the site precisely; the trade-off is that adding a CMS
// item later means re-deriving rather than the list updating itself. For a static
// migration the order is baked at build time regardless.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { findTopLevelByClass, documentParts } from './lib/html-slice.mjs';
import { enumerate, signature } from './lib/dom-slots.mjs';

const cols = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
const assetMap = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));
const manifest = JSON.parse(readFileSync('src/shells/manifest.json', 'utf8'));

const items = new Map();
for (const c of cols) items.set(c.slug, JSON.parse(readFileSync(`reference/webflow/items/${c.slug}.json`, 'utf8')));

const byId = new Map();
for (const [, list] of items) for (const it of list) byId.set(it.id, it);

// Index items by normalised display name, for text-based identification.
const byName = new Map();
for (const [col, list] of items) for (const it of list) {
  const n = String(it.fieldData?.name ?? it.fieldData?.title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (n.length > 3) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push({ col, slug: it.fieldData.slug }); }
}

// Index items by any asset they carry: some lists render nothing but a logo, so
// text-based identification cannot see them.
const byAsset = new Map();
for (const [col, list] of items) for (const it of list) {
  for (const v of Object.values(it.fieldData ?? {})) {
    if (v && typeof v === 'object' && v.url) {
      const t = decodeURIComponent(String(v.url)).split('/').filter(Boolean).pop();
      if (t && !byAsset.has(t)) byAsset.set(t, { col, slug: it.fieldData.slug });
    }
  }
}

const ENT = { '&amp;': '&', '&nbsp;': ' ', '&#39;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' };
const strip = (h) => h
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;|&nbsp;|&#39;|&quot;|&lt;|&gt;/g, (m) => ENT[m])
  .replace(/\s+/g, ' ')
  .trim();

const tail = (u) => { try { return decodeURIComponent(String(u)).split('/').filter(Boolean).pop(); } catch { return String(u); } };

/** Identify which collection + item a rendered list item corresponds to. */
function identify(segment) {
  const href = /href="\/([a-z0-9-]+)\/([^"#?]+)"/.exec(segment);
  if (href && items.has(href[1])) {
    const it = items.get(href[1]).find((x) => x.fieldData?.slug === href[2]);
    if (it) return { collection: href[1], slug: href[2] };
  }
  const t = strip(segment).toLowerCase();
  let best = null;
  for (const [n, recs] of byName) {
    if (n.length > 5 && t.includes(n) && (!best || n.length > best.n.length)) best = { n, rec: recs[0] };
  }
  if (best) return { collection: best.rec.col, slug: best.rec.slug };

  // image-only items (logo grids): identify by the asset they render
  for (const m of segment.replace(/&quot;/g, '"').matchAll(/(?:src="|url\(["']?)([^"')]+)/g)) {
    const hit = byAsset.get(decodeURIComponent(m[1]).split('/').filter(Boolean).pop());
    if (hit) return { collection: hit.col, slug: hit.slug };
  }
  return null;
}

/** Candidate scalar values an item can produce. Mirrors derive-bindings.mjs. */
function candidates(it) {
  const out = [];
  const push = (v, field, transform) => { if (v) out.push({ value: String(v), field, transform }); };
  for (const [field, v] of Object.entries(it.fieldData ?? {})) {
    if (v == null) continue;
    if (typeof v === 'string') {
      push(v, field, 'text');
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
        const d = new Date(v);
        push(d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }), field, 'date:MMMM D, YYYY');
        push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), field, 'date:D MMMM YYYY');
      }
      const r = byId.get(v);
      if (r) { push(r.fieldData?.name ?? r.fieldData?.title, field, 'ref.name'); push(r.fieldData?.slug, field, 'ref.slug'); }
    } else if (typeof v === 'object' && v.url) {
      push(v.url, field, 'asset');
      push(assetMap[v.url] ?? '', field, 'asset');
    } else if (Array.isArray(v)) {
      for (const id of v) { const r = byId.get(id); if (r) push(r.fieldData?.name ?? r.fieldData?.title, field, 'ref[].name'); }
    } else push(v, field, 'text');
  }
  push(it.fieldData?.slug, 'slug', 'text');
  return out;
}

const result = {};
let pagesDone = 0, listsBound = 0, listsEmpty = 0, listsUnknown = 0;

for (const [route, page] of Object.entries(manifest)) {
  if (!page.listCount) continue;
  const lp = `reference/live/${route === 'index' ? 'index' : route}.html`;
  if (!existsSync(lp)) continue;
  const liveBody = documentParts(readFileSync(lp, 'utf8')).body;
  const liveLists = findTopLevelByClass(liveBody, 'w-dyn-list');

  for (let li = 0; li < page.listCount; li++) {
    const key = `${route}#${li}`;
    if (!liveLists[li]) { listsUnknown++; continue; }
    const [ls, le] = liveLists[li];
    const liveSeg = liveBody.slice(ls, le);
    const liveItems = findTopLevelByClass(liveSeg, 'w-dyn-item');
    if (!liveItems.length) { result[key] = { empty: true }; listsEmpty++; continue; }

    const ids = liveItems.map(([is, ie]) => identify(liveSeg.slice(is, ie)));
    const known = ids.filter(Boolean);
    if (!known.length) { listsUnknown++; continue; }
    const collection = known[0].collection;

    // Derive per-item slot bindings by aligning the shell's single placeholder item
    // against the first few identified live items. Positional alignment is safe here:
    // both sides are renderings of the same item template.
    const shell = readFileSync(`src/shells/${route}/list.${li}.html`, 'utf8');
    const shellItems = findTopLevelByClass(shell, 'w-dyn-item');
    let slots = [];
    if (shellItems.length) {
      const tpl = shell.slice(shellItems[0][0], shellItems[0][1]);
      const tplEls = enumerate(tpl);
      const tplSig = tplEls.map(signature);
      const evidence = new Map();
      let sampled = 0;
      for (let k = 0; k < liveItems.length && sampled < 4; k++) {
        if (!ids[k]) continue;
        const it = items.get(ids[k].collection)?.find((x) => x.fieldData?.slug === ids[k].slug);
        if (!it) continue;
        const seg = liveSeg.slice(liveItems[k][0], liveItems[k][1]);
        const segEls = enumerate(seg);
        const segSig = segEls.map(signature);
        const cands = candidates(it);
        const len = Math.min(tplSig.length, segSig.length);
        for (let i = 0; i < len; i++) {
          if (tplSig[i] !== segSig[i]) break;      // structures diverged; stop
          const s = tplEls[i], l = segEls[i];
          const lInner = seg.slice(l.innerStart, l.innerEnd);
          if (!lInner.includes('<')) {
            const lText = strip(lInner);
            const sText = strip(tpl.slice(s.innerStart, s.innerEnd));
            if (lText && lText !== sText) {
              const hit = cands.find((c) => strip(c.value).toLowerCase() === lText.toLowerCase() && c.transform !== 'asset');
              if (hit) {
                const kk = ['inner', hit.field, hit.transform].join(' ');
                const e = evidence.get(i) ?? new Map(); e.set(kk, (e.get(kk) ?? 0) + 1); evidence.set(i, e);
              }
            }
          }
          for (const attr of ['href', 'src', 'style']) {
            const lv = new RegExp(`${attr}="([^"]*)"`).exec(l.attrs)?.[1];
            const sv = new RegExp(`${attr}="([^"]*)"`).exec(s.attrs)?.[1];
            if (!lv || lv === sv) continue;
            const clean = lv.replace(/&quot;/g, '"');
            const url = /url\(["']?([^"')]+)/.exec(clean)?.[1] ?? clean;
            const hit = cands.find((c) => c.value === url
              || (tail(c.value) && tail(c.value) === tail(url))
              || (c.field === 'slug' && clean.endsWith('/' + c.value)));
            if (hit) {
              const kk = [`attr:${attr}`, hit.field, hit.transform].join(' ');
              const e = evidence.get(i) ?? new Map(); e.set(kk, (e.get(kk) ?? 0) + 1); evidence.set(i, e);
            }
          }
        }
        sampled++;
      }
      slots = [...evidence].sort((a, b) => a[0] - b[0]).map(([i, e]) => {
        const [kk] = [...e].sort((a, b) => b[1] - a[1])[0];
        const [kind, field, transform] = kk.split(' ');
        return { slot: i, kind, field, transform };
      });
    }

    result[key] = { collection, items: ids.map((x) => (x ? x.slug : null)), slots };
    listsBound++;
  }
  pagesDone++;
}

writeFileSync('src/bindings/_lists.json', JSON.stringify(result, null, 1));
const withSlots = Object.values(result).filter((r) => r.slots?.length).length;
console.log(`pages ${pagesDone} | lists bound ${listsBound} | empty ${listsEmpty} | unresolved ${listsUnknown}`);
console.log(`lists with derived item slots: ${withSlots}`);
