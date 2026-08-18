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
import { enumerate, signature, alignByLcs, bestSlotsFromEvidence, collapseNestedRepeats } from './lib/dom-slots.mjs';
import { applyShellPatch } from './lib/shell-patches.mjs';

const cols = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
const assetMap = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));
const EXPORT = '/Volumes/Development/radix/radixdlt.com/static export';

// A MultiReference field's schema names the TARGET collection by id, not slug --
// needed so a 'repeat' binding knows which collection prefix to build hrefs against.
const colById = new Map(cols.map((c) => [c.id, c.slug]));
const fieldsCache = new Map();
function refCollectionOf(collection, field) {
  if (!fieldsCache.has(collection)) {
    const p = `reference/webflow/fields/${collection}.json`;
    fieldsCache.set(collection, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).fields ?? [] : []);
  }
  const cid = fieldsCache.get(collection).find((f) => f.slug === field)?.validations?.collectionId;
  return cid ? colById.get(cid) ?? null : null;
}

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

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const strip = (h) => h
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  // Named entities AND numeric ones (&#39; decimal, &#x27; hex) -- a fixed named-entity
  // list misses &#x27;, which live HTML uses for apostrophes at least as often as the
  // named form. Missing it means text-based item identification (identify()) silently
  // fails on any title containing one, since the raw entity never matches the decoded
  // apostrophe in a candidate's name.
  .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (ENT[e]) return ENT[e];
    if (e[0] === '#') { try { return String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10)); } catch { return m; } }
    return m;
  })
  .replace(/\s+/g, ' ').trim();
const tail = (u) => { try { return decodeURIComponent(String(u)).split('/').filter(Boolean).pop(); } catch { return String(u); } };

function identify(segment) {
  // A card usually contains SEVERAL collection links -- the item's own link plus a
  // category/author tag. The tag is rendered via its own NESTED w-dyn-list (Finsweet
  // cms-nest), and its name is always present in the card's text too, so naive
  // text-matching over ALL hrefs picks the tag instead of the card's own item (and
  // does so inconsistently -- short tag names like "AMA" fail the length>3 guard and
  // fall through, long ones like "Community & Ecosystem" don't). Exclude hrefs that
  // live inside a nested w-dyn-list first; only fall back to them if the card has no
  // own-level collection link at all.
  const nestedRanges = findTopLevelByClass(segment, 'w-dyn-list');
  const isNested = (idx) => nestedRanges.some(([s, e]) => idx >= s && idx < e);
  const text = strip(segment).toLowerCase();
  const allHrefs = [...segment.matchAll(/href="\/([a-z0-9-]+)\/([^"#?]+)"/g)]
    .filter((m) => items.has(m[1]));
  const hrefs = allHrefs.some((m) => !isNested(m.index))
    ? allHrefs.filter((m) => !isNested(m.index))
    : allHrefs;
  let fallback = null;
  for (const m of hrefs) {
    const it = items.get(m[1]).find((x) => x.fieldData?.slug === m[2]);
    if (!it) continue;
    if (!fallback) fallback = { collection: m[1], slug: m[2] };
    const n = String(it.fieldData?.name ?? it.fieldData?.title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (n.length > 3 && text.includes(n)) return { collection: m[1], slug: m[2] };
  }
  if (fallback) return fallback;

  // Asset match (a unique image the item renders, e.g. a logo or an avatar) BEFORE
  // the byName text search: a card can legitimately quote/mention OTHER items by name
  // in its own free-text body (a tweet praising "the Radix Wallet", a testimonial
  // naming a partner), and byName's substring search has no way to tell that apart
  // from the card genuinely BEING that item. An asset URL is far less ambiguous.
  for (const m of segment.replace(/&quot;/g, '"').matchAll(/(?:src="|url\(["']?)([^"')]+)/g)) {
    const hit = byAsset.get(tail(m[1]));
    if (hit) return { collection: hit.col, slug: hit.slug };
  }
  const t = strip(segment).toLowerCase();
  let best = null;
  for (const [n, rec] of byName) if (n.length > 5 && t.includes(n) && (!best || n.length > best.n.length)) best = { n, rec };
  if (best) return { collection: best.rec.col, slug: best.rec.slug };
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
    else if (Array.isArray(v)) for (const id of v) {
      const r = byId.get(id);
      if (r) { push(r.fieldData?.name ?? r.fieldData?.title, field, 'ref[].name'); push(r.fieldData?.slug, field, 'ref[].slug'); }
    }
    else push(v, field, 'text');
  }
  push(it.fieldData?.slug, 'slug', 'text');
  return out;
}

