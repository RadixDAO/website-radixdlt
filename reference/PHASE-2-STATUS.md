# Phase 2 — status: COMPLETE

All static (non-CMS-detail) pages converted.

## Results

| Metric | Value |
|---|---|
| Pages built | **49** |
| Exact structural match vs live | **48 / 49** |
| >= 0.98 | **49 / 49** |
| Only imperfect page | `search` 0.9915 — diff is Webflow's server-rendered search results, replaced by Pagefind in Phase 4 |
| CMS lists awaiting Phase 3 | **103** across 37 pages |

## Page accounting (117 exported HTML files)

| Group | Count | Disposition |
|---|---|---|
| `archived/` | 24 | dropped (decision 1) |
| `detail_*.html` | 29 | Phase 3 templates |
| unpublished on live (404/401) | 12 | dropped — `excluded-pages.txt` |
| 301 on live | 2 | `_redirects`, not pages (`/community`, `/events`) |
| **built** | **49** | |
| *(1 file is `index.html`, counted once)* | | |

## Also delivered

- `public/_redirects` — 8 rules; the 3 whitepaper redirects repointed from
  dying Webflow CDN PDFs to the local mirror.
- `tools/check-links.mjs` — every local `href`/`src`/`poster` in `dist` must
  resolve to a real file, route, or redirect.

## Converter bug found and fixed

`convert-pages.mjs` cleared `src/shells` but left stale `src/pages/*.astro`, so
excluding a page left an orphan route that failed the build. Generated pages now
carry an `@generated` marker and only those are reaped — hand-written Phase 3
routes in the same tree survive.
