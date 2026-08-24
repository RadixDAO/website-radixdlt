// Data resolution for the nativised projects / projects-6-highlighted detail
// templates (REBUILD-PLAN.md Phase 4: src/pages/projects/[slug].astro,
// src/pages/projects-6-highlighted/[slug].astro, and
// src/components/projects/ProjectsDetailPage.astro).
//
// Both collections' src/shells/_detail/<collection>/body.html are otherwise
// content-less (script/style bundle, no nav, no footer -- the same orphan-template
// shape as the eight GenericDetailPage.astro collections), EXCEPT for one real,
// per-item bit of content: a list of the project's categories, rendered via
// Finsweet CMS Nest (`fs-cmsnest-collection="ce"`) as plain <a> links to
// /project-categories/<slug>.
//
// src/bindings/<collection>.json and src/bindings/detail-lists/<collection>.json
// both treat this as an opaque "nested list SELECTION" (the pattern every other
// nested list on this site needs, since Finsweet's own filter/sort query isn't
// independently derivable -- see blog-detail.ts's header comment). This one is
// different: checked first, per REBUILD-PLAN.md's instruction, and it turns out the
// "selection" is nothing but the item's own `categories` MultiReference field,
// verbatim in field order. Verified against reference/live for every projects/
// projects-6-highlighted item with 2+ categories (xrddomains, cacao-swap, in-de,
// radxplorer, astrolecent): live's rendered link order matches fieldData.categories'
// array order exactly, every time. So this resolves live through content.ts like any
// other Reference field, rather than reading the cached detail-lists JSON.
import { itemById, type CmsItem } from './content';

export interface CategoryRef { slug: string; name: string }

/** Toggle Webflow's own "unbound field" marker class, same rule render-detail.mjs
 * and render-list.mjs use: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

export async function getCategories(item: CmsItem): Promise<CategoryRef[]> {
  const ids = (item.fieldData.categories as string[] | null) ?? [];
  const refs = await Promise.all(ids.map((id) => itemById(id)));
  return refs
    .filter((r): r is CmsItem => !!r)
    .map((r) => ({ slug: r.fieldData.slug as string, name: (r.fieldData.name as string) ?? '' }));
}
