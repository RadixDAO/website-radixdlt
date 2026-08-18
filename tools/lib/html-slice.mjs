// Byte-exact HTML slicing. We never re-serialize Webflow markup -- a parser
// round-trip is precisely how attribute order, quoting, inline <script> bodies and
// IX2 `data-w-id` hooks get quietly mangled. Everything here returns offsets into
// the ORIGINAL string; callers slice.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAWTEXT = new Set(['script', 'style', 'textarea']);

/** End offset (exclusive) of the tag starting at `<` index `i`. */
function endOfTag(html, i) {
  // Attribute values may contain '>', so track quoting.
  let q = null;
  for (let j = i + 1; j < html.length; j++) {
    const c = html[j];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '>') return j + 1;
  }
  return html.length;
}

function tagNameAt(html, i) {
  const m = /^<\/?([a-zA-Z][\w:-]*)/.exec(html.slice(i, i + 40));
  return m ? m[1].toLowerCase() : null;
}

/**
 * Given the index of a start tag's `<`, return [start, end) of the whole element
 * including its closing tag. Handles nesting, comments, void and raw-text elements.
 */
export function elementRange(html, start) {
  const name = tagNameAt(html, start);
  if (!name) return null;
  let i = endOfTag(html, start);
  if (VOID.has(name) || /\/>\s*$/.test(html.slice(start, i))) return [start, i];

  let depth = 1;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;

    if (html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt);
      i = e === -1 ? html.length : e + 3;
      continue;
    }
    const n = tagNameAt(html, lt);
    if (!n) { i = lt + 1; continue; }
    const closing = html[lt + 1] === '/';
    const tagEnd = endOfTag(html, lt);

    if (!closing && RAWTEXT.has(n) && n !== name) {
      // Skip raw-text content wholesale; '<' inside it is not markup.
      const close = html.toLowerCase().indexOf(`</${n}`, tagEnd);
      i = close === -1 ? html.length : endOfTag(html, close);
      continue;
    }
    if (n === name) {
      if (closing) { if (--depth === 0) return [start, tagEnd]; }
      else if (!VOID.has(n) && !/\/>\s*$/.test(html.slice(lt, tagEnd))) depth++;
    }
    i = tagEnd;
  }
  return [start, html.length];
}

/**
 * Top-level (non-nested) elements whose start tag carries `className`.
 * Nested matches are deliberately skipped -- an outer w-dyn-list owns its children.
 */
export function findTopLevelByClass(html, className) {
  const out = [];
  const re = new RegExp(`<[a-zA-Z][\\w:-]*[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*"`, 'g');
  let m;
  while ((m = re.exec(html))) {
    const start = m.index;
    if (out.length && start < out[out.length - 1][1]) continue; // nested -> skip
    const r = elementRange(html, start);
    if (!r) continue;
    out.push(r);
    re.lastIndex = r[1];
  }
  return out;
}

/** Split `html` into alternating literal chunks and named slots at the given ranges. */
export function splitAt(html, ranges) {
  const parts = [];
  let cur = 0;
  ranges.forEach(([s, e], idx) => {
    parts.push({ kind: 'html', text: html.slice(cur, s) });
    parts.push({ kind: 'slot', index: idx, text: html.slice(s, e) });
    cur = e;
  });
  parts.push({ kind: 'html', text: html.slice(cur) });
  return parts;
}

/** Extract <html> attrs, <head> inner, <body> attrs, <body> inner -- all raw. */
export function documentParts(html) {
  const htmlTag = /<html([^>]*)>/i.exec(html);
  const headOpen = /<head[^>]*>/i.exec(html);
  const headClose = /<\/head>/i.exec(html);
  const bodyOpen = /<body([^>]*)>/i.exec(html);
  const bodyClose = html.toLowerCase().lastIndexOf('</body>');
  if (!headOpen || !headClose || !bodyOpen || bodyClose === -1)
    throw new Error('could not locate head/body');
  return {
    htmlAttrs: (htmlTag?.[1] ?? '').trim(),
    head: html.slice(headOpen.index + headOpen[0].length, headClose.index),
    bodyAttrs: (bodyOpen[1] ?? '').trim(),
    body: html.slice(bodyOpen.index + bodyOpen[0].length, bodyClose),
  };
}
