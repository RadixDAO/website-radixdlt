// Render a Webflow `w-dyn-list` slot from CMS data.
//
// The exported shell contains exactly one placeholder `w-dyn-item`. We clone it once
// per item and fill its slots, leaving every surrounding byte untouched -- that is
// what keeps Finsweet's fs-cmsfilter / fs-cmsnest / fs-cmsload attributes working,
// since they key off Webflow's own list DOM.
import { readFileSync, existsSync } from 'node:fs';
import { findTopLevelByClass } from '../../tools/lib/html-slice.mjs';
import { enumerate } from '../../tools/lib/dom-slots.mjs';
import { itemById, assetPath } from './detail-data.mjs';

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

function resolve(item, { field, transform }) {
  const v = field === 'slug' ? item.fieldData?.slug : item.fieldData?.[field];
  if (v == null || v === '') return '';
  if (transform === 'text') return typeof v === 'object' ? '' : String(v);
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

/** Fill one cloned item template. */
function fillItem(tpl, item, slots) {
  const els = enumerate(tpl);
  const edits = [];
  for (const slot of slots) {
    const el = els[slot.slot];
    if (!el) continue;
    const value = resolve(item, slot);
    if (slot.kind === 'inner' || slot.kind === 'html') {
      edits.push({ el, kind: 'inner', content: slot.kind === 'html' ? value : esc(value), empty: !value });
    } else if (slot.kind.startsWith('attr:')) {
      const attr = slot.kind.slice(5);
      let next = value;
      if (attr === 'style') next = value ? `background-image:url("${value}")` : 'background-image:none';
      else if (attr === 'href' && slot.field === 'slug') next = value ? `/${slot.collection ?? ''}/${value}`.replace('//', '/') : '#';
      edits.push({ el, kind: 'attr', attr, content: next });
    }
  }
  edits.sort((a, b) => b.el.start - a.el.start);   // right-to-left keeps offsets valid
  let out = tpl;
  for (const e of edits) {
    const openTag = tpl.slice(e.el.start, e.el.innerStart);
    if (e.kind === 'inner') {
      const cls = e.el.cls;
      const nextCls = e.empty
        ? (cls.includes('w-dyn-bind-empty') ? cls : `${cls} w-dyn-bind-empty`.trim())
        : cls.split(/\s+/).filter((c) => c !== 'w-dyn-bind-empty').join(' ');
      const tag = cls ? openTag.replace(/class="[^"]*"/, `class="${nextCls}"`) : openTag;
      out = out.slice(0, e.el.start) + tag + e.content + out.slice(e.el.innerEnd);
    } else {
      const re = new RegExp(`${e.attr}="[^"]*"`);
      const tag = re.test(openTag)
        ? openTag.replace(re, `${e.attr}="${esc(e.content)}"`)
        : openTag.replace(/^<([\w:-]+)/, `<$1 ${e.attr}="${esc(e.content)}"`);
      out = out.slice(0, e.el.start) + tag + out.slice(e.el.innerStart);
    }
  }
  return out;
}

/**
 * Render one list slot. Returns the shell untouched when we have no binding for it --
 * an unbound list must look exactly like the export, never half-filled.
 */
export function renderList(route, index, shell) {
  const b = bindings()[`${route}#${index}`];
  if (!b || b.empty || !b.collection || !b.items?.length) return shell;

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
  return shell.slice(0, ts) + rendered.join('') + shell.slice(te);
}
