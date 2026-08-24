// Named nav variants (see REBUILD-PLAN.md Task 2.2).
//
// Measured directly against the BUILT site (dist/, all 1,202 pages), not the export:
// for every page, find the nav (tools/lib/find-nav.mjs), strip Webflow's current-page
// marking (tools/lib/mark-current.mjs's inverse -- see derive-nav-variants.mjs), and
// hash what's left. Pages sharing a hash are byte-identical modulo current-marking.
//
// This turned up ten groups, not the seven named in the plan's prose. Two are real:
// `developers` renders at two different indentation depths depending on whether the
// route wraps its body in an extra element (`c-hero` / `page-wrappper-3`) -- Webflow
// indents markup to reflect DOM nesting, so the nav's own bytes differ by nesting
// depth even though every element and attribute is identical. `labs` and `main-nested`
// are two more one-off pages the plan's rough grouping didn't break out. All of this
// is silent to the byte gate either way: the names below only have to be internally
// consistent, and they were chosen to describe what's actually different.
//
//   hash (dist, marking-stripped)   name               n    bytes   example
//   3991945d                        blog               646  8,708   blog, all-recent-posts
//   d117587c                        learn              218  700     articles-learn/*
//   9396e6e1                        status             38   3,461   radix-opp-statuses/*
//   718c32da                        main               31   39,217  index, wallet, token
//   fa30e5b4                        careers            17   10,308  404, careers/*
//   4f667650                        developers         7    5,714   developers/ecosystem
//   736cd5c0                        developers-nested   2    5,886   developers/home (in page-wrappper-3)
//   f065f87e                        main-nested         1    40,053  full-stack (main, +1 indent)
//   2e97bc61                        labs                1    2,310   labs (its own distinct nav)
//   c438b914                        radfi               1    2,091   radfi
//
// 962 nav-bearing pages total; 240 pages have no nav at all.
export const VARIANT_NAMES = {
  '3991945d': 'blog',
  'd117587c': 'learn',
  '9396e6e1': 'status',
  '718c32da': 'main',
  'fa30e5b4': 'careers',
  '4f667650': 'developers',
  '736cd5c0': 'developers-nested',
  'f065f87e': 'main-nested',
  '2e97bc61': 'labs',
  'c438b914': 'radfi',
};

export function stripCurrentMarking(navHtml) {
  return navHtml.replace(/ aria-current="page"/g, '').replace(/ w--current/g, '');
}
