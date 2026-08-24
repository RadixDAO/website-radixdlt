// One-off repair: video-poster background URLs mangled by the pre-fix rewriteUrl.
//
// `url(&quot;https://host/x.jpg&quot;)` in a style ATTRIBUTE was treated as a relative
// path, becoming `url(/&quot;https:/host/x.jpg&quot;)` -- a dead reference on 674 pages.
// tools/lib/rewrite-urls.mjs now handles entity-quoted URLs; this repairs the shells
// already committed, so `pnpm convert` does not have to be re-run (which would undo the
// head/nav/footer hoisting applied to those shells afterwards).
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { rewriteUrl } from './lib/rewrite-urls.mjs';

const walk = d => readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

const MANGLED = /\/(&quot;)(https?:)\/([^&]*)(&quot;)/g;
let files = 0, fixes = 0, unresolved = [];

for (const f of walk('src/shells').filter(f => f.endsWith('.html'))) {
  const before = readFileSync(f, 'utf8');
  const after = before.replace(MANGLED, (m, q, scheme, rest) => {
    const original = `${q}${scheme}//${rest}${q}`;   // undo the mangling
    const out = rewriteUrl(original, '');
    if (out === original) unresolved.push(`${scheme}//${rest}`);
    fixes++;
    return out;
  });
  if (after !== before) { writeFileSync(f, after); files++; }
}

console.log(`repaired ${fixes} poster URLs across ${files} shells`);
if (unresolved.length) {
  console.log(`unmirrored (left absolute): ${new Set(unresolved).size}`);
  for (const u of new Set(unresolved)) console.log(`  ${u}`);
}
