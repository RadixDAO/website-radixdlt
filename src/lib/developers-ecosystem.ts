// Helpers for developers/ecosystem's 10 non-empty "blueprints-developers" CMS lists
// (REBUILD-PLAN.md section 11). Item SELECTION for each per-category tab comes from
// src/bindings/_lists.json via src/lib/static-lists.ts; this module resolves the one
// piece those bindings never captured -- the CTA button in each card's
// `c-b-link-holder`, which Webflow renders from a Link field, not plain text.
//
// Verified item-by-item against reference/live/developers/ecosystem.html: every item
// has AT MOST one of `github-url` / `website-url` set (never both, confirmed across all
// 25 items in reference/webflow/items/blueprints-developers.json). When github-url is
// set the button carries an extra `is-web` class, a GitHub mark and the label "Github";
// when only website-url is set it has neither `is-web` nor the GitHub svg, and reads
// "Website". An item with neither (e.g. the "Coming soon..." placeholder used in the
// Stablecoins/Insurance tabs) renders an empty `c-b-link-holder`.
import type { CmsItem } from './content';

export interface BlueprintLink {
  href: string;
  isWeb: boolean;
}

export function blueprintLink(item: CmsItem): BlueprintLink | null {
  const gh = item.fieldData['github-url'] as string | undefined;
  if (gh) return { href: gh, isWeb: true };
  const web = item.fieldData['website-url'] as string | undefined;
  if (web) return { href: web, isWeb: false };
  return null;
}
