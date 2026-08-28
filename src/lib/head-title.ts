// Per-item <title> resolution for CMS detail routes.
//
// Extracted from render-detail.mjs, which is part of the deleted Webflow shell pipeline.
// Eight routes imported resolveHeadTitle from there, which made a 700-line byte-splicing
// module load-bearing for one small piece of real logic.
//
// The full resolve() in render-detail.mjs supported ten transforms (asset paths, date
// formats, reference lookups, option names). Every head-title binding in this project
// uses `transform: "text"` on a plain field -- verified across all six collections that
// have one (blog, blog-author, blog-category, articles-learn, categories-learn,
// radix-opp-statuses; careers and sub-categories-learn have none). So this handles that
// case and THROWS on anything else rather than silently producing a wrong <title>.
import { readFileSync, existsSync } from 'node:fs';
import { rewriteAssetUrls } from './assets';

interface HeadBinding { target: string; field: string; transform: string; pattern?: string }
interface BindingMap { head?: HeadBinding[] }

const cache = new Map<string, BindingMap | null>();
function bindings(collection: string): BindingMap | null {
  if (!cache.has(collection)) {
    const p = `src/bindings/${collection}.json`;
    cache.set(collection, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
  }
  return cache.get(collection) ?? null;
}

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function resolveHeadTitle(collection: string, item: Record<string, any>): string | null {
  const h = bindings(collection)?.head?.find((x) => x.target === 'title');
  if (!h) return null;

  if (h.transform !== 'text') {
    throw new Error(
      `resolveHeadTitle: ${collection} uses transform "${h.transform}". Only "text" is ` +
      `implemented here -- the other transforms lived in render-detail.mjs, which is gone. ` +
      `Port the branch you need rather than letting the title render wrong.`);
  }

  // `$`-prefixed fields are Webflow item metadata (lastPublished/createdOn), read off the
  // item rather than fieldData.
  const v = h.field.startsWith('$') ? item[h.field.slice(1)] : item.fieldData?.[h.field];
  const value = (v == null || v === '') ? '' : rewriteAssetUrls(typeof v === 'object' ? '' : String(v));
  const filled = (h.pattern ?? '{}').replace('{}', value);

  // Live escapes the apostrophe as &#x27; in <title> and head meta. Not required by HTML,
  // but it is what the source of truth emits -- 18 pages differed on this alone.
  return esc(filled).replace(/'/g, '&#x27;');
}
