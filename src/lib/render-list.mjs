// Render a Webflow `w-dyn-list` slot from CMS data.
//
// The exported shell contains exactly one placeholder `w-dyn-item`. We clone it once
// per item and fill its slots, leaving every surrounding byte untouched -- that is
// what keeps Finsweet's fs-cmsfilter / fs-cmsnest / fs-cmsload attributes working,
// since they key off Webflow's own list DOM.
import { readFileSync, existsSync } from 'node:fs';
import { findTopLevelByClass } from '../../tools/lib/html-slice.mjs';
import { enumerate } from '../../tools/lib/dom-slots.mjs';
import { itemById, assetPath, rewriteAssetUrls } from './detail-data.mjs';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let listBindings = null;
function bindings() {
  if (!listBindings) {
    listBindings = existsSync('src/bindings/_lists.json')
      ? JSON.parse(readFileSync('src/bindings/_lists.json', 'utf8'))
      : {};
  }
  return listBindings;
}

const itemCache = new Map();
function collectionItems(collection) {
  if (!itemCache.has(collection)) {
    const p = `reference/webflow/items/${collection}.json`;
    const list = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
    itemCache.set(collection, new Map(list.map((i) => [i.fieldData?.slug, i])));
  }
  return itemCache.get(collection);
}

const fmtDate = (v, style) => {
  const d = new Date(v);
  if (Number.isNaN(+d)) return '';
  if (style === 'date:D MMMM YYYY')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

function resolve(item, { field, transform, literal }) {
  if (transform === 'literal') return literal;
  const v = field === 'slug' ? item.fieldData?.slug : item.fieldData?.[field];
  if (v == null || v === '') return '';
  if (transform === 'text') return rewriteAssetUrls(typeof v === 'object' ? '' : String(v));
  if (transform.startsWith('date:')) return fmtDate(v, transform);
  if (transform === 'asset') return assetPath(typeof v === 'object' ? v.url : v);
  if (transform === 'ref.name') { const r = itemById(v); return r ? (r.fieldData.name ?? r.fieldData.title ?? '') : ''; }
  if (transform === 'ref.slug') { const r = itemById(v); return r ? (r.fieldData.slug ?? '') : ''; }
  if (transform === 'ref[].name') {
    const ids = Array.isArray(v) ? v : [v];
    return ids.map((id) => itemById(id)?.fieldData?.name ?? '').filter(Boolean).join(', ');
  }
  return String(v);
}

/**
 * A MultiReference field (e.g. a blog post's categories) that renders as its own
 * NESTED w-dyn-list (a Finsweet cms-nest tag-pill pattern) needs one clone of the
 * nested item template PER referenced item -- joining names into one pill's text
 * (as `ref[].name` does) is only correct when there is exactly one. `slot` here is a
 * 'repeat' binding: { slot: <index of the nested w-dyn-list>, field, refCollection,
 * itemSlots: [{ slot: <absolute tpl index inside the anchor>, kind, field }] }.
 *
 * `ctx`, when given, is the CURRENT PAGE's own { collection, slug } -- e.g. rendering
 * blog-category/product-roadmap.html's post list, where each post's OWN category-tag
 * pill that happens to match "product-roadmap" gets Webflow's active/self-reference
 * highlight (`aria-current="page"` + a `w--current` class). Only detail pages that
 * pass their own identity down get this; static lists pass none and skip it.
 */
function renderRepeat(tpl, els, listEl, item, slot, ctx) {
  const nestedSeg = tpl.slice(listEl.start, listEl.end);
  const anchorRange = findTopLevelByClass(nestedSeg, 'w-dyn-item')[0];
  if (!anchorRange) return nestedSeg;
  const raw = item.fieldData?.[slot.field];
  const ids = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const refItems = ids.map((id) => itemById(id)).filter(Boolean);
  if (!refItems.length) return spliceList(nestedSeg, null, null);

  // Map each itemSlot's ABSOLUTE index (from enumerate(tpl)) to its LOCAL index
  // within the anchor's own markup (from enumerate(anchorHtml)) -- both traversals
  // visit the same elements in the same order since anchorHtml is a contiguous slice
  // of tpl, so position-within-range is a stable correspondence.
  const absAnchorStart = listEl.start + anchorRange[0];
  const absAnchorEnd = listEl.start + anchorRange[1];
  const within = els.filter((e) => e.start >= absAnchorStart && e.end <= absAnchorEnd);
  const localOf = new Map(within.map((e, idx) => [e.i, idx]));
  const anchorHtml = nestedSeg.slice(anchorRange[0], anchorRange[1]);
  const hrefItemSlot = (slot.itemSlots ?? []).find((is) => is.kind === 'attr:href');
  const anchorLocalIdx = hrefItemSlot ? localOf.get(hrefItemSlot.slot) : null;

  const rendered = refItems.map((refItem) => {
    const localSlots = (slot.itemSlots ?? [])
      .map((is) => ({ slot: localOf.get(is.slot), kind: is.kind, field: is.field, transform: 'text', collection: slot.refCollection }))
      .filter((s) => s.slot != null);
    const isCurrent = ctx && anchorLocalIdx != null
      && slot.refCollection === ctx.collection && refItem.fieldData?.slug === ctx.slug;
    if (isCurrent) {
      localSlots.push({ slot: anchorLocalIdx, kind: 'attr:class-add', literal: 'w--current', transform: 'literal' });
    }
    return fillItem(anchorHtml, refItem, localSlots);
  }).join('');
  return spliceList(nestedSeg, anchorRange, rendered);
}

/**
 * Fill one cloned item template. Exported for reuse by render-detail.
 *
 * An element can carry MORE THAN ONE binding at once -- e.g. an anchor whose inner
 * text is the item name AND whose href is the item's own permalink. Edits are grouped
 * per element (by start offset) and applied as a single combined open-tag rewrite;
 * handling them as independent slice/splice operations would have each one recompute
 * the open tag from the pristine template and clobber whatever the other changed.
 *
 * `ctx`, when given, is the current page's own { collection, slug } -- threaded through
 * to `renderRepeat` for a 'repeat' slot so it can detect a nested item that IS the
 * page it's rendered on (see renderRepeat's own doc comment).
 */
export function fillItem(tpl, item, slots, ctx) {
  const els = enumerate(tpl);
  const byEl = new Map();   // el.start -> { el, inner?: {content, empty}, attrs: Map<attr, value> }
  const replacements = [];  // whole-element replacements (repeats), disjoint from byEl
  for (const slot of slots) {
    const el = els[slot.slot];
    if (!el) continue;
    if (slot.kind === 'repeat') {
      replacements.push({ el, content: renderRepeat(tpl, els, el, item, slot, ctx) });
      continue;
    }
    const value = resolve(item, slot);
    const rec = byEl.get(el.start) ?? { el, attrs: new Map() };
    byEl.set(el.start, rec);
    if (slot.kind === 'inner' || slot.kind === 'html') {
      rec.inner = { content: slot.kind === 'html' ? value : esc(value), empty: !value };
    } else if (slot.kind.startsWith('attr:')) {
      const attr = slot.kind.slice(5);
      let next = value;
      if (attr === 'style') next = value ? `background-image:url("${value}")` : 'background-image:none';
      else if (attr === 'href' && slot.field === 'slug') next = value ? `/${slot.collection ?? ''}/${value}`.replace('//', '/') : '#';
      rec.attrs.set(attr, next);
    }
  }
  const partial = [...byEl.values()].map((r) => ({ start: r.el.start, end: r.el.end, kind: 'partial', rec: r }));
  const full = replacements.map((r) => ({ start: r.el.start, end: r.el.end, kind: 'full', content: r.content }));
  const edits = [...partial, ...full].sort((a, b) => b.start - a.start);   // right-to-left keeps offsets valid
  let out = tpl;
  for (const e of edits) {
    if (e.kind === 'full') { out = out.slice(0, e.start) + e.content + out.slice(e.end); continue; }
    const { el, inner, attrs } = e.rec;
    let openTag = tpl.slice(el.start, el.innerStart);
    if (inner) {
      const cls = el.cls;
      const nextCls = inner.empty
        ? (cls.includes('w-dyn-bind-empty') ? cls : `${cls} w-dyn-bind-empty`.trim())
        : cls.split(/\s+/).filter((c) => c !== 'w-dyn-bind-empty').join(' ');
      if (cls) openTag = openTag.replace(/class="[^"]*"/, `class="${nextCls}"`);
    }
    for (const [attr, value] of attrs) {
      if (attr === 'class-add') {
        // Append a class token rather than replacing the whole attribute -- used for
        // conditional markers (e.g. Webflow's `w--current` self-reference highlight)
        // that coexist with whatever class the element already carries.
        if (!value) continue;
        openTag = /class="/.test(openTag)
          ? openTag.replace(/class="([^"]*)"/, (m, c) => `class="${(c ? `${c} ` : '') + value}"`)
          : openTag.replace(/^<([\w:-]+)/, `<$1 class="${value}"`);
        continue;
      }
      const re = new RegExp(`${attr}="[^"]*"`);
      openTag = re.test(openTag)
        ? openTag.replace(re, `${attr}="${esc(value)}"`)
        : openTag.replace(/^<([\w:-]+)/, `<$1 ${attr}="${esc(value)}"`);
    }
    out = inner
      ? out.slice(0, el.start) + openTag + inner.content + out.slice(el.innerEnd)
      : out.slice(0, el.start) + openTag + out.slice(el.innerStart);
  }
  return out;
}

