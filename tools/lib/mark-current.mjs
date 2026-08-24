// Webflow's current-page marking for nav links (see REBUILD-PLAN.md Task 2.2).
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

    const classMatch = /\bclass="([^"]*)"/.exec(tag);
    if (!classMatch) {
      throw new Error(
        `markCurrent: <a href="${currentPath}"> has no class attribute -- ` +
        `Webflow's marking rule (insert before class=) doesn't apply: ${tag}`);
    }
    const before = tag.slice(0, classMatch.index);
    const after = tag.slice(classMatch.index + classMatch[0].length);
    const newTag = `${before}aria-current="page" class="${classMatch[1]} w--current"${after}`;

    out += navHtml.slice(cur, s) + newTag;
    cur = e;
  }
  out += navHtml.slice(cur);
  return out;
}
