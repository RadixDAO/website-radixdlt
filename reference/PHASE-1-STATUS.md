# Phase 1 — status: COMPLETE

The converter and page shell, proven on the homepage.

## Acceptance results (homepage)

| Criterion | Result |
|---|---|
| Structural match vs **live** (`tools/verify.mjs`) | **1.0000** — 631 tags both sides, 0 differences |
| Body bytes: shells → `dist` | **identical** (110,013 bytes) |
| Inline `<script>` bytes preserved | **12,678** — byte-identical to export |
| `<script>` tags / `<style>` blocks | 17 / 5 — identical to export |
| `data-w-id` (IX2 hooks) | preserved |
| jQuery / Webflow / IX2 at runtime | 3.5.1 / present / **loaded** |
| OneTrust cookie banner | fires |
| Webflow CDN references remaining | **0** |
| Astro artefacts in output (`astro-`, `data-astro`) | **0** |

## How it works

`tools/lib/html-slice.mjs` slices the export **by byte offset** — no parser round-trip,
because reserializing is exactly how attribute order, inline script bodies and IX2
hooks get mangled. `tools/convert-pages.mjs` emits raw shells; `WebflowPage.astro`
re-emits them via `set:html`, so Astro never parses Webflow markup.

## Pre-existing bug found (NOT caused by the migration)

The homepage inline "Rolling Number" script calls `$('.rolling-number').offset().top`,
but no `.rolling-number` element exists — in the export, on live, or in our build.
**Live throws the identical TypeError.** We are at parity. Worth fixing separately.

## Deferred to Phase 3

`CollectionList.astro` currently emits the exported list shell verbatim, so Phase 1/2
output matches the export exactly and the converter is verifiable in isolation.