/**
 * A `w-dyn-list` template carries two sibling branches: the `w-dyn-items` wrapper
 * (holding the placeholder item) and a `w-dyn-empty` "No items found." fallback.
 * Webflow's published output only ever contains ONE of them; the raw export keeps
 * both, because it's the design-time markup rather than a rendered page. Once we
 * KNOW which branch applies, drop the other one so structure matches live.
 *
 * Offsets are computed from the PRISTINE segment (before any items are spliced in)
 * and applied as plain string edits -- never re-scan content that now contains real
 * CMS text. A live rich-text field can contain HTML unbalanced enough (a stray '<',
 * a dangling tag) to confuse the simple tag-depth parser this pipeline uses
 * elsewhere, and doing so once per rendered item multiplies that risk badly.
 */
export function spliceList(pristineSeg, itemRange, renderedHtml) {
  const emptyRange = findTopLevelByClass(pristineSeg, 'w-dyn-empty')[0];
  const edits = [];
  if (renderedHtml != null && itemRange) {
    edits.push({ s: itemRange[0], e: itemRange[1], html: renderedHtml });
    if (emptyRange) edits.push({ s: emptyRange[0], e: emptyRange[1], html: '' });
  } else {
    const itemsWrapper = findTopLevelByClass(pristineSeg, 'w-dyn-items')[0];
    if (itemsWrapper) edits.push({ s: itemsWrapper[0], e: itemsWrapper[1], html: '' });
  }
  edits.sort((a, b) => b.s - a.s);   // right-to-left keeps offsets valid
  let out = pristineSeg;
  for (const ed of edits) out = out.slice(0, ed.s) + ed.html + out.slice(ed.e);
  return out;
}

