#!/usr/bin/env node
// Phase 0: build a permanently-hosted local mirror of every Webflow-CDN asset
// referenced by the CMS content and the exported static HTML, named by its
// ORIGINAL filename (not by content hash).
//
// Sources scanned:
//   1. site/reference/webflow/items/*.json   (Webflow CMS API export)
//   2. static export/**/*.html               (exported HTML, excluding archived/)
//
// Reuse:
//   astro-site/src/data/generated/asset-map.json maps original URL -> /mirrored/<sha256>.<ext>
//   and the bytes already exist at astro-site/public/mirrored/<sha256>.<ext>.
//   We copy those instead of re-downloading.
//
// Outputs (all inside site/):
//   public/assets/<24hex>_<sanitised-name>.<ext>
//   reference/asset-map.json
//   reference/asset-failures.json
//
// Idempotent: safe to re-run after a partial failure. Concurrency-limited to 6
// parallel downloads, 3 retries with exponential backoff. Logs every 100 assets.

import { readFileSync, existsSync, statSync, mkdirSync, copyFileSync, createWriteStream } from 'node:fs';
import { readdir, rename, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

const ROOT = '/Volumes/Development/radix/radixdlt.com';
const SITE = path.join(ROOT, 'site');
const ITEMS_DIR = path.join(SITE, 'reference/webflow/items');
const EXPORT_DIR = path.join(ROOT, 'static export');
const ASTRO_MAP_PATH = path.join(ROOT, 'astro-site/src/data/generated/asset-map.json');
const ASTRO_MIRROR_DIR = path.join(ROOT, 'astro-site/public/mirrored');
const KNOWN_DEAD_PATH = path.join(ROOT, 'astro-site/src/data/generated/asset-mirror-failures.json');

const OUT_ASSETS_DIR = path.join(SITE, 'public/assets');
const OUT_ASSET_MAP = path.join(SITE, 'reference/asset-map.json');
const OUT_FAILURES = path.join(SITE, 'reference/asset-failures.json');

const CONCURRENCY = 6;
const MAX_RETRIES = 3;
const LOG_EVERY = 100;

const HOSTS = [
  'uploads-ssl.webflow.com',
  'cdn.prod.website-files.com',
  'assets.website-files.com',
  'assets-global.website-files.com',
  's3.amazonaws.com/webflow-prod-assets',
];
// Matches a URL, stopping at any character that could plausibly be HTML/JSON
// syntax rather than part of the URL (quotes, angle brackets, closing paren,
// ampersand (start of an HTML entity like &quot;)). Deliberately does NOT stop
// at whitespace or commas, because some attributes (e.g. data-video-urls,
// unencoded filenames with spaces) legitimately contain those inside a single
// quoted value; we post-process to split/trim those cases.
const HOST_ALT = HOSTS.map((h) => h.replace(/[.]/g, '\\.').replace(/\//g, '\\/')).join('|');
// Note: '(' and ')' are deliberately NOT excluded -- original filenames
// legitimately contain parentheses (e.g. "...Vector%2520(1).svg", "...(2) 1.png").
// All CSS `url(...)` usages found in this codebase are quote-wrapped
// (`url('...')` / `url(&quot;...&quot;)`), so the quote/entity boundary is
// always hit before the closing paren.
const URL_RE = new RegExp(`https?:\\/\\/(?:${HOST_ALT})\\/[^"'<>&\\\\]*`, 'g');

mkdirSync(OUT_ASSETS_DIR, { recursive: true });
mkdirSync(path.dirname(OUT_ASSET_MAP), { recursive: true });

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/** Post-process a raw regex match, which may contain a comma-separated list
 * of URLs (data-video-urls) and/or srcset-style trailing width descriptors
 * ("... 500w"). Returns an array of clean URL strings. */
function splitRawMatch(raw) {
  const pieces = raw.split(',').map((s) => s.trim());
  const out = [];
  for (const piece of pieces) {
    if (!piece.startsWith('http')) continue;
    // strip a trailing srcset width/density descriptor, e.g. " 500w" or " 2x"
    const stripped = piece.replace(/\s+\d+(?:w|x)$/i, '');
    out.push(stripped.trim());
  }
  return out;
}

function extractUrlsFromText(text) {
  const found = [];
  const matches = text.match(URL_RE);
  if (!matches) return found;
  for (const raw of matches) {
    found.push(...splitRawMatch(raw));
  }
  return found;
}

/** discovered: Map<url, { sources: Set<'cms'|'html'>, referencedBy: Set<string> }> */
const discovered = new Map();
function record(url, source, ref) {
  let entry = discovered.get(url);
  if (!entry) {
    entry = { sources: new Set(), referencedBy: new Set() };
    discovered.set(url, entry);
  }
  entry.sources.add(source);
  entry.referencedBy.add(ref);
}

/** Recursively collect every string leaf value from a JSON-parsed value. */
function collectStrings(value, out) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

async function scanCmsJson() {
  const files = (await readdir(ITEMS_DIR)).filter((f) => f.endsWith('.json'));
  let cmsUrlCount = 0;
  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const items = JSON.parse(readFileSync(path.join(ITEMS_DIR, file), 'utf8'));
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const id = item?.id ?? 'unknown-id';
      // Walk actual parsed string values (already unescaped by JSON.parse)
      // rather than re-serializing with JSON.stringify, which would
      // re-introduce backslash-escaped quotes around URLs embedded in
      // RichText HTML fields and corrupt the match boundary.
      const strings = [];
      collectStrings(item, strings);
      for (const s of strings) {
        const urls = extractUrlsFromText(s);
        for (const url of urls) {
          record(url, 'cms', `cms:${slug}:${id}`);
          cmsUrlCount++;
        }
      }
    }
  }
  return { fileCount: files.length, occurrenceCount: cmsUrlCount };
}

async function walkHtmlFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'archived') continue; // strictly excluded
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkHtmlFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

