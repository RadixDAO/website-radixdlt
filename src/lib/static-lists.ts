// Item SELECTION for a static page's Webflow CMS list (REBUILD-PLAN.md section 11).
//
// src/bindings/_lists.json is a snapshot of what Webflow/Finsweet actually rendered
// for each "<route>#<index>" list slot -- not reproducible from CMS data alone (the
// exact filter/sort/limit query Finsweet ran isn't recoverable), so the item
// selection (which slugs, in which order) is read from that file, same as the
// nativised CMS detail templates read src/bindings/detail-lists/*.json (see
// src/lib/blog-detail.ts). Field VALUES for each selected item are resolved live
// through Astro content collections via src/lib/content.ts, not from the binding
// file's own (lossy) slot-fill data -- this module only answers "which items".
import { readFileSync } from 'node:fs';
import { liveItems, type CmsItem, type CollectionSlug } from './content';

interface ListEntry {
  collection?: string;
  items?: string[];
  empty?: boolean;
}

let cache: Record<string, ListEntry> | null = null;
function bindings(): Record<string, ListEntry> {
  if (!cache) cache = JSON.parse(readFileSync('src/bindings/_lists.json', 'utf8'));
  return cache!;
}

/** Ordered, live-resolved CMS items for one static-page list slot. Empty array for
 * both a confirmed-empty list (`empty: true`) and an unresolved one -- callers render
 * their own `w-dyn-empty` branch in either case, same as Webflow does when a list has
 * zero items. */
export async function staticListItems(key: string): Promise<CmsItem[]> {
  const entry = bindings()[key];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const items = await liveItems(entry.collection as CollectionSlug);
  const bySlug = new Map(items.map((i) => [i.fieldData.slug as string, i]));
  return entry.items
    .map((slug) => bySlug.get(slug))
    .filter((i): i is CmsItem => !!i);
}
