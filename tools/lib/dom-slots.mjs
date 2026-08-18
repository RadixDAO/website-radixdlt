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
      const close = html.lastIndexOf('</', end);
      innerEnd = close > innerStart ? close : openEnd;
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
