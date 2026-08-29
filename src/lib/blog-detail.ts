// Data resolution for the nativised blog detail template (REBUILD-PLAN.md Phase 4
// step 3: src/pages/blog/[slug].astro and src/components/blog/*).
//
// Per-item relations (author, categories, dates, images, rich text) are resolved
// live through Astro content collections via src/lib/content.ts -- real CMS
// reference/date/asset logic, not a string splice.
//
// The two list SELECTIONS that Webflow's Finsweet CMS Nest computed server-side at
// publish time still come from src/bindings/detail-lists/blog.json, the same
// proven-equivalent-to-live snapshot render-detail.mjs already used for the old
// shell-splicing path:
//   - "related articles" (list index 2) genuinely varies per post and its exact
//     selection rule (it can include the post itself) isn't independently derivable
//     without risking drift from what the live site actually rendered.
//   - "explore more topics" / the latest-posts strip (indices 3 and 4) are IDENTICAL
//     across all 618 posts (verified), so reading them is just reading one constant.
// Re-deriving Finsweet's filter/sort/limit query here would trade proven-correct data
// for a guess; the shell/bindings themselves are left in place per the plan until
// every collection is nativised, not just read here as page-independent CMS data.
import { readFileSync, existsSync } from 'node:fs';
import { itemById, liveItems, assetPath, rewriteAssetUrls, type CmsItem } from './content';

const SITE = 'https://www.radixdlt.com';

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface CategoryRef { slug: string; name: string; textColour: string; bgColour: string }

/**
 * The inline colour Webflow renders on a category pill, e.g.
 *   <div style="color:white;background-color:#00ab84" class="cbfs-tag">AMA</div>
 *
 * These come from the blog-category item's `text-colour` / `background-colour` fields.
 * Dropping them cost 8,066 coloured pills across 644 pages and NO gate could see it:
 * verify.mjs default mode strips list interiors, and even --lists compares tags, classes
 * and text -- a style attribute is none of the three.
 */
export const tagStyle = (c: { textColour?: string; bgColour?: string }): string | undefined =>
  c.textColour && c.bgColour ? `color:${c.textColour};background-color:${c.bgColour}` : undefined;
export interface AuthorRef { slug: string; name: string }
export interface RelatedArticle { slug: string; name: string; isCurrent: boolean }
export interface SliderPost {
  slug: string;
  title: string;
  imageUrl: string;
  dateText: string;
  categories: CategoryRef[];
  isCurrent: boolean;
}

