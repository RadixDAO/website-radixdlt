// Per-route markup injected at the end of <body> by WebflowPage.
//
// Used for the handful of behaviours Webflow provided server-side that a static build
// has to supply itself. Kept out of the shells so the converter stays a pure
// export -> shell transform.
//
// Scripts are referenced by src, never inlined here: Vite parses this module looking
// for dynamic imports, and an `import()` inside a template literal breaks its parser.

/**
 * /search — Webflow's site search is a hosted feature that dies with the
 * subscription. Pagefind replaces it; see public/js/site-search.js.
 */
const EXTRAS = {
  search: '<script type="module" src="/js/site-search.js"></script>',
};

export function bodyExtras(route) {
  return EXTRAS[route] ?? '';
}