// Optional fields (e.g. a blog post's excerpt) are only populated on SOME items, so a
// small sample can systematically miss them and leave the slot permanently unbound --
// not because the field never applies, but because none of the few sampled items
// happened to have it set. Sampling more pages/items lowers that risk.
const MAX_SAMPLES_FOR_SLOTS = 20;
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
  const itemCollectionByIndex = new Map();   // li -> collection slug of the items IN that list
  const tplElsByIndex = new Map();           // li -> enumerate(itemTemplate), for repeat collapsing
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
      // CONFIRMED empty: record it so the renderer can match live's empty-state
      // branch instead of leaving the shell's placeholder-item branch in place.
      if (!liveItems.length) { perPage[li] = { empty: true }; continue; }

      const ids = liveItems.map(([is, ie]) => identify(seg.slice(is, ie)));
      const known = ids.filter(Boolean);
      if (!known.length) continue;   // items exist but none identified: unresolved, leave verbatim
      perPage[li] = { collection: known[0].collection, items: ids.map((x) => (x ? x.slug : null)) };
      if (!itemCollectionByIndex.has(li)) itemCollectionByIndex.set(li, known[0].collection);

      // derive item-template slots once per (collection, listIndex)
      if (sampled < MAX_SAMPLES_FOR_SLOTS) {
        const shellSeg = shellBody.slice(shellLists[li][0], shellLists[li][1]);
        const shellItems = findTopLevelByClass(shellSeg, 'w-dyn-item');
        if (shellItems.length) {
          const tpl = shellSeg.slice(shellItems[0][0], shellItems[0][1]);
          const tplEls = enumerate(tpl); const tplSig = tplEls.map(signature);
          tplElsByIndex.set(li, tplEls);
          const evidence = evidenceByIndex.get(li) ?? new Map();
          evidenceByIndex.set(li, evidence);
          for (let k = 0; k < liveItems.length && k < 8; k++) {
            if (!ids[k]) continue;
            const it = items.get(ids[k].collection)?.find((x) => x.fieldData?.slug === ids[k].slug);
            if (!it) continue;
            const iseg = seg.slice(liveItems[k][0], liveItems[k][1]);
            const segEls = enumerate(iseg); const segSig = segEls.map(signature);
            const cands = candidates(it);
            for (const [i, j] of alignByLcs(tplSig, segSig)) {
              const s = tplEls[i], l = segEls[j];
              const lInner = iseg.slice(l.innerStart, l.innerEnd);
              const lText = strip(lInner);
              const sText = strip(tpl.slice(s.innerStart, s.innerEnd));
              if (lText && lText !== sText) {
                if (!lInner.includes('<')) {
                  const hit = cands.find((x) => strip(x.value).toLowerCase() === lText.toLowerCase() && x.transform !== 'asset');
                  if (hit) {
                    const kk = ['inner', hit.field, hit.transform].join(' ');
                    const e = evidence.get(i) ?? new Map(); e.set(kk, (e.get(kk) ?? 0) + 1); evidence.set(i, e);
                  }
                } else if (s.cls.split(/\s+/).includes('w-richtext')) {
                  // Webflow marks genuine RichText bind targets with a `w-richtext`
                  // class in the designer export -- that is the ONLY safe signal for
                  // entering this branch. Without it, a plain structural wrapper (e.g.
                  // one that contains a nested w-dyn-list of category tags) also
                  // "contains tags", and matching its concatenated text against some
                  // field would bind raw HTML into a container and blow away its real
                  // children.
                  // Its raw value carries HTML tags, so it never equals plain live
                  // text directly -- compare stripped text instead, and mark the
                  // binding 'html' (raw insert) rather than 'inner' (escaped).
                  const lLower = lText.toLowerCase();
                  let hit = cands.find((x) => x.transform === 'text' && strip(x.value).toLowerCase() === lLower);
                  if (!hit && lText.length >= 80) {
                    const probe = lLower.slice(0, 60);
                    hit = cands.find((x) => x.transform === 'text' && strip(x.value).toLowerCase().startsWith(probe));
                  }
                  if (hit) {
                    const kk = ['html', hit.field, hit.transform].join(' ');
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
    let slots = bestSlotsFromEvidence(evidence);
    const tplEls = tplElsByIndex.get(li);
    const itemCollection = itemCollectionByIndex.get(li);
    if (tplEls && itemCollection) {
      slots = collapseNestedRepeats(tplEls, slots, (field) => refCollectionOf(itemCollection, field));
    }
    slotsByIndex[li] = slots;
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
