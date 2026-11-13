#!/usr/bin/env node
/* Pre-render /pet/<id>/index.html + card.png for a bounded set of living pets.
 * Crawlers (X, Telegram) do not run JavaScript, so the og tags and the PNG have to be real files.
 * GitHub Pages has no rewrite rules. A folder pet/<id>/index.html is a 200. Every other id still
 * opens through 404.html (js/v2-pet-route.js). This does not touch the VPS feed, HatchBot, or js/v2-rules.js.
 *
 *   node tools/share-cards.js --top 24
 * Needs Google Chrome and: npm install --no-save puppeteer-core
 * Sabo #1765 is never drawn. Bitcoin red (#e11d2e) is used, never orange.
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const feed = require(path.join(ROOT, 'js/pets-feed.js'));
const html = require(path.join(__dirname, 'share-page.js'));
const args = process.argv.slice(2);
function opt(k, d) { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; }
const TOP = Math.max(1, Math.min(80, +(opt('--top', '24')) || 24));
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';

function pick(pets, n) {
  return pets.filter(function (p) { return p && p.status === 'alive' && p.id !== 1765 && !p.community; })
    .sort(function (a, b) {
      var ar = a.rarityRank == null ? 1e15 : a.rarityRank, br = b.rarityRank == null ? 1e15 : b.rarityRank;
      return ar - br || (b.rarityScore || 0) - (a.rarityScore || 0) || a.id - b.id;
    }).slice(0, n);
}

function serve(root) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  return http.createServer(function (req, res) {
    let u = decodeURIComponent((req.url || '/').split('?')[0]);
    if (u.endsWith('/')) u += 'index.html';
    const fp = path.normalize(path.join(root, u));
    if (fp !== root && !fp.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, function (err, buf) {
      if (err) { res.writeHead(404); res.end('missing'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  });
}

async function draw(origin, ids) {
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none']
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(origin + '/pet.html?id=' + ids[0], { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(function (id) {
      try {
        var w = window.V2Mock && V2Mock.world && V2Mock.world();
        var t = document.getElementById('title');
        return !!(w && w.byId && w.byId[id] && w.byId[id].art && t && t.textContent && t.textContent.indexOf('Loading') < 0);
      } catch (e) { return false; }
    }, { timeout: 180000 }, ids[0]);
    try { await page.evaluate(function () { return document.fonts && document.fonts.load('32px "Press Start 2P"'); }); } catch (e) {}
    return await page.evaluate(async function (ids) {
      var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
      var TCOL = { Common: '#cfd6dd', Uncommon: '#4fc06b', Rare: '#3d8bff', Legendary: '#ffcf3a', Mythic: '#ff8fd8', God: '#ffffff' };
      var RED = '#e11d2e', INK = '#fff8ee', NIGHT = '#100E18', BAND = '#1b1440';
      function shortAddr(s) { s = String(s || ''); return s.length > 16 ? s.slice(0, 6) + '...' + s.slice(-4) : s; }
      function font(px) { return px + 'px "Press Start 2P", monospace'; }
      function label(g, s, x, y, px, color) {
        g.font = font(px); g.textAlign = 'left'; g.textBaseline = 'top';
        g.fillStyle = '#000'; g.fillText(s, x + 3, y + 3); g.fillStyle = color; g.fillText(s, x, y);
      }
      function fit(g, s, px, maxW) {
        var n = px; g.font = font(n);
        while (n > 14 && g.measureText(s).width > maxW) { n -= 2; g.font = font(n); }
        return n;
      }
      function sprite(p) {
        var s = document.createElement('canvas'); s.width = s.height = 32;
        window.V2Render.paint(s, window.V2Render.petFrames(p, window.V2Mock.world())[0]);
        return s;
      }
      function card(p) {
        if (!p || p.id === 1765 || p.dead) return null;
        var W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
        g.fillStyle = NIGHT; g.fillRect(0, 0, W, H);
        g.fillStyle = BAND; g.fillRect(0, 0, W, 92);
        g.fillStyle = RED; g.fillRect(0, 0, 22, H);
        g.fillStyle = '#2a1530'; g.fillRect(48, 120, 520, 470);
        g.strokeStyle = RED; g.lineWidth = 8; g.strokeRect(52, 124, 512, 462);
        var spr = sprite(p); g.imageSmoothingEnabled = false; g.drawImage(spr, 78, 150, 448, 448);
        var V = window.V2Rules;
        var hatch = TIERS[p.tier] || '';
        var stage = ''; try { stage = V && V.stageLabelOf ? V.stageLabelOf(p) : (p.stageName || ''); } catch (e) { stage = p.stageName || ''; }
        var sp = ''; try { sp = V && V.speciesLabel ? V.speciesLabel(p.species) : p.species; } catch (e) { sp = p.species || ''; }
        var parts = [];
        [hatch, p.resurrected ? 'God' : '', stage].forEach(function (x) { if (x && parts.indexOf(x) < 0) parts.push(x); });
        var line = parts.join(' · ');
        label(g, 'XCPETS', 620, 28, 28, INK);
        var name = String(p.name || 'Pet');
        label(g, name, 620, 160, fit(g, name, 40, 520), INK);
        label(g, '#' + p.id, 620, 230, 22, RED);
        label(g, line, 620, 300, fit(g, line, 22, 520), TCOL[stage] || TCOL[hatch] || INK);
        label(g, String(sp || ''), 620, 370, fit(g, String(sp || ''), 18, 520), '#d7d3ea');
        var own = 'owner ' + shortAddr(p.owner);
        label(g, own, 620, 440, fit(g, own, 16, 520), '#cfd6dd');
        label(g, 'xcpets.fun/pet/' + p.id, 620, 530, 16, RED);
        return { id: p.id, name: p.name || '', tier: hatch || (p.resurrected ? 'God' : ''), stageName: stage && stage !== hatch ? stage : (p.resurrected && stage !== 'God' ? 'God' : (stage === hatch ? '' : stage)), species: sp, owner: p.owner || '', png: c.toDataURL('image/png') };
      }
      function generic() {
        var W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
        g.fillStyle = NIGHT; g.fillRect(0, 0, W, H); g.fillStyle = RED; g.fillRect(0, 0, 22, H); g.fillStyle = BAND; g.fillRect(0, 0, W, 92);
        label(g, 'XCPETS', 80, 28, 28, INK);
        label(g, 'Share a pet', 80, 180, 48, INK);
        label(g, 'Sprite, gear, name, rarity, stage.', 80, 280, 18, '#d7d3ea');
        label(g, 'xcpets.fun/pet/<id>', 80, 360, 22, RED);
        g.imageSmoothingEnabled = false;
        [[180, '#4fc06b'], [280, '#3d8bff'], [380, '#ffcf3a'], [480, RED]].forEach(function (e, i) {
          g.fillStyle = '#000'; g.fillRect(80 + i * 120, 450, 72, 88);
          g.fillStyle = e[1]; g.fillRect(88 + i * 120, 458, 56, 72);
        });
        return c.toDataURL('image/png');
      }
      var w = window.V2Mock.world(), cards = [];
      ids.forEach(function (id) {
        var p = w.byId[id];
        try { var row = card(p); if (row) cards.push(row); } catch (e) { cards.push({ id: id, error: String(e && e.message || e) }); }
      });
      return { cards: cards, generic: generic() };
    }, ids);
  } finally { await browser.close(); }
}

function decodePng(dataUrl) {
  const i = String(dataUrl).indexOf(',');
  return Buffer.from(String(dataUrl).slice(i + 1), 'base64');
}

(async function () {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/pets.json'), 'utf8'));
  const expanded = feed.expand(doc);
  const chosen = pick(expanded.pets, TOP);
  if (chosen.some(function (p) { return p.id === 1765; })) throw new Error('Sabo #1765 slipped into the set');
  const ids = chosen.map(function (p) { return p.id; });
  console.log('set', ids.length, 'from block', doc.blockHeight, ids.join(','));
  const server = serve(ROOT);
  await new Promise(function (res) { server.listen(0, '127.0.0.1', res); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  let drawn;
  try { drawn = await draw(origin, ids); }
  finally { server.close(); }
  const petRoot = path.join(ROOT, 'pet');
  fs.mkdirSync(petRoot, { recursive: true });
  fs.readdirSync(petRoot, { withFileTypes: true }).forEach(function (ent) {
    if (ent.isDirectory() && /^\d+$/.test(ent.name)) fs.rmSync(path.join(petRoot, ent.name), { recursive: true, force: true });
  });
  let bytes = 0, wrote = [];
  (drawn.cards || []).forEach(function (row) {
    if (!row || !row.png || row.id === 1765) { console.log('skip', row && row.id, row && row.error); return; }
    const dir = path.join(petRoot, String(row.id));
    fs.mkdirSync(dir, { recursive: true });
    const png = decodePng(row.png);
    fs.writeFileSync(path.join(dir, 'card.png'), png);
    const page = html.page({ id: row.id, name: row.name, tier: row.tier, stageName: row.stageName, speciesLabel: row.species, owner: row.owner });
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    bytes += png.length + Buffer.byteLength(page);
    wrote.push({ id: row.id, name: row.name, tier: row.tier, stage: row.stageName, png: png.length });
    console.log('wrote', row.id, row.name, row.tier, row.stageName, png.length);
  });
  const generic = decodePng(drawn.generic);
  fs.writeFileSync(path.join(ROOT, 'img/share-generic.png'), generic);
  bytes += generic.length;
  const meta = {
    blockHeight: doc.blockHeight,
    generatedAt: new Date().toISOString(),
    top: TOP,
    count: wrote.length,
    bytes: bytes,
    note: 'Living pets with the best Pet Score rank in api/pets.json, excluding Sabo #1765. Other pets use /pet/<id> via 404.html and the generic card.',
    ids: wrote.map(function (r) { return r.id; }),
    pets: wrote
  };
  fs.mkdirSync(path.join(ROOT, 'share'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'share/set.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log('total new bytes', bytes, 'generic', generic.length, 'pets', wrote.length);
})().catch(function (e) { console.error(e); process.exit(1); });
