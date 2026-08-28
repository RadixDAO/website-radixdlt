// Gate on `verify.mjs --lists`, which the project was NOT gating on.
//
// The default mode strips every w-dyn-list interior, so it says nothing about CMS list
// CONTENT. Gating only on it let two regressions through Phase 4 unnoticed:
//   * blog-category fell 11/11 -> 1/11 because the taxonomy list hardcoded the empty
//     state instead of binding seo-meta-description
//   * blog-author fell 6/14 -> 5/14
// Both were invisible in default mode and to every other check.
//
// Floor, not equality: pre-existing failures (podcast 0/5, signup 0/2, lp 2/5, notices
// 0/1, navigation-featured-section 0/3, static 6/29) predate this work and are not this
// gate's job to fix. It exists to stop the number going DOWN.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASELINE = 'tools/baselines/verify-lists-floor.json';
const out = execFileSync('node', ['tools/verify.mjs', '--lists'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const m = /exact match\s*:\s*(\d+)\/(\d+)/.exec(out);
if (!m) { console.error('could not parse verify.mjs --lists output'); process.exit(2); }
const [exact, total] = [Number(m[1]), Number(m[2])];
console.log(`verify --lists: ${exact}/${total} exact`);

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, JSON.stringify({ exact, total }, null, 1) + '\n');
  console.log(`floor set at ${exact}/${total} -> ${BASELINE}`);
  process.exit(0);
}
if (!existsSync(BASELINE)) { console.error(`No ${BASELINE}. Create with --update-baseline`); process.exit(2); }
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
if (exact < base.exact) {
  console.error(`\nFAIL: list-interior fidelity fell ${base.exact} -> ${exact}`);
  console.error(out.split('\n').filter(l => /n=\s*\d+\s+exact=/.test(l)).join('\n'));
  process.exit(1);
}
console.log(`floor ${base.exact}/${base.total} held${exact > base.exact ? ` (improved to ${exact})` : ''}`);
