#!/usr/bin/env node
/* merge-pages-1123 (Jake Nov 23 2026, "one searchable Guide"): the search index for the Guide strip.
 * Reads the Guide pages (GUIDE_PAGES in js/v2-places.js), gives every <h2> in <main> an id (g-<slug>) when it has none, and writes
 * data/guide-index.json: { p: [page titles], s: [{ p: page index, h: heading, u: link, t: plain text }] }. Display only.
 *   node tools/build-guide.js           write (tools/build-places.js runs this first)
 *   node tools/build-guide.js --check   exit 1 if a page or the index is out of date */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), ROOT = path.join(__dirname, '..'), P = require('../js/v2-places.js');
const OUT = path.join(ROOT, 'data/guide-index.json');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', rarr: '→', larr: '←', middot: '·', mdash: '-', ndash: '-', hellip: '…', times: '×' };
function text(h) { return h.replace(/<(script|style|template|svg|canvas)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] != null ? ENT[e] : m))
  .replace(/\s+/g, ' ').trim(); }
function slug(s) { return 'g-' + (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'part'); }
function build() {
  const pages = [], secs = [], changed = [];
  P.GUIDE_PAGES.forEach((g, pi) => { const file = g[2], fp = path.join(ROOT, file); let h = fs.readFileSync(fp, 'utf8');
    const used = {}; (h.match(/\sid="([^"]+)"/g) || []).forEach(m => { used[m.slice(5, -1)] = 1; });
    const o = h.replace(/<main([\s\S]*?)<\/main>/, main => main.replace(/<h2((?:(?!\sid=)[^>])*)>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
      if (/\sid=/.test(attrs)) return m; let id = slug(text(inner)), n = 2; while (used[id]) id = slug(text(inner)) + '-' + n++; used[id] = 1; return '<h2' + attrs + ' id="' + id + '">' + inner + '</h2>'; }));
    if (o !== h) { changed.push(file); h = o; }
    const t = (/<title>([^<]*)<\/title>/.exec(h) || [])[1] || file; pages.push(g[1]);
    const main = (/<main[\s\S]*?<\/main>/.exec(h) || [''])[0].replace(/<!--guide-->[\s\S]*?<!--\/guide-->/, '');
    const parts = main.split(/(?=<h2[\s>])/);
    parts.forEach((part, i) => { let head, id;
      if (i === 0) { const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(part); head = h1 ? text(h1[1]) : t; id = ''; }
      else { const m = /^<h2([^>]*)>([\s\S]*?)<\/h2>/.exec(part); if (!m) return; head = text(m[2]); id = (/\sid="([^"]+)"/.exec(m[1]) || [])[1] || ''; part = part.slice(m[0].length); }
      const body = text(i === 0 ? part.replace(/<h1[\s\S]*?<\/h1>/, '') : part).slice(0, 6000);
      if (!head && !body) return; secs.push({ p: pi, h: head || g[1], u: file + (id ? '#' + id : ''), t: body }); });
    if (!process.argv.includes('--check') && changed.indexOf(file) >= 0) fs.writeFileSync(fp, h); });
  const json = JSON.stringify({ p: pages, s: secs });
  return { json, changed, token: crypto.createHash('sha256').update(json).digest('hex').slice(0, 10) };
}
module.exports = { build };
if (require.main === module) {
  const r = build(), check = process.argv.includes('--check'), cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (check) { const bad = r.changed.length || cur !== r.json; console.log(bad ? 'guide index out of date (run node tools/build-places.js)' : 'guide index: up to date'); process.exit(bad ? 1 : 0); }
  if (cur !== r.json) fs.writeFileSync(OUT, r.json); console.log('guide index: ' + JSON.parse(r.json).s.length + ' sections, ' + r.json.length + ' bytes, token ' + r.token + (r.changed.length ? ', ids added to ' + r.changed.join(', ') : ''));
}
