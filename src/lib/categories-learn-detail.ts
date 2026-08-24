// Data resolution shared by the two "Learn taxonomy" detail templates nativised
// together (REBUILD-PLAN.md Phase 4): categories-learn
// (src/pages/categories-learn/[slug].astro, 5 pages) and sub-categories-learn
// (src/pages/sub-categories-learn/[slug].astro, 1 page).
//
// Genuine commonality: both pages are "list of Knowledge Base questions (articles-learn
// items) belonging to this taxonomy term", sharing one question-list block
// (src/components/learn-taxonomy/QuestionList.astro, used once by sub-categories-learn
// and twice by categories-learn) and one hero block
// (src/components/learn-taxonomy/CategoryHero.astro). The only structural difference
// is that sub-categories-learn's hero always carries a second line (its own name,
// under the PARENT category's name+icon -- see getSubCategoryHero below) and has only
// one question-list section ("Featured Questions"), not two.
//
// Neither collection's own fields carry a reference to articles-learn (checked
// src/content.config.ts: categoriesLearn has no article-list field at all) -- the
// "Featured Questions" / "All questions" splits are Finsweet-computed reverse lookups
// (articles-learn's own "article-category" + "feature-in-category-header" fields),
// and the two counts don't cleanly sum to the item's own "number-of-questions" display
// field on every category (checked: radix-overview reads 2+48=50 against a stored 47),
// so re-deriving the filter here would trade proven-correct data for a guess. Read
// from src/bindings/detail-lists/<collection>.json as data, same principle
// src/lib/blog-detail.ts already uses for its own list selections.
import { readFileSync, existsSync } from 'node:fs';
import { itemById, liveItems, assetPath, type CmsItem } from './content';

/** Toggle Webflow's own "unbound field" marker class, same rule render-detail.mjs
 * and render-list.mjs use: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

export interface QuestionRef {
  slug: string;
  name: string;
  iconUrl: string;
}

export const categoryIcon = (item: CmsItem): string => {
  const img = item.fieldData.icon as { url: string } | null;
  return img?.url ? assetPath(img.url) : '';
};

type DetailLists = { pages?: Record<string, Record<string, { empty?: boolean; items?: string[] }>> };
const listsCache = new Map<string, DetailLists>();
function detailLists(collection: 'categories-learn' | 'sub-categories-learn'): DetailLists {
  if (!listsCache.has(collection)) {
    const p = `src/bindings/detail-lists/${collection}.json`;
    listsCache.set(collection, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { pages: {} });
  }
  return listsCache.get(collection)!;
}

let articlesBySlugPromise: Promise<Map<string, CmsItem>> | null = null;
function articlesBySlug(): Promise<Map<string, CmsItem>> {
  if (!articlesBySlugPromise) {
    articlesBySlugPromise = liveItems('articles-learn').then((items) => new Map(items.map((i) => [i.fieldData.slug as string, i])));
  }
  return articlesBySlugPromise;
}

/** One question-list block: `listIndex` '0' is "Featured Questions" on both
 * collections; '1' is categories-learn's additional "All questions" (sub-categories-learn
 * has no second list). */
export async function getQuestions(
  collection: 'categories-learn' | 'sub-categories-learn',
  slug: string,
  listIndex: '0' | '1',
): Promise<QuestionRef[]> {
  const entry = detailLists(collection).pages?.[slug]?.[listIndex];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const bySlug = await articlesBySlug();
  return entry.items
    .map((s) => bySlug.get(s))
    .filter((i): i is CmsItem => !!i)
    .map((i) => ({
      slug: i.fieldData.slug as string,
      name: (i.fieldData.name as string) ?? '',
      iconUrl: categoryIcon(i),
    }));
}

export interface SubCategoryHero {
  /** The PARENT categories-learn item's own icon + name -- sub-categories-learn's h1
   * and image bind to `main-category` via a `ref.name`/`ref.icon` lookup, not to the
   * sub-category's own fields (verified against
   * reference/live/sub-categories-learn/olympia-general-information.html: the image
   * and h1 shown are "Radix Overview"'s, not this sub-category's own icon/name). */
  parentIconUrl: string;
  parentName: string;
  /** The sub-category's own name, shown as the subtitle line beneath. */
  ownName: string;
}

export async function getSubCategoryHero(item: CmsItem): Promise<SubCategoryHero> {
  const parentId = item.fieldData['main-category'] as string | null;
  const parent = parentId ? await itemById(parentId) : undefined;
  return {
    parentIconUrl: parent ? categoryIcon(parent) : '',
    parentName: (parent?.fieldData.name as string) ?? '',
    ownName: (item.fieldData.name as string) ?? '',
  };
}
