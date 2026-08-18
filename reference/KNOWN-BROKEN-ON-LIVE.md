# Already broken on radixdlt.com — parity preserved, do NOT "fix" during migration

Verified against live 2026-08-18. Fixing these changes behaviour vs. the current
site, so they are out of scope for the migration. Worth a separate ticket.

| Issue | Detail |
|---|---|
| 13 brand-pack download links 404 | `/radix-brand-pack` links `/images/radix_logo*.webp` and `/images/Radix-Icon-*.webp`. All 404 on live. Not in the Webflow export either. |
| Homepage "Rolling Number" script throws | Inline script calls `$('.rolling-number').offset().top`; no such element exists in the export, on live, or in our build. Live throws the identical TypeError. |
| `/archived/old-home` linked but 401 | Linked from `radfi-thank-you` and 2 others; password-protected on live. |

# Genuinely missing from our build — TODO

| Item | Status |
|---|---|
| `/blog/rss.xml` | Live serves it (application/rss+xml). Captured to `reference/live/blog/rss.xml`. Must be regenerated in Phase 3. |
| `/podcast/rss.xml` | Same. Captured to `reference/live/podcast/rss.xml`. |
