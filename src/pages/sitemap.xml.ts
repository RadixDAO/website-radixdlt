// Sitemap.
//
// DELIBERATE DEVIATION FROM LIVE: Webflow's published sitemap lists 999 URLs, but the
// site actually serves 1,202 -- eight collections with working detail routes (events,
// team-member, tweets, radix-services, project-categories, full-stack-social-comments,
// partners, faqs) appear nowhere in it. A sitemap is machine-facing, so correctness
// beats bug-for-bug parity; every URL below is one the site genuinely serves.
//
// Routes are derived from the real Astro pages and content collections. It previously
// read src/shells/manifest.json and reference/collection-map.json -- both scaffolding
// from the Webflow conversion, now deleted. A sitemap built from the converter's own
// manifest could only ever describe what the converter knew about, not what the site
// actually ships.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://www.radixdlt.com';

// Every non-dynamic .astro page under src/pages. Astro resolves this glob at build time,
// so the sitemap is derived from the routes that genuinely exist.
const staticPages = import.meta.glob('./**/*.astro', { eager: true });

// Collections that have a /<collection>/<slug> detail route, i.e. those with a
// [slug].astro page. Derived from the same glob rather than a hand-maintained list.
const detailRoutes = Object.keys(staticPages)
  .filter((p) => p.endsWith('/[slug].astro'))
  .map((p) => p.replace(/^\.\//, '').replace(/\/\[slug\]\.astro$/, ''));

export const GET: APIRoute = async () => {
  const urls = new Set<string>();

  for (const path of Object.keys(staticPages)) {
    if (path.includes('[')) continue;                     // dynamic routes handled below
    const route = path.replace(/^\.\//, '').replace(/\.astro$/, '');
    // NB: 401 and 404 ARE included, matching the previous sitemap exactly. Listing error
    // pages in a sitemap is arguably wrong, but changing it here would smuggle a
    // behaviour change into a refactor -- raise it separately if it matters.
    urls.add(route === 'index' ? SITE : `${SITE}/${route}`);
  }

  for (const collection of detailRoutes) {
    const items = await getCollection(collection as never);
    for (const item of items) {
      const data = (item as { data?: { isDraft?: boolean; isArchived?: boolean; fieldData?: { slug?: string } } }).data;
      if (!data?.fieldData?.slug) continue;
      if (data.isDraft || data.isArchived) continue;      // matches what the routes build
      urls.add(`${SITE}/${collection}/${data.fieldData.slug}`);
    }
  }

  const body = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [...urls].sort().map((u) => `    <url>\n        <loc>${u}</loc>\n    </url>`).join('\n')
    + '\n</urlset>\n';

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
