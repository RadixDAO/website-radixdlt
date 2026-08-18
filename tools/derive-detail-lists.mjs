// Phase 3: nested w-dyn-lists INSIDE detail templates (related posts, a category's
// posts, an author's posts, a project's categories).
//
// Unlike static-page lists, these vary per page, so a single materialised sequence
// will not do. We record the sequence PER PAGE from the live mirror -- exact, and it
// avoids guessing the Webflow filter/sort/limit rules the export does not record.
// Item-slot bindings are derived once per (collection, listIndex), since every page
// renders the same item template.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { findTopLevelByClass, documentParts } from './lib/html-slice.mjs';
import { enumerate, signature, alignByLcs } from './lib/dom-slots.mjs';
import { applyShellPatch } from './lib/shell-patches.mjs';

const cols = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
const assetMap = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));
const EXPORT = '/Volumes/Development/radix/radixdlt.com/static export';

const items = new Map();
for (const c of cols) items.set(c.slug, JSON.parse(readFileSync(`reference/webflow/items/${c.slug}.json`, 'utf8')));
const byId = new Map();
for (const [, list] of items) for (const it of list) byId.set(it.id, it);

const byName = new Map();
for (const [col, list] of items) for (const it of list) {
  const n = String(it.fieldData?.name ?? it.fieldData?.title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (n.length > 3 && !byName.has(n)) byName.set(n, { col, slug: it.fieldData.slug });
}
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
  .replace(/\s+/g, ' ').trim();
const tail = (u) => { try { return decodeURIComponent(String(u)).split('/').filter(Boolean).pop(); } catch { return String(u); } };

function identify(segment) {
  // A card usually contains SEVERAL collection links -- the item's own link plus a
  // category/author tag. Taking the first href fills blog-category lists with
  // categories instead of posts. Prefer the href whose item name actually appears in
  // the card's text; fall back to the first href only if none does.
  const text = strip(segment).toLowerCase();
  const hrefs = [...segment.matchAll(/href="\/([a-z0-9-]+)\/([^"#?]+)"/g)]
    .filter((m) => items.has(m[1]));
  let fallback = null;
  for (const m of hrefs) {
    const it = items.get(m[1]).find((x) => x.fieldData?.slug === m[2]);
    if (!it) continue;
    if (!fallback) fallback = { collection: m[1], slug: m[2] };
    const n = String(it.fieldData?.name ?? it.fieldData?.title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (n.length > 3 && text.includes(n)) return { collection: m[1], slug: m[2] };
  }
  if (fallback) return fallback;
  const t = strip(segment).toLowerCase();
  let best = null;
  for (const [n, rec] of byName) if (n.length > 5 && t.includes(n) && (!best || n.length > best.n.length)) best = { n, rec };
  if (best) return { collection: best.rec.col, slug: best.rec.slug };
  for (const m of segment.replace(/&quot;/g, '"').matchAll(/(?:src="|url\(["']?)([^"')]+)/g)) {
    const hit = byAsset.get(tail(m[1]));
    if (hit) return { collection: hit.col, slug: hit.slug };
  }
  return null;
}

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
    } else if (typeof v === 'object' && v.url) { push(v.url, field, 'asset'); push(assetMap[v.url] ?? '', field, 'asset'); }
    else if (Array.isArray(v)) for (const id of v) { const r = byId.get(id); if (r) push(r.fieldData?.name ?? r.fieldData?.title, field, 'ref[].name'); }
    else push(v, field, 'text');
  }
  push(it.fieldData?.slug, 'slug', 'text');
  return out;
}

const MAX_SAMPLES_FOR_SLOTS = 6;
const out = {};          // collection -> { slots: {index: [...]}, pages: {slug: {index: [slugs]}} }
let totalPages = 0, totalLists = 0;

