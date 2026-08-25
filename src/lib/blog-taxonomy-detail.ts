// Data resolution shared by the two "blog taxonomy" detail templates nativised
// together (REBUILD-PLAN.md Phase 4): blog-author (src/pages/blog-author/[slug].astro,
// 14 pages) and blog-category (src/pages/blog-category/[slug].astro, 11 pages).
//
// Genuine commonality, not a forced abstraction: both pages are "list of blog posts
// belonging to this taxonomy term" and share TWO top-level blocks byte-identical
// across both collections' shells apart from field data -- the post-list
// (`c-section is-blog-cat`, see TaxonomyPostList.astro) and the "Explore more topics"
// block (`c-section is-tags` minus the slider blog itself has, see
// TaxonomyTopics.astro). Only the hero/intro block genuinely differs (blog-author
// shows an author image + name + role; blog-category shows just a category name), so
// those stay as two small separate per-collection components rather than one forced
// abstraction.
//
// Neither blog-author nor blog-category's own CMS fields carry a reference back to
// blog posts (src/content.config.ts: blogAuthor has no post-list field, blogCategory
// has no post-list field either) -- the "posts in this term" list is a
// Finsweet-computed reverse lookup, and src/bindings/detail-lists/blog-category.json
// shows some categories capped at exactly 100 (crypto-defi, product-roadmap,
// community-ecosystem all read exactly 100 -- a Finsweet list-length cap, not
// reproducible by re-deriving "every blog post whose blog-category array contains
// this id"). Read from src/bindings/detail-lists/<collection>.json as data, same
// principle src/lib/blog-detail.ts already uses for related articles / slider posts.
//
// The "Explore more topics" list (index '1' in both files) is the SAME 11-item
// blog-category list on every blog-author AND blog-category page (verified byte-for-
// byte identical across all 25 pages), and is itself identical to blog's own "explore
// more topics" list (src/bindings/detail-lists/blog.json entry '3'). Read
// independently per collection here rather than importing blog-detail.ts's private
// cache (it isn't exported, and blog-detail.ts's getExploreTopics is hardcoded to
// read blog.json keyed by a BLOG slug, which a blog-author/blog-category slug is not).
//
// blog-category pages additionally self-highlight: any tag pill -- in the post list's
// nested category tags, or in the topics list itself -- whose href equals the current
// page's own path gets Webflow's `aria-current="page"` + ` w--current` marking
// (verified in reference/live/blog-category/product-roadmap.html: 100 of 111
// cat-tag-link pills carry it -- one per listed post, since the list is already
// filtered to posts that carry this category -- plus the topics list's own
// "product-roadmap" tag-link). This is DIFFERENT from blog's own related-articles/
// slider isCurrent handling (src/components/blog/BlogContent.astro,
// src/components/blog/BlogTags.astro), which only adds the `w--current` class with no
// `aria-current` -- those highlight a post linking to itself within the SAME
// collection, whereas this is markCurrent's general "any anchor whose href equals
// currentPath" rule (tools/lib/mark-current.mjs), which does add aria-current.
// Reproduced faithfully here since it's independently confirmed against
// reference/live; the gap in blog's own components is flagged separately, out of
// scope for this task.
import { readFileSync, existsSync } from 'node:fs';
import { liveItems, assetPath, type CmsItem } from './content';
import { dynClass, bgStyle, fmtDate, heroImage, getCategories, type CategoryRef } from './blog-detail';

export { dynClass, bgStyle, fmtDate, heroImage };

export type TaxonomyCollection = 'blog-author' | 'blog-category';

