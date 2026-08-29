// Locate the site footer within a page's raw markup (see REBUILD-PLAN.md Task 2.3).
//
// Measured across all 1,202 built pages: the footer is always a top-level
// element whose start tag carries the `is_footer` class token -- Webflow's own
// marker for the footer section (typically `<footer class="... is_footer ...">` but
// occasionally a `<div class="... is_footer ...">`). The first match is always the
// real, rendered footer.
//
// Never reparses/reserialises: returns a byte range into the ORIGINAL string.
import { elementRange } from './html-slice.mjs';

const OPEN_TAG_RE = /</g;
const HAS_IS_FOOTER = /\bclass="[^"]*\bis_footer\b[^"]*"/;

/** [start, end) of the footer element, or null if the page has no footer. */
export function findFooterRange(html) {
  // We need to find an element with is_footer class. Let's scan for opening tags.
  const re = /<([a-z][a-z0-9]*)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const openTag = m[0];
    if (!HAS_IS_FOOTER.test(openTag)) continue;
    return elementRange(html, m.index);
  }
  return null;
}
