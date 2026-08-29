# radixdlt.com

The [radixdlt.com](https://www.radixdlt.com) marketing site. Astro, deployed as a
Cloudflare Workers static-asset site (asset requests are free and unlimited on both
Free and Paid plans).

## Quick start

```bash
pnpm install
pnpm dev              # dev server with HMR
pnpm build            # astro build + pagefind index -> dist/
pnpm preview           # astro's own preview server
pnpm preview:workers  # preview at :4399 with Cloudflare's actual asset-routing rules
```

## Structure

```
src/
  pages/          routes -- one file per static page, [slug].astro per CMS collection
  components/     site chrome (SiteHead/SiteNav/SiteFooter) and per-collection components
  content/        29 Astro content collections, ~1,590 items, schemas in content.config.ts
  chrome/         canonical nav/footer HTML per variant, spliced in by SiteNav/SiteFooter
  lib/            data resolution helpers (one file per collection, plus shared ones)
  data/           asset-map.json -- CDN URL -> local /assets path
  bindings/       CMS list item selections that aren't derivable from the CMS data alone
public/
  assets/         mirrored CMS media (rich-text images, uploads)
  css/js/fonts/images/videos/documents/   the site's own static assets, incl. radix-web.css
tools/
  check-links.mjs          every internal href/src in dist/ resolves, gated on a baseline
                            of known-broken links (docs/KNOWN-BROKEN-ON-LIVE.md)
  test-astro-artifacts.mjs no Astro-scoped styles, no Astro-generated CSS bundle (see below)
  serve.mjs                local preview matching Cloudflare's asset-routing semantics
```

## The one thing to know before touching markup here

Most of this site's HTML predates Astro and still carries Webflow's classes, structure,
and — on a handful of components — a Webflow-authored inline `<style>` or `<script>`
sitting inside the markup (video-player CSS, a carousel indicator, third-party embeds).

**Astro processes `<style>` and `<script>` by default.** If one of these ever loses its
`is:inline` attribute, Astro will scope the style (rewriting its selectors so they quietly
stop matching anything) or bundle the script into its own module — replacing behaviour
the design depends on, with no error and no visual difference until you look closely.

`pnpm check` (`tools/test-astro-artifacts.mjs`) catches both: it fails if any page emits
an Astro scope attribute (`data-astro-cid`) or an Astro-generated stylesheet
(`dist/_astro/*.css`). It runs in CI. If you add a new inline `<style>` or `<script>`
inside a component, mark it `is:inline`.

## Deployment

```bash
pnpm build
pnpm deploy      # wrangler deploy -- see wrangler.jsonc
```

Static-only Worker: no `main` entry, no SSR. Free-plan limits are 20,000 files and
25 MiB per file.

## Deliberate deviations from the original Webflow site

- **`sitemap.xml`** lists every URL the site actually serves. Webflow's published
  sitemap omitted eight collections that had working detail routes — correctness over
  bug-for-bug parity for a machine-facing file.
- **Search** is [Pagefind](https://pagefind.app/), built at `pnpm build` time. Webflow's
  hosted site search didn't survive the migration.
- **`og:image`/`twitter:image`** point at this site's own asset mirror rather than the
  Webflow CDN, which no longer exists.
- `docs/KNOWN-BROKEN-ON-LIVE.md` lists a few defects reproduced deliberately because the
  live site itself has them (broken download links, a script error). Check there before
  "fixing" one on a hunch.

## History

This was a Webflow site until 2026-08. The full migration record — the durability work,
every nativisation batch, every regression found and fixed along the way, and the final
verification numbers — lives in the `migration-archive` repo and on this repo's
`backup/pre-squash-full-history` branch, not here. Nothing in normal day-to-day work on
this codebase should need either.
