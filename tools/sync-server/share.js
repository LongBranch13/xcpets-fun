'use strict';
/* Pet share links (Nov 24 2026). A shared pet link is https://node.xcpets.fun/xp/v1/pet/<id>.
 *   GET /xp/v1/pet/<id>      a tiny page with the og/twitter tags X and Telegram read for the link preview, which sends people on
 *                            to https://xcpets.fun/pet.html?id=<id> (crawlers do not follow it, people do at once)
 *   GET /xp/v1/pet/<id>.png  the 1200x630 pet card, drawn by the burn check service (card.js) and kept on disk
 * GitHub Pages has no server code, so before this every pet link except 24 pre-made ones landed on 404.html and its
 * preview said "page not found". Cards are drawn one at a time (the check service answers burn checks too) and the
 * newest copy on disk is served when the check service is busy, between world builds or down. */
const fs = require('fs'), path = require('path');

const SITE = 'https://xcpets.fun';
const BASE = 'https://node.xcpets.fun/xp/v1/pet/';
const FRESH_MS = 3 * 3600e3;   /* redraw a card older than this when the check service is free */
const NONE_MS = 10 * 60e3;     /* remember "no such pet" this long */
const MAX_FILES = 6000;        /* cards kept on disk (each about 15 KB) */
const MAX_ID = 1e8;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function petPath(p) { const m = /^\/xp\/v1\/pet\/(\d{1,9})(\.png)?$/.exec(p || ''); if (!m) return null; const id = +m[1]; return id >= 1 && id <= MAX_ID ? { id: id, png: !!m[2] } : null; }

/** page(id, meta, ver): the preview page. meta: { name, title, line, dead } or null (unknown yet). */
function page(id, meta, ver) {
  const go = SITE + '/pet.html?id=' + id, img = BASE + id + '.png' + (ver ? '?v=' + ver : '');
  const title = meta ? meta.title + ' on XCPETS' : 'Pet #' + id + ' on XCPETS';
  const desc = meta ? (meta.dead ? 'Remembering ' + meta.title + (meta.line ? ', ' + meta.line : '') + '. ' : (meta.line ? meta.line + '. ' : '')) + '8-bit meme pets on Bitcoin. Hatch, breed and battle at xcpets.fun'
    : 'Hatch, breed and battle 8-bit meme pets on Bitcoin at xcpets.fun';
  const alt = meta ? meta.title + (meta.line ? ', ' + meta.line : '') : 'XCPETS pet #' + id;
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:site_name" content="XCPETS"><meta property="og:type" content="website">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + esc(BASE + id) + '"><meta property="og:image" content="' + esc(img) + '">' +
    '<meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
    '<meta property="og:image:alt" content="' + esc(alt) + '">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@XCPets">' +
    '<meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '"><meta name="twitter:image" content="' + esc(img) + '">' +
    '<link rel="canonical" href="' + esc(go) + '"><meta http-equiv="refresh" content="0;url=' + esc(go) + '">' +
    '<script>location.replace(' + JSON.stringify(go) + ')</script>' +
    '<style>body{background:#14121f;color:#fff;font:16px system-ui,sans-serif;text-align:center;padding:40px 16px}a{color:#f5c518}</style></head>' +
    '<body><p><a href="' + esc(go) + '">Open ' + esc(meta ? meta.title : 'pet #' + id) + ' on XCPETS</a></p></body></html>';
}

function makeCards(opts) {
  const dir = path.join(opts.dataDir, 'cards'), ask = opts.card, now = opts.now || Date.now;
  const busy = new Map(), none = new Map(); let writes = 0;
  function files(id) { return { png: path.join(dir, id + '.png'), json: path.join(dir, id + '.json') }; }
  function readCached(id) {
    const f = files(id);
    try { const m = JSON.parse(fs.readFileSync(f.json, 'utf8')); if (!m || !m.at || !fs.existsSync(f.png)) return null; return m; } catch (e) { return null; }
  }
  function prune() {
    let list; try { list = fs.readdirSync(dir).filter(n => /^\d+\.json$/.test(n)); } catch (e) { return; }
    if (list.length <= MAX_FILES) return;
    list.map(n => { let t = 0; try { t = fs.statSync(path.join(dir, n)).mtimeMs; } catch (e) { } return [n, t]; }).sort((a, b) => a[1] - b[1])
      .slice(0, list.length - Math.floor(MAX_FILES * 0.8)).forEach(([n]) => { const id = n.slice(0, -5); try { fs.rmSync(path.join(dir, id + '.json'), { force: true }); fs.rmSync(path.join(dir, id + '.png'), { force: true }); } catch (e) { } });
  }
  function draw(id) {
    if (typeof ask !== 'function') return Promise.resolve(null);
    if (busy.has(id)) return busy.get(id);
    if (busy.size >= 2) return Promise.resolve(null); /* never queue up work behind the burn checks */
    const job = Promise.resolve().then(() => ask(id)).then(a => {
      if (!a || !a.ok) return null;
      if (a.none) { none.set(id, now()); return { none: true }; }
      if (!a.png || !a.meta) return null;
      const f = files(id), meta = Object.assign({}, a.meta, { at: now(), tip: a.tip || 0 });
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(f.png + '.tmp', Buffer.from(a.png, 'base64')); fs.renameSync(f.png + '.tmp', f.png);
      fs.writeFileSync(f.json + '.tmp', JSON.stringify(meta)); fs.renameSync(f.json + '.tmp', f.json);
      if (++writes % 50 === 0) prune();
      return meta;
    }).catch(() => null).finally(() => busy.delete(id));
    busy.set(id, job);
    return job;
  }
  /** get(id) -> { meta, file } | { none: true } | null */
  async function get(id) {
    const n = none.get(id); if (n && now() - n < NONE_MS) return { none: true };
    const c = readCached(id);
    if (c && now() - c.at < FRESH_MS) return { meta: c, file: files(id).png };
    const d = await draw(id);
    if (d && d.none) return c ? { meta: c, file: files(id).png } : { none: true };
    if (d) return { meta: d, file: files(id).png };
    return c ? { meta: c, file: files(id).png } : null;
  }
  return { get, files, readCached, dir };
}

/** handle(req, res, pathname, cards, send) -> true when the request was a pet share path */
function handle(req, res, p, cards, send) {
  const m = petPath(p); if (!m) return false;
  cards.get(m.id).then(r => {
    if (m.png) {
      if (r && r.file && !r.none) {
        let buf; try { buf = fs.readFileSync(r.file); } catch (e) { buf = null; }
        if (buf) { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Content-Type', 'image/png'); res.setHeader('Content-Length', String(buf.length)); res.setHeader('Cache-Control', 'public, max-age=3600'); res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : buf); return; }
      }
      res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cache-Control', 'public, max-age=60'); res.setHeader('Location', SITE + '/img/og.png'); res.writeHead(302); res.end(); return;
    }
    const meta = r && r.meta && !r.none ? r.meta : null;
    send(req, res, 200, page(m.id, meta, meta ? Math.floor(meta.at / 1000).toString(36) : ''), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
  }, () => send(req, res, 200, page(m.id, null, ''), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }));
  return true;
}
module.exports = { page, petPath, makeCards, handle, BASE, esc };
