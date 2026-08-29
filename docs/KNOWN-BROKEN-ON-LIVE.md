# Already broken on radixdlt.com — reproduced deliberately, not bugs in this repo

Verified against the live site 2026-08-18. Each of these is intentionally reproduced
because fixing it here would change behaviour the live site itself doesn't have. If any
of these get fixed on the live site, this repo should follow — check before "fixing" one
of these on a hunch.

| Issue | Detail |
|---|---|
| 13 brand-pack download links 404 | `/radix-brand-pack` links `/images/radix_logo*.webp` and `/images/Radix-Icon-*.webp`. All 404 on live. |
| Homepage "Rolling Number" script throws | Inline script calls `$('.rolling-number').offset().top`; no such element exists on live either. Live throws the identical `TypeError`. |
| `/archived/old-home` linked but 401 | Linked from `radfi-thank-you` and two other pages; password-protected on live. |

`tools/check-links.mjs` gates against these via `tools/link-baseline.json` — they're
expected failures, not regressions. Refresh the baseline (`--update-baseline`) only when
a link is legitimately added or removed, not to silence a new one.
