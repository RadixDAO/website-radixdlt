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

### 2.1 — `<SiteHead>`
Diff the `<head>` across all shells. Hoist the identical block (stylesheet links,
`radix-web.js`, GTM, favicons) into `src/components/site/SiteHead.astro`. Per-page
props: `title`, `description`, OG/Twitter tags, `data-wf-page`, `data-wf-site`, any
page-local `<style>`/`<script>`. Shells keep only their unique head fragment.

### 2.2 — `<SiteNav variant currentPath>`
Commit the 6 canonical blocks as `src/chrome/nav.{main,blog,compact,wallet-test,radfi,learn}.html`.
The component splices the block through `set:html` — *never* re-serialised — and applies
current-page marking with an offset-based rewrite, matching Webflow's rule: on each
`<a>` whose href resolves to `currentPath`, insert `aria-current="page"` immediately
before `class=` and append ` w--current` to the class list. Add `tools/lib/mark-current.mjs`
for that single transform, with a unit test over all 41 nav-bearing pages.

Remove the nav block from every shell; it now comes from the component.

### 2.3 — `<SiteFooter variant currentPath>`
Same shape, 4 variants, same `mark-current` helper.

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

## 7. Phase 3 — Cutover blockers that are still open on `main`

These are real gaps, independent of the refactor. Found while auditing the export:

**7.1 — Seven Webflow-hosted forms will silently break.** 23 `<form>` elements exist
in the export: 8 point at `/search` (fine — Pagefind), 1 is `/.wf_auth` (the 401 page),
and **7 have no `action` at all** — they POST to Webflow's own endpoint and stop
working the moment the subscription lapses. Affected: `developers/grants`,
`developers/submit-blueprint`, `developers/sign-up`, and the signup pages.
They fail *quietly*: the user sees a success state, the submission goes nowhere.
Codex's `MailerLiteForm.astro` and its "MailerLite form recovery evidence" commit are
the salvageable half of that branch — see §8. Decide the destination (MailerLite,
a Worker `POST` handler, or a form service) and prove one round-trip end to end before
DNS cutover. The 117 pages carrying MailerLite *embeds* are fine; those are external.

**7.2 — RadFi microsite assets.** 3 pages still reference the dead Webflow CDN
(`PHASE-5-STATUS.md`). Mirror or accept explicitly.

**7.3 — Rollback plan.** As `README.md` already says: keep Webflow published but
un-DNS'd for a week after cutover. Write the rollback runbook down before you need it.

---

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
