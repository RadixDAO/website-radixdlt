// Equivalence proof for the "CMS data -> Astro content collections" migration.
//
// Asserts that for every one of the 1,590 items across all 29 collections in
// reference/webflow/items/*.json, every field the NEW data layer (src/content.config.ts
// + src/lib/content.ts, both backed by Astro's content-collection getCollection())
// returns is deep-equal to what the OLD data layer (src/lib/detail-data.mjs, reading
// reference/webflow/items/*.json directly) returns today. Any divergence is a
// failure, not a rounding difference.
//
// Why this doesn't just `import '../src/lib/content.ts'` and call it: content.ts
// calls `getCollection()` from the virtual module 'astro:content', which only
// exists inside Astro/Vite's build pipeline -- plain `node` cannot resolve it. So
// instead this script:
//
//   1. Runs `astro sync`, which loads src/content.config.ts, runs every
//      collection's glob() loader over src/content/<collection>/*.json, validates
//      every item against that collection's zod schema, and persists the result to
//      node_modules/.astro/data-store.json. This is the exact artifact
//      getCollection() reads from at build/dev time -- reading it back is reading
//      Astro's real content-layer output, not a re-implementation of it.
//   2. Loads that file with Astro's own `MutableDataStore.fromFile()` (deep-imported
//      from astro's dist, since it's not part of the package's public "exports" --
//      but it's the same class `astro sync`/`astro build` themselves use to write
//      the file, so reading it back this way is reading the file the way Astro
//      reads it, not guessing at the format).
//   3. Compares every entry's `.data` (the schema-validated item: id, cmsLocaleId,
//      lastPublished, lastUpdated, createdOn, isArchived, isDraft, fieldData) against
//      the matching raw item from reference/webflow/items/<collection>.json.
//
// Usage: node tools/test-content-equivalence.mjs
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { liveItems, itemById } from '../src/lib/detail-data.mjs';

const root = process.cwd();

console.log('Running `astro sync` to build a fresh content-layer data store...');
execSync('npx astro sync', { cwd: root, stdio: 'inherit' });

const mutableDataStoreUrl = pathToFileURL(
  path.resolve(root, 'node_modules/astro/dist/content/mutable-data-store.js'),
);
const { MutableDataStore } = await import(mutableDataStoreUrl);

const storeFileUrl = pathToFileURL(path.resolve(root, 'node_modules/.astro/data-store.json'));
const store = await MutableDataStore.fromFile(storeFileUrl);

const collectionSlugs = readdirSync('reference/webflow/items')
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .sort();

let checked = 0;
let divergences = [];

for (const slug of collectionSlugs) {
  const rawItems = JSON.parse(readFileSync(`reference/webflow/items/${slug}.json`, 'utf8'));
  const rawById = new Map(rawItems.map((it) => [it.id, it]));

  const storeEntries = store.hasCollection(slug) ? store.values(slug) : [];
  const storeById = new Map(storeEntries.map((e) => [e.data.id, e.data]));

  // 1. Same item count, same id set, in both directions.
  if (storeEntries.length !== rawItems.length) {
    divergences.push(`${slug}: item count ${storeEntries.length} (content collection) !== ${rawItems.length} (reference/webflow/items)`);
  }
  for (const id of rawById.keys()) {
    if (!storeById.has(id)) divergences.push(`${slug}/${id}: present in reference/webflow/items, missing from content collection`);
  }
  for (const id of storeById.keys()) {
    if (!rawById.has(id)) divergences.push(`${slug}/${id}: present in content collection, missing from reference/webflow/items`);
  }

  // 2. Every field, for every item, deep-equal.
  for (const [id, rawItem] of rawById) {
    checked++;
    const newItem = storeById.get(id);
    if (!newItem) continue; // already reported above
    if (!isDeepStrictEqual(newItem, rawItem)) {
      divergences.push(`${slug}/${id}: field mismatch\n  old: ${JSON.stringify(rawItem)}\n  new: ${JSON.stringify(newItem)}`);
    }
  }

  // 3. liveItems() parity: filtering the content-collection data the same way
  //    detail-data.mjs's liveItems() filters reference/webflow/items (isDraft/isArchived)
  //    must produce the same set of items.
  const oldLive = liveItems(slug);
  const newLive = [...storeById.values()].filter((i) => !i.isDraft && !i.isArchived);
  const oldLiveIds = new Set(oldLive.map((i) => i.id));
  const newLiveIds = new Set(newLive.map((i) => i.id));
  if (oldLiveIds.size !== newLiveIds.size || [...oldLiveIds].some((id) => !newLiveIds.has(id))) {
    divergences.push(`${slug}: liveItems() id set mismatch (old ${oldLiveIds.size}, new ${newLiveIds.size})`);
  }
}

// 4. itemById() parity: the same global cross-collection live-item lookup
//    detail-data.mjs's itemById() performs, replicated against the content-collection
//    data, must resolve every id the same way (found -> same item; not found -> not found).
const collectionMap = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
const newByIdGlobal = new Map();
for (const c of collectionMap) {
  const entries = store.hasCollection(c.slug) ? store.values(c.slug) : [];
  for (const e of entries) {
    const it = e.data;
    if (!it.isDraft && !it.isArchived) newByIdGlobal.set(it.id, it);
  }
}
let idsChecked = 0;
for (const c of collectionMap) {
  const rawItems = JSON.parse(readFileSync(`reference/webflow/items/${c.slug}.json`, 'utf8'));
  for (const it of rawItems) {
    idsChecked++;
    const old = itemById(it.id);
    const next = newByIdGlobal.get(it.id);
    const oldFound = old !== undefined;
    const newFound = next !== undefined;
    if (oldFound !== newFound) {
      divergences.push(`itemById(${it.id}): found=${oldFound} (old) !== found=${newFound} (new)`);
    } else if (oldFound && !isDeepStrictEqual(old, next)) {
      divergences.push(`itemById(${it.id}): resolved item mismatch`);
    }
  }
}

console.log(`\nChecked ${checked} items across ${collectionSlugs.length} collections (plus ${idsChecked} itemById() lookups).`);
if (divergences.length) {
  console.error(`\n${divergences.length} divergence(s) found:\n`);
  for (const d of divergences.slice(0, 50)) console.error(d, '\n');
  if (divergences.length > 50) console.error(`...and ${divergences.length - 50} more.`);
  process.exit(1);
}
console.log(`${checked} items, 0 divergences.`);
