# Rebuild plan — durability first, then componentization that cannot lose the design

Supersedes the approach taken on `codex/astro-rebuild-foundation`.

---

## 1. What you actually have on `main`

`main` is not a "half export". It is a byte-faithful Webflow→Astro conversion,
verified at **1,195 / 1,202 pages structurally exact** against a 1,207-page snapshot
of the live site, with every remaining diff individually explained in
`reference/PHASE-5-STATUS.md`. The central design decision — *Astro never parses the
Webflow markup, it splices it by byte offset* — is correct, and it is the reason the
IX2 interactions, `data-w-id` hooks and inline scripts still work.

It has two real defects, and they are the two you named:

**D1 — it does not build in a fresh clone.** Everything below is required at build
time and is either gitignored or outside the repo:

| Missing input | Size | Reproducible? |
|---|---|---|
| `../static export/` (hardcoded absolute path in 7 tools) | 241 MB | ❌ dies with the Webflow subscription |
| `reference/live/` — the verification oracle | 76 MB, 1,209 files | ❌ dies when Webflow stops serving |
| `public/assets/` (CDN mirror) | 913 MB | ⚠️ only while the Webflow CDN is alive |
| `public/{images,videos,documents,css,js,fonts}` | 230 MB | ✅ from the export — which itself is not committed |
| `src/shells/` | generated | ✅ from the export — same problem |

`src/shells/` is currently **empty on disk**. The repo as committed cannot build at all.

**D2 — there is no shared chrome.** Every page carries its own full copy of the nav
and footer. Editing a menu item means editing ~60 HTML blobs.

Everything else in the "proper Astro" complaint follows from D2.

---

## 2. What went wrong on `codex/astro-rebuild-foundation`

Root cause, one sentence: **it fixed D2 by rewriting the input instead of refactoring
the output.**

The branch adds 416 files, 157k lines, and 25 hand-authored components under
`src/components/content/`. Each one carries its own invented CSS —
`#0735df`, `#112e55`, `clamp(3rem,7vw,6rem)` — none of which is Radix's design.
`public/css/radix-web.css` (539 KB, the actual design) is still shipped and still
linked from `BaseLayout.astro`, but **zero pages render markup that uses it**:
`WebflowPage.astro` survives in the tree with no importers.

The homepage is the clearest evidence. It went from 118 KB of Webflow markup —
hero video, ecosystem grid, testimonials, rolling numbers — to a single call:

```astro
<NativeMarketingPage title="The full stack for Web3 and DeFi." … sections={[…2 items…]} />
```

That is not a migration. It is a redesign that preserves the URLs.

**Do not merge it. Do not build on it.** Tag it `archive/codex-rebuild` and keep it —
§7 lists the four things worth cherry-picking out of it.

---

## 3. The governing rule for everything that follows

> **Componentization is a refactor of the source layout. The bytes in `dist/` must not
> change.**

Not "must look similar". Not "must score well". *Byte-identical output*, enforced by a
diff harness (§5), for every step in §6.

This rule is what makes the work safe to delegate to a cheap model: "did I break the
design?" stops being a judgment call and becomes a boolean. Codex had no such gate,
which is exactly why it drifted 157,000 lines without anyone noticing.

The one thing that makes the rule achievable is a measurement, taken across all 66
exported pages:

**Within a chrome family, the *only* variance between pages is Webflow's
current-page marking.** Diffing `index.html`'s nav against `wallet.html`'s:

```
- <a href="index.html" aria-current="page" class="logo-holder-new-nav w-nav-brand w--current">
+ <a href="index.html" class="logo-holder-new-nav w-nav-brand">
- <a href="wallet.html" class="dp-group-link">The Radix Wallet</a>
+ <a href="wallet.html" aria-current="page" class="dp-group-link w--current">The Radix Wallet</a>
```

That is the entire diff. Same for the footer (22,792 vs 22,823 bytes = one
`aria-current="page" class="… w--current"` on the Blog link).

