import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BLOG_DIR = 'src/content/blog';
const AUTHORS_DIR = 'src/content/blog-author';
const CATEGORIES_DIR = 'src/content/blog-category';
const ASSET_MAP_PATH = 'src/data/asset-map.json';

const WEBFLOW_URL = /https?:\/\/(?:uploads-ssl\.webflow\.com|cdn\.prod\.website-files\.com|assets(?:-global)?\.website-files\.com|s3\.amazonaws\.com\/webflow-prod-assets)\/[^"'\s<>]+/g;

function trimUrl(url) {
  let value = url.replace(/&quot;.*$/, '').replace(/[.,;]+$/, '');
  while (value.endsWith(')') && (value.split(')').length - 1) > (value.split('(').length - 1)) {
    value = value.slice(0, -1);
  }
  return value;
}

function tail(url) {
  return decodeURIComponent(url).split('/').filter(Boolean).pop();
}

function createAssetRewriter(assetMap) {
  const byTail = new Map();
  for (const [url, localPath] of Object.entries(assetMap)) {
    const key = tail(url);
    if (key && !byTail.has(key)) byTail.set(key, localPath);
  }

  const stats = { found: 0, rewritten: 0, unresolved: new Set() };
  const assetPath = (url) => {
    if (!url) return url;
    return assetMap[url] ?? byTail.get(tail(url)) ?? url;
  };
  const rewrite = (value) => {
    if (!value || typeof value !== 'string') return value;
    return value.replace(WEBFLOW_URL, (match) => {
      stats.found += 1;
      const clean = trimUrl(match);
      const localPath = assetPath(clean);
      if (!localPath?.startsWith('/assets/')) {
        stats.unresolved.add(clean);
        return match;
      }
      stats.rewritten += 1;
      return localPath + match.slice(clean.length);
    });
  };
  return { assetPath, rewrite, stats };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function slugMap(directory) {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json'));
  const entries = await Promise.all(files.map(async (name) => readJson(join(directory, name))));
  return new Map(entries.map((item) => [item.id, item.fieldData.slug]));
}

const scalar = (value) => value === null || value === undefined ? 'null' : JSON.stringify(value);

function frontmatter(item, authorById, categoryById, assetPath, rewrite) {
  const fields = item.fieldData;
  const author = fields['blog-author'] ? authorById.get(fields['blog-author']) : null;
  const categories = (fields['blog-category'] ?? []).map((id) => {
    const slug = categoryById.get(id);
    if (!slug) throw new Error(`Unknown blog category ${id} on ${fields.slug}`);
    return slug;
  });
  if (fields['blog-author'] && !author) {
    throw new Error(`Unknown blog author ${fields['blog-author']} on ${fields.slug}`);
  }

  const lines = [
    '---',
    `title: ${scalar(fields.name)}`,
    `slug: ${scalar(fields.slug)}`,
    `date: ${scalar(fields.date)}`,
    `author: ${scalar(author)}`,
    categories.length > 0 ? 'categories:' : 'categories: []',
    ...categories.map((category) => `  - ${scalar(category)}`),
    `excerpt: ${scalar(fields.excerpt)}`,
    `seoDescription: ${scalar(fields['seo-meta-description'])}`,
    `featured: ${fields['featured-post']}`,
    `showToc: ${fields['show-table-of-contents']}`,
    `archived: ${item.isArchived}`,
    `draft: ${item.isDraft}`,
    'bodyFormat: "html"',
  ];

  if (fields.image?.url) {
    lines.push(
      'image:',
      `  src: ${scalar(assetPath(fields.image.url))}`,
      `  alt: ${scalar(fields.image.alt)}`,
    );
  } else {
    lines.push('image: null');
  }

  if (fields['use-video-over-image']) {
    lines.push(
      'video:',
      `  poster: ${scalar(rewrite(fields['video-code']))}`,
      `  mp4: ${scalar(rewrite(fields['video-mp4-url']))}`,
      `  webm: ${scalar(rewrite(fields['video-webm-url']))}`,
    );
  } else {
    lines.push('video: null');
  }

  // These values are retained for stable historical ordering and traceability, but
  // kept separate from the fields editors normally touch.
  lines.push(
    'legacy:',
    `  id: ${scalar(item.id)}`,
    `  createdAt: ${scalar(item.createdOn)}`,
    `  updatedAt: ${scalar(item.lastUpdated)}`,
    `  publishedAt: ${scalar(item.lastPublished)}`,
    '---',
  );
  return lines.join('\n');
}

async function main() {
  const [authorById, categoryById, assetMap] = await Promise.all([
    slugMap(AUTHORS_DIR),
    slugMap(CATEGORIES_DIR),
    readJson(ASSET_MAP_PATH),
  ]);
  const { assetPath, rewrite, stats } = createAssetRewriter(assetMap);
  const jsonFiles = (await readdir(BLOG_DIR)).filter((name) => name.endsWith('.json')).sort();
  if (jsonFiles.length === 0) throw new Error(`No JSON blog posts found in ${BLOG_DIR}`);

  const outputs = [];
  const seenSlugs = new Set();
  for (const filename of jsonFiles) {
    const sourcePath = join(BLOG_DIR, filename);
    const item = await readJson(sourcePath);
    const slug = item.fieldData.slug;
    if (!slug || seenSlugs.has(slug)) throw new Error(`Missing or duplicate blog slug: ${slug}`);
    seenSlugs.add(slug);

    const metadata = frontmatter(item, authorById, categoryById, assetPath, rewrite);
    const body = rewrite(item.fieldData['main-content'] ?? '');
    const sortDate = (item.fieldData.date ?? item.createdOn).slice(0, 10);
    outputs.push({ sourcePath, targetPath: join(BLOG_DIR, `${sortDate}--${slug}.md`), content: `${metadata}\n\n${body}\n` });
  }

  for (const { targetPath, content } of outputs) {
    await writeFile(targetPath, content, { encoding: 'utf8', flag: 'wx' });
  }
  for (const { sourcePath } of outputs) await unlink(sourcePath);

  console.log(`Converted ${outputs.length} blog posts from JSON to Markdown.`);
  console.log(`Rewrote ${stats.rewritten} of ${stats.found} Webflow asset URL occurrences.`);
  if (stats.unresolved.size > 0) {
    console.log(`${stats.unresolved.size} distinct Webflow URLs had no local mirror and were left unchanged:`);
    for (const url of [...stats.unresolved].sort()) console.log(`  ${url}`);
  }
}

await main();
