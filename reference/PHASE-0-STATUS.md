# Phase 0 — status: COMPLETE (except two manual Webflow exports)

Everything that dies when the Webflow subscription lapses has been rescued.

## Done

| Artefact | Result |
|---|---|
| `reference/webflow/collections.json` | 29 collections |
| `reference/webflow/fields/*.json` | field schema (slug + **type** + displayName) per collection |
| `reference/webflow/items/*.json` | **1,590 items**, full-fidelity Data API JSON |
| `reference/webflow/assets.json` | 983-entry asset manifest |
| `reference/collection-map.json` | collections × schemas × counts × templates × probed routes |
| `reference/all-urls.txt` | **1,219 URLs** — the real inventory (sitemap says 999) |
| `reference/live/` | **1,207 pages** mirrored — binding oracle + regression baseline |
| `reference/live-runtime/` | production Webflow JS chunks + minified CSS |
| `public/assets/` | **2,201 files / 908 MB**, original filenames |
| `reference/asset-map.json` | **2,202** URL → local path, all verified non-empty |
| `reference/redirects-discovered.tsv` | 8 live 301s |
| `reference/excluded-pages.txt` | 12 unpublished pages that must not ship |

## Known-dead, and safe

Two assets 403 (`BG - Heartbeat - 2-poster-00001.jpg`, `Radfi Logo Animation.json`).
Both belong to a **different Webflow site** (`635bb144…`, the RadFi microsite) that is
already gone. Only the *static export* references them; the live `radfi` pages do not.
The export is stale there. No action needed — parity is preserved by ignoring them.

## Still outstanding — MANUAL, and only while Webflow is live

1. **Complete 301 redirect table** — Designer → Site settings → Publishing.
   Not exposed by API or CLI. The 8 in `redirects-discovered.tsv` are the in-use
   internal subset; inbound external links are invisible to probing.
2. **Custom code panel** — Designer → Site settings → Custom code.
   This is where `js/universal.js` and `js/sharethis.js` went (both 404 on live).

Neither blocks Phases 1–3. Both are Phase 4 inputs.
