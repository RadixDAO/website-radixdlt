// Phase 3: derive bindings for the w-dyn-list slots on static pages.
//
// Rather than reverse-engineering each list's Webflow filter/sort/limit (which the
// export does not record), we materialise the exact item sequence the live page
// renders. That reproduces the site precisely; the trade-off is that adding a CMS
// item later means re-deriving rather than the list updating itself. For a static
// migration the order is baked at build time regardless.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { findTopLevelByClass, documentParts } from './lib/html-slice.mjs';
import { enumerate, signature, alignByLcs, bestSlotsFromEvidence, collapseNestedRepeats } from './lib/dom-slots.mjs';

const cols = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
const assetMap = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));
const manifest = JSON.parse(readFileSync('src/shells/manifest.json', 'utf8'));

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

// Index items by a prefix of their longest text field. Some cards (testimonials,
// social comments) render only the quote -- the item's NAME is a handle that never
// appears in the card, so name- and asset-based identification both miss and the item
// is silently dropped from the rendered list.
const byBody = new Map();
for (const [col, list] of items) for (const it of list) {
  for (const v of Object.values(it.fieldData ?? {})) {
    if (typeof v !== 'string' || v.length < 40) continue;
    const key = v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).toLowerCase();
    if (key.length >= 25 && !byBody.has(key)) byBody.set(key, { col, slug: it.fieldData.slug });
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
  .replace(/\s+/g, ' ')
  .trim();

const tail = (u) => { try { return decodeURIComponent(String(u)).split('/').filter(Boolean).pop(); } catch { return String(u); } };

/** Identify which collection + item a rendered list item corresponds to. */
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
    const hit = byAsset.get(decodeURIComponent(m[1]).split('/').filter(Boolean).pop());
    if (hit) return { collection: hit.col, slug: hit.slug };
  }

  const t = strip(segment).toLowerCase();
  let best = null;
  for (const [n, recs] of byName) {
    if (n.length > 5 && t.includes(n) && (!best || n.length > best.n.length)) best = { n, rec: recs[0] };
  }
  if (best) return { collection: best.rec.col, slug: best.rec.slug };

  // Last resort: match the card against the item's OWN body text. Catches cards that
  // render only a quote, where the item's name is a handle shown nowhere.
  for (const [key, rec] of byBody) if (t.includes(key)) return { collection: rec.col, slug: rec.slug };
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
      for (const id of v) {
        const r = byId.get(id);
        if (r) {
          push(r.fieldData?.name ?? r.fieldData?.title, field, 'ref[].name');
          push(r.fieldData?.slug, field, 'ref[].slug');
        }
      }
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
      // Optional fields (e.g. a blog post's excerpt) are only populated on SOME
      // items, so a small sample can systematically miss them and leave the slot
      // permanently unbound -- not because the field never applies, but because none
      // of the few sampled items happened to have it set.
      for (let k = 0; k < liveItems.length && sampled < 20; k++) {
        if (!ids[k]) continue;
        const it = items.get(ids[k].collection)?.find((x) => x.fieldData?.slug === ids[k].slug);
        if (!it) continue;
        const seg = liveSeg.slice(liveItems[k][0], liveItems[k][1]);
        const segEls = enumerate(seg);
        const segSig = segEls.map(signature);
        const cands = candidates(it);
        for (const [i, j] of alignByLcs(tplSig, segSig)) {
          const s = tplEls[i], l = segEls[j];
          const lInner = seg.slice(l.innerStart, l.innerEnd);
          const lText = strip(lInner);
          const sText = strip(tpl.slice(s.innerStart, s.innerEnd));
          if (lText && lText !== sText) {
            if (!lInner.includes('<')) {
              const hit = cands.find((c) => strip(c.value).toLowerCase() === lText.toLowerCase() && c.transform !== 'asset');
              if (hit) {
                const kk = ['inner', hit.field, hit.transform].join(' ');
                const e = evidence.get(i) ?? new Map(); e.set(kk, (e.get(kk) ?? 0) + 1); evidence.set(i, e);
              }
            } else if (s.cls.split(/\s+/).includes('w-richtext')) {
              // Webflow marks genuine RichText bind targets with a `w-richtext` class
              // in the designer export -- that is the ONLY safe signal for entering
              // this branch. Without it, a plain structural wrapper (e.g. one that
              // contains a nested w-dyn-list of category tags) also "contains tags",
              // and matching its concatenated text against some field would bind raw
              // HTML into a container and blow away its real children.
              // Its raw value carries HTML tags, so it never equals plain live text
              // directly -- compare stripped text instead, and mark the binding
              // 'html' (raw insert) rather than 'inner' (escaped).
              const lLower = lText.toLowerCase();
              let hit = cands.find((c) => c.transform === 'text' && strip(c.value).toLowerCase() === lLower);
              if (!hit && lText.length >= 80) {
                const probe = lLower.slice(0, 60);
                hit = cands.find((c) => c.transform === 'text' && strip(c.value).toLowerCase().startsWith(probe));
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
      slots = bestSlotsFromEvidence(evidence);
      slots = collapseNestedRepeats(tplEls, slots, (field) => refCollectionOf(collection, field));
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
