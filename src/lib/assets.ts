// Asset-path resolution: the Webflow-CDN-URL -> local-/assets-path map.
//
// Ported verbatim from src/lib/detail-data.mjs (which read reference/asset-map.json,
// scaffolding from the Webflow conversion). This is real runtime data -- the map
// itself, now at src/data/asset-map.json -- not scaffolding, so it moved rather than
// being deleted alongside the rest of reference/.
import { readFileSync } from 'node:fs';

let assets: Record<string, string> & { __byTail?: Record<string, string> } | null = null;

export function assetPath(url?: string | null): string {
  if (!assets) assets = JSON.parse(readFileSync('src/data/asset-map.json', 'utf8'));
  if (!url) return '';
  if (assets![url]) return assets![url];
  // Webflow serves one asset from several CDN hostnames; match on the id_name tail.
  const tail = decodeURIComponent(url).split('/').filter(Boolean).pop();
  if (!assets!.__byTail) {
    assets!.__byTail = {};
    for (const [u, p] of Object.entries(assets!)) {
      if (u === '__byTail') continue;
      const t = decodeURIComponent(u).split('/').filter(Boolean).pop();
      if (t && !assets!.__byTail[t]) assets!.__byTail[t] = p;
    }
  }
  return assets!.__byTail[tail as string] ?? url;
}

// NOTE the character class: it must be `\s` (whitespace), not `\\s`. Written as `\\s`
// it excludes a literal backslash AND the letter "s", so matching stops inside
// "uploads-ssl" and every URL silently survives unrewritten.
//
// Parentheses are ALLOWED in the match: real Webflow filenames contain them
// (e.g. "Backeum%20(2).png"). Excluding ")" truncates the URL mid-filename, which
// then matches nothing in the asset map. Any trailing unbalanced ")" -- from a CSS
// url(...) wrapper -- is trimmed back off below.
const WEBFLOW_URL = /https?:\/\/(?:uploads-ssl\.webflow\.com|cdn\.prod\.website-files\.com|assets(?:-global)?\.website-files\.com|s3\.amazonaws\.com\/webflow-prod-assets)\/[^"'\s<>]+/g;

/** Trim trailing characters that belong to the surrounding markup, not the URL. */
function trimUrl(u: string): string {
  let s = u.replace(/&quot;.*$/, '').replace(/[.,;]+$/, '');
  while (s.endsWith(')') && (s.split(')').length - 1) > (s.split('(').length - 1)) s = s.slice(0, -1);
  return s;
}

/**
 * Rewrite Webflow CDN URLs embedded inside a CMS field value to the local mirror.
 * Rich-text bodies carry hundreds of <img src> and <a href> pointing at the CDN; the
 * field value is injected raw, so without this every one of them 404s after cutover.
 */
export function rewriteAssetUrls(html?: string | null): string | null | undefined {
  if (!html || typeof html !== 'string') return html;
  if (!html.includes('webflow.com') && !html.includes('website-files.com') && !html.includes('webflow-prod-assets')) return html;
  return html.replace(WEBFLOW_URL, (u) => {
    const clean = trimUrl(u);
    const hit = assetPath(clean);
    if (!hit || !hit.startsWith('/assets/')) return u;
    return hit + u.slice(clean.length);   // preserve any trimmed markup tail
  });
}
