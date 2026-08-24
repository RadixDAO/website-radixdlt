// Record dist/ as the golden baseline that tools/diff-dist.mjs compares against.
//
//   node tools/snapshot-dist.mjs [--force]
//
// Run this ONLY on a build you have verified. Everything downstream trusts this file,
// so snapshotting a broken build silently disarms every later check -- which is the
// exact failure this harness exists to prevent.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { GOLDEN, hashDist, htmlCount } from './lib/dist-hash.mjs';

const force = process.argv.includes('--force');
const map = hashDist();
const html = htmlCount(map);

if (html < 1000 && !force) {
  console.error(`REFUSING: dist/ has only ${html} HTML files; a healthy build has ~1,202.`);
  console.error(`If this is genuinely intended, re-run with --force.`);
  process.exit(1);
}

if (existsSync(GOLDEN) && !force) {
  const prev = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  const changed = Object.keys({ ...prev.files, ...map })
    .filter(k => prev.files[k] !== map[k]).length;
  console.error(`REFUSING: ${GOLDEN} already exists (${Object.keys(prev.files).length} files, ${changed} would change).`);
  console.error(`Re-baselining is a deliberate act: use "node tools/diff-dist.mjs --accept".`);
  process.exit(1);
}

writeFileSync(GOLDEN, JSON.stringify({
  recorded: new Date().toISOString(),
  files: map,
}, null, 1) + '\n');
console.log(`golden recorded: ${Object.keys(map).length} files (${html} HTML) -> ${GOLDEN}`);