async function scanExportedHtml() {
  const files = await walkHtmlFiles(EXPORT_DIR);
  let htmlUrlCount = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const urls = extractUrlsFromText(text);
    const rel = path.relative(ROOT, file);
    for (const url of urls) {
      record(url, 'html', `html:${rel}`);
      htmlUrlCount++;
    }
  }
  return { fileCount: files.length, occurrenceCount: htmlUrlCount };
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Sanitise a filename-ish string (may include an extension). */
function sanitiseName(rawNameWithExt) {
  let name = rawNameWithExt;
  // handle residual literal "%20" left over from double-encoded source URLs
  name = name.replace(/%20/gi, ' ');
  // spaces -> hyphen
  name = name.replace(/ +/g, '-');
  // split off the last extension
  const extMatch = name.match(/^(.*)\.([A-Za-z0-9]+)$/);
  let base, ext;
  if (extMatch) {
    base = extMatch[1];
    ext = extMatch[2].toLowerCase();
  } else {
    base = name;
    ext = '';
  }
  // strip characters outside [A-Za-z0-9._-]
  base = base.replace(/[^A-Za-z0-9._-]/g, '');
  // collapse repeated separators
  base = base.replace(/-{2,}/g, '-').replace(/_{2,}/g, '_').replace(/\.{2,}/g, '.');
  base = base.replace(/^[-._]+/, '').replace(/[-._]+$/, '');
  if (!base) base = 'file';
  return ext ? `${base}.${ext}` : base;
}

/** Compute the target filename (no directory) for a given source URL. */
function computeFilename(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    u = null;
  }
  const pathname = u ? u.pathname : url;
  const basenameRaw = pathname.split('/').filter(Boolean).pop() ?? 'file';
  const basenameDecoded = safeDecode(basenameRaw);

  const idMatch = basenameDecoded.match(/^([0-9a-fA-F]{24})_(.+)$/);
  if (idMatch) {
    const id = idMatch[1].toLowerCase();
    const rest = sanitiseName(idMatch[2]);
    return `${id}_${rest}`;
  }
  // fallback: no parseable <id>_<name> form
  const fallbackId = sha256Hex(url).slice(0, 16);
  const rest = sanitiseName(basenameDecoded);
  return `${fallbackId}_${rest}`;
}