const SITE = 'https://www.radixdlt.com';

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// description/og:description/twitter:description on both collections' live pages
// come straight from the CMS `description` field (empty on all but one item --
// verified against reference/live/blog-author/jacob-mcatamney.html, the one author
// with a real bio, and empty everywhere else including all of blog-category).
// Webflow TRIMS trailing whitespace -- including U+00A0 -- from the meta description
// before emitting it. Ours did not, leaving 68 blog pages one nbsp longer than
// reference/live. Cosmetic, but it is a real difference from the source of truth.
const trimNbsp = (s: unknown): string => String(s ?? '').replace(/[\s\u00a0]+$/, '');
// Live also escapes the apostrophe as &#x27; in head attribute values. Not required by
// HTML (the attribute is double-quoted), but it is what the source of truth emits, and
// this is applied ONLY to head helpers -- the shared esc() also feeds body text, where
// changing it would move verify.mjs.
const escHead = (s: string): string => s.replace(/'/g, '&#x27;');
export const headDescription = (item: CmsItem): string => escHead(esc(trimNbsp(item.fieldData.description)));

// blog-author's live pages always carry og:image/twitter:image (empty content="" when
// the author has no photo, the CDN URL when they do) -- the `image` field. blog-category
// has no image field and never emits these tags at all on live, so this is exported
// for blog-author's page only; blog-category's page leaves ogImage/twitterImage
// undefined so SiteHead omits the tags entirely, matching live.
//
// Absolute URL against our own asset mirror, not live's Webflow CDN URL -- same
// deliberate deviation as blog/podcast (see REBUILD-PLAN.md): social scrapers need an
// absolute URL, and the Webflow CDN dies with the subscription.
export const headImage = (item: CmsItem): string => {
  const img = item.fieldData.image as { url: string } | null;
  const p = img?.url ? assetPath(img.url) : '';
  return p ? SITE + p : '';
};

export interface TopicRef extends CategoryRef {
  isCurrent: boolean;
}

export interface TaxonomyPost {
  slug: string;
  title: string;
  imageUrl: string;
  dateText: string;
  categories: TopicRef[];
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

type DetailLists = { pages?: Record<string, Record<string, { empty?: boolean; items?: string[] }>> };
const listsCache = new Map<TaxonomyCollection, DetailLists>();
function detailLists(collection: TaxonomyCollection): DetailLists {
  if (!listsCache.has(collection)) {
    const p = `src/bindings/detail-lists/${collection}.json`;
    listsCache.set(collection, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { pages: {} });
  }
  return listsCache.get(collection)!;
}

/** The "Latest posts"/post-list block (list index '0' in both files). */
export async function getTaxonomyPosts(
  collection: TaxonomyCollection,
  slug: string,
  currentCategorySlug?: string,
): Promise<TaxonomyPost[]> {
  const entry = detailLists(collection).pages?.[slug]?.['0'];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const bySlug = await blogBySlug();
  const posts = entry.items.map((s) => bySlug.get(s)).filter((i): i is CmsItem => !!i);
  return Promise.all(
    posts.map(async (p) => {
      const categories = await getCategories(p);
      return {
        slug: p.fieldData.slug as string,
        title: (p.fieldData.name as string) ?? '',
        imageUrl: heroImage(p),
        dateText: fmtDate(p.fieldData.date),
        categories: categories.map((c) => ({
          ...c,
          isCurrent: !!currentCategorySlug && c.slug === currentCategorySlug,
        })),
      };
    }),
  );
}

/** The "Explore more topics" block (list index '1' in both files). */
export async function getTaxonomyTopics(
  collection: TaxonomyCollection,
  slug: string,
  currentCategorySlug?: string,
): Promise<TopicRef[]> {
  const entry = detailLists(collection).pages?.[slug]?.['1'];
  if (!entry || entry.empty || !entry.items?.length) return [];
  const bySlug = await categoryBySlug();
  return entry.items
    .map((s) => bySlug.get(s))
    .filter((i): i is CmsItem => !!i)
    .map((i) => ({
      slug: i.fieldData.slug as string,
      name: (i.fieldData.name as string) ?? '',
      isCurrent: !!currentCategorySlug && i.fieldData.slug === currentCategorySlug,
    }));
}
