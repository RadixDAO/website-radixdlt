// Locate the site nav within a page's raw markup (see REBUILD-PLAN.md Task 2.2).
//
// Measured across all 1,202 built pages: the nav is always the first top-level
// element whose start tag carries both `role="banner"` and a `w-nav` class token --
// Webflow's own marker for the element `.w-nav` initialises against. Exactly one
// page (developers/home) contains a SECOND such element, buried in unrelated body
// content near the footer; the first match is always the real, rendered header nav,
// so "first match" is the correct and only rule, not a simplification.
//
// Never reparses/reserialises: returns a byte range into the ORIGINAL string.
import { elementRange } from './html-slice.mjs';

const OPEN_TAG_RE = /<div\b[^>]*\brole="banner"[^>]*>/g;
const HAS_W_NAV = /\bclass="[^"]*\bw-nav\b[^"]*"/;

/** [start, end) of the nav element, or null if the page has no nav. */
export function findNavRange(html) {
  OPEN_TAG_RE.lastIndex = 0;
  let m;
  while ((m = OPEN_TAG_RE.exec(html))) {
    if (!HAS_W_NAV.test(m[0])) continue;
    return elementRange(html, m.index);
  }
  return null;
}
