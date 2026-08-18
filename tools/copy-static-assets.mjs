// Phase 1: copy the Webflow export's static asset tree into public/ VERBATIM.
// The directory names must match the export exactly -- radix-web.css references
// fonts via url('../fonts/...'), so /css/ and /fonts/ must stay siblings.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = '/Volumes/Development/radix/radixdlt.com/static export';
const DIRS = ['css', 'js', 'fonts', 'images', 'videos', 'documents'];

mkdirSync('public', { recursive: true });
for (const d of DIRS) {
  const from = join(SRC, d);
  if (!existsSync(from)) { console.error(`MISSING ${from}`); process.exitCode = 1; continue; }
  cpSync(from, join('public', d), { recursive: true, force: false, errorOnExist: false });
  console.log(`copied ${d}`);
}
