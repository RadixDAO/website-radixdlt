// Locates reference/live -- the 1,209-page snapshot of the live Webflow site that every
// fidelity check compares against.
//
// It used to live in this repo. It was split into a separate migration archive once the
// migration completed, because it is 76 MB of material that a clean Astro site has no
// business carrying. It is still the ONLY proof that the design survived the rewrite, so
// it was archived rather than deleted -- see the archive repo's README.
//
// Checks that need it skip cleanly when it is absent rather than failing, so a normal
// `pnpm build` in a fresh clone works with no external dependency. Point at the archive
// to run the full suite:
//
//     export RADIX_MIGRATION_ARCHIVE=/path/to/migration-archive
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Absolute path to the live snapshot, or null when the archive is not available. */
export function oracleDir() {
  const local = 'reference/live';
  if (existsSync(local)) return local;                 // still present (pre-split checkouts)
  const arch = process.env.RADIX_MIGRATION_ARCHIVE;
  if (!arch) return null;
  const p = join(arch, 'reference', 'live');
  return existsSync(p) ? p : null;
}

/** Print the skip notice and exit 0. Callers use this so a missing archive is not a failure. */
export function skipWithoutOracle(toolName) {
  console.log(`${toolName}: SKIPPED -- the live snapshot is not available.`);
  console.log(`  It lives in the migration archive, not this repo. To run this check:`);
  console.log(`    export RADIX_MIGRATION_ARCHIVE=/path/to/migration-archive`);
  process.exit(0);
}