for (const c of cols) {
  if (!c.hasDetailRoute || !c.detailTemplate) continue;
  const raw = readFileSync(`${EXPORT}/${c.detailTemplate}`, 'utf8');
  const shellBody = applyShellPatch(c.slug, documentParts(raw).body);
  const shellLists = findTopLevelByClass(shellBody, 'w-dyn-list');
  if (!shellLists.length) continue;

  const live = items.get(c.slug).filter((i) => !i.isDraft && !i.isArchived);
  const slotsByIndex = {};
  // Evidence accumulates across sampled pages. Locking slots in from the first page
  // that yields ANY match lets one weak sample (e.g. an item whose optional fields are
  // all empty) define the whole list's bindings.
  const evidenceByIndex = new Map();
  const pages = {};
  let sampled = 0;

  for (const item of live) {
    const slug = item.fieldData?.slug;
    const p = `reference/live/${c.slug}/${slug}.html`;
    if (!slug || !existsSync(p)) continue;
    const liveBody = documentParts(readFileSync(p, 'utf8')).body;
    const liveLists = findTopLevelByClass(liveBody, 'w-dyn-list');
    if (liveLists.length !== shellLists.length) continue;   // structures disagree; skip

    const perPage = {};
    for (let li = 0; li < shellLists.length; li++) {
      const [ls, le] = liveLists[li];
      const seg = liveBody.slice(ls, le);
      const liveItems = findTopLevelByClass(seg, 'w-dyn-item');
      if (!liveItems.length) continue;

      const ids = liveItems.map(([is, ie]) => identify(seg.slice(is, ie)));
      const known = ids.filter(Boolean);
      if (!known.length) continue;
      perPage[li] = { collection: known[0].collection, items: ids.map((x) => (x ? x.slug : null)) };

      // derive item-template slots once per (collection, listIndex)
      if (sampled < MAX_SAMPLES_FOR_SLOTS) {
        const shellSeg = shellBody.slice(shellLists[li][0], shellLists[li][1]);
        const shellItems = findTopLevelByClass(shellSeg, 'w-dyn-item');
        if (shellItems.length) {
          const tpl = shellSeg.slice(shellItems[0][0], shellItems[0][1]);
          const tplEls = enumerate(tpl); const tplSig = tplEls.map(signature);
          const evidence = evidenceByIndex.get(li) ?? new Map();
          evidenceByIndex.set(li, evidence);
          for (let k = 0; k < liveItems.length && k < 4; k++) {
            if (!ids[k]) continue;
            const it = items.get(ids[k].collection)?.find((x) => x.fieldData?.slug === ids[k].slug);
            if (!it) continue;
            const iseg = seg.slice(liveItems[k][0], liveItems[k][1]);
            const segEls = enumerate(iseg); const segSig = segEls.map(signature);
            const cands = candidates(it);
            for (const [i, j] of alignByLcs(tplSig, segSig)) {
              const s = tplEls[i], l = segEls[j];
              const lInner = iseg.slice(l.innerStart, l.innerEnd);
              if (!lInner.includes('<')) {
                const lText = strip(lInner);
                const sText = strip(tpl.slice(s.innerStart, s.innerEnd));
                if (lText && lText !== sText) {
                  const hit = cands.find((x) => strip(x.value).toLowerCase() === lText.toLowerCase() && x.transform !== 'asset');
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
                const hit = cands.find((x) => x.value === url || (tail(x.value) && tail(x.value) === tail(url))
                  || (x.field === 'slug' && clean.endsWith('/' + x.value)));
                if (hit) {
                  const kk = [`attr:${attr}`, hit.field, hit.transform].join(' ');
                  const e = evidence.get(i) ?? new Map(); e.set(kk, (e.get(kk) ?? 0) + 1); evidence.set(i, e);
                }
              }
            }
          }

        }
      }
    }
    if (Object.keys(perPage).length) { pages[slug] = perPage; totalLists += Object.keys(perPage).length; }
    sampled++;
    totalPages++;
  }

  for (const [li, evidence] of evidenceByIndex) {
    if (!evidence.size) continue;
    slotsByIndex[li] = [...evidence].sort((a, b) => a[0] - b[0]).map(([i, e]) => {
      const [kk] = [...e].sort((a, b) => b[1] - a[1])[0];
      const [kind, field, transform] = kk.split(' ');
      return { slot: i, kind, field, transform };
    });
  }
  if (Object.keys(pages).length) {
    out[c.slug] = { slots: slotsByIndex, pages };
  }
}

mkdirSync('src/bindings/detail-lists', { recursive: true });
for (const [col, data] of Object.entries(out)) {
  writeFileSync(`src/bindings/detail-lists/${col}.json`, JSON.stringify(data));
}
console.log(`collections with nested lists: ${Object.keys(out).length}`);
console.log(`pages processed: ${totalPages} | list instances recorded: ${totalLists}`);
for (const [col, d] of Object.entries(out))
  console.log(`  ${col.padEnd(28)} pages=${String(Object.keys(d.pages).length).padStart(4)}  listIndexesWithSlots=${Object.keys(d.slots).join(',') || '(none)'}`);
