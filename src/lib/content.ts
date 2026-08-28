// CMS data access, backed by Astro's content collections (src/content.config.ts)
// instead of reading reference/webflow/items/*.json directly (that's what
// src/lib/detail-data.mjs still does -- this module is the next-generation
// replacement, proven equivalent by tools/test-content-equivalence.mjs, but not
// yet wired into any page/layout).
//
// Same public shape as detail-data.mjs (liveItems, itemById, getPaths, plus the
// re-exported assetPath/rewriteAssetUrls, which are collection-agnostic and don't
// need a content-collection-backed replacement). The one difference is that these
// are async: getCollection() is async, so there's no way around it.
import { getCollection } from 'astro:content';
export { assetPath, rewriteAssetUrls } from './assets';

// Keep in sync with the `collections` export of src/content.config.ts (itself
// generated from reference/webflow/items/*.json by
// tools/generate-content-collections.mjs).
export const COLLECTIONS = [
  'articles-learn', 'blog', 'blog-author', 'blog-category', 'blueprints-developers',
  'careers', 'categories-developers', 'categories-learn', 'ecosystem-projects',
  'ecosystems-developers', 'events', 'faqs', 'featured-on', 'full-stack-social-comments',
  'navigation-featured-section', 'partners', 'podcast', 'project-categories', 'projects',
  'projects-6-highlighted', 'radix-opp-services', 'radix-opp-statuses', 'radix-services',
  'radix-statuses', 'sub-categories-learn', 'team-member', 'team-members-learn',
  'testemonials', 'tweets',
] as const;

export type CollectionSlug = (typeof COLLECTIONS)[number];

// A CMS item, in the same shape reference/webflow/items/<collection>.json items
// have always had: id, cmsLocaleId, lastPublished, lastUpdated, createdOn,
// isArchived, isDraft, fieldData. fieldData's actual keys vary per collection --
// see src/content.config.ts for the per-collection zod schema -- so it's left
// loosely typed here, same as detail-data.mjs (plain JS, no static typing at all).
export interface CmsItem {
  id: string;
  cmsLocaleId: string;
  lastPublished: string | null;
  lastUpdated: string;
  createdOn: string;
  isArchived: boolean;
  isDraft: boolean;
  fieldData: Record<string, unknown>;
}

async function allItems(collection: CollectionSlug): Promise<CmsItem[]> {
  const entries = await getCollection(collection);
  return entries.map((e) => e.data as CmsItem);
}

export async function liveItems(collection: CollectionSlug): Promise<CmsItem[]> {
  const items = await allItems(collection);
  return items.filter((i) => !i.isDraft && !i.isArchived);
}

// Same rule as detail-data.mjs's itemById: a Reference/MultiReference field can
// point at an item that is itself a draft or archived. Webflow can't build a live
// page for that item, so it renders the reference as empty rather than following
// it -- match that by only ever resolving to *live* items here.
let byIdPromise: Promise<Map<string, CmsItem>> | null = null;
export function itemById(id: string): Promise<CmsItem | undefined> {
  if (!byIdPromise) {
    byIdPromise = (async () => {
      const map = new Map<string, CmsItem>();
      for (const collection of COLLECTIONS) {
        for (const item of await liveItems(collection)) map.set(item.id, item);
      }
      return map;
    })();
  }
  return byIdPromise.then((m) => m.get(id));
}

export async function getPaths(collection: CollectionSlug) {
  const items = await liveItems(collection);
  return items.map((item) => ({
    params: { slug: item.fieldData.slug as string },
    props: { item },
  }));
}