// ---------------------------------------------------------------------------
// Reuse map (already-downloaded bytes) + known-dead list
// ---------------------------------------------------------------------------

function loadAstroAssetMap() {
  const raw = JSON.parse(readFileSync(ASTRO_MAP_PATH, 'utf8'));
  const map = new Map();
  for (const [url, mirroredPath] of Object.entries(raw)) {
    // mirroredPath looks like "/mirrored/<sha256>.<ext>"
    const m = mirroredPath.match(/^\/mirrored\/([0-9a-f]{64})\.([A-Za-z0-9]+)$/);
    map.set(url, { mirroredPath, sha256: m ? m[1] : null, ext: m ? m[2] : null });
  }
  return map;
}

function loadKnownDead() {
  const raw = JSON.parse(readFileSync(KNOWN_DEAD_PATH, 'utf8'));
  const set = new Map();
  for (const entry of raw) set.set(entry.url, entry.error);
  return set;
}

// ---------------------------------------------------------------------------
// Collision resolution
// ---------------------------------------------------------------------------

/** Given the full discovered URL set and the reuse map, compute a final
 * url -> filename assignment. Groups urls by their tentative (id-based)
 * filename. Groups of size 1 are trivially resolved. Groups of size >1 are
 * resolved immediately when we already KNOW (from the reuse map) that both
 * sides' content hashes agree (same asset, e.g. mirrored under two CDN
 * hosts) or disagree (disambiguate with a content-hash suffix). Anything
 * that can't be resolved from known hashes alone (a fresh download is
 * involved) is returned separately as a "contested" group -- the caller
 * MUST resolve those sequentially, never concurrently, to avoid two
 * different URLs racing to write the same path. */
function assignFilenames(urls, astroMap) {
  const urlToFilename = new Map();
  const groups = new Map(); // tentativeFilename -> url[]
  for (const url of [...urls].sort()) {
    const filename = computeFilename(url);
    if (!groups.has(filename)) groups.set(filename, []);
    groups.get(filename).push(url);
  }

  const contested = []; // array of { filename, urls: string[] }

  for (const [filename, groupUrls] of groups) {
    if (groupUrls.length === 1) {
      urlToFilename.set(groupUrls[0], filename);
      continue;
    }
    // Multiple urls tentatively want this exact filename. Try to resolve
    // using known sha256 hashes from the reuse map only.
    const known = groupUrls.map((u) => ({ url: u, sha256: astroMap.get(u)?.sha256 ?? null }));
    const allKnown = known.every((k) => k.sha256);
    if (allKnown) {
      const firstSha = known[0].sha256;
      const allSame = known.every((k) => k.sha256 === firstSha);
      if (allSame) {
        // genuinely the same asset under multiple urls -> share one file
        for (const u of groupUrls) urlToFilename.set(u, filename);
        continue;
      }
      // all known, but content differs -> disambiguate deterministically now
      known.forEach((k, i) => {
        if (i === 0) {
          urlToFilename.set(k.url, filename);
        } else {
          const disambiguator = k.sha256.slice(0, 8);
          const extMatch = filename.match(/^(.*)\.([A-Za-z0-9]+)$/);
          const disambiguated = extMatch ? `${extMatch[1]}-dup-${disambiguator}.${extMatch[2]}` : `${filename}-dup-${disambiguator}`;
          urlToFilename.set(k.url, disambiguated);
          console.warn(`[collision] different content for same target name; disambiguated -> ${disambiguated}\n  ${known[0].url}\n  ${k.url}`);
        }
      });
      continue;
    }
    // At least one side's hash is unknown (a fresh download is involved).
    // Cannot safely resolve without fetching the bytes -- hand off to the
    // caller for strictly-sequential resolution.
    contested.push({ filename, urls: groupUrls });
  }

  return { urlToFilename, contested };
}

