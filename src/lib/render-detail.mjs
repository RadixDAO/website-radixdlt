// Fill a detail template's shell from a CMS item using its derived binding map.
// Splices by byte offset -- the surrounding Webflow markup is never re-serialized.
import { readFileSync, existsSync } from 'node:fs';
import { enumerate } from '../../tools/lib/dom-slots.mjs';
import { itemById, assetPath, rewriteAssetUrls } from './detail-data.mjs';
import { findTopLevelByClass } from '../../tools/lib/html-slice.mjs';
import { fillItem, spliceList } from './render-list.mjs';

// Nested lists inside detail templates vary per page (related posts, a category's
// posts). Sequences are materialised per page in src/bindings/detail-lists/.
const nestedCache = new Map();
function nested(collection) {
  if (!nestedCache.has(collection)) {
    const p = `src/bindings/detail-lists/${collection}.json`;
    nestedCache.set(collection, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
  }
  return nestedCache.get(collection);
}

const listItemCache = new Map();
function collectionBySlug(collection) {
  if (!listItemCache.has(collection)) {
    const p = `reference/webflow/items/${collection}.json`;
    const list = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
    listItemCache.set(collection, new Map(list.map((i) => [i.fieldData?.slug, i])));
  }
  return listItemCache.get(collection);
}

/**
 * Replace each nested w-dyn-list with its rendered items for THIS page.
 * Runs after page-level slots: those use element indices from the pristine shell,
 * and filling a list changes the element count. List ORDER is unaffected by
 * page-level edits, so index alignment still holds here.
 */
export function renderNestedLists(body, collection, slug) {
  const data = nested(collection);
  if (!data?.pages?.[slug]) return body;
  const perPage = data.pages[slug];
  const lists = findTopLevelByClass(body, 'w-dyn-list');
  const edits = [];
  for (const [idxStr, spec] of Object.entries(perPage)) {
    const li = Number(idxStr);
    if (!lists[li]) continue;
    const [ls, le] = lists[li];
    const seg = body.slice(ls, le);
    // CONFIRMED empty (derivation saw zero live items for this page+list): known
    // truth, so match live by keeping only the w-dyn-empty branch.
    if (spec?.empty) { edits.push({ ls, le, html: spliceList(seg, null, null) }); continue; }
    if (!spec?.items?.length) continue;
    const shellItems = findTopLevelByClass(seg, 'w-dyn-item');
    if (!shellItems.length) continue;
    const [ts, te] = shellItems[0];
    const tpl = seg.slice(ts, te);
    const lookup = collectionBySlug(spec.collection);
    const slots = (data.slots?.[li] ?? []).map((s) => ({ ...s, collection: spec.collection }));
    // Pass the CURRENT page's own identity through: a nested 'repeat' slot (e.g. a
    // blog post's category-tag pills) uses it to detect when one of its own nested
    // items IS the page being rendered, so it can add Webflow's self-reference
    // highlight the same way live does (see renderRepeat's doc comment).
    const ctx = { collection, slug };
    // A FLAT list (not a nested 'repeat') can ALSO be a self-reference case: e.g. a
    // blog-category page's own "browse categories" tab bar, where the tab matching
    // the current page gets the same `w--current` highlight. Detect it the same way:
    // the rendered item's own collection+slug equals the current page's.
    const hrefSlot = slots.find((s) => s.kind === 'attr:href');
    const rendered = spec.items
      .map((s) => (s ? lookup.get(s) : null))
      .filter(Boolean)
      .map((it) => {
        const isCurrent = hrefSlot && spec.collection === collection && it.fieldData?.slug === slug;
        const itemSlots = isCurrent
          ? [...slots, { slot: hrefSlot.slot, kind: 'attr:class-add', literal: 'w--current', transform: 'literal' }]
          : slots;
        return fillItem(tpl, it, itemSlots, ctx);
      });
    if (!rendered.length) continue;
    edits.push({ ls, le, html: spliceList(seg, [ts, te], rendered.join('')) });
  }
  edits.sort((a, b) => b.ls - a.ls);          // right-to-left keeps offsets valid
  let out = body;
  for (const e of edits) out = out.slice(0, e.ls) + e.html + out.slice(e.le);
  return out;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Webflow's rich-text editor stores a custom HTML embed block (e.g. a raw <table>) as
// `<div data-rt-embed-type='true'>...`, but the published page always renders it as
// `<div class="w-embed">...` -- CMS export keeps the editor's marker, live pages show
// the publish-time class. Normalise it wherever RichText is emitted verbatim.
const normaliseRichText = (s) => s.replace(/<div data-rt-embed-type=(['"])true\1\s*>/g, '<div class="w-embed">');

const fmtDate = (v, style) => {
  const d = new Date(v);
  if (Number.isNaN(+d)) return '';
  if (style === 'date:D MMMM YYYY')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

// Option fields store the option's id in fieldData, not its display name (e.g. a
// "status" field holding "5d07bb89..." meaning "Closed"). Resolve via the field's own
// schema, same source derive-bindings.mjs uses to offer this as a candidate match.
const optionFieldsCache = new Map();
function optionName(collection, field, id) {
  const key = collection;
  if (!optionFieldsCache.has(key)) {
    const p = `reference/webflow/fields/${collection}.json`;
    const map = new Map();
    if (existsSync(p)) {
      for (const f of JSON.parse(readFileSync(p, 'utf8')).fields ?? []) {
        if (f.type === 'Option' && f.validations?.options) {
          map.set(f.slug, new Map(f.validations.options.map(o => [o.id, o.name])));
        }
      }
    }
    optionFieldsCache.set(key, map);
  }
  return optionFieldsCache.get(key).get(field)?.get(id) ?? '';
}

/** Resolve one binding to its string value, or '' when the field is empty. */
export function resolve(item, { field, transform }, collection) {
  // `$`-prefixed fields are Webflow item metadata (lastPublished/lastUpdated/
  // createdOn) that has no corresponding CMS field -- read the item directly rather
  // than fieldData. See tools/derive-bindings.mjs for where these are offered.
  const v = field.startsWith('$') ? item[field.slice(1)] : item.fieldData?.[field];
  if (v == null || v === '') return '';
  switch (true) {
    case transform === 'text': return rewriteAssetUrls(typeof v === 'object' ? '' : String(v));
    case transform.startsWith('date:'): return fmtDate(v, transform);
    case transform === 'asset': return assetPath(typeof v === 'object' ? v.url : v);
    case transform === 'ref.name': { const r = itemById(v); return r ? (r.fieldData.name ?? r.fieldData.title ?? '') : ''; }
    case transform === 'ref.slug': { const r = itemById(v); return r ? (r.fieldData.slug ?? '') : ''; }
    case transform === 'ref.image': { const r = itemById(v); return r?.fieldData?.image?.url ? assetPath(r.fieldData.image.url) : ''; }
    case transform === 'ref[].name': {
      const ids = Array.isArray(v) ? v : [v];
      return ids.map(id => itemById(id)?.fieldData?.name ?? '').filter(Boolean).join(', ');
    }
    case transform === 'option.name': return typeof v === 'string' ? optionName(collection, field, v) : '';
    default: return String(v);
  }
}

const bindingCache = new Map();
export function bindings(collection) {
  if (!bindingCache.has(collection)) {
    const p = `src/bindings/${collection}.json`;
    bindingCache.set(collection, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
  }
  return bindingCache.get(collection);
}

/**
 * Apply page-level slots to the shell body.
 * inList slots are skipped: they belong to nested collection lists, which are driven
 * by their own query rather than by this item.
 */
export function renderBody(shellBody, collection, item) {
  const map = bindings(collection);
  if (!map) return shellBody;
  const els = enumerate(shellBody);
  const edits = [];

  for (const slot of map.slots) {
    if (slot.inList) continue;
    const el = els[slot.slot];
    if (!el) continue;
    const value = resolve(item, slot, collection);

    if (slot.kind === 'inner' || slot.kind === 'html') {
      // An empty CMS field keeps Webflow's own empty marker, matching live exactly.
      const content = slot.kind === 'html' ? value : esc(value);
      edits.push({ el, kind: 'inner', content, empty: !value });
    } else if (slot.kind.startsWith('attr:')) {
      const attr = slot.kind.slice(5);
      let next = value;
      if (attr === 'style') next = value ? `background-image:url("${value}")` : 'background-image:none';
      else if (attr === 'href' && slot.transform === 'ref.slug') {
        const refCollection = refCollectionFor(collection, slot.field);
        next = value ? `/${refCollection}/${value}` : '#';
      }
      edits.push({ el, kind: 'attr', attr, content: next });
    }
  }

  // splice right-to-left so earlier offsets stay valid
  edits.sort((a, b) => b.el.start - a.el.start);
  let out = shellBody;
  for (const e of edits) {
    if (e.kind === 'inner') {
      const cls = e.el.cls;
      const withMarker = e.empty
        ? cls.includes('w-dyn-bind-empty') ? cls : `${cls} w-dyn-bind-empty`.trim()
        : cls.split(/\s+/).filter(c => c !== 'w-dyn-bind-empty').join(' ');
      const openTag = shellBody.slice(e.el.start, e.el.innerStart)
        .replace(/class="[^"]*"/, `class="${withMarker}"`);
      out = out.slice(0, e.el.start) + openTag + e.content + out.slice(e.el.innerEnd);
    } else {
      const openTag = shellBody.slice(e.el.start, e.el.innerStart);
      const next = new RegExp(`${e.attr}="[^"]*"`).test(openTag)
        ? openTag.replace(new RegExp(`${e.attr}="[^"]*"`), `${e.attr}="${esc(e.content)}"`)
        : openTag.replace(/^<(\w+)/, `<$1 ${e.attr}="${esc(e.content)}"`);
      out = out.slice(0, e.el.start) + next + out.slice(e.el.innerStart);
    }
  }
  return out;
}

/** Which collection does a Reference field point at? Derived from the field schema. */
let schemaCache = null;
function refCollectionFor(collection, field) {
  if (!schemaCache) {
    schemaCache = {};
    const map = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
    for (const c of map) for (const f of c.fields) schemaCache[`${c.slug}.${f.slug}`] = f;
  }
  // Field slug matches the target collection slug in this project's schema
  // (blog.blog-author -> blog-author). Verified across all Reference fields.
  return field;
}

export function renderHead(shellHead, collection, item) {
  const map = bindings(collection);
  if (!map?.head?.length) return shellHead;
  let out = shellHead;
  for (const h of map.head) {
    const value = resolve(item, h);
    const filled = (h.pattern ?? '{}').replace('{}', value);
    if (h.target === 'title') out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(filled)}</title>`);
  }
  return out;
}
