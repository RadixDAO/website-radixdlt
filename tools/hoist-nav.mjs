// Removes the nav from the shells in both render pipelines (REBUILD-PLAN.md Task
// 2.2), replacing it with a `{kind:'nav', variant}` manifest entry (WebflowPage) or a
// `<!--RADIX_NAV_SLOT-->` marker (DetailPage) that src/components/site/SiteNav.astro
// fills at render time via tools/lib/mark-current.mjs.
//
//   node tools/hoist-nav.mjs [--dry-run]
//
// Never reparses/reserialises: the nav's [start,end) byte range is located with
// tools/lib/find-nav.mjs and the surrounding bytes are kept verbatim on both sides.
//
// --- WebflowPage shells (src/shells/<route>/) ---
// The nav is not contiguous there: convert-pages.mjs splits every body at top-level
// w-dyn-list boundaries, and the nav variant used by every one of these routes
// ("main") embeds two CMS `navigation-featured-section` dropdowns, so on a page like
// index the nav spans body.0 -> list.0 -> body.1 -> list.1 -> (part of) body.2. This
// reconstructs the full body from the CURRENT order array, finds the nav in that
// reconstruction, then maps the [start,end) back onto the underlying files: entries
// wholly before/after the nav are untouched, entries wholly inside it are deleted,
// and the entry(ies) straddling its edges are truncated in place (or split into a
// `.pre.html`/`.post.html` pair when the nav starts and ends inside the same entry).
//
// --- DetailPage shells (src/shells/_detail/<collection>/body.html) ---
// One shell serves every item in a collection, so there's no per-page duplication to
// remove -- but the nav bytes still need to move to src/chrome/ so there's exactly
// ONE copy of each variant shared by both pipelines (proven byte-identical already:
// tools/derive-nav-variants.mjs grouped WebflowPage-rendered and DetailPage-rendered
// pages under the same hash without distinguishing pipeline).
//
// The hard part there is that render-detail.mjs's page-level bindings
// (src/bindings/<collection>.json) address elements by their INDEX in document order
// (tools/lib/dom-slots.mjs's `enumerate`), computed once, back when the bindings were
// derived, against the shell AS IT CURRENTLY STANDS. Deleting the nav's bytes would
// silently shift every later element's index and desync every binding. Two things
// make this tractable instead of a blocker:
//   1. Replacing the nav with an HTML COMMENT marker, rather than deleting it,
//      contributes zero elements to `enumerate` (comments aren't tags) -- so the
//      marker's presence is exactly equivalent, index-wise, to true removal.
//   2. Verified for all ten nav-bearing collections below: no ACTIVE binding slot
//      (i.e. not `inList` -- inList slots belong to nested collection lists and are
//      unconditionally skipped by renderBody) falls inside the nav's own element
//      range, and every nav-bearing collection's OTHER top-level w-dyn-lists (used
//      by src/bindings/detail-lists/*.json, keyed by ordinal position) sit strictly
//      after the nav -- so removing it never renumbers them. That leaves exactly one
//      mechanical fix: shift every element index at or past the nav's end down by
//      the number of elements the nav itself contained.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { findNavRange } from './lib/find-nav.mjs';
import { enumerate } from './lib/dom-slots.mjs';
import { VARIANT_NAMES, stripCurrentMarking } from './lib/nav-variants.mjs';

const DRY = process.argv.includes('--dry-run');
const CHROME_DIR = 'src/chrome';

function variantNameFor(navRaw, where) {
  const canon = stripCurrentMarking(navRaw);
  const hash = createHash('sha1').update(canon).digest('hex').slice(0, 8);
  const name = VARIANT_NAMES[hash];
  if (!name) throw new Error(`${where}: nav hash ${hash} isn't a known variant (see tools/lib/nav-variants.mjs)`);
  const canonical = readFileSync(join(CHROME_DIR, `nav.${name}.html`), 'utf8');
  if (canonical !== canon) {
    throw new Error(`${where}: nav content for variant "${name}" doesn't match src/chrome/nav.${name}.html`);
  }
  return name;
}

