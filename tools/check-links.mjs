// Verify every local reference in dist/ resolves to a real file or a real route.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const walk = d => readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);

const pages = walk('dist').filter(f => f.endsWith('.html'));
const routes = new Set(pages.map(f => '/' + relative('dist', f).replace(/\.html$/, '').replace(/(^|\/)index$/, '')));
routes.add('/');

const redirects = new Set(
  existsSync('public/_redirects')
    ? readFileSync('public/_redirects', 'utf8').split('\n')
        .filter(l => l.trim() && !l.startsWith('#')).map(l => l.trim().split(/\s+/)[0])
    : []);

const missingAssets = new Map();   // path -> pages referencing it
const missingRoutes = new Map();
const RE = /\b(?:href|src|poster)="(\/[^"#?]*)"/g;

for (const f of pages) {
  const html = readFileSync(f, 'utf8');
  const page = '/' + relative('dist', f).replace(/\.html$/, '');
  for (const m of html.matchAll(RE)) {
    const p = decodeURIComponent(m[1]);
    if (redirects.has(p)) continue;                           // handled by _redirects
    if (/\.[a-z0-9]{2,5}$/i.test(p)) {                       // looks like a file
      const onDisk = join('dist', p);
      const inPublic = join('public', p);
      if (!existsSync(onDisk) && !existsSync(inPublic))
        (missingAssets.get(p) ?? missingAssets.set(p, []).get(p)).push(page);
    } else {                                                  // looks like a route
      if (!routes.has(p) && !redirects.has(p))
        (missingRoutes.get(p) ?? missingRoutes.set(p, []).get(p)).push(page);
    }
  }
}

console.log(`pages scanned: ${pages.length}`);
console.log(`missing assets: ${missingAssets.size}`);
for (const [p, refs] of [...missingAssets].slice(0, 15)) console.log(`  ${p}  <- ${refs.length} page(s) e.g. ${refs[0]}`);
console.log(`unresolved internal routes: ${missingRoutes.size}`);
for (const [p, refs] of [...missingRoutes].sort((a,b)=>b[1].length-a[1].length).slice(0, 20))
  console.log(`  ${p}  <- ${refs.length} page(s) e.g. ${refs[0]}`);
