// Removes the footer from the shells in both render pipelines (REBUILD-PLAN.md Task
// 2.3), replacing it with a `{kind:'footer', variant}` manifest entry (WebflowPage) or a
// `<!--RADIX_FOOTER_SLOT-->` marker (DetailPage) that src/components/site/SiteFooter.astro
// fills at render time via tools/lib/mark-current.mjs.
//
//   node tools/hoist-footer.mjs [--dry-run]
//
// Never reparses/reserialises: the footer's [start,end) byte range is located with
// tools/lib/find-footer.mjs and the surrounding bytes are kept verbatim on both sides.
//
// --- WebflowPage shells (src/shells/<route>/) ---
// The footer typically appears in the last body chunk, but may span across list
// boundaries if there are CMS-driven elements. This reconstructs the full body from
// the order array, finds the footer in that reconstruction, then maps the [start,end)
// back onto the underlying files: entries wholly before the footer are untouched,
// entries wholly inside it are deleted, and the entry(ies) straddling its edges are
// truncated in place (or split into a `.pre.html`/`.post.html` pair when the footer
// starts and ends inside the same entry).
//
// --- DetailPage shells (src/shells/_detail/<collection>/body.html) ---
// One shell serves every item in a collection. The footer bytes are replaced with a
// <!--RADIX_FOOTER_SLOT--> comment marker, which contributes zero elements to dom-slots.mjs's
// `enumerate` (comments aren't tags) -- so the marker's presence is exactly equivalent,
// index-wise, to true removal. Bindings are remapped: every ACTIVE (non-inList) slot
// at or past the footer's end shifts down by the number of elements the footer itself
// contained (verified that no active binding falls inside the footer for any
// footer-bearing collection).
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { findFooterRange } from './lib/find-footer.mjs';
import { enumerate } from './lib/dom-slots.mjs';
import { VARIANT_NAMES, stripCurrentMarking } from './lib/footer-variants.mjs';

const DRY = process.argv.includes('--dry-run');
const CHROME_DIR = 'src/chrome';

