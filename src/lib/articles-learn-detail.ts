// Data resolution for the nativised articles-learn detail template (REBUILD-PLAN.md
// Phase 4: src/pages/articles-learn/[slug].astro and src/components/articles-learn/*).
//
// Same shape as src/lib/blog-detail.ts (the proven reference implementation for this
// phase): per-item relations (author, category, icon, dates, rich text) are resolved
// live through Astro content collections via src/lib/content.ts. The two nested-list
// SELECTIONS this template carries -- "Getting started" (list index 0, a fixed set of
// categories-learn items) and "Related articles" (list index 1, per-article) -- come
// from src/bindings/detail-lists/articles-learn.json, the same proven-equivalent-to-live
// snapshot render-detail.mjs already used for the old shell-splicing path. Re-deriving
// Webflow/Finsweet's own selection query here would trade proven-correct data for a
// guess (see REBUILD-PLAN.md Phase 4 note on this).
import { readFileSync, existsSync } from 'node:fs';
import { itemById, liveItems, assetPath, rewriteAssetUrls, type CmsItem } from './content';

export interface CategoryRef { slug: string; name: string; iconUrl: string }
export interface AuthorRef { name: string }

/** Toggle Webflow's own "unbound field" marker class, same rule render-detail.mjs
 * and render-list.mjs use: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

// The one date binding on this template ("$lastUpdated") resolves through the "else"
// branch of render-detail.mjs's fmtDate (it uses the 'date:MMMM D, YYYY' pattern, not
// 'date:D MMMM YYYY') -- same output, reproduced directly rather than imported from a
// module whose other exports are byte-splicing internals.
export const fmtDate = (v: unknown): string => {
  if (!v) return '';
  const d = new Date(v as string);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

export const articleIcon = (item: CmsItem): string => {
  const img = item.fieldData.icon as { url: string } | null;
  return img?.url ? assetPath(img.url) : '';
};

export const richText = (item: CmsItem): string =>
  rewriteAssetUrls((item.fieldData['full-article-text'] as string) ?? '');

export const likesText = (item: CmsItem): string => {
  const v = item.fieldData['article-likes'] as number | null;
  return v == null ? '' : String(v);
};

/** The breadcrumb's own category name -- inner text only, the shell's href for this
 * link stays the static "#" literal (see src/shells/_detail/articles-learn/body.html:
 * there is no href binding for this field in src/bindings/articles-learn.json). */
export async function getCategoryName(item: CmsItem): Promise<string> {
  const id = item.fieldData['article-category'] as string | null;
  if (!id) return '';
  const ref = await itemById(id);
  return (ref?.fieldData.name as string) ?? '';
}

export async function getAuthor(item: CmsItem): Promise<AuthorRef | null> {
  const id = item.fieldData.author as string | null;
  if (!id) return null;
  const a = await itemById(id);
  if (!a) return null;
  return { name: (a.fieldData.name as string) ?? '' };
}

let listsCache: { pages?: Record<string, Record<string, { empty?: boolean; collection?: string; items?: string[] }>> } | null = null;
function detailLists() {
  if (!listsCache) {
    const p = 'src/bindings/detail-lists/articles-learn.json';
    listsCache = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { pages: {} };
  }
  return listsCache!;
}

const bySlugCache = new Map<string, Promise<Map<string, CmsItem>>>();
function itemsBySlug(collection: 'categories-learn' | 'articles-learn'): Promise<Map<string, CmsItem>> {
  let p = bySlugCache.get(collection);
  if (!p) {
    p = liveItems(collection).then((items) => new Map(items.map((i) => [i.fieldData.slug as string, i])));
    bySlugCache.set(collection, p);
  }
  return p;
}

/** "Getting started" -- a fixed set of categories-learn items, identical across every
 * article that has one (verified from src/bindings/detail-lists/articles-learn.json). */
export async function getGettingStarted(slug: string): Promise<CategoryRef[]> {
  const entry = detailLists().pages?.[slug]?.['0'];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const bySlug = await itemsBySlug('categories-learn');
  return entry.items
    .map((s) => bySlug.get(s))
    .filter((i): i is CmsItem => !!i)
    .map((i) => ({
      slug: i.fieldData.slug as string,
      name: (i.fieldData.name as string) ?? '',
      iconUrl: articleIcon(i),
    }));
}

/** "Related articles" -- genuinely varies per article. */
export async function getRelatedArticles(slug: string): Promise<CategoryRef[]> {
  const entry = detailLists().pages?.[slug]?.['1'];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const bySlug = await itemsBySlug('articles-learn');
  return entry.items
    .map((s) => bySlug.get(s))
    .filter((i): i is CmsItem => !!i)
    .map((i) => ({
      slug: i.fieldData.slug as string,
      name: (i.fieldData.name as string) ?? '',
      iconUrl: articleIcon(i),
    }));
}

// Live's meta description on all 174 articles-learn pages is the article's CATEGORY NAME
// (e.g. "Staking &amp; Validating on Radix"), HTML-escaped for the attribute -- not the
// empty string the shell pipeline emitted. Escaping matters: 106 of them contain "&".
export const headDescription = (categoryName: string): string =>
  String(categoryName ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\s\u00a0]+$/, '');
