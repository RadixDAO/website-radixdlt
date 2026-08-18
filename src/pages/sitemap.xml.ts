// Sitemap.
//
// DELIBERATE DEVIATION FROM LIVE: Webflow's published sitemap lists 999 URLs, but the
// site actually serves ~1,207 -- eight collections with working detail routes
// (events, team-member, tweets, radix-services, project-categories,
// full-stack-social-comments, partners, faqs) appear nowhere in it. See
// MIGRATION-PLAN.md section 0. A sitemap is machine-facing, so correctness beats
// bug-for-bug parity here; every URL below is one the site genuinely serves.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { liveItems } from '../lib/detail-data.mjs';

const SITE = 'https://www.radixdlt.com';

export const GET: APIRoute = () => {
  const urls = new Set<string>();

  // static pages, from the converter's own manifest
  const manifest = JSON.parse(readFileSync('src/shells/manifest.json', 'utf8'));
  for (const route of Object.keys(manifest)) {
    urls.add(route === 'index' ? SITE : `${SITE}/${route}`);
  }

  // CMS detail pages, for every collection with a live detail route
  const cols = JSON.parse(readFileSync('reference/collection-map.json', 'utf8'));
  for (const c of cols) {
    if (!c.hasDetailRoute) continue;
    for (const it of liveItems(c.slug)) {
      if (it.fieldData?.slug) urls.add(`${SITE}/${c.slug}/${it.fieldData.slug}`);
    }
  }

  const body = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [...urls].sort().map((u) => `    <url>\n        <loc>${u}</loc>\n    </url>`).join('\n')
    + '\n</urlset>\n';

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