// ---------------------------------------------------------------------------
// Fetch with retry + concurrency limiter
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadWithRetry(url, destPath) {
  let lastErr;
  // Unique per (url, attempt, process) so concurrent downloads can never
  // collide on the same temp path, even if two different urls are
  // (temporarily) destined for the same final destPath.
  const uniquePart = `${sha256Hex(url).slice(0, 12)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const tmpPath = `${destPath}.part-${uniquePart}-${attempt}`;
      const fileStream = createWriteStream(tmpPath);
      await finished(Readable.fromWeb(res.body).pipe(fileStream));
      const size = statSync(tmpPath).size;
      if (size === 0) {
        await unlink(tmpPath).catch(() => {});
        throw new Error('downloaded file is empty');
      }
      await rename(tmpPath, destPath);
      return { ok: true };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const backoff = 500 * 2 ** attempt + Math.random() * 250;
        await sleep(backoff);
      }
    }
  }
  return { ok: false, error: String(lastErr?.message ?? lastErr) };
}

async function runPool(items, limit, worker) {
  let idx = 0;
  let inFlight = [];
  const results = new Array(items.length);

  async function runOne(i) {
    results[i] = await worker(items[i], i);
  }

  while (idx < items.length || inFlight.length > 0) {
    while (inFlight.length < limit && idx < items.length) {
      const i = idx++;
      const p = runOne(i).then(() => {
        inFlight = inFlight.filter((x) => x !== p);
      });
      inFlight.push(p);
    }
    if (inFlight.length > 0) {
      await Promise.race(inFlight);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Scanning CMS JSON items...');
  const cmsStats = await scanCmsJson();
  console.log(`  ${cmsStats.fileCount} files, ${cmsStats.occurrenceCount} URL occurrences`);

  console.log('Scanning exported HTML...');
  const htmlStats = await scanExportedHtml();
  console.log(`  ${htmlStats.fileCount} files, ${htmlStats.occurrenceCount} URL occurrences`);

  const cmsUrlSet = new Set();
  const htmlUrlSet = new Set();
  for (const [url, entry] of discovered) {
    if (entry.sources.has('cms')) cmsUrlSet.add(url);
    if (entry.sources.has('html')) htmlUrlSet.add(url);
  }
  const allUrls = [...discovered.keys()];
  console.log(`Total unique asset URLs discovered: ${allUrls.length}`);
  console.log(`  from CMS JSON: ${cmsUrlSet.size}`);
  console.log(`  from exported HTML: ${htmlUrlSet.size}`);
  console.log(`  (overlap: ${[...cmsUrlSet].filter((u) => htmlUrlSet.has(u)).length})`);

  const astroMap = loadAstroAssetMap();
  const knownDead = loadKnownDead();
  const { urlToFilename, contested } = assignFilenames(allUrls, astroMap);

  // Load our OWN previous output (if any) so re-runs can skip work even for
  // urls whose final filename required content-based disambiguation (those
  // don't get a stable destPath until resolved, so the generic "does destPath
  // already exist" check in obtain() can't help them on its own).
  let prevAssetMap = {};
  try {
    prevAssetMap = JSON.parse(readFileSync(OUT_ASSET_MAP, 'utf8'));
  } catch {
    // no previous run, or unreadable -- fine, start fresh
  }
  const prevUrlToFilename = new Map(
    Object.entries(prevAssetMap).map(([url, p]) => [url, p.replace(/^\/assets\//, '')])
  );

  const results = { copied: 0, downloaded: 0, skippedIdempotent: 0, failed: [] };
  // url -> resolved sha256 (once known), used for the final collision assertion.
  const urlSha256 = new Map();
  const failedUrls = new Set();

  /** Obtain the bytes for `url` at exactly `destPath` (idempotent). Returns
   * { ok, sha256? } or { ok: false, error }. Never touches any path other
   * than destPath (plus its own uniquely-named temp file). */
  async function obtain(url, destPath) {
    if (knownDead.has(url)) return { ok: false, error: knownDead.get(url) };
    try {
      if (existsSync(destPath) && statSync(destPath).size > 0) {
        const reuse = astroMap.get(url);
        return { ok: true, sha256: reuse?.sha256 ?? sha256Hex(readFileSync(destPath)), fromSkip: true };
      }
      const reuse = astroMap.get(url);
      if (reuse) {
        const srcPath = path.join(ASTRO_MIRROR_DIR, `${reuse.sha256}.${reuse.ext}`);
        if (!existsSync(srcPath)) throw new Error(`reuse source missing: ${srcPath}`);
        copyFileSync(srcPath, destPath);
        return { ok: true, sha256: reuse.sha256, fromCopy: true };
      }
      const r = await downloadWithRetry(url, destPath);
      if (!r.ok) return { ok: false, error: r.error };
      const sha256 = sha256Hex(readFileSync(destPath));
      return { ok: true, sha256, fromDownload: true };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  }

  // ---------------------------------------------------------------------
  // Phase 1: resolve contested groups (urls that tentatively share a
  // filename and couldn't be disambiguated from known hashes alone).
  // Processed strictly sequentially, one URL at a time, so no two writers
  // can ever race on the same path -- each url gets its own temp/staging
  // area and the final path is only decided once its real content hash is
  // known.
  // ---------------------------------------------------------------------
  if (contested.length > 0) {
    console.log(`Resolving ${contested.length} contested filename group(s) sequentially...`);
  }
  for (const group of contested) {
    const placed = []; // { url, filename, sha256 }
    for (const url of group.urls) {
      // Idempotent fast path: if a previous run already resolved this url
      // (including any content-based disambiguation) and the file is still
      // there, reuse that decision directly -- no network, no re-staging.
      const prevFilename = prevUrlToFilename.get(url);
      if (prevFilename) {
        const prevPath = path.join(OUT_ASSETS_DIR, prevFilename);
        if (existsSync(prevPath) && statSync(prevPath).size > 0) {
          const sha256 = sha256Hex(readFileSync(prevPath));
          placed.push({ url, filename: prevFilename, sha256 });
          urlToFilename.set(url, prevFilename);
          urlSha256.set(url, sha256);
          results.skippedIdempotent++;
          continue;
        }
      }
      const stagingPath = path.join(OUT_ASSETS_DIR, `.staging-${sha256Hex(url).slice(0, 16)}`);
      const r = await obtain(url, stagingPath);
      if (!r.ok) {
        results.failed.push({ url, error: r.error, referencedBy: [...discovered.get(url).referencedBy] });
        failedUrls.add(url);
        await unlink(stagingPath).catch(() => {});
        continue;
      }
      const match = placed.find((p) => p.sha256 === r.sha256);
      let finalFilename;
      if (match) {
        finalFilename = match.filename;
      } else if (placed.length === 0) {
        finalFilename = group.filename;
      } else {
        const disambiguator = r.sha256.slice(0, 8);
        const extMatch = group.filename.match(/^(.*)\.([A-Za-z0-9]+)$/);
        finalFilename = extMatch ? `${extMatch[1]}-dup-${disambiguator}.${extMatch[2]}` : `${group.filename}-dup-${disambiguator}`;
        console.warn(`[collision] different content for same target name; disambiguated -> ${finalFilename}\n  ${placed[0]?.url}\n  ${url}`);
      }
      const finalPath = path.join(OUT_ASSETS_DIR, finalFilename);
      if (!existsSync(finalPath)) {
        copyFileSync(stagingPath, finalPath);
      }
      await unlink(stagingPath).catch(() => {});
      placed.push({ url, filename: finalFilename, sha256: r.sha256 });
      urlToFilename.set(url, finalFilename);
      urlSha256.set(url, r.sha256);
      if (r.fromCopy) results.copied++;
      else if (r.fromDownload) results.downloaded++;
      else if (r.fromSkip) results.skippedIdempotent++;
    }
  }

  // ---------------------------------------------------------------------
  // Phase 2: everything else, concurrency-limited.
  // ---------------------------------------------------------------------
  const remainingUrls = allUrls.filter((u) => !failedUrls.has(u) && urlToFilename.has(u) && !contested.some((g) => g.urls.includes(u)));
  const tasks = remainingUrls.map((url) => {
    const filename = urlToFilename.get(url);
    const destPath = path.join(OUT_ASSETS_DIR, filename);
    return { url, filename, destPath };
  });

  let processed = contested.reduce((n, g) => n + g.urls.length, 0);
  const totalCount = processed + tasks.length;
  await runPool(tasks, CONCURRENCY, async (task) => {
    const { url, filename, destPath } = task;
    const r = await obtain(url, destPath);
    if (!r.ok) {
      results.failed.push({ url, error: r.error, referencedBy: [...discovered.get(url).referencedBy] });
    } else {
      if (r.sha256) urlSha256.set(url, r.sha256);
      if (r.fromCopy) results.copied++;
      else if (r.fromDownload) results.downloaded++;
      else if (r.fromSkip) results.skippedIdempotent++;
    }
    processed++;
    if (processed % LOG_EVERY === 0) {
      console.log(`  processed ${processed}/${totalCount} (copied=${results.copied} downloaded=${results.downloaded} skipped=${results.skippedIdempotent} failed=${results.failed.length})`);
    }
  });
  console.log(`  processed ${processed}/${totalCount} (done)`);

  // Build asset-map.json for successful urls only.
  for (const f of results.failed) failedUrls.add(f.url);
  const assetMap = {};
  for (const url of allUrls) {
    if (failedUrls.has(url)) continue;
    const filename = urlToFilename.get(url);
    if (!filename) continue;
    assetMap[url] = `/assets/${filename}`;
  }

  // ---------------------------------------------------------------------
  // Verification
  // ---------------------------------------------------------------------
  console.log('Verifying output...');
  let missing = 0;
  for (const [url, assetPath] of Object.entries(assetMap)) {
    const full = path.join(SITE, 'public', assetPath.replace(/^\//, ''));
    if (!existsSync(full) || statSync(full).size === 0) {
      missing++;
      console.error(`  MISSING or empty: ${assetPath} (${url})`);
    }
  }

  // Collision assertion: no filename should map to more than one distinct
  // sha256 among all successfully-mirrored urls that share it.
  const filenameToUrls = new Map();
  for (const url of allUrls) {
    if (failedUrls.has(url)) continue;
    const filename = urlToFilename.get(url);
    if (!filename) continue;
    if (!filenameToUrls.has(filename)) filenameToUrls.set(filename, []);
    filenameToUrls.get(filename).push(url);
  }
  let collisions = 0;
  for (const [filename, urls] of filenameToUrls) {
    if (urls.length <= 1) continue;
    const shas = new Set();
    for (const u of urls) {
      const sha = astroMap.get(u)?.sha256 ?? urlSha256.get(u);
      if (sha) shas.add(sha);
    }
    if (shas.size > 1) {
      collisions++;
      console.error(`  COLLISION: ${filename} claimed by ${urls.length} urls with differing content:\n    ${urls.join('\n    ')}`);
    }
  }

  const fs = await import('node:fs/promises');
  await fs.writeFile(OUT_ASSET_MAP, JSON.stringify(assetMap, null, 2) + '\n');
  await fs.writeFile(
    OUT_FAILURES,
    JSON.stringify(
      results.failed.map((f) => ({ url: f.url, error: f.error, referencedBy: f.referencedBy })),
      null,
      2
    ) + '\n'
  );

  console.log('');
  console.log('=== Summary ===');
  console.log(`Discovered URLs: ${allUrls.length} (CMS: ${cmsUrlSet.size}, HTML: ${htmlUrlSet.size})`);
  console.log(`Copied from existing mirror: ${results.copied}`);
  console.log(`Freshly downloaded: ${results.downloaded}`);
  console.log(`Already present (idempotent skip): ${results.skippedIdempotent}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`asset-map.json entries: ${Object.keys(assetMap).length}`);
  console.log(`Missing/empty verification failures: ${missing}`);
  console.log(`Filename collisions with differing content: ${collisions}`);

  if (missing > 0 || collisions > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
