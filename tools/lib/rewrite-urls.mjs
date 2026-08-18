// Rewrite the export's relative URLs to root-absolute, and Webflow-CDN URLs to the
// local mirror. Operates on raw HTML by regex over attribute values only -- we do not
// parse, so nothing else in the markup can shift.
import { readFileSync } from 'node:fs';

const assetMap = JSON.parse(readFileSync('reference/asset-map.json', 'utf8'));
const SITE = 'https://www.radixdlt.com';

// Longest-first so a prefix never shadows a longer match.
const cdnKeys = Object.keys(assetMap).sort((a, b) => b.length - a.length);
const cdnByOrigin = new Map();
for (const k of cdnKeys) {
  // Index by the id_filename tail too: the export and the CMS sometimes reference the
  // same asset through different CDN hostnames.
  const tail = k.split('/').slice(-1)[0];
  if (tail && !cdnByOrigin.has(tail)) cdnByOrigin.set(tail, assetMap[k]);
}

const EXTERNAL = /^(https?:)?\/\/|^(mailto|tel|javascript|data):|^#/i;
const WEBFLOW_HOST = /^https?:\/\/(uploads-ssl\.webflow\.com|cdn\.prod\.website-files\.com|assets(-global)?\.website-files\.com|s3\.amazonaws\.com\/webflow-prod-assets)\//i;

/** Resolve a page-relative URL against the page's directory, returning a root path. */
function toRootPath(url, pageDir) {
  const segs = (pageDir ? pageDir.split('/') : []).filter(Boolean);
  for (const part of url.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') segs.pop();
    else segs.push(part);
  }
  return '/' + segs.join('/');
}

export function rewriteUrl(raw, pageDir) {
  let url = raw.trim();
  if (!url) return raw;

  if (WEBFLOW_HOST.test(url)) {
    const hit = assetMap[url] ?? assetMap[decodeURI(url)] ?? cdnByOrigin.get(url.split('/').pop());
    return hit ?? url; // unmirrored (2 known-dead) -- leave as-is rather than 404 silently
  }
  if (EXTERNAL.test(url)) return raw;
  if (url.startsWith('/')) return raw;

  // strip query/hash before extension handling, re-attach after
  const m = /^([^?#]*)([?#].*)?$/.exec(url);
  let path = m[1], suffix = m[2] ?? '';
  path = toRootPath(path, pageDir);
  if (path.endsWith('.html')) {
    path = path.slice(0, -5);
    if (path.endsWith('/index')) path = path.slice(0, -6) || '/';
  }
  return path + suffix;
}

const URL_ATTRS = /\b(href|src|poster|action|data-src|data-poster-url|data-video-urls)="([^"]*)"/g;
// <meta content="<url>"> for og:image / twitter:image -- these carry absolute Webflow
// CDN URLs that must be mirrored AND left absolute for social scrapers.
const META_URL = /<meta\b[^>]*>/gi;
const SRCSET = /\bsrcset="([^"]*)"/g;
const CSS_URL = /url\((['"]?)([^'")]+)\1\)/g;

export function rewriteHtml(html, pageDir, { absolutise = false } = {}) {
  let out = html.replace(URL_ATTRS, (full, attr, val) => {
    // data-video-urls is a comma-separated list
    const next = val.includes(',') && attr.startsWith('data-')
      ? val.split(',').map(v => rewriteUrl(v, pageDir)).join(',')
      : rewriteUrl(val, pageDir);
    return `${attr}="${next}"`;
  });
  out = out.replace(SRCSET, (full, val) => {
    const next = val.split(',').map(part => {
      const t = part.trim();
      if (!t) return t;
      const sp = t.indexOf(' ');
      return sp === -1 ? rewriteUrl(t, pageDir)
        : rewriteUrl(t.slice(0, sp), pageDir) + t.slice(sp);
    }).join(', ');
    return `srcset="${next}"`;
  });
  out = out.replace(CSS_URL, (full, q, val) =>
    EXTERNAL.test(val) && !WEBFLOW_HOST.test(val) ? full : `url(${q}${rewriteUrl(val, pageDir)}${q})`);

  if (absolutise) {
    out = out.replace(META_URL, tag => {
      if (!/(?:property|name)="(?:og:image|twitter:image|og:url)"/i.test(tag)) return tag;
      return tag.replace(/content="([^"]*)"/i, (f, val) => {
        let next = rewriteUrl(val, pageDir);
        if (next.startsWith('/')) next = SITE + next;   // social scrapers need absolute
        return `content="${next}"`;
      });
    });
  }
  return out;
}
