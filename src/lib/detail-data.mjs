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
export function itemById(id) {
  if (!byId) {
    byId = new Map();
    const map = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
    for (const c of map) for (const i of load(c.slug)) byId.set(i.id, i);
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