So a *single* `<SiteNav variant currentPath />` component, holding the canonical block
verbatim and re-applying `aria-current`/`w--current` by rule, reproduces every page
byte-for-byte. Real componentization, zero fidelity loss. Measured variants:

| Chrome | Variants | Sizes | Pages |
|---|---|---|---|
| Nav | 6 | 39,299 (main) · 8,736 (blog) · 10,411 (compact) · 42,218 (wallet-test) · 2,089 (radfi) · 712 (learn) | 41 |
| Footer | 4 | 22,792 (main) · 24,445 (labs) · 11,454 (status) · 6,768 (learn) | 41 |

---

## 4. Phase 0 — Durability (do this first, this week, no design work)

Nothing else matters until a fresh clone on a fresh machine builds. Right now a disk
failure destroys the export, the oracle, and 1.1 GB of media.

The split is cleaner than it looks, because **the export's HTML is only 8.4 MB** —
the 241 MB is videos (147 MB), images (73 MB) and PDFs (8 MB).

### 0.1 — Commit the text. ~95 MB, all of it irreplaceable.

```
source/webflow-export/          8.4 MB   117 HTML files + css/js/fonts (3.9 MB)
reference/live/                  76 MB   1,209-page oracle — CANNOT be regenerated
reference/webflow/              9.9 MB   already committed ✅
src/shells/                      ~9 MB   un-ignore and commit (see 0.3)
```

Move `../static export/` → `source/webflow-export/`, minus `videos/`, `images/`,
`documents/` (those go to 0.2). Drop `archived/` (1.9 MB of dead Webflow scratch —
the converter already skips it). Delete the corresponding lines from `.gitignore`.

Git handles 95 MB of HTML fine; it compresses to a fraction of that. No LFS needed —
largest single file is well under 25 MB.

### 0.2 — Media to R2 with a checksummed manifest. ~1.15 GB.

`public/assets` (913 MB) + `videos` (147 MB) + `images` (73 MB) + `documents` (8 MB).

Write `tools/media-manifest.mjs` producing a committed
`reference/media-manifest.json`: for every file, `{ path, sha256, bytes, sourceUrl }`.
Then `tools/fetch-media.mjs` restores `public/` from R2 and **verifies every hash**,
failing loudly on mismatch. Upload with codex's `tools/upload-r2-assets.mjs` (§7).

Also take one offline tarball of the media set to storage that is not this Mac and not
Cloudflare. Two copies is not a backup.

### 0.3 — Commit `src/shells/`, and take the converter out of `pnpm build`.

The shells are the build's real source of truth for markup. Today they are regenerated
on every build from a directory that isn't in the repo — which is precisely how
`pnpm build` became impossible to run anywhere else.

Change `package.json`:

```jsonc
"build":   "node tools/build-redirects.mjs && astro build && pagefind --site dist",
"convert": "node tools/convert-pages.mjs && node tools/convert-detail-templates.mjs"
```

`convert` becomes a maintenance command run deliberately, not a build step.

### 0.4 — Kill the hardcoded paths.

Seven tools hardcode `/Volumes/Development/radix/radixdlt.com/static export`
(`convert-pages`, `convert-detail-templates`, `copy-static-assets`,
`build-url-inventory`, `build-collection-map`, `derive-bindings`,
`derive-detail-lists`, plus `mirror-assets`). Replace with one shared module:

```js
// tools/lib/paths.mjs
export const EXPORT = process.env.WEBFLOW_EXPORT ?? new URL('../../source/webflow-export/', import.meta.url).pathname;
```

Fix `tools/BINDING-BRIEF.md` too — it instructs agents using absolute machine paths.

### 0.5 — CI, because it is the only real proof.

`.github/workflows/build.yml` — the repo has no CI at all today:

```yaml
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: node tools/fetch-media.mjs        # R2 + hash verification
      - run: pnpm build
      - run: node tools/check-links.mjs
      - run: node tools/verify.mjs             # >= 1195 exact or fail
      - run: node tools/diff-dist.mjs          # Phase 1 — zero unexpected changes
```