// ---------------------------------------------------------------------------------
// WebflowPage pipeline
// ---------------------------------------------------------------------------------
function hoistWebflowPages() {
  const manifestPath = 'src/shells/manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const writes = new Map();   // file -> content
  const deletes = new Set();  // file
  let navRoutes = 0, noNavRoutes = 0;

  for (const route of Object.keys(manifest).sort()) {
    const entry = manifest[route];
    const dir = join('src/shells', route);

    // Reconstruct the full body from the current order, tracking each part's range.
    const ranges = [];
    let full = '';
    for (const part of entry.order) {
      const text = readFileSync(join(dir, part.file), 'utf8');
      ranges.push({ part, start: full.length, end: full.length + text.length, text });
      full += text;
    }

    const navRange = findNavRange(full);
    if (!navRange) { noNavRoutes++; continue; }
    navRoutes++;
    const [ns, ne] = navRange;
    const navRaw = full.slice(ns, ne);
    const name = variantNameFor(navRaw, `WebflowPage route "${route}"`);

    const startIdx = ranges.findIndex(r => ns >= r.start && ns < r.end);
    const endIdx = ranges.findIndex(r => ne > r.start && ne <= r.end);
    if (startIdx === -1 || endIdx === -1) throw new Error(`route "${route}": couldn't map nav range onto order parts`);
    if (ranges[startIdx].part.kind !== 'html') throw new Error(`route "${route}": nav starts inside a non-html part`);
    if (ranges[endIdx].part.kind !== 'html') throw new Error(`route "${route}": nav ends inside a non-html part`);

    const newOrder = [];
    // Parts wholly before the nav: untouched.
    for (let i = 0; i < startIdx; i++) newOrder.push(ranges[i].part);

    if (startIdx === endIdx) {
      const r = ranges[startIdx];
      const before = r.text.slice(0, ns - r.start);
      const after = r.text.slice(ne - r.start);
      if (before) {
        writes.set(join(dir, r.part.file), before);
        newOrder.push(r.part);
      } else {
        deletes.add(join(dir, r.part.file));
      }
      newOrder.push({ kind: 'nav', variant: name });
      if (after) {
        const postFile = r.part.file.replace(/\.html$/, '.post.html');
        writes.set(join(dir, postFile), after);
        newOrder.push({ kind: 'html', file: postFile });
      }
    } else {
      const startR = ranges[startIdx];
      const before = startR.text.slice(0, ns - startR.start);
      if (before) {
        writes.set(join(dir, startR.part.file), before);
        newOrder.push(startR.part);
      } else {
        deletes.add(join(dir, startR.part.file));
      }
      newOrder.push({ kind: 'nav', variant: name });
      // Parts strictly between: wholly consumed by the nav -- delete.
      for (let i = startIdx + 1; i < endIdx; i++) deletes.add(join(dir, ranges[i].part.file));
      const endR = ranges[endIdx];
      const after = endR.text.slice(ne - endR.start);
      if (after) {
        writes.set(join(dir, endR.part.file), after);
        newOrder.push(endR.part);
      } else {
        deletes.add(join(dir, endR.part.file));
      }
    }
    // Parts wholly after the nav: untouched.
    for (let i = endIdx + 1; i < ranges.length; i++) newOrder.push(ranges[i].part);

    entry.order = newOrder;
    entry.nav = name;
    entry.listCount = newOrder.filter(p => p.kind === 'list').length;
  }

  console.log(`WebflowPage: ${navRoutes} routes with a nav, ${noNavRoutes} without`);

  if (!DRY) {
    for (const [file, content] of writes) writeFileSync(file, content);
    for (const file of deletes) if (existsSync(file)) unlinkSync(file);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  } else {
    console.log(`  (dry run) ${writes.size} files would be written, ${deletes.size} deleted`);
  }
}

// ---------------------------------------------------------------------------------
// DetailPage pipeline
// ---------------------------------------------------------------------------------
const NAV_MARKER = '<!--RADIX_NAV_SLOT-->';

function hoistDetailTemplates() {
  const manifestPath = 'src/shells/_detail/manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let navCollections = 0, noNavCollections = 0;

  for (const collection of Object.keys(manifest).sort()) {
    const dir = join('src/shells/_detail', collection);
    const bodyPath = join(dir, 'body.html');
    const body = readFileSync(bodyPath, 'utf8');

    const navRange = findNavRange(body);
    if (!navRange) { noNavCollections++; continue; }
    navCollections++;
    const [ns, ne] = navRange;
    const navRaw = body.slice(ns, ne);
    const name = variantNameFor(navRaw, `detail collection "${collection}"`);

    const els = enumerate(body);
    const navStartI = els.findIndex(e => e.start === ns);
    const navEndIdx = els.findIndex(e => e.start >= ne);
    if (navStartI === -1) throw new Error(`collection "${collection}": nav start isn't an element boundary`);
    const elementsConsumed = (navEndIdx === -1 ? els.length : navEndIdx) - navStartI;

    const newBody = body.slice(0, ns) + NAV_MARKER + body.slice(ne);

    // Remap src/bindings/<collection>.json: every ACTIVE (non-inList) slot at or
    // past navEndIdx shifts down by the element count the nav itself contained.
    // inList slots that fell inside the nav (the two navigation-featured-section
    // dropdown bindings) are dead already -- renderBody skips every inList slot
    // unconditionally -- so they're simply dropped rather than remapped.
    const bindingsPath = `src/bindings/${collection}.json`;
    let bindingsChanged = null;
    if (existsSync(bindingsPath)) {
      const b = JSON.parse(readFileSync(bindingsPath, 'utf8'));
      if (Array.isArray(b.slots)) {
        const before = b.slots.length;
        b.slots = b.slots
          .filter(s => !(s.slot >= navStartI && s.slot < navEndIdx))
          .map(s => s.slot >= navEndIdx ? { ...s, slot: s.slot - elementsConsumed } : s);
        if (b.slots.length !== before || elementsConsumed) bindingsChanged = b;
      }
    }

    if (!DRY) {
      writeFileSync(bodyPath, newBody);
      manifest[collection].nav = name;
      if (bindingsChanged) writeFileSync(bindingsPath, JSON.stringify(bindingsChanged, null, 1));
    }
  }

  console.log(`DetailPage: ${navCollections} collections with a nav, ${noNavCollections} without`);
  if (!DRY) writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
}

hoistWebflowPages();
hoistDetailTemplates();
console.log(DRY ? '\n(dry run -- nothing written)' : '\ndone.');
