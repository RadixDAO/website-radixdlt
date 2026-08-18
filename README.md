# radixdlt.com — Astro on Cloudflare Workers

A byte-faithful rebuild of the Webflow site as a static Astro build, deployed as a
Workers static-asset site (asset requests are free and unlimited).

**Verified against the live site:** 1,195 / 1,202 pages match exactly; 1,201 score
≥ 0.98. Including CMS list interiors: 1,150 exact, 1,197 ≥ 0.98.
See `reference/PHASE-5-STATUS.md` for every remaining diff, individually explained.

## Quick start

```bash
pnpm install
pnpm build        # convert -> redirects -> astro build -> pagefind index
node tools/serve.mjs   # preview at :4399 with Workers asset-routing semantics
```

## The one idea that matters

**Astro never parses the Webflow markup.** The exported HTML is sliced by byte offset
and re-emitted through `set:html`. A parser round-trip silently mangles attribute
order, inline `<script>` bodies, and the `data-w-id` hooks that Webflow's IX2 engine
needs — and the damage doesn't surface as an error, it surfaces as a dead site.

Everything else follows from that: `tools/lib/html-slice.mjs` returns offsets, never
re-serialised HTML, and every renderer splices rather than rebuilds.

## Layout

```
reference/            Phase 0 rescue — everything that dies with the Webflow subscription
  webflow/            29 collections, 1,590 items, field schemas, asset manifest, 301 table
  live/               1,207-page snapshot: binding oracle AND regression baseline (gitignored)
  collection-map.json collections x schemas x counts x templates x probed routes
  asset-map.json      2,227 CDN URL -> local /assets path
src/
  shells/             raw HTML chunks generated from the export (gitignored)
  bindings/           WHICH CMS field fills WHICH slot — the hand-reviewed core
  lib/                render-detail, render-list, detail-data, page-extras
  layouts/            WebflowPage (static pages), DetailPage (CMS detail routes)
tools/                converters, binding derivation, verification
public/assets/        2,227 mirrored Webflow assets (gitignored, reproducible)
```

## Workflow

| Command | Purpose |
|---|---|
| `node tools/convert-pages.mjs` | export HTML → shells + `.astro` pages |
| `node tools/convert-detail-templates.mjs` | `detail_*.html` → shells + `[slug].astro` |
| `node tools/derive-bindings.mjs <collection> <n>` | propose a detail binding map |
| `node tools/derive-list-bindings.mjs` | static-page CMS lists |
| `node tools/derive-detail-lists.mjs` | nested lists inside detail templates |
| `node tools/verify.mjs [--lists]` | compare `dist/` against `reference/live/` |
| `node tools/check-links.mjs` | every local href/src resolves |

`tools/BINDING-BRIEF.md` is the self-contained brief for refining a collection.

**Use a large sample when deriving.** `derive-bindings.mjs <collection> 8` will miss
fields that appear on few items — `articles-learn.author` is on 13 of 211. An
8-sample re-derive once silently dropped that collection from 211/211 exact to
197/211.

## Verification is the whole game

`tools/verify.mjs` compares structure **and text**. Structure alone is not enough: an
early version scored empty pages at 1.0000, and fifteen collections looked complete
while rendering nothing.

Even text is not enough on its own — 945 rich-text images once pointed at Webflow's
dying CDN while every page scored 1.0000. Run `tools/mirror-residual-assets.mjs`
after a build to sweep for CDN URLs that survived rewriting.

The recurring failure mode in this project is **output that verifies well while being
quietly wrong**. Compare against `reference/live/`, not against the export.

## Deployment

```bash
pnpm build
pnpm exec wrangler deploy        # publishes; see wrangler.jsonc
```

Static-only Worker — no `main` entry, no SSR. Free-plan limits: 20,000 files and
25 MiB per file; the build is ~5,750 files with no file over 25 MiB.

Before DNS cutover, keep Webflow published but un-DNS'd for a week as rollback.

## Deliberate deviations from live

1. **`sitemap.xml`** lists every URL the site serves (1,202). Webflow's published
   sitemap lists 999 and omits eight collections that have working detail routes.
   Correctness over bug-for-bug parity, for a machine-facing file.
2. **Search** is Pagefind. Webflow's hosted site search does not survive migration.

`reference/KNOWN-BROKEN-ON-LIVE.md` lists defects that already exist on radixdlt.com
and are reproduced deliberately — do not "fix" them as part of the migration.

## Regenerating content

CMS data comes from the Webflow Data API pull in `reference/webflow/items/`. While the
subscription is live, `tools/pull-webflow.sh` refreshes it. **After it lapses, that
directory is the only copy.**

Note: `webflow-cli` 2.4.0's `--limit` flag is broken; the script pages via `--offset`.
