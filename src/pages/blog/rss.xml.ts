// Reproduces Webflow's /blog/rss.xml. Format matched byte-for-byte in structure
// against the captured live feed at reference/live/blog/rss.xml (100 most recent
// items, RSS 2.0 with atom:link and media:* extensions).
import type { APIRoute } from 'astro';
import { liveItems, assetPath } from '../../lib/content';

const SITE = 'https://www.radixdlt.com';

const esc = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** RFC-822, the form Webflow emits: "Wed, 29 Apr 2026 16:28:37 GMT". */
const rfc822 = (d: Date) => d.toUTCString().replace('GMT', 'GMT');

export const GET: APIRoute = async () => {
  const posts = (await liveItems('blog'))
    .filter((p: any) => p.fieldData?.slug)
    .sort((a: any, b: any) => {
      const ad = new Date(a.fieldData.date ?? a.lastPublished ?? 0).getTime();
      const bd = new Date(b.fieldData.date ?? b.lastPublished ?? 0).getTime();
      if (bd !== ad) return bd - ad;
      // Tie-break on createdOn, descending. reference/webflow/items/blog.json's array
      // order (which a plain stable sort on the primary key alone used to preserve for
      // ties) is exactly createdOn-descending, with zero duplicate createdOn values --
      // but content collections (astro:content's glob loader, one file per item) don't
      // preserve that array order, so this reproduces the same tie-break explicitly.
      return new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime();
    })
    .slice(0, 100);

  const items = posts.map((p: any) => {
    const url = `${SITE}/blog/${p.fieldData.slug}`;
    const img = p.fieldData.image?.url ? SITE + assetPath(p.fieldData.image.url) : null;
    const pub = new Date(p.lastPublished ?? p.fieldData.date ?? 0);
    return '<item>'
      + `<title>${esc(`${p.fieldData.name} | The Radix Blog | Radix DLT`)}</title>`
      + `<link>${esc(url)}</link>`
      + `<guid>${esc(url)}</guid>`
      + '<description></description>'
      + `<pubDate>${rfc822(pub)}</pubDate>`
      + (img ? `<media:content url="${esc(img)}" medium="image"/><media:thumbnail url="${esc(img)}"/>` : '')
      + '</item>';
  }).join('');

  // Deterministic: the channel date is the newest post's, not the build's. A build
  // timestamp here makes every build differ from the last, which turns tools/diff-dist.mjs
  // into noise -- and a gate people learn to ignore is worse than no gate.
  const newest = posts.reduce((acc: number, p: any) =>
    Math.max(acc, new Date(p.lastPublished ?? p.fieldData.date ?? 0).getTime()), 0);

  const body = '<?xml version="1.0" encoding="utf-8"?>'
    + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">'
    + '<channel>'
    + '<title>The Radix Blog</title>'
    + `<link>${SITE}</link>`
    + '<description>The Radix blog. Radix is an open source, public, decentralised ledger. Built to provide unlimited scale.</description>'
    + `<pubDate>${rfc822(new Date(newest))}</pubDate>`
    + '<ttl>60</ttl>'
    + '<generator>Astro</generator>'
    + `<atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>`
    + items
    + '</channel></rss>';

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
