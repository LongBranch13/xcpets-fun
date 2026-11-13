/* Stacked Rare Room gear cards: one card per piece ("Gold aviators ×44"), full official names,
 * drag onto the pet preview wears one copy (mouse and touch), and a refused drop shows equipCheck's reason.
 * Practice ledger only. Nothing is signed or sent. Rule files are not modified.
 *   node tools/gear-stack-ui-test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const ART = '/opt/cursor/artifacts';
function chromium() {
  const tries = ['/tmp/pw/node_modules/playwright-core', 'playwright-core', 'playwright'];
  for (const p of tries) { try { return require(p).chromium; } catch (e) { } }
  throw new Error('playwright-core not found');
}
function md5(p) { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }
function gitFile(f) { return cp.execFileSync('git', ['show', 'origin/main:' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6 }); }
const RULES = ['js/v2-rules.js', 'rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/real-core.js', 'rjs/burn-core.js', 'rjs/bonus-gear.js', 'rjs/chain.js', 'rjs/wallet.js'];
const fail = [];
const ok = (c, m) => { if (c) console.log('ok', m); else { fail.push(m); console.log('FAIL', m); } };
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = path.normalize(path.join(ROOT, decodeURIComponent(q.url.split('?')[0])));
      if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) { r.writeHead(404); r.end('missing'); return; }
      r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}
const SEED = `() => {
  var XP = XcpPractice, V = V2Rules;
  function rnd() { var a = new Uint8Array(16), s = ''; crypto.getRandomValues(a); for (var i = 0; i < 16; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16); return s + s; }
  function hexTag(t) { var s = unescape(encodeURIComponent(String(t))), o = ''; for (var i = 0; i < s.length; i++) { var h = s.charCodeAt(i).toString(16); o += (h.length < 2 ? '0' : '') + h; } return o; }
  function mine(w) { return (w.pets || []).filter(function (p) { return p.owner === XP.ME && !p.dead && !p.released; }); }
  var L0 = XP.load(), w0 = XP._replay(L0.rows, L0.tip), pet = null;
  mine(w0).forEach(function (p) { if (!pet || p.tier > pet.tier) pet = p; });
  if (!pet) { XP.burn({ tag: 'pet:hatch', amount: 69 }); var wH = XP._replay(XP.load().rows, XP.load().tip); mine(wH).forEach(function (p) { if (!pet || p.tier > pet.tier) pet = p; }); }
  if (!pet) return { error: 'no pet after hatch' };
  var cat = V.GEAR_BY_ID || {}, slots = V.V2_SLOTS, sigs = V.legendaryOf(pet.species) || [];
  var sig = sigs.filter(function (x) { return x.slot === 'face'; })[0] || sigs.filter(function (x) { return x.slot !== 'weapon'; })[0];
  function rs(it) { if (!it) return null; if (it.rollSlot && slots.indexOf(it.rollSlot) >= 0) return it.rollSlot; if (slots.indexOf(it.slot) >= 0) return it.slot; if (it.slot === 'weapon') return 'hand'; return null; }
  var goals = [{ id: 'v2-gold-aviators', n: 44, slot: rs(cat['v2-gold-aviators']) }];
  ['v2-crown-feather', 'v2-brow-piercing', 'v2-gold-grill', 'v2-teardrop-gem'].forEach(function (id) { var sl = rs(cat[id]); if (sl && sl !== 'hand') goals.push({ id: id, n: id === 'v2-crown-feather' ? 2 : 1, slot: sl, label: cat[id].label }); });
  if (pet.tier >= 3 && sig && rs(sig) && rs(sig) !== 'hand') goals.push({ id: sig.id, n: 1, slot: rs(sig), label: sig.label, sig: 1 });
  goals = goals.filter(function (g) { return g.slot; });
  var L = XP.load(), wNow = XP._replay(L.rows, L.tip), pool = mine(wNow), owned = {};
  (wNow.itemList || []).forEach(function (g) { if (g.owner === XP.ME) owned[g.item] = (owned[g.item] || 0) + 1; });
  var b = L.tip, guard = 0, made = [];
  function open() { for (var i = 0; i < goals.length; i++) if (goals[i].n > 0) return true; return false; }
  function wheelWho(hex) { var T = 0, i, r; for (i = 0; i < pool.length; i++) T += V.wheelWt(pool[i]); if (!T) return null; r = parseInt(hex.slice(0, 12), 16) % T; for (i = 0; i < pool.length; i++) { r -= V.wheelWt(pool[i]); if (r < 0) return pool[i]; } return pool[pool.length - 1]; }
  while (open() && guard < 500000) { guard++;
    var tx = rnd(), bb = b + 1, bh = V.sha('xcpets-practice-block:' + L.salt + ':' + bb), wh = V.sha(bh + tx + 'XCPETS:v2:gear-roll'), sl = slots[parseInt(wh.slice(16, 24), 16) % slots.length];
    var waiting = goals.some(function (g) { return g.n > 0 && g.slot === sl; }); if (!waiting) continue;
    var who = wheelWho(V.sha(bh + tx + 'XCPETS:v2:wheel-pet')); if (!who) continue;
    var it = V.pickItem(wh, sl, who.species, who.tier, owned, V.bodyOf(who)); if (!it) continue;
    var hit = null; for (var i = 0; i < goals.length; i++) if (goals[i].n > 0 && goals[i].slot === sl && (it.id === goals[i].id || it.alias === goals[i].id)) { hit = goals[i]; break; }
    if (!hit) continue; hit.n--; owned[it.id] = (owned[it.id] || 0) + 1; b = bb; made.push(tx);
  }
  made.forEach(function (tx) { L.n++; L.tip++; L.rows.push({ tx_index: 100000000 + L.n, tx_hash: tx, block_index: L.tip, source: XP.ME, asset: 'XCPETS', asset_longname: null, quantity: 345 * 1e8, tag: hexTag('pet:spin'), status: 'valid', _t: 'pet:spin' }); });
  XP.save();
  var info = { species: pet.species, petId: pet.id, tier: pet.tier, otherId: pet.id, otherSpecies: pet.species, sig: sig && sig.id, sigLabel: sig && sig.label, guard: guard, made: made.length, left: goals.filter(function (g) { return g.n > 0; }).map(function (g) { return g.id + ':' + g.n; }), hatches: 1 };
  try { sessionStorage.setItem('stack-fixture', JSON.stringify(info)); } catch (e) {}
  return info;
}`;

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const RULES_MD5 = '8e98664087bab2e991680ebdb80ba143';
  RULES.forEach(f => { const a = md5(path.join(ROOT, f)); ok(f === 'js/v2-rules.js' ? a === RULES_MD5 : a === crypto.createHash('md5').update(gitFile(f)).digest('hex'), f === 'js/v2-rules.js' ? 'js/v2-rules.js MD5 is ' + RULES_MD5 : 'rule unchanged ' + f); });
  const oldShop = gitFile('js/v2-shop.js');
  const mainStacks = /function stackPieces/.test(oldShop);
  ok(mainStacks, 'origin/main already stacks gear cards');
  ok(/function stackPieces/.test(fs.readFileSync(path.join(ROOT, 'js/v2-shop.js'), 'utf8')), 'this branch stacks gear cards');
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium().launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  async function boot(width, height, shopBody) {
    const ctx = await browser.newContext({ viewport: { width: width, height: height }, ...(width < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    if (shopBody) await ctx.route('**/js/v2-shop.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'cache-control': 'no-store' }, body: shopBody }));
    const page = await ctx.newPage();
    page.setDefaultTimeout(180000);
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(origin + '/practice-rare.html#rare-room', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.XcpPractice && window.V2Rules && window.V2UI && document.querySelector('#drEnter'), null, { timeout: 180000 });
    return { ctx: ctx, page: page };
  }
  async function hush(page) { await page.evaluate(() => { var bs = [].slice.call(document.querySelectorAll('button')); var b = bs.filter(function (x) { return /No thanks/i.test(x.textContent || ''); })[0]; if (b) b.click(); }); await page.waitForTimeout(200); }
  async function openDress(page, pid) {
    await page.evaluate(id => { location.hash = 'dressing-room'; if (id && window.V2Shop) { V2Shop._state().pet = id; if (V2Shop.refreshRoll) V2Shop.refreshRoll(); } }, pid || null);
    await page.waitForSelector('#rrDress .dr-grid', { timeout: 30000 });
    if (pid) await page.evaluate(id => { var b = document.querySelector('[data-dpid="' + id + '"]'); if (b) b.click(); }, pid);
    await page.waitForTimeout(400);
    await page.evaluate(() => { var d = document.getElementById('rrDress'); if (d) d.scrollIntoView({ block: 'start' }); });
    await page.waitForTimeout(200);
  }
  try {
    const before = await boot(1280, 900, oldShop);
    const seeded = await before.page.evaluate(s => (0, eval)('(' + s + ')()'), SEED);
    console.log('fixture', JSON.stringify(seeded));
    ok(seeded && !seeded.error && seeded.made >= 44 && !(seeded.left && seeded.left.length), 'practice spins created the stacked pile (' + (seeded && seeded.made) + ' burns, left ' + JSON.stringify(seeded && seeded.left) + ')');
    ok(seeded && seeded.petId, 'practice keeps one pet, and that pet is the dress target (' + (seeded && seeded.species) + ')');
    await before.page.reload({ waitUntil: 'domcontentloaded' });
    await before.page.waitForFunction(() => window.V2UI && document.querySelector('#drEnter'), null, { timeout: 180000 });
    await openDress(before.page, seeded.otherId);
    await hush(before.page);
    const beforeGrid = await before.page.evaluate(() => {
      var cards = [].slice.call(document.querySelectorAll('#rrDress .rr-card'));
      var names = cards.map(c => (c.querySelector('.rr-nm') || {}).textContent || '');
      var avi = names.filter(n => n.indexOf('Gold aviators') === 0).length;
      return { n: cards.length, avi: avi, sample: names.slice(0, 6) };
    });
    console.log('before grid', JSON.stringify(beforeGrid));
    ok(mainStacks ? beforeGrid.avi >= 1 && beforeGrid.avi <= 8 : beforeGrid.avi > 8, mainStacks ? 'main already stacks, Gold aviators is one card (' + beforeGrid.avi + ')' : 'before: Gold aviators is repeated as separate cards (' + beforeGrid.avi + ' on the first page)');
    const dress = await before.page.$('#rrDress');
    await dress.screenshot({ path: path.join(ART, 'gear_grid_before_unstacked.png') });
    const dump = await before.page.evaluate(() => {
      var P = 'xcpets-practice-', out = {};
      for (var i = 0; ; i++) { var k = localStorage.key(i); if (k == null) break; out[P + k] = localStorage.getItem(k); }
      out.__info = sessionStorage.getItem('stack-fixture');
      return out;
    });
    await before.ctx.close();

    async function bootLedger(width, height, data) {
      const ctx = await browser.newContext({ viewport: { width: width, height: height }, ...(width < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
      await ctx.addInitScript(data => { try { Object.keys(data).forEach(function (k) { if (k === '__info') return; localStorage.setItem(k, data[k]); }); } catch (e) {} }, data);
      const page = await ctx.newPage();
      page.setDefaultTimeout(180000);
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(origin + '/practice-rare.html#dressing-room', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => window.V2Shop && V2Shop.stackPieces && (document.querySelector('#rrDress .dr-grid') || document.querySelector('#drEnter')), null, { timeout: 180000 });
      return { ctx: ctx, page: page };
    }
    const after = await bootLedger(1280, 900, dump);
    const dbg = await after.page.evaluate(() => {
      var info = { hash: location.hash, enter: !!document.querySelector('#drEnter'), dress: !!document.querySelector('#rrDress'), grid: !!document.querySelector('#rrDress .dr-grid') };
      try { var w = V2UI.world(); var owners = {}; (w.pets || []).forEach(function (p) { owners[p.owner] = (owners[p.owner] || 0) + 1; }); info.pets = (w.pets || []).length; info.mine = V2UI.mine(w).length; info.me = V2UI.ME; info.mock = window.V2Mock && V2Mock.ME; info.owners = owners; info.items = (w.itemList || []).filter(function (g) { return g.owner === V2UI.ME; }).length; info.sample = (w.pets || []).slice(0, 4).map(function (p) { return p.id + ' ' + p.species + ' ' + p.owner; }); } catch (e) { info.err = String(e); }
      try { var L = JSON.parse(localStorage.getItem('xcpets-practice-ledger') || 'null'); info.rows = L && L.rows && L.rows.length; info.tip = L && L.tip; } catch (e) { info.lerr = String(e); }
      return info;
    });
    console.log('after dbg', JSON.stringify(dbg));
    await openDress(after.page, seeded.otherId);
    await hush(after.page);
    const grid = await after.page.evaluate(info => {
      var cards = [].slice.call(document.querySelectorAll('#rrDress .rr-card'));
      var by = {};
      cards.forEach(function (c) { var id = c.getAttribute('data-ditem'); by[id] = (by[id] || 0) + 1; });
      var avi = document.querySelector('#rrDress .rr-card[data-ditem="v2-gold-aviators"]');
      var sig = info.sig && document.querySelector('#rrDress .rr-card[data-ditem="' + info.sig + '"]');
      var sign = document.querySelector('#rrDress .rr-card[data-ditem="v2-crown-feather"]');
      function txt(el) { return el ? (el.querySelector('.rr-nm') || {}).textContent.replace(/\\s+/g, ' ').trim() : ''; }
      return { kinds: Object.keys(by).length, dup: Object.keys(by).filter(function (k) { return by[k] > 1; }), avi: txt(avi), aviN: avi && avi.getAttribute('data-n'), sig: txt(sig), sign: txt(sign), signN: sign && sign.getAttribute('data-n') };
    }, seeded);
    console.log('after grid', JSON.stringify(grid));
    ok(grid.dup.length === 0, 'after: one card per piece (no duplicate item ids)');
    ok(grid.avi === 'Gold aviators ×44' && grid.aviN === '44', 'Gold aviators card reads "' + grid.avi + '" (n ' + grid.aviN + ')');
    ok(grid.sign && grid.sign.indexOf('Black-feather crown') === 0 && grid.sign.indexOf('×') > 0, 'long official name is not cut off ("' + grid.sign + '")');
    const dress2 = await after.page.$('#rrDress');
    await dress2.screenshot({ path: path.join(ART, 'gear_grid_after_stacked.png') });

    await after.page.evaluate(() => { var d = document.querySelector('details.rr-browse'); if (d) d.open = true; });
    await after.page.waitForTimeout(200);
    await after.page.click('#rrGallery [data-bslot="face"]');
    await after.page.waitForTimeout(200);
    const binder = await after.page.evaluate(() => {
      var cards = [].slice.call(document.querySelectorAll('#rrGallery .rr-card'));
      var ids = cards.map(c => c.getAttribute('data-ditem'));
      var avi = document.querySelector('#rrGallery .rr-card[data-ditem="v2-gold-aviators"]');
      return { n: cards.length, unique: new Set(ids).size, avi: avi && (avi.querySelector('.rr-nm') || {}).textContent.replace(/\s+/g, ' ').trim() };
    });
    ok(binder.n > 0 && binder.n === binder.unique, 'binder page is one card per piece (' + binder.n + ')');
    ok(binder.avi === 'Gold aviators ×44', 'binder uses the same count ("' + binder.avi + '")');

    async function drag(page, item, kind) {
      if (kind === 'touch') {
        return page.evaluate(async function (id) {
          var card = document.querySelector('#rrDress .rr-card[data-ditem="' + id + '"]');
          var prev = document.querySelector('#rrDress .dr-prev');
          if (!card || !prev) return { missing: true };
          var a = card.getBoundingClientRect();
          var sx = a.x + Math.min(24, a.width / 2), sy = a.y + Math.min(20, a.height / 2);
          function ev(type, x, y, target) { (target || window).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true })); }
          ev('pointerdown', sx, sy, card);
          await new Promise(function (r) { setTimeout(r, 250); });
          var dock = document.querySelector('.dr-dock');
          var target = dock || prev;
          var b = target.getBoundingClientRect();
          var tx = b.x + b.width / 2, ty = b.y + Math.max(8, Math.min(b.height / 2, 40));
          ev('pointermove', tx, ty, window);
          var had = !!dock;
          ev('pointerup', tx, ty, window);
          return { dock: had, w: Math.round(b.width), h: Math.round(b.height) };
        }, item);
      }
      const card = page.locator('#rrDress .rr-card[data-ditem="' + item + '"]');
      const prev = page.locator('#rrDress .dr-prev');
      await page.evaluate(() => { var d = document.getElementById('rrDress'); if (d) d.scrollIntoView({ block: 'start' }); });
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      const pb = await prev.boundingBox();
      console.log('drag box', item, JSON.stringify({ box: box, prev: pb }));
      await card.dragTo(prev, { targetPosition: { x: 30, y: 30 }, steps: 12 });
      return { box: box, prev: pb };
    }
    function worn(page, pid) {
      return page.evaluate(id => {
        var w = V2UI.world(), V = V2Rules, P = w.byId[id];
        var list = V.wornOf(w, id).map(function (g) { return g.item + ':' + (g.label || ''); });
        var face = V.wornOf(w, id).filter(function (g) { return g.slot === 'face'; })[0];
        return { id: id, species: P && P.species, face: face && face.item, faceLabel: face && face.label, worn: list };
      }, pid);
    }

    const touch = await drag(after.page, 'v2-crown-feather', 'touch');
    await after.page.waitForTimeout(400);
    const afterTouch = await worn(after.page, seeded.otherId);
    console.log('touch', JSON.stringify(touch), JSON.stringify(afterTouch));
    ok(afterTouch.worn.some(x => x.indexOf('v2-crown-feather') === 0), 'touch drag equips one copy of Black-feather crown');

    await openDress(after.page, seeded.otherId);
    await drag(after.page, 'v2-gold-aviators', 'mouse');
    await after.page.waitForTimeout(500);
    const afterMouse = await worn(after.page, seeded.otherId);
    console.log('mouse', JSON.stringify(afterMouse));
    ok(afterMouse.face === 'v2-gold-aviators', 'mouse drag onto the pet equips one Gold aviators');
    const still = await after.page.evaluate(() => { var c = document.querySelector('#rrDress .rr-card[data-ditem="v2-gold-aviators"]'); return c && { n: c.getAttribute('data-n'), t: (c.querySelector('.rr-nm') || {}).textContent.replace(/\\s+/g, ' ').trim(), on: !!c.querySelector('.dr-wb') }; });
    ok(still && still.n === '44' && still.t === 'Gold aviators ×44', 'equipping one copy keeps the stack at ×44 ("' + (still && still.t) + '")');
    await after.page.evaluate(() => { var d = document.getElementById('rrDress'); if (d) d.scrollIntoView({ block: 'start' }); });
    await (await after.page.$('#rrDress')).screenshot({ path: path.join(ART, 'gear_drag_equipped.png') });

    await drag(after.page, 'v2-gold-aviators', 'mouse');
    await after.page.waitForTimeout(400);
    const again = await after.page.evaluate(() => { var n = document.querySelector('#rrDress .dr-dropwhy'); var bar = document.querySelector('#rrDress .dr-ok, #rrDress .sc-why'); return { why: n && n.textContent.trim(), bar: bar && bar.textContent.trim(), face: (V2Rules.wornOf(V2UI.world(), V2Shop._state().pet).filter(function (g) { return g.slot === 'face'; })[0] || {}).item }; });
    console.log('reject same', JSON.stringify(again));
    ok(again.face === 'v2-gold-aviators' && /already wear/i.test((again.why || '') + ' ' + (again.bar || '')), 'a second drop of the same piece is refused with the existing reason ("' + again.why + '" / "' + again.bar + '")');

    if (seeded.sig && seeded.tier < 3) {
      await drag(after.page, seeded.sig, 'mouse');
      await after.page.waitForTimeout(400);
      const sigWhy = await after.page.evaluate(() => { var n = document.querySelector('#rrDress .dr-dropwhy'); var bar = document.querySelector('#rrDress .sc-why'); return { why: n && n.textContent.trim(), bar: bar && bar.textContent.trim() }; });
      console.log('reject sig', JSON.stringify(sigWhy));
      ok(/only legendary/i.test((sigWhy.why || '') + ' ' + (sigWhy.bar || '')), 'a piece that pet cannot wear shows equipCheck\'s reason ("' + sigWhy.why + '")');
      await after.page.evaluate(() => { var d = document.getElementById('rrDress'); if (d) d.scrollIntoView({ block: 'start' }); });
      await (await after.page.$('#rrDress')).screenshot({ path: path.join(ART, 'gear_drag_rejected.png') });
    } else console.log('signature refuse skipped: practice allows one pet' + (seeded.sig ? ' and this one is legendary' : ' and no foreign piece was rolled'));

    await after.ctx.close();

    const phone = await bootLedger(390, 844, dump);
    await openDress(phone.page, seeded.otherId);
    await hush(phone.page);
    const phoneGrid = await phone.page.evaluate(() => { var c = document.querySelector('#rrDress .rr-card[data-ditem="v2-gold-aviators"]'); var nm = c && (c.querySelector('.rr-nm') || {}).textContent.replace(/\\s+/g, ' ').trim(); return { nm: nm, n: c && c.getAttribute('data-n'), cards: document.querySelectorAll('#rrDress .rr-card').length }; });
    ok(phoneGrid.nm === 'Gold aviators ×44', 'phone grid stacks the same way ("' + phoneGrid.nm + '", ' + phoneGrid.cards + ' cards)');
    await phone.page.evaluate(() => { var d = document.getElementById('rrDress'); if (d) d.scrollIntoView({ block: 'start' }); });
    await (await phone.page.$('#rrDress')).screenshot({ path: path.join(ART, 'gear_grid_phone_stacked.png') });
    const phoneTouch = await drag(phone.page, 'v2-gold-grill', 'touch');
    await phone.page.waitForTimeout(400);
    const phoneWorn = await worn(phone.page, seeded.otherId);
    console.log('phone touch', JSON.stringify(phoneTouch), JSON.stringify(phoneWorn));
    ok(phoneWorn.worn.some(x => x.indexOf('v2-gold-grill') === 0), 'phone touch-drag equips one Gold grill');
    await phone.ctx.close();
  } catch (e) {
    console.log('ERR', e && e.stack || e);
    fail.push(String(e && e.message || e));
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) console.log('page errors', errors.slice(0, 8));
  ok(!errors.length, 'no page errors');
  if (fail.length) { console.log('FAILED ' + fail.length); process.exit(1); }
  console.log('ALL OK');
})();
