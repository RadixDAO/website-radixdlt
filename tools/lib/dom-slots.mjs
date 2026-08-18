// Enumerate elements in raw HTML with byte ranges for their inner content, so slots
// can be filled by splicing rather than re-serializing.
import { elementRange } from './html-slice.mjs';

const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta',
  'param','source','track','wbr']);

/**
 * Ordered list of every element start tag in `html`.
 * Each entry: { i, tag, attrs, cls, start, end, innerStart, innerEnd }
 * Index `i` is the element's position in document order -- a stable slot id as long as
 * the shell does not change. Shells are regenerated from the export, so it is stable.
 */
export function enumerate(html) {
  const out = [];
  const re = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const start = m.index;
    const openEnd = m.index + m[0].length;
    const selfClosing = /\/\s*$/.test(attrs);
    let end = openEnd, innerStart = openEnd, innerEnd = openEnd;
    if (!VOID.has(tag) && !selfClosing) {
      const r = elementRange(html, start);
      end = r[1];
      innerStart = openEnd;
      // Derive innerEnd from the element's OWN closing tag. Scanning backwards for the
      // last '</' mis-measures on minified markup and silently includes the closing tag
      // in the inner range -- which then makes every leaf look like it has children,
      // and makes an inner-splice delete the closing tag.
      const closeTag = `</${tag}`;
      let k = end - 1;
      while (k >= innerStart && html[k] !== '<') k--;
      innerEnd = (k >= innerStart && html.slice(k, k + closeTag.length).toLowerCase() === closeTag)
        ? k
        : end;
    }
    out.push({
      i: out.length, tag, attrs, start, end, innerStart, innerEnd,
      cls: /class="([^"]*)"/.exec(attrs)?.[1] ?? '',
    });
  }
  return out;
}

/** Normalised signature used to align a shell element with its live counterpart. */
export function signature(el) {
  const cls = el.cls.split(/\s+/).filter(Boolean)
    .filter(c => c !== 'w-dyn-bind-empty' && c !== 'w-condition-invisible')
    .sort().join(' ');
  return `${el.tag}.${cls}`;
}

/** Replace inner content of elements by index. edits: Map<index, string>. */
export function spliceInner(html, edits) {
  const els = enumerate(html);
  const list = [...edits.entries()]
    .map(([i, v]) => ({ el: els[i], v }))
    .filter(x => x.el)
    .sort((a, b) => a.el.innerStart - b.el.innerStart);
  let out = '', cur = 0;
  for (const { el, v } of list) {
    if (el.innerStart < cur) continue;      // nested edit -- outer wins
    out += html.slice(cur, el.innerStart) + v;
    cur = el.innerEnd;
  }
  return out + html.slice(cur);
}

/**
 * Align two signature sequences by longest common subsequence, returning [i, j] pairs.
 *
 * Positional alignment is NOT safe even for two renderings of the same item template:
 * Webflow drops conditionally-hidden elements from the DOM entirely, so a live item
 * can have fewer/more elements than the placeholder. Stopping at the first mismatch
 * loses every slot after the first optional field.
 */
export function alignByLcs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return pairs;
}

/**
 * Collapse per-slot evidence (`Map<elementIndex, Map<"kind field transform", count>>`)
 * into a slots array, keeping the majority winner PER BINDING FAMILY rather than one
 * winner per element.
 *
 * A single element can legitimately carry two independent bindings at once -- e.g. an
 * anchor whose inner text is the item's name AND whose href is the item's own
 * permalink. `inner`/`html` are mutually exclusive with each other (an element's
 * content is either escaped text or raw HTML, never both) but NOT with an `attr:*`
 * binding, and different attrs don't conflict with each other either. Keeping only the
 * single highest-count key per element silently drops whichever binding lost the tie.
 */
export function bestSlotsFromEvidence(evidenceByIndex) {
  const out = [];
  for (const [i, e] of [...evidenceByIndex].sort((a, b) => a[0] - b[0])) {
    const families = new Map();   // 'text' | 'attr:href' | 'attr:style' | ... -> [[kk, count], ...]
    for (const [kk, n] of e) {
      const kind = kk.split(' ')[0];
      const family = kind === 'inner' || kind === 'html' ? 'text' : kind;
      const list = families.get(family) ?? [];
      list.push([kk, n]);
      families.set(family, list);
    }
    for (const [, list] of families) {
      const [kk] = list.sort((a, b) => b[1] - a[1])[0];
      const [kind, field, transform] = kk.split(' ');
      out.push({ slot: i, kind, field, transform });
    }
  }
  return out;
}

/**
 * A MultiReference field (e.g. a blog post's categories) can render as its own
 * NESTED w-dyn-list -- a Finsweet cms-nest tag-pill pattern, one pill per referenced
 * item. `bestSlotsFromEvidence` only ever learns to join those into one comma-joined
 * `ref[].name` string (from aligning against whichever sample happened to have
 * exactly one), which is wrong the moment a live item has two-plus. Detect any
 * flat `ref[].name` / `ref[].slug` slot whose element sits inside a nested
 * `w-dyn-list` within this item template, and collapse it (and its sibling attr
 * binding on the same anchor) into a single 'repeat' slot the renderer can clone
 * once per referenced item instead.
 */
export function collapseNestedRepeats(tplEls, slots, refCollectionOf) {
  const listEls = tplEls.filter((e) => e.cls.split(/\s+/).includes('w-dyn-list'));
  if (!listEls.length) return slots;
  const consumed = new Set();
  const repeats = [];
  for (const listEl of listEls) {
    const anchor = tplEls.find((e) => e.cls.split(/\s+/).includes('w-dyn-item')
      && e.start > listEl.start && e.end <= listEl.end);
    if (!anchor) continue;
    const within = slots.filter((s) => {
      const el = tplEls[s.slot];
      return el && el.start >= anchor.start && el.end <= anchor.end
        && (s.transform === 'ref[].name' || s.transform === 'ref[].slug');
    });
    if (!within.length) continue;
    const field = within[0].field;
    if (!within.every((s) => s.field === field)) continue;   // ambiguous, leave alone
    within.forEach((s) => consumed.add(s));
    const itemSlots = within.map((s) => ({
      slot: s.slot, kind: s.kind, field: s.transform === 'ref[].slug' ? 'slug' : 'name',
    }));
    repeats.push({ slot: listEl.i, kind: 'repeat', field, refCollection: refCollectionOf(field), itemSlots });
  }
  if (!repeats.length) return slots;
  return [...slots.filter((s) => !consumed.has(s)), ...repeats].sort((a, b) => a.slot - b.slot);
}
