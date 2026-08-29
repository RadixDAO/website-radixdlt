// Single source of truth for on-disk locations.
//
// Every tool used to hardcode /Volumes/Development/radix/radixdlt.com/... which is why
// `pnpm build` only ever worked on one machine. Paths now resolve relative to the repo,
// with env overrides for the few tools that still need material living outside it.
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

/** Repo root (the directory holding package.json). */
export const SITE = fileURLToPath(new URL('../../', import.meta.url));

/** The Webflow static export — committed under source/webflow-export/. */
export const EXPORT = process.env.WEBFLOW_EXPORT
  ?? fileURLToPath(new URL('../../source/webflow-export/', import.meta.url));

/**
 * The superseded first-attempt Astro tree (../astro-site). Not in the repo and not
 * required for a build -- only tools/mirror-assets.mjs reads it, to reuse an earlier
 * mirror run instead of re-downloading 2,227 files. Set LEGACY_ASTRO_SITE to point at it.
 */
export const LEGACY_ASTRO_SITE = process.env.LEGACY_ASTRO_SITE ?? null;

export function requireExport(who = 'this tool') {
  if (!existsSync(EXPORT)) {
    throw new Error(
      `${who} needs the Webflow export at ${EXPORT}, which is missing.\n` +
      `It is committed under source/webflow-export/ -- check your working tree, ` +
      `or set WEBFLOW_EXPORT to point elsewhere.`);
  }
  return EXPORT;
}
