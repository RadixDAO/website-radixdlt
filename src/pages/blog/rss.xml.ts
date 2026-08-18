// Reproduces Webflow's /blog/rss.xml. Format matched byte-for-byte in structure
// against the captured live feed at reference/live/blog/rss.xml (100 most recent
// items, RSS 2.0 with atom:link and media:* extensions).
import type { APIRoute } from 'astro';
import { liveItems, assetPath } from '../../lib/detail-data.mjs';

const SITE = 'https://www.radixdlt.com';

const esc = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** RFC-822, the form Webflow emits: "Wed, 29 Apr 2026 16:28:37 GMT". */
const rfc822 = (d: Date) => d.toUTCString().replace('GMT', 'GMT');

export const GET: APIRoute = () => {
  const posts = liveItems('blog')
    .filter((p: any) => p.fieldData?.slug)
    .sort((a: any, b: any) => {
      const ad = new Date(a.fieldData.date ?? a.lastPublished ?? 0).getTime();
      const bd = new Date(b.fieldData.date ?? b.lastPublished ?? 0).getTime();
      return bd - ad;
    })
    .slice(0, 100);

  const items = posts.map((p: any) => {
    const url = `${SITE}/blog/${p.fieldData.slug}`;
    const img = p.fieldData.image?.url ? SITE + assetPath(p.fieldData.image.url) : null;
    const pub = new Date(p.lastPublished ?? p.fieldData.date ?? Date.now());
    return '<item>'
      + `<title>${esc(`${p.fieldData.name} | The Radix Blog | Radix DLT`)}</title>`
      + `<link>${esc(url)}</link>`
      + `<guid>${esc(url)}</guid>`
      + '<description></description>'
      + `<pubDate>${rfc822(pub)}</pubDate>`
      + (img ? `<media:content url="${esc(img)}" medium="image"/><media:thumbnail url="${esc(img)}"/>` : '')
      + '</item>';
  }).join('');

  const body = '<?xml version="1.0" encoding="utf-8"?>'
    + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">'
    + '<channel>'
    + '<title>The Radix Blog</title>'
    + `<link>${SITE}</link>`
    + '<description>The Radix blog. Radix is an open source, public, decentralised ledger. Built to provide unlimited scale.</description>'
    + `<pubDate>${rfc822(new Date())}</pubDate>`
    + '<ttl>60</ttl>'
    + '<generator>Astro</generator>'
    + `<atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>`
    + items
    + '</channel></rss>';

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
