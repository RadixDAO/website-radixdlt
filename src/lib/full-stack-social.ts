// Helpers for full-stack's "full-stack-social-comments" CMS list (REBUILD-PLAN.md
// section 11). Item SELECTION comes from src/bindings/_lists.json's "full-stack#2"
// entry via src/lib/static-lists.ts; this module resolves per-item field VALUES.
//
// Each card shows all four static platform icons (discord/twitter/telegram/reddit,
// in that fixed order -- src/shells/full-stack/list.2.html), with Webflow's
// conditional visibility (w-condition-invisible) hiding the three that don't match
// the item's own `platform` Option field. That field stores Webflow's internal
// option id, not a readable name -- mapped here from
// reference/webflow/fields/full-stack-social-comments.json's own option list, and
// verified item-by-item against reference/live/full-stack.html (e.g. bdebenon's
// platform id resolves to Reddit, matching live's reddit-only-visible icon set).
import type { CmsItem } from './content';

const PLATFORM_NAME: Record<string, 'reddit' | 'twitter' | 'telegram' | 'discord'> = {
  '2b768495691c4cd8e4536a41f1456d66': 'reddit',
  '80334be403c6166a3f295cf8e2de505f': 'twitter',
  '9ca04548f0bd31ac50b72f99d843535a': 'telegram',
  '790730fb8247a07bddbb6df93eab3bee': 'discord',
};

export const platformOf = (item: CmsItem): string => PLATFORM_NAME[item.fieldData.platform as string] ?? '';

export const commentText = (item: CmsItem): string => (item.fieldData.text as string) ?? '';
export const commentName = (item: CmsItem): string => (item.fieldData.name as string) ?? '';
export const commentUrl = (item: CmsItem): string => (item.fieldData['social-url'] as string) ?? '#';

/** Toggle Webflow's own "unbound field" marker class, same rule render-list.mjs
 * uses: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

/** The static icon class carries w-condition-invisible on every platform except the
 * one matching this item's own `platform` field -- see reference/live for the
 * discord/twitter/telegram/reddit order this must be called in. */
export const iconClass = (platform: string, thisIcon: string): string =>
  platform === thisIcon ? 'fs-img-social-icon' : 'fs-img-social-icon w-condition-invisible';
