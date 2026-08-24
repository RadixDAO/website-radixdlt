// Data resolution for the nativised radix-opp-statuses detail template
// (REBUILD-PLAN.md Phase 4: src/pages/radix-opp-statuses/[slug].astro and
// src/components/radix-opp-statuses/*).
//
// Same shape as src/lib/blog-detail.ts (the proven reference implementation for this
// phase): per-item fields are resolved live through Astro content collections via
// src/lib/content.ts.
//
// The one list on this template -- the "service(s)" badge row -- is the item's own
// `service-s` MultiReference field, rendered as one badge per referenced
// radix-services item. Unlike blog's "related articles" (a Finsweet-computed
// cross-collection selection with no derivation path from the CMS data alone), this
// list is 1:1 with a field the item itself carries, so it is resolved directly here
// via itemById rather than read from src/bindings/detail-lists/radix-opp-statuses.json
// -- confirmed equivalent: that file's per-page "0" list is exactly this field's own
// ids, in order (spot-checked against src/content/radix-opp-statuses/*.json).
import { itemById, rewriteAssetUrls, type CmsItem } from './content';

export interface ServiceRef { slug: string; name: string }

export const richText = (item: CmsItem): string =>
  rewriteAssetUrls((item.fieldData.content as string) ?? '');

/** Toggle Webflow's own "unbound field" marker class, same rule render-detail.mjs
 * and render-list.mjs use: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

// This template's two date bindings ("date-reported", "last-update") both use the
// 'date:MMMM D, YYYY' pattern in src/bindings/radix-opp-statuses.json -- the "else"
// branch of render-detail.mjs's fmtDate, reproduced directly rather than imported
// from a module whose other exports are byte-splicing internals (same reasoning as
// blog-detail.ts/articles-learn-detail.ts's own copy of this function).
export const fmtDate = (v: unknown): string => {
  if (!v) return '';
  const d = new Date(v as string);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

// The "status" field is a Webflow Option field; its id must be resolved to the
// option's display name (transform "option.name" in the bindings map). Only two
// options exist on this field (reference/webflow/fields/radix-opp-statuses.json) and
// they are stable CMS schema, not per-item data, so they're reproduced literally here
// rather than read from that reference file at build time.
const STATUS_OPTIONS: Record<string, string> = {
  '8e0819e294ace51e942b2873f55ed251': 'Open',
  '5d07bb893cd14595735bc9ca3038d8bc': 'Closed',
};
export const statusName = (id: unknown): string =>
  typeof id === 'string' ? (STATUS_OPTIONS[id] ?? '') : '';

export async function getServices(item: CmsItem): Promise<ServiceRef[]> {
  const ids = (item.fieldData['service-s'] as string[] | null) ?? [];
  const refs = await Promise.all(ids.map((id) => itemById(id)));
  return refs
    .filter((r): r is CmsItem => !!r)
    .map((r) => ({ slug: r.fieldData.slug as string, name: (r.fieldData.name as string) ?? '' }));
}
