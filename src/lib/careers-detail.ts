// Data resolution for the nativised careers detail template (REBUILD-PLAN.md Phase 4:
// src/pages/careers/[slug].astro and src/components/careers/*).
//
// This template is the simplest of the nativised collections so far --
// src/bindings/careers.json binds only two fields (name -> h1, job-spec -> the rich
// text body) and carries no nested list at all. No relations to resolve, so this
// module is smaller than blog-detail.ts/articles-learn-detail.ts, but kept as its own
// file rather than inlined in the page, matching their shape.
import { rewriteAssetUrls, type CmsItem } from './content';

/** Toggle Webflow's own "unbound field" marker class, same rule render-detail.mjs
 * and render-list.mjs use: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

export const richText = (item: CmsItem): string =>
  rewriteAssetUrls((item.fieldData['job-spec'] as string) ?? '');
