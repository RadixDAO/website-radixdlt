// Named footer variants (see REBUILD-PLAN.md Task 2.3).
//
// Measured directly against the BUILT site (dist/, all 1,202 pages), not the export:
// for every page, find the footer (tools/lib/find-footer.mjs), strip Webflow's current-page
// marking (tools/lib/mark-current.mjs's inverse -- see derive-footer-variants.mjs), and
// hash what's left. Pages sharing a hash are byte-identical modulo current-marking.
//
// This turned up nine groups, compared to the six predicted in the plan's prose.
// Similar to the nav: some routes render their footer with different indentation
// depending on the page wrapper (e.g. developers/home in page-wrapper-3 renders
// slightly differently), and some pages like full-stack, privacy-policy, labs, and
// radfi each have their own distinct footer variants.
//
//   hash (dist, marking-stripped)   name               n    bytes   example
//   b47b79e5                        main               693  22,672  index, wallet, 404
//   19420053                        learn              218  6,760   articles-learn/*
//   6e6e1077                        status             38   11,339  radix-opp-statuses/*
//   0e56a016                        developers         8    12,321  developers/ecosystem
//   7bbc26a3                        developers-nested  1    13,547  developers/home
//   200b81bb                        full-stack         1    22,890  full-stack (main, nested)
//   e390fa45                        labs               1    24,325  labs
//   20f93856                        privacy-policy     1    22,691  privacy-policy
//   fd174b4e                        radfi              1    21,560  radfi
//
// 962 footer-bearing pages total; 240 pages have no footer at all.
export const VARIANT_NAMES = {
  'b47b79e5': 'main',
  '19420053': 'learn',
  '6e6e1077': 'status',
  '0e56a016': 'developers',
  '7bbc26a3': 'developers-nested',
  '200b81bb': 'full-stack',
  'e390fa45': 'labs',
  '20f93856': 'privacy-policy',
  'fd174b4e': 'radfi',
};

export function stripCurrentMarking(footerHtml) {
  // Remove aria-current="page" and w--current that were added by Webflow's current-page marking.
  // The marking is applied as:
  //   - insert aria-current="page" immediately before class=
  //   - append " w--current" to the class value
  // We reverse both with simple string replacement -- never re-serialize, just remove the
  // exact bytes Webflow added. Only remove the specifically formatted tokens.
  // NB: / w--current/ alone misses class="w--current", where w--current is the only
  // class and has no leading space -- that hole left a page-specific block stored as a
  // shared variant (see the privacy-policy footer). Drop the whole attribute in that case.
  return footerHtml
    .replace(/ aria-current="page"/g, '')
    .replace(/ class="w--current"/g, '')
    .replace(/ w--current/g, '');
}
