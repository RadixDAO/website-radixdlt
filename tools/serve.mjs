// Local preview that mimics Cloudflare Workers static-asset routing
// (html_handling: "auto-trailing-slash", not_found_handling: "404-page").
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = 'dist';
const PORT = Number(process.env.PORT || 4399);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.xml': 'application/xml' };

const tryFiles = p => [p, `${p}.html`, join(p, 'index.html')];

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = url === '/' ? '/index' : url.replace(/\/$/, '');
  for (const cand of tryFiles(join(ROOT, base))) {
    try {
      if (!(await stat(cand)).isFile()) continue;
      const body = await readFile(cand);
      res.writeHead(200, { 'content-type': TYPES[extname(cand)] ?? 'application/octet-stream' });
      return res.end(body);
    } catch {}
  }
  try {
    const body = await readFile(join(ROOT, '404.html'));
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