/**
 * Render one list slot. Returns the shell untouched when we have no binding for it --
 * an unbound list must look exactly like the export, never half-filled.
 */
export function renderList(route, index, shell) {
  const b = bindings()[`${route}#${index}`];
  // A CONFIRMED empty list (derivation saw zero live items) is known truth: match
  // live by keeping only the w-dyn-empty branch. An UNRESOLVED list (no entry at
  // all) is unknown truth -- leave the shell fully verbatim, never guess.
  if (b?.empty) return spliceList(shell, null, null);
  if (!b || !b.collection || !b.items?.length) return shell;

  const shellItems = findTopLevelByClass(shell, 'w-dyn-item');
  if (!shellItems.length) return shell;
  const [ts, te] = shellItems[0];
  const tpl = shell.slice(ts, te);
  const lookup = collectionItems(b.collection);

  const slots = (b.slots ?? []).map((s) => ({ ...s, collection: b.collection }));
  const rendered = b.items
    .map((slug) => (slug ? lookup.get(slug) : null))
    .filter(Boolean)
    .map((item) => fillItem(tpl, item, slots));

  if (!rendered.length) return shell;
  // Replace the single placeholder with the rendered run; everything else is verbatim.
  return spliceList(shell, [ts, te], rendered.join(''));
}
