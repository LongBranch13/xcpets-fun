#!/usr/bin/env node
/* site-speed-1103: a tiny static server that answers like GitHub Pages does for xcpets.fun (gzip for text types, Cache-Control
 * max-age=600, weak ETag + 304, no brotli), so before/after page-speed runs of two checkouts compare like for like.
 * Measurement tooling only (never deployed or used by the site).   node tools/pages-server.js <root> <port> */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(process.argv[2] || '.'), PORT = +(process.argv[3] || 8913);
if (PORT === 8841) { console.error('refusing port 8841'); process.exit(2); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const GZ = /^(text\/|application\/(javascript|json|manifest)|image\/svg)/;
const cache = new Map();
/* GET /__stamp/<id> makes every ?v=<clone build> in text files read ?v=<id> (a UI-only deploy without changing any bytes but the stamp); /__stamp/ resets */
let FROM = null, TO = null; try { FROM = (/v2-chain\.js\?v=([0-9a-f]+)/.exec(fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8')) || [])[1] || null; } catch (e) {}
http.createServer((req, res) => {
  if (req.url.startsWith('/__stamp/')) { TO = req.url.slice(9) || null; res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('stamp ' + FROM + ' -> ' + TO); }
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('404'); }
  const st = fs.statSync(f), type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const etag = 'W/"' + st.mtimeMs.toString(16) + '-' + st.size.toString(16) + (TO ? '-' + TO : '') + '"';
  const h = { 'content-type': type, 'cache-control': 'max-age=600', etag, 'access-control-allow-origin': '*', vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
  let body = fs.readFileSync(f);
  if (TO && FROM && /^(text\/|application\/(javascript|json))/.test(type)) body = Buffer.from(body.toString('utf8').split('?v=' + FROM).join('?v=' + TO));
  if (GZ.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    const k = f + '|' + etag; let z = cache.get(k); if (!z) { z = zlib.gzipSync(body, { level: 6 }); cache.set(k, z); }
    body = z; h['content-encoding'] = 'gzip'; }
  h['content-length'] = body.length; res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : body);
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + ROOT + ' on http://127.0.0.1:' + PORT));
