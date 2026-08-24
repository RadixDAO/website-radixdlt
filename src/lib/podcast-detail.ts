// Data resolution for the nativised podcast detail template (REBUILD-PLAN.md Phase 4:
// src/pages/podcast/[slug].astro and src/components/podcast/*).
//
// Same shape as src/lib/blog-detail.ts / careers-detail.ts: per-item data resolved
// live through Astro content collections via src/lib/content.ts. This collection has
// no nested list (no detail-lists/podcast.json), just direct field bindings plus a
// couple of derived values (the head <title>/OG block, and the Buzzsprout embed
// id/src) that src/bindings/podcast.json either gets wrong or doesn't capture at all
// -- both worked out by diffing src/shells/_detail/podcast/{head,body}.html against
// reference/live/podcast/*.html directly rather than trusting the binding file:
//
//   - title pattern: bindings/podcast.json records "{} | Podcast | Radix DLT -
//     Decentralized Ledger Technology" (single spaces), but every live page has
//     TWO spaces on each side of the first pipe: "{name}  |  Podcast | Radix DLT -
//     Decentralized Ledger Technology". Verified against all 5 live pages.
//   - description/og:description/twitter:description come from the `excerpt` field
//     (not `main-content`) -- bindings/podcast.json has no slot for this at all.
//   - og:image/twitter:image use the *absolute* site URL over the local asset path
//     (same convention src/pages/podcast/rss.xml.ts already uses: `SITE + assetPath(...)`)
//     -- live shows the original CDN URL, but this project intentionally serves a
//     locally-mirrored copy for every other image on the site (see REBUILD-PLAN.md);
//     an absolute local URL keeps OG crawlers working while staying consistent with
//     that convention.
//   - <link rel="alternate" ... rss.xml> after the canonical link: present on every
//     live podcast page (this collection has an RSS feed, rss.xml.ts), but absent
//     from src/shells/_detail/podcast/head.html and therefore never reproduced by
//     the old render-detail.mjs/DetailPage path either -- a pre-existing, whole-site
//     gap in <head> reproduction, not introduced here. Reproduced correctly for this
//     collection since it's now known; the same gap on blog (already nativised) is
//     out of scope for this task and reported separately.
//   - the guest photo's alt text is the `guest-name` field, not the asset's own (null)
//     `alt` property -- also not in bindings/podcast.json, found by direct comparison.
import { assetPath, rewriteAssetUrls, type CmsItem } from './content';

const SITE = 'https://www.radixdlt.com';
const TITLE_SUFFIX = '  |  Podcast | Radix DLT - Decentralized Ledger Technology';

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Toggle Webflow's own "unbound field" marker class, same rule render-detail.mjs
 * and render-list.mjs use: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

// The one date binding on this template uses the 'date:MMMM D, YYYY' pattern
// (src/bindings/podcast.json), which render-detail.mjs's fmtDate resolves through
// its "else" branch -- same output, reproduced directly.
export const fmtDate = (v: unknown): string => {
  if (!v) return '';
  const d = new Date(v as string);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

export const richText = (item: CmsItem): string =>
  rewriteAssetUrls((item.fieldData['main-content'] as string) ?? '');

export const guestImageUrl = (item: CmsItem): string => {
  const img = item.fieldData['guest-image'] as { url: string } | null;
  return img?.url ? assetPath(img.url) : '';
};

export const guestName = (item: CmsItem): string => (item.fieldData['guest-name'] as string) ?? '';

/** Verbatim <title>/og:title/twitter:title -- all three are identical on every live page. */
export const headTitle = (item: CmsItem): string =>
  `${esc(item.fieldData.name)}${TITLE_SUFFIX}`;

/** Verbatim description/og:description/twitter:description. */
export const headDescription = (item: CmsItem): string => esc(item.fieldData.excerpt);

/** Absolute URL for og:image/twitter:image (SITE + the local asset path). */
export const headImage = (item: CmsItem): string => {
  const p = guestImageUrl(item);
  return p ? SITE + p : '';
};

/** Buzzsprout embed: <p id={embedId}></p><script src={embedSrc}>. Both derive from
 * the item's own `podcast-embed-code` field and slug -- verified against all 5 live
 * pages (container_id always matches `buzzsprout-player-${slug}`). */
export const embedId = (slug: string): string => `buzzsprout-player-${slug}`;
export const embedSrc = (item: CmsItem, slug: string): string => {
  const code = item.fieldData['podcast-embed-code'] as string | null;
  return code ? `${code}.js?container_id=${embedId(slug)}&player=small` : '';
};
