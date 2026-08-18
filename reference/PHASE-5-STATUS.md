# Phase 5 — verification status

Every page compared against `reference/live/` (1,207 pages captured while Webflow
was still serving). Two modes: `chrome` ignores CMS list interiors, `--lists`
includes them.

| | chrome | --lists |
|---|---|---|
| exact (struct 1.0000 AND text >= 0.995) | **1,195 / 1,202** | **1,150 / 1,202** |
| >= 0.98 | **1,201 / 1,202** | **1,197 / 1,202** |

Integrity: 0 pages with unbalanced `<div>`; 3 pages carry Webflow CDN URLs (the
known-dead RadFi microsite assets); `wrangler deploy --dry-run` reads 5,752 files
cleanly, no file over 25 MiB, against a 20,000-file limit.

## Every remaining diff, accounted for

| Page(s) | Score | Cause | Action |
|---|---|---|---|
| `/401` | text 0.70 | Live emits `<input … />`, the export `<input …>`. 4 chars of serialisation. | none — cosmetic |
| `/search` | 0.9915 / 0.9874 | Pagefind replaces Webflow's server-rendered results by design | none |
| `developers/ecosystem` | 0.9297 | One external-link-only card ("Radit") has no derivable identity | accepted |
| `lp/brave/*` (3) | text 0.976 | Shared nav featured-section dropdown, matched by external `url-link` rather than a `/collection/slug` path | see below |
| `navigation-featured-section/*` (3) | 0.9935 | same root cause | see below |
| ~8 blog/articles pages | struct 0.994–0.996, **text 1.0000** | structural nuance only; text identical | none |

### The nav featured-section lists

48 static-page list slots (24 pages x 2) are the shared navigation dropdown, sourced
from `navigation-featured-section`. Its items link to arbitrary external URLs via a
`url-link` field rather than to `/collection/slug`, so the identification path used
everywhere else cannot resolve them. They render as the exported shell — visually
correct chrome, missing only the dropdown's CMS-driven promo text.

### Known-broken on live, preserved deliberately

See `KNOWN-BROKEN-ON-LIVE.md`: 13 brand-pack 404s, the homepage rolling-number
TypeError, and a 401 link. All reproduce live behaviour exactly.

## Deliberate deviations from live

1. **sitemap.xml** lists 1,202 URLs; Webflow's lists 999. Eight collections with
   working detail routes are absent from the published sitemap. Correctness chosen
   over bug-for-bug parity for a machine-facing file.
2. **Search** is Pagefind rather than Webflow's hosted search, which does not survive
   the migration.

## Not yet done — requires a decision

- **Deploy.** `wrangler deploy` publishes to Cloudflare. Not run; needs sign-off.
- **DNS cutover.** Keep Webflow published but un-DNS'd for a week as rollback.