function variantNameFor(footerRaw, where) {
  const canon = stripCurrentMarking(footerRaw);
  const hash = createHash('sha1').update(canon).digest('hex').slice(0, 8);
  const name = VARIANT_NAMES[hash];
  if (!name) throw new Error(`${where}: footer hash ${hash} isn't a known variant (see tools/lib/footer-variants.mjs)`);
  const canonical = readFileSync(join(CHROME_DIR, `footer.${name}.html`), 'utf8');
  if (canonical !== canon) {
    throw new Error(`${where}: footer content for variant "${name}" doesn't match src/chrome/footer.${name}.html`);
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
  let footerRoutes = 0, noFooterRoutes = 0;

  for (const route of Object.keys(manifest).sort()) {
    const entry = manifest[route];
    const dir = join('src/shells', route);

    // Reconstruct the full body from the current order, tracking each part's range and
    // preserving nav entries' positions relative to file ranges.
    const ranges = [];
    let full = '';
    const originalOrder = entry.order; // Keep original order for nav preservation
    for (const part of originalOrder) {
      if (part.kind === 'nav') {
        continue; // Skip nav entries, they're not files
      }
      const text = readFileSync(join(dir, part.file), 'utf8');
      ranges.push({ part, start: full.length, end: full.length + text.length, text });
      full += text;
    }

    const footerRange = findFooterRange(full);
    if (!footerRange) { noFooterRoutes++; continue; }
    footerRoutes++;
    const [fs, fe] = footerRange;
    const footerRaw = full.slice(fs, fe);
    const name = variantNameFor(footerRaw, `WebflowPage route "${route}"`);

    const startIdx = ranges.findIndex(r => fs >= r.start && fs < r.end);
    const endIdx = ranges.findIndex(r => fe > r.start && fe <= r.end);
    if (startIdx === -1 || endIdx === -1) throw new Error(`route "${route}": couldn't map footer range onto order parts`);
    if (ranges[startIdx].part.kind !== 'html') throw new Error(`route "${route}": footer starts inside a non-html part`);
    if (ranges[endIdx].part.kind !== 'html') throw new Error(`route "${route}": footer ends inside a non-html part`);

    // Build a mapping of original position to range index, preserving nav entries in between.
    // This maps each position in originalOrder to either a range index or a nav entry.
    const orderWithRangeIndices = []; // Array of {type: 'range'|'nav', value: rangeIndex|navPart}
    {
      let rangeIdx = 0;
      for (const part of originalOrder) {
        if (part.kind === 'nav') {
          orderWithRangeIndices.push({ type: 'nav', value: part });
        } else {
          orderWithRangeIndices.push({ type: 'range', value: rangeIdx });
          rangeIdx++;
        }
      }
    }

    // Helper to rebuild newOrder from orderWithRangeIndices, applying footer changes.
    // This preserves all nav entries at their original positions.
    const newOrder = [];

    for (const item of orderWithRangeIndices) {
      if (item.type === 'nav') {
        newOrder.push(item.value);
        continue;
      }

      const i = item.value;
      if (i < startIdx) {
        // Wholly before footer: untouched
        newOrder.push(ranges[i].part);
      } else if (i === startIdx && i === endIdx) {
        // Footer is entirely within this range
        const r = ranges[i];
        const before = r.text.slice(0, fs - r.start);
        const after = r.text.slice(fe - r.start);
        if (before) {
          writes.set(join(dir, r.part.file), before);
          newOrder.push(r.part);
        } else {
          deletes.add(join(dir, r.part.file));
        }
        newOrder.push({ kind: 'footer', variant: name });
        if (after) {
          const postFile = r.part.file.replace(/\.html$/, '.post.html');
          writes.set(join(dir, postFile), after);
          newOrder.push({ kind: 'html', file: postFile });
        }
      } else if (i === startIdx) {
        // Footer starts in this range
        const r = ranges[i];
        const before = r.text.slice(0, fs - r.start);
        if (before) {
          writes.set(join(dir, r.part.file), before);
          newOrder.push(r.part);
        } else {
          deletes.add(join(dir, r.part.file));
        }
        newOrder.push({ kind: 'footer', variant: name });
      } else if (i === endIdx) {
        // Footer ends in this range
        const r = ranges[i];
        const after = r.text.slice(fe - r.start);
        if (after) {
          writes.set(join(dir, r.part.file), after);
          newOrder.push(r.part);
        } else {
          deletes.add(join(dir, r.part.file));
        }
      } else if (i > startIdx && i < endIdx) {
        // Wholly consumed by footer -- delete
        deletes.add(join(dir, ranges[i].part.file));
      } else if (i > endIdx) {
        // Wholly after footer: untouched
        newOrder.push(ranges[i].part);
      }
    }

    entry.order = newOrder;
    entry.footer = name;
  }

  console.log(`WebflowPage: ${footerRoutes} routes with a footer, ${noFooterRoutes} without`);

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
const FOOTER_MARKER = '<!--RADIX_FOOTER_SLOT-->';

function hoistDetailTemplates() {
  const manifestPath = 'src/shells/_detail/manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let footerCollections = 0, noFooterCollections = 0;

  for (const collection of Object.keys(manifest).sort()) {
    const dir = join('src/shells/_detail', collection);
    const bodyPath = join(dir, 'body.html');
    const body = readFileSync(bodyPath, 'utf8');

    const footerRange = findFooterRange(body);
    if (!footerRange) { noFooterCollections++; continue; }
    footerCollections++;
    const [fs, fe] = footerRange;
    const footerRaw = body.slice(fs, fe);
    const name = variantNameFor(footerRaw, `detail collection "${collection}"`);

    const els = enumerate(body);
    const footerStartI = els.findIndex(e => e.start === fs);
    const footerEndIdx = els.findIndex(e => e.start >= fe);
    if (footerStartI === -1) throw new Error(`collection "${collection}": footer start isn't an element boundary`);
    const elementsConsumed = (footerEndIdx === -1 ? els.length : footerEndIdx) - footerStartI;

    const newBody = body.slice(0, fs) + FOOTER_MARKER + body.slice(fe);

    // Remap src/bindings/<collection>.json: every ACTIVE (non-inList) slot at or
    // past footerEndIdx shifts down by the element count the footer itself contained.
    // inList slots that fell inside the footer are dead already -- renderBody skips
    // every inList slot unconditionally -- so they're simply dropped rather than remapped.
    const bindingsPath = `src/bindings/${collection}.json`;
    let bindingsChanged = null;
    if (existsSync(bindingsPath)) {
      const b = JSON.parse(readFileSync(bindingsPath, 'utf8'));
      if (Array.isArray(b.slots)) {
        const before = b.slots.length;
        b.slots = b.slots
          .filter(s => !(s.slot >= footerStartI && s.slot < footerEndIdx))
          .map(s => s.slot >= footerEndIdx ? { ...s, slot: s.slot - elementsConsumed } : s);
        if (b.slots.length !== before || elementsConsumed) bindingsChanged = b;
      }
    }

    if (!DRY) {
      writeFileSync(bodyPath, newBody);
      manifest[collection].footer = name;
      if (bindingsChanged) writeFileSync(bindingsPath, JSON.stringify(bindingsChanged, null, 1));
    }
  }

  console.log(`DetailPage: ${footerCollections} collections with a footer, ${noFooterCollections} without`);
  if (!DRY) writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
}

hoistWebflowPages();
hoistDetailTemplates();
console.log(DRY ? '\n(dry run -- nothing written)' : '\ndone.');
