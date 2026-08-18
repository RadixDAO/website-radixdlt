# Binding brief — refining a collection's CMS binding map

Self-contained. Everything you need is on disk; do not assume prior context.

## Repo
`/Volumes/Development/radix/radixdlt.com/site` — work ONLY here.
`/Volumes/Development/radix/radixdlt.com/static export/`, `/cms/`, `/astro-site/` are READ-ONLY.

## The job
A Webflow site is being rebuilt in Astro with byte-exact fidelity. Each CMS collection
has a *binding map* saying which CMS field fills which slot in the exported template.
Maps are auto-derived, then refined by hand where derivation falls short.

## Ground truth
`reference/live/<collection>/<slug>.html` — a real snapshot of every published page.
**A binding is correct when the built page matches the live page.** Nothing else counts.

## Loop
```bash
node tools/derive-bindings.mjs <collection> 8      # re-derive (prints unresolved slots)
node_modules/.bin/astro build                      # ~10s for the whole site
node tools/verify.mjs                              # per-collection struct + TEXT scores
```
Target: `TEXT >= 0.995` and `struct == 1.0000` for the collection.

To inspect one page:
```bash
node -e "
import('./tools/lib/dom-slots.mjs').then(({enumerate})=>{
  const fs=require('fs');
  const shell=fs.readFileSync('src/shells/_detail/<collection>/body.html','utf8');
  const els=enumerate(shell);
  console.log(els[SLOT].tag, els[SLOT].cls, JSON.stringify(shell.slice(els[SLOT].innerStart, els[SLOT].innerStart+120)));
});"
```

## Binding map format — `src/bindings/<collection>.json`
```jsonc
{
  "collection": "blog",
  "head": [ { "target": "title", "field": "name", "transform": "text",
              "pattern": "{} | The Radix Blog | Radix DLT" } ],
  "slots": [
    { "slot": 141, "kind": "inner",      "field": "name",        "transform": "text" },
    { "slot": 142, "kind": "inner",      "field": "date",        "transform": "date:MMMM D, YYYY" },
    { "slot": 150, "kind": "html",       "field": "main-content","transform": "text" },
    { "slot": 139, "kind": "attr:style", "field": "image",       "transform": "asset" },
    { "slot": 155, "kind": "attr:href",  "field": "blog-author", "transform": "ref.slug" },
    { "slot": 212, "kind": "inner", "...": "...", "inList": true }
  ]
}
```
- `slot` — element index in document order over `src/shells/_detail/<c>/body.html`.
  **Enumerated over `documentParts().body` (body INNER html).** Getting this wrong
  silently binds the wrong element; it once replaced an 11 KB `<footer>` with a title.
- `kind` — `inner` (escaped text) | `html` (raw, rich text) | `attr:<name>`
- `transform` — `text` | `date:MMMM D, YYYY` | `date:D MMMM YYYY` | `asset` |
  `ref.name` | `ref.slug` | `ref.image` | `ref[].name`
- `inList: true` — the slot lives inside a `w-dyn-list`; it binds per list item, NOT
  from this page's item. The renderer skips these. Do not remove the flag.

Field slugs and types: `reference/collection-map.json` (`.fields[]`) and
`reference/webflow/fields/<collection>.json`. Item data:
`reference/webflow/items/<collection>.json` (`fieldData`, filter out
`isDraft`/`isArchived`).

## Rules
1. **Never edit `src/shells/`** — regenerated from the export. Fix the map or the tool.
2. **Never widen a slot to a container.** If text belongs to a child, bind the child.
3. An empty CMS field must keep Webflow's `w-dyn-bind-empty` class — the renderer
   already does this. Live pages rely on it for conditional visibility.
4. If derivation reports a slot as unresolved and live text comes from ANOTHER
   collection (nav featured sections, related posts), it is not this map's job.
5. Prefer fixing `tools/derive-bindings.mjs` over hand-editing a map when the same
   mistake affects several collections.

## Done means
`node tools/verify.mjs` shows your collection at `struct=1.0000` and `TEXT>=0.995`,
AND no other collection's score dropped. Report both numbers before and after.
