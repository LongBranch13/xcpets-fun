#!/usr/bin/env node
/* Screenshots for the share-link review. Local static server, system Chrome. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'design/share-links');
fs.mkdirSync(OUT, { recursive: true });
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';

function serve(root) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  return http.createServer(function (req, res) {
    let u = decodeURIComponent((req.url || '/').split('?')[0]);
    const send = function (fp, code) {
      fs.readFile(fp, function (err, buf) {
        if (err) { res.writeHead(404); res.end('missing'); return; }
        res.writeHead(code || 200, { 'content-type': types[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(buf);
      });
    };
    if (u.endsWith('/')) u += 'index.html';
    let fp = path.normalize(path.join(root, u));
    if (fp !== root && !fp.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.stat(fp, function (err, st) {
      if (!err && st.isDirectory()) fp = path.join(fp, 'index.html');
      fs.stat(fp, function (err2, st2) {
        if (!err2 && st2.isFile()) return send(fp, 200);
        if (/^\/pet\/\d+\/?$/.test(u)) return send(path.join(root, '404.html'), 404);
        res.writeHead(404); res.end('missing');
      });
    });
  });
}

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
async function bootPet(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(function () {
    var t = document.getElementById('title');
    var row = document.querySelector('.sh-row[data-sh="page"], .petshare .sh-row');
    return !!(t && t.textContent && t.textContent.indexOf('Loading') < 0 && t.textContent.indexOf('#') === 0 && row && document.getElementById('cv'));
  }, { timeout: 180000 });
}

(async function () {
  const server = serve(ROOT);
  await new Promise(function (res) { server.listen(0, '127.0.0.1', res); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const report = {};
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await bootPet(page, origin + '/pet/15004?ref=');
    report.pretty = await page.evaluate(function () {
      var t = document.getElementById('title').textContent;
      var facts = (document.getElementById('facts') || {}).innerText || '';
      var gear = (document.getElementById('gear') || {}).innerText || '';
      return { href: location.pathname + location.search, title: t, facts: facts.slice(0, 180), gear: gear.slice(0, 160), share: !!document.querySelector('.sh-row'), dead: document.body.innerText.indexOf('Died of neglect') >= 0 };
    });
    await page.screenshot({ path: path.join(OUT, 'pet-desktop.png') });
    await page.setViewport({ width: 412, height: 820, deviceScaleFactor: 1 });
    await sleep(400);
    const card = await page.$('#petCard, .pcard-wrap, #cv');
    if (card) await card.screenshot({ path: path.join(OUT, 'pet-412.png') });
    else await page.screenshot({ path: path.join(OUT, 'pet-412.png') });

    async function toastShot(width, file) {
      await page.setViewport({ width: width, height: 780, deviceScaleFactor: 1 });
      await page.evaluate(function () { window.__opened = []; window.open = function (u) { window.__opened.push(u); return null; }; });
      const btn = await page.$('.sh-x');
      await btn.evaluate(function (b) { b.scrollIntoView({ block: 'center' }); });
      await btn.click();
      await page.waitForSelector('.sh-toast', { timeout: 4000 });
      await sleep(200);
      report['toast' + width] = await page.evaluate(function () {
        var t = document.querySelector('.sh-toast'), r = t.getBoundingClientRect();
        return { text: t.innerText, left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: innerWidth, h: innerHeight, opened: window.__opened };
      });
      const box = report['toast' + width];
      if (box.left < -1 || box.right > box.w + 1 || box.bottom > box.h + 1) throw new Error('toast clipped at ' + width + ' ' + JSON.stringify(box));
      await page.screenshot({ path: path.join(OUT, file) });
      await page.evaluate(function () { var t = document.querySelector('.sh-toast'); if (t) t.remove(); });
    }
    await toastShot(412, 'toast-412.png');
    await toastShot(360, 'toast-360.png');

    report.fallback = 'skip-second-boot';
    await page.goto(origin + '/pet/1', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(function () {
      var t = document.getElementById('title');
      return !!(t && /#1\b/.test(t.textContent) && t.textContent.indexOf('Loading') < 0 && location.pathname === '/pet/1');
    }, { timeout: 180000 });
    report.fallback = await page.evaluate(function () { return { href: location.pathname, title: document.getElementById('title').textContent }; });

    await page.setViewport({ width: 412, height: 820, deviceScaleFactor: 1 });
    await page.goto(origin + '/play.html?moment=hatch&pet=15004', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('#packBox.on .sh-row[data-sh="hatch"]', { timeout: 180000 });
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, 'hatch-modal-412.png') });
    report.hatch = await page.evaluate(function () { var b = document.querySelector('#packBox.on .sh-x'); return b ? b.textContent : ''; });

    await page.evaluate(function () {
      var pack = document.getElementById('packBox'); if (pack) pack.classList.remove('on');
      var w = V2Mock.world(), kid = null, i;
      for (i = 0; i < w.pets.length; i++) { var p = w.pets[i]; if (p && p.parents && p.parents.length === 2 && p.id !== 1765 && p.art) { kid = p; break; } }
      V2Motel.eggPop(w, kid); window.__breed = kid && kid.id;
    });
    await page.waitForSelector('#eggPop .sh-row[data-sh="breed"]', { timeout: 10000 });
    await sleep(250);
    await page.screenshot({ path: path.join(OUT, 'breed-modal-412.png') });
    report.breed = await page.evaluate(function () { return { id: window.__breed, label: document.querySelector('#eggPop .sh-x').textContent }; });

    await page.evaluate(function () {
      var e = document.getElementById('eggPop'); if (e) e.remove();
      var w = V2Mock.world();
      V2LifeAnim.play({ kind: 'mythic', ids: [15004], n: 1 }, { w: w, noQueue: true, noClip: true });
    });
    await page.waitForSelector('.la-ov[data-anim="mythic"] .sh-row', { timeout: 10000 });
    await page.evaluate(function () { if (window.V2LifeAnim && V2LifeAnim.last && V2LifeAnim.last.frame) V2LifeAnim.last.frame(50); });
    await sleep(200);
    await page.screenshot({ path: path.join(OUT, 'mythic-modal-412.png') });
    report.mythic = await page.evaluate(function () {
      var b = document.querySelector('.la-ov[data-anim="mythic"] .sh-x');
      var r = b.getBoundingClientRect();
      return { label: b.textContent, left: r.left, right: r.right, w: innerWidth, cap: document.querySelector('.la-cap').textContent };
    });
    if (report.mythic.left < 0 || report.mythic.right > report.mythic.w + 1) throw new Error('mythic button clipped ' + JSON.stringify(report.mythic));

    const mock = path.join(ROOT, 'design/share-links/x-card-mock.html');
    await page.setViewport({ width: 560, height: 760, deviceScaleFactor: 1 });
    await page.goto('file://' + mock, { waitUntil: 'load', timeout: 30000 });
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, 'x-card-mock.png') });
    fs.copyFileSync(path.join(ROOT, 'pet/15004/card.png'), path.join(OUT, 'og-card-15004.png'));
    fs.copyFileSync(path.join(ROOT, 'img/share-generic.png'), path.join(OUT, 'og-generic.png'));
    fs.writeFileSync(path.join(OUT, 'shot-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(function (e) { console.error(e); process.exit(1); });