/** Toggle Webflow's own "unbound field" marker class, same rule render-detail.mjs
 * and render-list.mjs use: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

export const bgStyle = (url: string): string => (url ? `background-image:url("${url}")` : 'background-image:none');

// Every date binding on this template resolves through the "else" branch of
// render-list.mjs's fmtDate (neither binding uses the 'date:D MMMM YYYY' pattern) --
// same output, reproduced directly rather than imported from a module whose other
// exports are byte-splicing internals.
export const fmtDate = (v: unknown): string => {
  if (!v) return '';
  const d = new Date(v as string);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

export const heroImage = (item: CmsItem): string => {
  const img = item.fieldData.image as { url: string } | null;
  return img?.url ? assetPath(img.url) : '';
};

// description/og:description/twitter:description come from the `excerpt` field, NOT
// `seo-meta-description` (which also exists on this collection and differs) --
// verified against reference/live/blog/2018-year-in-review.html: its <meta
// name="description"> content matches fieldData.excerpt exactly, while
// seo-meta-description holds a longer, different string that appears nowhere in
// live's <head>.
// Webflow TRIMS trailing whitespace -- including U+00A0 -- from the meta description
// before emitting it. Ours did not, leaving 68 blog pages one nbsp longer than
// reference/live. Cosmetic, but it is a real difference from the source of truth.
const trimNbsp = (s: unknown): string => String(s ?? '').replace(/[\s\u00a0]+$/, '');
// Live also escapes the apostrophe as &#x27; in head attribute values. Not required by
// HTML (the attribute is double-quoted), but it is what the source of truth emits, and
// this is applied ONLY to head helpers -- the shared esc() also feeds body text, where
// changing it would move verify.mjs.
const escHead = (s: string): string => s.replace(/'/g, '&#x27;');
export const headDescription = (item: CmsItem): string => escHead(esc(trimNbsp(item.fieldData.excerpt)));

// og:image/twitter:image: live points at the Webflow CDN
// (https://cdn.prod.website-files.com/...), which dies with the Webflow
// subscription. Social scrapers need an absolute URL, so this emits one against our
// own mirror instead -- SITE + assetPath(...), same convention
// src/pages/blog/rss.xml.ts and src/lib/podcast-detail.ts already use. Deliberate
// deviation from live, recorded in REBUILD-PLAN.md.
export const headImage = (item: CmsItem): string => {
  const p = heroImage(item);
  return p ? SITE + p : '';
};

export const richText = (item: CmsItem): string =>
  rewriteAssetUrls((item.fieldData['main-content'] as string) ?? '');

export async function getCategories(item: CmsItem): Promise<CategoryRef[]> {
  const ids = (item.fieldData['blog-category'] as string[] | null) ?? [];
  const refs = await Promise.all(ids.map((id) => itemById(id)));
  return refs
    .filter((r): r is CmsItem => !!r)
    .map((r) => ({
      slug: r.fieldData.slug as string,
      name: (r.fieldData.name as string) ?? '',
      textColour: (r.fieldData['text-colour'] as string) ?? '',
      bgColour: (r.fieldData['background-colour'] as string) ?? '',
    }));
}

export async function getAuthor(item: CmsItem): Promise<AuthorRef | null> {
  const id = item.fieldData['blog-author'] as string | null;
  if (!id) return null;
  const a = await itemById(id);
  if (!a) return null;
  return { slug: a.fieldData.slug as string, name: (a.fieldData.name as string) ?? '' };
}

let listsCache: { pages?: Record<string, Record<string, { empty?: boolean; items?: string[] }>> } | null = null;
function detailLists() {
  if (!listsCache) {
    const p = 'src/bindings/detail-lists/blog.json';
    listsCache = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { pages: {} };
  }
  return listsCache!;
}

let blogBySlugPromise: Promise<Map<string, CmsItem>> | null = null;
function blogBySlug(): Promise<Map<string, CmsItem>> {
  if (!blogBySlugPromise) {
    blogBySlugPromise = liveItems('blog').then((items) => new Map(items.map((i) => [i.fieldData.slug as string, i])));
  }
  return blogBySlugPromise;
}

let categoryBySlugPromise: Promise<Map<string, CmsItem>> | null = null;
function categoryBySlug(): Promise<Map<string, CmsItem>> {
  if (!categoryBySlugPromise) {
    categoryBySlugPromise = liveItems('blog-category').then((items) => new Map(items.map((i) => [i.fieldData.slug as string, i])));
  }
  return categoryBySlugPromise;
}

export async function getRelatedArticles(slug: string): Promise<RelatedArticle[]> {
  const entry = detailLists().pages?.[slug]?.['2'];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const bySlug = await blogBySlug();
  return entry.items
    .map((s) => bySlug.get(s))
    .filter((i): i is CmsItem => !!i)
    .map((i) => ({
      slug: i.fieldData.slug as string,
      name: (i.fieldData.name as string) ?? '',
      isCurrent: i.fieldData.slug === slug,
    }));
}

/** "Explore more topics" -- identical on all 618 blog posts (verified), still keyed
 * by the current slug rather than hardcoded, so it stays correct if that ever changes. */
export async function getExploreTopics(slug: string): Promise<CategoryRef[]> {
  const entry = detailLists().pages?.[slug]?.['3'];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const bySlug = await categoryBySlug();
  return entry.items
    .map((s) => bySlug.get(s))
    .filter((i): i is CmsItem => !!i)
    .map((i) => ({
      slug: i.fieldData.slug as string,
      name: (i.fieldData.name as string) ?? '',
      textColour: (i.fieldData['text-colour'] as string) ?? '',
      bgColour: (i.fieldData['background-colour'] as string) ?? '',
    }));
}

/** The bottom "latest posts" slider -- identical on all 618 blog posts (verified),
 * except each post's own `isCurrent` flag which depends on the page being rendered. */
export async function getSliderPosts(slug: string): Promise<SliderPost[]> {
  const entry = detailLists().pages?.[slug]?.['4'];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const bySlug = await blogBySlug();
  const posts = entry.items.map((s) => bySlug.get(s)).filter((i): i is CmsItem => !!i);
  return Promise.all(
    posts.map(async (p) => ({
      slug: p.fieldData.slug as string,
      title: (p.fieldData.name as string) ?? '',
      imageUrl: heroImage(p),
      dateText: fmtDate(p.fieldData.date),
      categories: await getCategories(p),
      isCurrent: p.fieldData.slug === slug,
    })),
  );
}
