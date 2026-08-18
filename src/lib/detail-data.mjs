// Build-time CMS access. Reads the Phase 0 pull directly from disk rather than
// bundling ~9 MB of JSON into the client build.
import { readFileSync, existsSync } from 'node:fs';

const cache = new Map();
const load = (slug) => {
  if (!cache.has(slug)) {
    const p = `reference/webflow/items/${slug}.json`;
    cache.set(slug, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []);
  }
  return cache.get(slug);
};

export const liveItems = (slug) => load(slug).filter(i => !i.isDraft && !i.isArchived);

let byId = null;
// A Reference/MultiReference field can point at an item that is itself a draft or
// archived (e.g. a category that was retired). Webflow can't build a live page for
// that item, so it renders the reference as empty rather than following it -- match
// that by only ever resolving to *live* items here, same filter as liveItems().
export function itemById(id) {
  if (!byId) {
    byId = new Map();
    const map = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
    for (const c of map) for (const i of load(c.slug)) if (!i.isDraft && !i.isArchived) byId.set(i.id, i);
  }
  return byId.get(id);
}

let assets = null;
export function assetPath(url) {
  if (!assets) assets = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));
  if (!url) return '';
  if (assets[url]) return assets[url];
  // Webflow serves one asset from several CDN hostnames; match on the id_name tail.
  const tail = decodeURIComponent(url).split('/').filter(Boolean).pop();
  if (!assets.__byTail) {
    assets.__byTail = {};
    for (const [u, p] of Object.entries(assets)) {
      if (u === '__byTail') continue;
      const t = decodeURIComponent(u).split('/').filter(Boolean).pop();
      if (t && !assets.__byTail[t]) assets.__byTail[t] = p;
    }
  }
  return assets.__byTail[tail] ?? url;
}

export function getPaths(collection) {
  return liveItems(collection).map(item => ({
    params: { slug: item.fieldData.slug },
    props: { item },
  }));
}

// NOTE the character class: it must be `\s` (whitespace), not `\\s`. Written as `\\s`
// it excludes a literal backslash AND the letter "s", so matching stops inside
// "uploads-ssl" and every URL silently survives unrewritten.
//
// Parentheses are ALLOWED in the match: real Webflow filenames contain them
// (e.g. "Backeum%20(2).png"). Excluding ")" truncates the URL mid-filename, which
// then matches nothing in the asset map. Any trailing unbalanced ")" -- from a CSS
// url(...) wrapper -- is trimmed back off below.
const WEBFLOW_URL = /https?:\/\/(?:uploads-ssl\.webflow\.com|cdn\.prod\.website-files\.com|assets(?:-global)?\.website-files\.com|s3\.amazonaws\.com\/webflow-prod-assets)\/[^"'\s<>]+/g;

/** Trim trailing characters that belong to the surrounding markup, not the URL. */
function trimUrl(u) {
  let s = u.replace(/&quot;.*$/, '').replace(/[.,;]+$/, '');
  while (s.endsWith(')') && (s.split(')').length - 1) > (s.split('(').length - 1)) s = s.slice(0, -1);
  return s;
}

/**
 * Rewrite Webflow CDN URLs embedded inside a CMS field value to the local mirror.
 * Rich-text bodies carry hundreds of <img src> and <a href> pointing at the CDN; the
 * field value is injected raw, so without this every one of them 404s after cutover.
 */
export function rewriteAssetUrls(html) {
  if (!html || typeof html !== 'string') return html;
  if (!html.includes('webflow.com') && !html.includes('website-files.com') && !html.includes('webflow-prod-assets')) return html;
  return html.replace(WEBFLOW_URL, (u) => {
    const clean = trimUrl(u);
    const hit = assetPath(clean);
    if (!hit || !hit.startsWith('/assets/')) return u;
    return hit + u.slice(clean.length);   // preserve any trimmed markup tail
  });
}

