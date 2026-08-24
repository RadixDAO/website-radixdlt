// Compare the current build against reference/dist-golden.json, byte for byte.
//
//   node tools/diff-dist.mjs            fail on ANY difference
//   node tools/diff-dist.mjs --accept   re-baseline, deliberately
//   node tools/diff-dist.mjs --quiet    counts only, no diff bodies
//
// This is the gate for every refactor in REBUILD-PLAN.md section 6. tools/verify.mjs
// answers "did the conversion work" and tolerates ~0.5% drift by design. This answers
// "did my refactor change anything" and tolerates nothing. A componentisation step that
// is genuinely a refactor prints "0 files changed"; anything else is a regression until
// proven otherwise.
//
// It is deliberately blind to intent: it cannot be argued with, only re-baselined, and
// re-baselining leaves a commit behind.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { GOLDEN, hashDist, htmlCount, bytesOf } from './lib/dist-hash.mjs';

const accept = process.argv.includes('--accept');
const quiet = process.argv.includes('--quiet');

if (!existsSync(GOLDEN)) {
  console.error(`No ${GOLDEN}. Record one with: node tools/snapshot-dist.mjs`);
  process.exit(2);
}

const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
const now = hashDist();

const keys = [...new Set([...Object.keys(golden.files), ...Object.keys(now)])].sort();
const added   = keys.filter(k => !(k in golden.files));
const removed = keys.filter(k => !(k in now));
const changed = keys.filter(k => k in golden.files && k in now && golden.files[k] !== now[k]);
const total = added.length + removed.length + changed.length;

console.log(`baseline ${golden.recorded}  ${Object.keys(golden.files).length} files`);
console.log(`current             ${Object.keys(now).length} files (${htmlCount(now)} HTML)`);

if (total === 0) {
  console.log(`\n0 files changed`);
  process.exit(0);
}

console.log(`\n${total} files changed  (${changed.length} modified, ${added.length} added, ${removed.length} removed)`);
const list = (label, arr) => {
  if (!arr.length) return;
  console.log(`\n  ${label}:`);
  for (const k of arr.slice(0, 40)) console.log(`    ${k}`);
  if (arr.length > 40) console.log(`    ... and ${arr.length - 40} more`);
};
list('modified', changed);
list('added', added);
list('removed', removed);

// Size deltas for the modified files: a nav accidentally rendered twice shows up here
// as a uniform +39,299 across dozens of pages, which names the bug immediately.
if (!quiet && changed.length) {
  console.log(`\n  size deltas:`);
  for (const k of changed.slice(0, 20)) {
    const was = bytesOf(golden.files[k]), is = bytesOf(now[k]);
    const d = is - was;
    console.log(`    ${d >= 0 ? '+' : ''}${d}\t${was} -> ${is}\t${k}`);
  }
  if (changed.length > 20) console.log(`    ... and ${changed.length - 20} more`);
  console.log(`\n  To see the actual markup change, rebuild the previous state:`);
  console.log(`    git stash && pnpm build && cp -r dist /tmp/dist-before && git stash pop && pnpm build`);
  console.log(`    diff /tmp/dist-before/<file> dist/<file>`);
}

if (accept) {
  writeFileSync(GOLDEN, JSON.stringify({ recorded: new Date().toISOString(), files: now }, null, 1) + '\n');
  console.log(`\nACCEPTED: ${GOLDEN} re-baselined to the current build.`);
  console.log(`Commit it on its own, with a message saying why the output was allowed to change.`);
  process.exit(0);
}

process.exit(1);