A green run on a GitHub runner is the definition of "it builds in a fresh
environment". Nothing you assert locally counts.

### 0.6 — Push. Everything. Today.

`main` is 17 commits ahead of nothing; `origin/main` matches. Confirm after 0.1–0.2
that `git status` is clean and `origin/main` has the new blobs. Add a second remote
(a GitHub org mirror or a self-hosted bare repo) and push there too.

**Phase 0 exit gate:** clone into an empty directory on a different machine,
`pnpm install && node tools/fetch-media.mjs && pnpm build && node tools/verify.mjs`,
score ≥ 1,195. Until this passes, do not start Phase 2.

---

## 5. Phase 1 — Build the safety net

Two small tools. They are what make §6 delegable.

**`tools/snapshot-dist.mjs`** — walk `dist/`, write `{ path: sha256 }` to
`reference/dist-golden.json`, commit it. Run once against Phase 0's `main`.

**`tools/diff-dist.mjs`** — rebuild, compare against the golden, print every changed
path plus a unified diff of the first N changed files, exit non-zero if the change set
is non-empty. Support `--accept` to re-baseline when a change *is* intended, so
re-baselining is always an explicit, reviewable commit.

`verify.mjs` compares against the live site and tolerates ~0.5% drift by design — the
right tool for "did the conversion work". `diff-dist.mjs` tolerates nothing — the right
tool for "did my refactor change anything". You need both.

---

## 6. Phase 2 — Componentization, byte-exact

Every task: refactor → `pnpm build` → `node tools/diff-dist.mjs` → **must print
`0 files changed`** → commit. If it prints anything else, revert; do not "fix forward".

### 2.1 — `<SiteHead>` — DONE (b9a41c2), 49 WebflowPage routes only
Diff the `<head>` across all shells. Hoist the identical block (stylesheet links,
`radix-web.js`, GTM, favicons) into `src/components/site/SiteHead.astro`. Per-page
props: `title`, `description`, OG/Twitter tags, `data-wf-page`, `data-wf-site`, any
page-local `<style>`/`<script>`. Shells keep only their unique head fragment.

### 2.2 — `<SiteNav variant currentPath>` — DONE (5395acc), 10 variants, 962 pages, both pipelines

**Measured against all 1,202 built pages, not the export.** Two corrections to the
original plan, both found before delegating:

*The nav is not one block in the shells.* It contains two CMS-driven
`navigation-featured-section` dropdowns, and `convert-pages.mjs` splits every body at
top-level `w-dyn-list` boundaries — so on `index` the nav spans
`body.0 -> list.0 -> body.1 -> list.1 -> body.2`, opening 49 `<div>`s and closing 40.

*But the rendered nav is constant per variant.* Six pages sharing the main variant
produce six different raw hashes and one identical hash after removing
`aria-current="page"` and ` w--current`. The CMS dropdowns render the same bytes on
every page. So the component targets the rendered block, and the chunk split is an
implementation detail of removing it from the shells.

