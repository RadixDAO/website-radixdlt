// Shared helpers for the "tweets" CMS list carousel used by lp/brave/discover,
// lp/brave/brave-landing, lp/brave/discover-report and radfi (REBUILD-PLAN.md
// section 11). Item SELECTION for each page's list comes from
// src/bindings/_lists.json via src/lib/static-lists.ts (a snapshot of what
// Webflow/Finsweet actually rendered); this module only resolves per-item field
// VALUES, verified against reference/live's markup for a tweet card:
//   <div class="tweet-text">{content}</div>
//   <div style="background-image:url(&quot;{avatar}&quot;)" class="c-avatar"></div>
//   <div>@</div><div>{name}</div>
//   <a href="{url}">...</a>
// `name` sometimes already includes its own leading "@" (e.g. "@Nicholas_Merten")
// -- Webflow renders the literal "@" plus the field verbatim regardless, producing
// a doubled "@@" on those items. That is live's own behaviour, reproduced as-is.
import { assetPath, type CmsItem } from './content';

/** Toggle Webflow's own "unbound field" marker class, same rule render-list.mjs
 * uses: drop it when the value is present, add it back when not. */
export const dynClass = (base: string, filled: boolean): string => {
  const tokens = base.split(/\s+/).filter(Boolean).filter((c) => c !== 'w-dyn-bind-empty');
  if (!filled) tokens.push('w-dyn-bind-empty');
  return tokens.join(' ');
};

export const tweetContent = (item: CmsItem): string => (item.fieldData.content as string) ?? '';
export const tweetName = (item: CmsItem): string => (item.fieldData.name as string) ?? '';
export const tweetUrl = (item: CmsItem): string => (item.fieldData.url as string) ?? '#';

/** Same rule as render-list.mjs's attr:style/asset handling: a resolved local asset
 * path becomes a background-image url(), an absent one becomes `background-image:none`
 * (never a dropped/omitted style attribute). */
export const avatarStyle = (item: CmsItem): string => {
  const avatar = item.fieldData.avatar as { url?: string } | undefined;
  const url = avatar?.url ? assetPath(avatar.url) : '';
  return url ? `background-image:url("${url}")` : 'background-image:none';
};
