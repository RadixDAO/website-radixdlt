// Byte-level inventory of dist/. No normalisation of any kind: the whole point is to
// notice changes a fidelity comparison would forgive.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const DIST = 'dist';
export const GOLDEN = 'reference/dist-golden.json';

export function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/**
 * { "<path relative to dist, / separated>": "<sha256>:<bytes>" }, key-sorted.
 * Size rides along with the hash so a failing gate can say "grew by 39,299 bytes"
 * -- usually enough to identify the mistake without rebuilding the previous state.
 */
export function hashDist() {
  if (!existsSync(DIST)) throw new Error(`${DIST}/ does not exist -- run pnpm build first.`);
  const files = walk(DIST);
  if (!files.length) throw new Error(`${DIST}/ is empty.`);
  const map = {};
  for (const f of files) {
    const key = relative(DIST, f).split(sep).join('/');
    const buf = readFileSync(f);
    map[key] = `${createHash('sha256').update(buf).digest('hex')}:${buf.length}`;
  }
  return Object.fromEntries(Object.keys(map).sort().map(k => [k, map[k]]));
}

export const bytesOf = (v) => Number(v.split(':')[1]);
export const htmlCount = (m) => Object.keys(m).filter(k => k.endsWith('.html')).length;
