/* Stacked gear in the Dress drawer (js/v2-dress.js), the one place pets are dressed since the Nov 23 2026 rare-room rethink
 * (#dressing-room now opens the Closet door + this drawer; the old #rrDress grid with drag-to-wear is no longer reachable):
 * one row per piece with "×N" equal to the spare copies you own, Wear uses one copy, the Closet counts match the world, desktop and phone.
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
  const RULES_MD5 = require('./lib/rules-pin').pin('js/v2-rules.js');
  RULES.forEach(f => { const a = md5(path.join(ROOT, f)); ok(f === 'js/v2-rules.js' ? a === RULES_MD5 : a === crypto.createHash('md5').update(gitFile(f)).digest('hex'), f === 'js/v2-rules.js' ? 'js/v2-rules.js MD5 is ' + RULES_MD5 : 'rule unchanged ' + f); });
  ok(/function stackPieces/.test(fs.readFileSync(path.join(ROOT, 'js/v2-shop.js'), 'utf8')), 'the shop still stacks gear pieces');
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium().launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  async function boot(width, height) {
    const ctx = await browser.newContext({ viewport: { width: width, height: height }, ...(width < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const page = await ctx.newPage();
    page.setDefaultTimeout(180000);
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(origin + '/practice-rare.html#rare-room', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.XcpPractice && window.V2Rules && window.V2UI && document.querySelector('#drEnter'), null, { timeout: 180000 });
    return { ctx: ctx, page: page };
  }
  async function hush(page) { await page.evaluate(() => { var bs = [].slice.call(document.querySelectorAll('button')); var b = bs.filter(function (x) { return /No thanks/i.test(x.textContent || ''); })[0]; if (b) b.click(); }); await page.waitForTimeout(200); }
  /* the drawer for pet id, one slot expanded: rows [{ id, label, n }] and the world's spare count per item */
  async function drawer(page, id, slot) {
    return page.evaluate(async a => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      for (let k = 0; k < 240 && !(window.V2Dress && V2Dress.ready && V2Dress.ready()); k++) await wait(500);
      for (let k = 0; k < 60 && !document.querySelector('#dzModal [data-sl]'); k++) { if (k % 10 === 0) V2Dress.open(a.id); await wait(500); }
      if (!document.querySelector('#dzModal [data-sl]')) return { rows: [], spare: {}, worn: [], row: '', err: 'drawer did not open (ready ' + (V2Dress.ready && V2Dress.ready()) + ', pet ' + !!V2UI.world().byId[a.id] + ')' };
      let dz = document.getElementById('dzModal'), ex = dz && dz.querySelector('[data-exp="' + a.slot + '"]');
      if (ex && ex.getAttribute('aria-expanded') !== 'true') { ex.click(); await wait(400); dz = document.getElementById('dzModal'); }
      const rows = [].slice.call(dz.querySelectorAll('[data-try^="' + a.slot + '|"]')).map(e => { const t = e.innerText.replace(/\s+/g, ' '), m = / ×(\d+)/.exec(t); return { id: e.getAttribute('data-try').split('|')[1], text: t, n: m ? +m[1] : 1 }; });
      const w = V2UI.world(), spare = {}; (w.itemList || []).forEach(g => { if (g.owner === V2UI.ME && g.on == null) spare[g.item] = (spare[g.item] || 0) + 1; });
      const row = dz.querySelector('[data-sl="' + a.slot + '"]');
      return { rows, spare, worn: V2Rules.wornOf(w, a.id).map(x => x.slot + ':' + x.item), row: row ? row.innerText.replace(/\s+/g, ' ') : '' };
    }, { id, slot });
  }
  async function wear(page, id, slot, item) {
    return page.evaluate(async a => {
      const wait = ms => new Promise(r => setTimeout(r, ms)); let dz = document.getElementById('dzModal');
      const t = dz.querySelector('[data-try="' + a.slot + '|' + a.item + '"]'); if (!t) return { err: 'no row for ' + a.item }; t.click(); await wait(400);
      dz = document.getElementById('dzModal'); const b = dz.querySelector('[data-wear="' + a.slot + '|' + a.item + '"]'); if (!b) return { err: 'no Wear button for ' + a.item }; b.click();
      for (let k = 0; k < 20 && !V2Rules.wornOf(V2UI.world(), a.id).some(x => x.item === a.item); k++) await wait(250);
      return { worn: V2Rules.wornOf(V2UI.world(), a.id).map(x => x.slot + ':' + x.item) };
    }, { id, slot, item });
  }
  const stacked = (d, label) => {
    const ids = d.rows.map(r => r.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    ok(d.rows.length > 0 && !dup.length, label + ': one row per piece (' + d.rows.length + ' rows' + (dup.length ? ', dup ' + dup.join() : '') + ')');
    const off = d.rows.filter(r => r.n !== (d.spare[r.id] || 0) && !(d.spare[r.id] == null && r.n === 1));
    ok(!off.length, label + ': every ×N is the spare copies owned' + (off.length ? ' (' + off.map(r => r.text + ' vs ' + d.spare[r.id]).join('; ') + ')' : ''));
  };
  try {
    const desk = await boot(1280, 900);
    const seeded = await desk.page.evaluate(s => (0, eval)('(' + s + ')()'), SEED);
    console.log('fixture', JSON.stringify(seeded));
    ok(seeded && !seeded.error && seeded.made >= 44 && !(seeded.left && seeded.left.length), 'practice spins created the stacked pile (' + (seeded && seeded.made) + ' burns, left ' + JSON.stringify(seeded && seeded.left) + ')');
    ok(seeded && seeded.petId, 'practice keeps one pet, and that pet is the dress target (' + (seeded && seeded.species) + ')');
    await desk.page.reload({ waitUntil: 'domcontentloaded' });
    await desk.page.waitForFunction(() => window.V2UI && window.V2Dress, null, { timeout: 180000 });
    await hush(desk.page);
    /* #dressing-room (old links, the room's mirror) lands on the Closet door, whose gear counts match the world */
    const closet = await desk.page.evaluate(async () => { location.hash = 'dressing-room'; const wait = ms => new Promise(r => setTimeout(r, ms));
      for (let k = 0; k < 240; k++) { const c = document.getElementById('rrCloset'); if (c && /pieces/.test(c.innerText)) break; await wait(500); }
      const c = document.getElementById('rrCloset'), w = V2UI.world(), L = (w.itemList || []).filter(g => g.owner === V2UI.ME);
      return { hash: location.hash, txt: c ? (/([\d,]+) pieces? · ([\d,]+) spare/.exec(c.innerText) || [''])[0] : '', all: L.length, spare: L.filter(g => g.on == null).length }; });
    ok(closet.hash === '#closet' && closet.txt === closet.all + ' pieces · ' + closet.spare + ' spare', 'old #dressing-room link opens the Closet, counts match the world ("' + closet.txt + '", ' + closet.hash + ')');
    const id = seeded.petId;
    const d0 = await drawer(desk.page, id, 'face');
    stacked(d0, 'Guise drawer');
    const pick = d0.rows.filter(r => !d0.worn.includes('face:' + r.id) && r.n >= 2)[0] || d0.rows.filter(r => !d0.worn.includes('face:' + r.id))[0];
    ok(!!pick, 'a spare Guise piece to wear (' + (pick && pick.text) + ')');
    if (pick) {
      const before = d0.spare[pick.id] || 0, wr = await wear(desk.page, id, 'face', pick.id);
      ok(wr.worn && wr.worn.includes('face:' + pick.id), 'Wear puts ' + pick.id + ' on #' + id + (wr.err ? ' (' + wr.err + ')' : ''));
      const d1 = await drawer(desk.page, id, 'face');
      ok((d1.spare[pick.id] || 0) === before - 1, 'wearing uses one copy: spare ' + before + ' -> ' + (d1.spare[pick.id] || 0));
      stacked(d1, 'Guise drawer after Wear');
      ok(new RegExp(pick.text.replace(/ ×\d+.*$/, '').replace(/ [+-]?\d+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(d1.row), 'the Guise row now shows the worn piece ("' + d1.row.slice(0, 80) + '")');
    }
    await desk.page.screenshot({ path: path.join(ART, 'gear-stack-drawer-1280.png') });
    /* phone: same drawer, same stacking, tap Wear works */
    const phone = await boot(390, 844); /* its own browser context, so its own practice ledger: seed it the same way */
    const ps = await phone.page.evaluate(x => (0, eval)('(' + x + ')()'), SEED);
    await phone.page.reload({ waitUntil: 'domcontentloaded' });
    await phone.page.waitForFunction(() => window.V2UI && window.V2Dress, null, { timeout: 180000 });
    await hush(phone.page);
    const pid = ps && ps.petId, pd = await drawer(phone.page, pid, 'head'); if (pd.err) console.log('phone', pd.err);
    stacked(pd, 'phone Headwear drawer');
    const pp = pd.rows.filter(r => !pd.worn.includes('head:' + r.id))[0];
    if (pp) { const pw = await wear(phone.page, pid, 'head', pp.id); ok(pw.worn && pw.worn.includes('head:' + pp.id), 'phone: Wear puts ' + pp.id + ' on #' + pid + (pw.err ? ' (' + pw.err + ')' : '')); }
    else ok(false, 'phone: a spare Headwear piece to wear');
    await phone.page.screenshot({ path: path.join(ART, 'gear-stack-drawer-390.png') });
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