| Variant | Pages | Size | Example |
|---|---|---|---|
| `3991945d` | 646 | 8,708 B | blog / blog-author / all-recent-posts |
| `d117587c` | 218 | 700 B | articles-learn |
| `9396e6e1` | 38 | 3,461 B | radix-opp-statuses |
| `718c32da` | 31 | 39,217 B | index, wallet, token, whitepapers |
| `fa30e5b4` | 17 | 10,308 B | 404, careers |
| `4f667650` | 7 | 5,714 B | developers/* |
| `c438b914` | 1 | 2,091 B | radfi |
| *(none)* | 244 | — | 401, developers/home |

Current-page marking, the only within-variant difference, follows one rule: on each
`<a>` whose href resolves to the current path, insert `aria-current="page"` immediately
before `class=` and append ` w--current` to the class list. Put that single transform in
`tools/lib/mark-current.mjs` with a test over every nav-bearing page.

**Unlike 2.1, this cannot skip the detail pipeline.** 902 of the 958 nav-bearing pages
render through `DetailPage.astro`, not `WebflowPage.astro`.

**Deliberate deviation to record:** hoisting the nav freezes its two CMS dropdown slots
into static markup. Today that changes nothing — `PHASE-5-STATUS.md` documents that
those 48 slots never resolved from CMS and already render as the exported shell — and
Webflow is being decommissioned, so the collection is frozen regardless. It is still a
semantic change that the byte gate cannot see, so it belongs in the deviations list
rather than passing silently.

### 2.3 — `<SiteFooter variant currentPath>` — DONE (c082c9d + 898b672), 9 variants, 962 pages

Same shape, same `mark-current` helper. Measured across all 1,202 pages:

| Variant | Pages | Size | Example |
|---|---|---|---|
| `b47b79e5` | 693 | 22,672 B | the main footer |
| `19420053` | 218 | 6,760 B | articles-learn |
| `6e6e1077` | 38 | 11,339 B | radix-opp-statuses |
| `0e56a016` | 8 | 12,321 B | developers/* |
| `e390fa45` | 1 | 24,325 B | labs |
| `20f93856` | 1 | 22,742 B | privacy-policy |
| *(none)* | 243 | — | 401, events/* |

### 2.1b — the detail-template heads (added after 2.1)

2.1 hoisted the head for the 49 `WebflowPage` routes and deliberately left the 21
`src/shells/_detail/*` templates alone: they render through `DetailPage.astro` and
`render-detail.mjs`, which does per-item regex title substitution at runtime. Those 21
templates produce roughly 1,153 of the 1,202 built pages, so editing the head is now a
22-place job rather than 70 — real progress, but not the goal. Fold them in.

### 2.4 — Shells become page content
After 2.1–2.3 a shell holds only the page's own body. Rename `src/shells/` →
`src/content/pages/` and update `WebflowPage.astro` and the manifest. This step is
pure renaming; `diff-dist` must still print zero.

### 2.5 — Nav/footer from structured data — **defer this**
Turning `src/data/navigation.ts` into the nav *markup* is the step where Codex went
over the cliff. It is worth doing eventually, and only under these conditions: the
site is live on Astro, the export is no longer load-bearing, and the generated markup
passes `diff-dist` at zero against the committed canonical blocks. Until then §2.2
already gives you what you actually asked for — **one file to edit per menu**.

**Phase 2 exit gate:** `dist/` byte-identical to Phase 0's golden; nav and footer each
exist in exactly one place; `verify.mjs` unchanged at 1,195 / 1,150.

---

## 7. Phase 3 — Cutover items

**7.1 Forms — dropped by decision (2026-08-24).** 23 `<form>` elements exist in the
export: 8 point at `/search` (fine, Pagefind), 1 is `/.wf_auth`, and **7 have no
`action`** — they POST to Webflow's own endpoint and stop working the moment the
subscription lapses, failing *quietly*: the user sees a success state, the submission
goes nowhere. Affected: `developers/grants`, `developers/submit-blueprint`,
`developers/sign-up` and the signup pages. Recorded here so it is a known cost rather
than a surprise. The 117 pages carrying MailerLite *embeds* are unaffected — external.

**7.2 — RadFi microsite assets.** 3 pages still reference the dead Webflow CDN
(`PHASE-5-STATUS.md`). Mirror them or accept explicitly.

**7.3 Rollback — deferred by decision (2026-08-24); nothing is live yet.** Revisit
before any DNS cutover: keep Webflow published but un-DNS'd for a week as the fallback.

## 8. What to salvage from `codex/astro-rebuild-foundation`

Tag it, cherry-pick these four, discard everything under `src/components/content/`:

| Take | Why |
|---|---|
| `tools/upload-r2-assets.mjs` | R2 upload for Phase 0.2 |
| `src/components/content/MailerLiteForm.astro` | the only component worth keeping — feeds 7.1 |
| `tools/verify-runtime-data.mjs` | runtime asset checksum verification |
| its `.gitignore` reasoning | correctly argues css/js/fonts must be tracked |

Everything else — the 25 content components, `NativeMarketingPage`, the hand-written
`Header`/`Footer`, `src/data/navigation.ts` as a markup source — is the redesign.
Leave it on the archived branch.

---

## 9. Delegating this to a cheaper model

The work is mechanical once §5 exists. Give each task this frame:

> Repo: `<path>`. Read `REBUILD-PLAN.md` §3 first — it is binding.
> Task: **<one numbered task from §4 or §6>**. Nothing else.
> Rules: never re-serialise Webflow HTML — splice by byte offset and render through
> `set:html`; never invent CSS, colours, spacing or markup; never edit a file under
> `reference/`.
> Done when: `pnpm build && node tools/diff-dist.mjs` prints `0 files changed`
> **and** `node tools/verify.mjs` still reports ≥ 1,195 exact. Paste both outputs.
> If `diff-dist` is non-zero: `git checkout .`, report what changed, stop. Do not
> iterate toward a passing diff.

Sequencing: Phase 0 tasks are independent and parallelisable. Phase 1 must be done by
one agent, once, carefully — the golden snapshot is the contract. Phase 2 tasks are
strictly sequential (2.1 → 2.2 → 2.3 → 2.4), one commit each, because each one shrinks
the shells the next one reads.

The last instruction is the important one. Codex's failure was not that it wrote bad
code — the components are competently written. It was that nothing ever told it *no*,
so 157,000 lines of plausible output accumulated without a single check against the
thing it was supposed to reproduce.

---

## 10. Phase 4 — Nativisation (the actual target)

Decided 2026-08-24. The end state is a **normal Astro site**: real `.astro` pages and
components, real content collections. `WebflowPage.astro`, `DetailPage.astro`,
`src/shells/**`, `src/bindings/**`, the converters, `source/webflow-export/` and
`reference/` all go away.

**The design is preserved exactly.** It lives in `public/css/radix-web.css` and in
Webflow's class names, so rewritten components emit the same classes in the same nesting.
Keeping the stylesheet is not "keeping Webflow" — it is the design system.

**The gate changes.** Byte-identity (`diff-dist.mjs`) was correct for refactors and is
wrong for a rewrite: the bytes are *supposed* to change. The gate is now `verify.mjs`
per route — **struct 1.0000 and text >= 0.995 against `reference/live/`**. That is
"same design", measured page by page, and it is why `reference/live/` must outlive the
rewrite and leave the repo last, not first.

### Component taxonomy — measured, not guessed

Top-level block shapes across all 1,202 rendered pages, nav/footer excluded:
132 distinct shapes, of which **88 (67%) appear on exactly one page**.

| Shape | Pages | Root element | Meaning |
|---|---|---|---|
| f7c6e563 / f34f87b2 / 578748eb | 618 each | `c-section is-blog-single` / `is-blog-content` / `is-tags` | the blog detail template |
| 96716221 | 211 | `article-section section` | the articles-learn template |
| fbc37d3e | 681 | `banner-wrap` | shared banner |
| bae3074f | 646 | `search-mobile` | shared mobile search |
| b9cf693c | 24 | `c-section is-blog-cat` | blog category |
| b06a7f69 | 27 | `c-section is-tags` | tag list |

Two conclusions:

1. **~1,150 of 1,202 pages reduce to roughly eight templates.** The CMS detail routes are
   near-perfectly uniform. This is where essentially all the leverage is, so it goes first.
2. **The 49 static pages are bespoke by nature.** A marketing site's landing pages do not
   share structure, and 67% single-use shapes says so. They become one composition each
   over a small set of shared primitives — not a speculative component library.

### Order

1. Content collections — **DONE** (`eeda2fc`), 29 collections, 1,590 items, 0 divergences.
2. Rewire `DetailPage` to content collections, retire `detail-data.mjs`.
3. Nativise CMS templates, largest first. **DONE:** blog (618, `bdb7345`),
   articles-learn (211). Remaining 18 collections / 324 pages measured by page shape
   (tag+class tree, depth 4) -- they are NOT 18 templates:

   | Shape | Pages | Collections |
   |---|---|---|
   | `923a59d8` | 197 | **8 share one template**: events 106, team-member 25, tweets 24, radix-services 11, full-stack-social-comments 9, project-categories 9, partners 8, faqs 5 |
   | `b7e01466` | 36 | radix-opp-statuses |
   | `7db24134` | 28 | projects |
   | `a5012c62` | 16 | careers |
   | `750a7bb4` | 14 | blog-author |
   | `44f5fef7` | 11 | blog-category |
   | `136e190a` | 8 | projects-6-highlighted |
   | `7fdbbe65` | 5 | categories-learn |
   | `73de8beb` | 5 | podcast |
   | `a44f8a4f` | 3 | navigation-featured-section |
   | `684e5a6b` | 1 | sub-categories-learn |

   Same shape means same layout, not same bindings -- one component with per-collection
   props, not eight components. About five tasks remain, not eighteen.
4. Nativise the 49 static pages, one per task.
5. Delete shells, bindings, layouts, converters. Move `source/` and `reference/` to an
   archive repo — **last**, once every route has passed its gate.

### Standing rule: nativised code must not read `src/shells/`

Found after the shared-template task, and it had already happened three times. Every
nativisation so far kept reading its `<head>` tail out of `src/shells/_detail/<coll>/`,
so routes that looked nativised still pinned the scaffolding in place and step 5 could
never have run. Head tails now live beside their components
(`src/components/<x>/<x>-head.html`).

**A route is not nativised while anything it imports reads `src/shells/`.** Check with:

```
grep -rn "src/shells\|'../shells" src/pages src/components src/lib
```

Known remaining, deliberately deferred: `src/pages/sitemap.xml.ts` reads
`src/shells/manifest.json` for the static-route list. It needs a real route source and
is part of the static-page phase (step 4), not a per-collection task.

`src/bindings/` is a separate question and is NOT scaffolding in the same sense: the
nativised components read `detail-lists/*.json` as *data*, because Webflow's
Finsweet-computed list selections are not reproducible from the CMS data alone. That
data needs a home under `src/data/` or `src/content/`, not deletion.

### The risk `verify.mjs` cannot see

Webflow's IX2 runtime (`public/js/radix-web.js`, 672 KB) drives animations from `data-w-id`
attributes. A hand-written component can keep every class, pass struct and text, and still
have dead animations. Pages with interactions need either `data-w-id` preserved verbatim or
a browser spot-check. Flag them per task; do not discover this at the end.

### 2.1c — closing the `<head>` blind spot (added after 2.1b)

`verify.mjs` compares the `<body>` only — its skeleton and text comparisons both start at
`<body>`. Nothing in this project ever checked `<head>`, which let a Phase 4 regression
survive a "1,194/1,202 exact" verification: the nativised per-collection pages (blog,
blog-author, blog-category, categories-learn, articles-learn, careers, ...) pass only
`title`/`description` to `SiteHead`, dropping `meta description`/`og:*`/`twitter:*`
entirely on ~648 of 1,202 pages, plus the blog RSS `link rel="alternate"` on 618 of them.
`tools/test-head-parity.mjs` (commit `e092a27`) closed the blind spot by diffing meta
name/property keys and link rels against `reference/live`, gated with a known-bad baseline
so it can only improve.

Fixed per collection by deriving the field mapping straight from `reference/live` (never
assumed to generalise from blog):

| Collection | description/og:description/twitter:description | og:title/twitter:title | og:image/twitter:image | og:type/twitter:card |
|---|---|---|---|---|
| blog | `excerpt` field | `{name} \| The Radix Blog \| Radix DLT` (same pattern as `<title>`) | `image.url` | static |
| blog-author | `description` field (empty on 13/14 items — matches live) | `{name} \| The Radix Blog \| Radix DLT` | `image.url` (tag always present, empty content when no photo) | static |
| blog-category | `description` field (empty on all 11 items — matches live) | `{name} \| The Radix Blog \| Radix DLT` | *(no image field on live; tags omitted entirely, not emitted empty)* | static |
| categories-learn | literal `Learn more about {name}` (not a CMS field) | — (no OG/Twitter on live) | — | — |
| podcast | `excerpt` field (already fixed pre-existing) | `{name}  \|  Podcast \| Radix DLT - ...` (note double space) | `guest-image.url` | static |
| articles-learn, careers, navigation-featured-section, radix-opp-statuses, sub-categories-learn, projects, projects-6-highlighted, and the 8 collections sharing `GenericDetailPage.astro` (events/team-member/tweets/radix-services/full-stack-social-comments/project-categories/partners/faqs) | confirmed against every live item in each collection: no description, no OG, no Twitter meta at all (some, like articles-learn, carry an empty `<meta name="description" content="">`) | — | — | — |

**Deliberate deviation to record:** `og:image`/`twitter:image` point at our own asset
mirror (`https://www.radixdlt.com` + `assetPath(...)`), not live's
`https://cdn.prod.website-files.com/...` URL. Social-card scrapers need an absolute URL,
and the Webflow CDN dies with the subscription (same reasoning as every other mirrored
asset on this site) — so this is intentionally not byte-parity with `reference/live`.
`src/lib/podcast-detail.ts` set this precedent first; blog, blog-author and blog-category
now follow the same convention.

The RSS `<link rel="alternate">` was restored on blog's 618 detail pages (spliced into
`src/components/blog/blog-head.html` right after the canonical link, same position and
markup podcast already carried) — `src/pages/blog/rss.xml.ts` already existed and served
the feed, the `<link>` pointing at it was simply never reproduced.

`tools/test-head-parity.mjs` after the fix: 0 missing tag kinds (previously up to 648),
canonical mismatches still 0. `verify.mjs` unaffected (still 1,194/1,202 exact — `<body>`
untouched).

---

## 11. Static pages — the round-trip finding that makes them tractable

Measured 2026-08-25. The 49 static routes are genuinely bespoke: **43 distinct top-level
shapes across 49 routes**, only five small families (lp/brave x3, lp/ebooks x2, notices x2,
two longform x2, wallet-landing-3/-4). There is no component library hiding in them, and
inventing one would be fabricating structure that is not there.

So each becomes what a normal Astro page is: a `.astro` file containing its own markup,
composed with `SiteHead` / `SiteNav` / `SiteFooter`. That is only safe because of this:

### Astro DOES round-trip Webflow markup — under two conditions

Tested by putting `complaints-procedure`'s 23,491-byte body verbatim into a page and
diffing the output:

| Condition | Result |
|---|---|
| as-is | `data-astro-cid` stamped on **every element**, an `_astro/*.css` bundle emitted, and Webflow's jQuery/Flickity CDN `<script>` tags **rewritten into Astro module bundles** |
| `<style is:inline>` only | scope attributes and CSS bundle gone; scripts still bundled |
| `<style is:inline>` **and** `<script is:inline>` | **identical markup**, 0 scope attributes, 0 `_astro` assets |

**Both are mandatory for every static page.** Astro processes `<style>` and `<script>`
by default; on this project that silently rewrites the design's selectors and replaces
Webflow's runtime with a bundle. `tools/test-astro-artifacts.mjs` catches the first two
symptoms; nothing catches script bundling except reading the output, so it goes in the
brief every time.

Whitespace between tags is collapsed regardless — harmless where it does not render,
and `tools/test-inline-whitespace.mjs` gates the case where it does.

### Note on `src/pages/_*.astro`

Astro EXCLUDES `src/pages` files whose name starts with `_`. Two probe pages earlier in
this project silently produced no output because of it, which reads exactly like a build
failure. Do not name a route file with a leading underscore.
