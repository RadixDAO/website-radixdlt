// Reproduces Webflow's /podcast/rss.xml, matched against the captured live feed at
// reference/live/podcast/rss.xml. Note the live feed carries a single item and an
// empty channel <description> -- both preserved deliberately for parity.
import type { APIRoute } from 'astro';
import { liveItems, assetPath } from '../../lib/detail-data.mjs';

const SITE = 'https://www.radixdlt.com';
const SUFFIX = 'Podcast | Radix DLT - Decentralized Ledger Technology';

const esc = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = () => {
  const eps = liveItems('podcast')
    .filter((p: any) => p.fieldData?.slug)
    .sort((a: any, b: any) =>
      new Date(b.lastPublished ?? 0).getTime() - new Date(a.lastPublished ?? 0).getTime())
    .slice(0, 100);

  const items = eps.map((p: any) => {
    const url = `${SITE}/podcast/${p.fieldData.slug}`;
    const raw = p.fieldData['guest-image']?.url ?? p.fieldData.image?.url;
    const img = raw ? SITE + assetPath(raw) : null;
    const pub = new Date(p.lastPublished ?? Date.now());
    return '<item>'
      + `<title>${esc(`${p.fieldData.name}  |  ${SUFFIX}`)}</title>`
      + `<link>${esc(url)}</link>`
      + `<guid>${esc(url)}</guid>`
      + '<description></description>'
      + `<pubDate>${pub.toUTCString()}</pubDate>`
      + (img ? `<media:content url="${esc(img)}" medium="image"/><media:thumbnail url="${esc(img)}"/>` : '')
      + '</item>';
  }).join('');

  const body = '<?xml version="1.0" encoding="utf-8"?>'
    + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">'
    + '<channel>'
    + `<title>${esc(SUFFIX)}</title>`
    + `<link>${SITE}</link>`
    + '<description></description>'
    + `<pubDate>${new Date().toUTCString()}</pubDate>`
    + '<ttl>60</ttl>'
    + '<generator>Astro</generator>'
    + `<atom:link href="${SITE}/podcast/rss.xml" rel="self" type="application/rss+xml"/>`
    + items
    + '</channel></rss>';

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
