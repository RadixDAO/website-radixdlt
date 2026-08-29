// Webflow's current-page marking for nav/footer links, used by SiteNav.astro and
// SiteFooter.astro on every page.
//
// Measured by diffing the rendered nav across pages that share a variant: the ONLY
// per-page difference is that every top-level <a> whose `href` equals the current
// page's own path gets `aria-current="page"` inserted immediately before `class=`,
// and ` w--current` appended to the class attribute's value. Confirmed to apply to
// EVERY matching anchor on a page, not just the first (e.g. token.html marks all
// three of its <a href="/token"> links: the nav-group link and both buy buttons).
//
// Byte-splice only -- never reparses/reserialises the surrounding markup.

/** [start, end) of each top-level `<a ...>` open tag in `html`, quote-aware. */
function findAnchorTags(html) {
  const ranges = [];
  const re = /<a\b/gi;
  let m;
  while ((m = re.exec(html))) {
    const start = m.index;
    let q = null, i = start + m[0].length;
    for (; i < html.length; i++) {
      const c = html[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '>') { i++; break; }
    }
    ranges.push([start, i]);
    re.lastIndex = i;
  }
  return ranges;
}

/**
 * Apply Webflow's current-page marking to `navHtml` for `currentPath`.
 * currentPath is an absolute, leading-slash path (e.g. "/", "/wallet",
 * "/blog/some-post") matched exactly against each anchor's `href`. Pages whose own
 * path never appears as a nav href (the overwhelming majority of CMS detail pages)
 * get back navHtml unchanged.
 */
export function markCurrent(navHtml, currentPath) {
  const tags = findAnchorTags(navHtml);
  let out = '';
  let cur = 0;
  for (const [s, e] of tags) {
    const tag = navHtml.slice(s, e);
    const hrefMatch = /\bhref="([^"]*)"/.exec(tag);
    if (!hrefMatch || hrefMatch[1] !== currentPath) continue;

    // Webflow marks a link two ways, both observed in reference/live:
    //   with a class:    <a href="/x" class="f-link">  -> aria-current before class=, " w--current" appended
    //   without a class: <a href="/x">                 -> aria-current + class="w--current" appended before >
    const classMatch = /\bclass="([^"]*)"/.exec(tag);
    let newTag;
    if (classMatch) {
      if (classMatch[1].split(/\s+/).includes('w--current')) {
        throw new Error(
          `markCurrent: input already carries w--current for "${currentPath}". Canonical ` +
          `chrome blocks must be stored UNMARKED; tolerating this silently would let a ` +
          `page-specific block masquerade as a shared variant: ${tag}`);
      }
      const before = tag.slice(0, classMatch.index);
      const after = tag.slice(classMatch.index + classMatch[0].length);
      newTag = `${before}aria-current="page" class="${classMatch[1]} w--current"${after}`;
    } else {
      const close = tag.lastIndexOf('>');
      newTag = `${tag.slice(0, close)} aria-current="page" class="w--current"${tag.slice(close)}`;
    }

    out += navHtml.slice(cur, s) + newTag;
    cur = e;
  }
  out += navHtml.slice(cur);
  return out;
}
