/* front-v3 (Jake, Nov 23 2026: "New front page: live hatches moving across the screen and one big Hatch your first pet button").
 * DISPLAY ONLY: reads the world the page already loads (V2Mock.world()), never burns, signs or changes a rule.
 * 1. The Hatch-O-Matic: a pixel conveyor at the top of Home. The newest real hatches pop out of the machine on the right and ride
 *    left, each in its own little crate (its real art, tier stripe on top). Until the world arrives it runs the cast, so the first
 *    paint is never empty. Tap a crate to open that pet. The ticker under it names the pet that just came out.
 * 2. The one big button: new visitors get "Hatch your first pet" (the free practice egg); a device that already played gets
 *    "Back to my pets" with "Hatch another" beside it.
 * 3. #cast / #gallery / #token / #how links open the "More about XCPETS" fold. */
(function () {
  'use strict';
  var d = document, w = window, cv = d.getElementById('hatchBelt');
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var $ = function (id) { return d.getElementById(id); };

  /* ---------- 2. the one big button ---------- */
  (function cta() {
    var me = ls('xcpets-v2-me'), go = $('heroHatch'), tx = $('heroHatchTxt'), why = $('heroWhy'), real = $('heroReal');
    if (!go) return;
    if (me) {
      /* Jake Nov 23 2026: "the back to my pets button is too big and should just say play" */
      go.href = 'play.html'; tx.textContent = 'Play'; go.classList.add('fv3-back');
      why.textContent = 'Feed them, hatch more, send them to fight.';
      if (real) { real.href = 'play.html#hatchPanel'; real.textContent = '🥚 Hatch another'; }
    }
    var pk = $('heroPeek'), box = $('peek');
    if (pk && box) pk.addEventListener('click', function (e) { e.preventDefault(); box.open = true; var i = $('avAddr'); if (i) { try { i.focus({ preventScroll: true }); } catch (x) { i.focus(); } box.scrollIntoView({ block: 'center' }); } });
  })();

  /* the phone "Open in Casa Tookan" help (js/casa-connect.js #ccBar) sits under the hero's wallet line instead of above the conveyor */
  (function () { var n = 0, tm = setInterval(function () { var bar = $('ccBar'), alt = $('heroAlt'); if (bar && alt && bar.previousElementSibling !== alt) alt.parentNode.insertBefore(bar, alt.nextSibling); if (++n > 20) clearInterval(tm); }, 500); })();

  /* ---------- 3. hash links open the fold ---------- */
  function unfold() { var h = location.hash.slice(1), more = $('homeMore'); if (!h || !more) return; var t = $(h);
    if (t && more.contains(t)) { more.open = true; setTimeout(function () { t.scrollIntoView({ block: 'start' }); }, 30); } }
  w.addEventListener('hashchange', unfold); unfold();
  d.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href*="#"]'); if (!a) return; var u; try { u = new URL(a.href); } catch (x) { return; }
    if (u.pathname === location.pathname && u.hash === location.hash) unfold(); });

  /* ---------- 1. the Hatch-O-Matic ---------- */
  if (!cv || !cv.getContext) return;
  var W = 320, H = 64, g = cv.getContext('2d'), still = w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  g.imageSmoothingEnabled = false;
  var TIERC = ['#9aa0a6', '#3ddc84', '#4aa8ff', '#ffd23f'], TIERN = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  var MX = 278, GAP = 44, SPEED = 14; /* machine left edge, crate spacing, game px per second */
  var queue = [], qi = 0, riders = [], spark = [], live = false, lastOut = null, t0 = 0, last = 0, raf = 0, vis = true;

  function offFrames(list) { return list.map(function (f) { var c = d.createElement('canvas'); c.width = c.height = 32;
    if (f instanceof HTMLCanvasElement) { c.getContext('2d').drawImage(f, 0, 0); return c; }
    if (w.V2Render && V2Render.paint) { V2Render.paint(c, f); return c; }
    var x = c.getContext('2d'), im = x.createImageData(f.width, f.height); im.data.set(f.data); x.putImageData(im, 0, 0); return c; }); }
  /* placeholder crates: the cast, same art as the game (js/pet-core.js) */
  function castQueue() { var P = w.PetCore, ids = ['pepe', 'doge', 'wojak', 'peepo', 'chud', 'nakamoto', 'bobo', 'lenny'], out = [];
    if (!P || !P.characterPet || !P.render) return out;
    ids.forEach(function (id, k) { try { var tier = ['common', 'uncommon', 'rare', 'legendary'][k % 4], pet = P.characterPet(id, { tier: tier }), fr = [];
      for (var f = 0; f < 4; f++) fr.push(P.render(pet, { stage: 3, frame: f }));
      out.push({ fr: offFrames(fr), tier: k % 4, demo: true }); } catch (e) { } });
    return out; }
  function short(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a; }
  function ago(blocks) { var m = Math.max(0, blocks) * 10; return m < 15 ? 'just now' : m < 90 ? '~' + m + ' min ago' : m < 60 * 36 ? '~' + Math.round(m / 60) + ' h ago' : '~' + Math.round(m / 1440) + ' days ago'; }
  function say(t) { var s = $('hatchTickTxt'); if (s && s.textContent !== t) s.textContent = t; }

  function emit() { if (!queue.length) return; var q = queue[qi % queue.length]; qi++;
    riders.push({ q: q, x: MX - 2, born: performance.now() });
    if (!still) for (var k = 0; k < 12; k++) spark.push({ x: MX - 4, y: 26, vx: -Math.random() * 40, vy: -20 - Math.random() * 30, life: 0.7 });
    lastOut = q; if (q.demo) say('warming up the hatchery…'); }
  function machine(t) {
    /* the Hatch-O-Matic: a purple box, a blinking lamp, a pipe with an egg dropping in */
    g.fillStyle = '#000'; g.fillRect(MX - 1, 4, W - MX + 2, 50);
    g.fillStyle = '#5b2a86'; g.fillRect(MX, 5, W - MX, 48); g.fillStyle = '#7a3fb0'; g.fillRect(MX, 5, W - MX, 6);
    g.fillStyle = '#1a1030'; g.fillRect(MX, 22, 8, 26); /* mouth */
    g.fillStyle = (Math.floor(t * 2) % 2) ? '#ff5a5a' : '#ffd23f'; g.fillRect(MX + 26, 13, 6, 4);
    g.fillStyle = '#3ddc84'; for (var i = 0; i < 3; i++) g.fillRect(MX + 14 + i * 7, 30, 4, 4 - ((Math.floor(t * 4) + i) % 3 === 0 ? 2 : 0));
    g.fillStyle = '#c9c1e6'; g.fillRect(MX + 20, 0, 8, 5);
    var p = (t % 3) / 3, ey = Math.round(-10 + p * 14); g.fillStyle = '#fff6dc'; g.fillRect(MX + 21, ey, 6, 8); g.fillStyle = '#f2c14e'; g.fillRect(MX + 22, ey + 2, 2, 2);
  }
  function belt(t) {
    g.fillStyle = '#000'; g.fillRect(0, 52, W, 12); g.fillStyle = '#2b2440'; g.fillRect(0, 54, W, 8);
    var off = still ? 0 : Math.floor(t * SPEED) % 8; g.fillStyle = '#4a3f6b'; for (var x = -8; x < W; x += 8) g.fillRect(x + off, 56, 4, 2);
    g.fillStyle = '#16121f'; for (var r = 4; r < W; r += 24) { g.fillRect(r, 60, 4, 4); }
  }
  function sky(t) { var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d0a24'); gr.addColorStop(1, '#2a1c4f'); g.fillStyle = gr; g.fillRect(0, 0, W, 54);
    for (var i = 0; i < 26; i++) { var on = still || ((t * 1.5 + i * 0.37) % 3) > 0.5; if (on) { g.fillStyle = i % 5 ? '#cfc6ff' : '#ffd23f'; g.fillRect((i * 53 + 11) % (MX - 4), (i * 17 + 3) % 30, 1, 1); } } }
  function crate(r, t, k) {
    var x = Math.round(r.x - 34), y = 16, bob = still ? 0 : (Math.floor(t * 4 + k) % 2), f = still ? 0 : Math.floor(t * 4 + k) % r.q.fr.length;
    g.fillStyle = '#000'; g.fillRect(x - 1, y - 1 - bob, 36, 38); g.fillStyle = TIERC[r.q.tier]; g.fillRect(x, y - bob, 34, 3);
    g.drawImage(r.q.fr[f], x + 1, y + 3 - bob, 32, 32);
    if (r.q.tier === 3 && !still && (Math.floor(t * 3 + k) % 4 === 0)) { g.fillStyle = '#fff3b0'; g.fillRect(x + 30, y + 4 - bob, 2, 2); g.fillRect(x + 3, y + 30 - bob, 1, 1); }
  }
  function draw(now) {
    var t = (now - t0) / 1000, dt = last ? Math.min(0.2, (now - last) / 1000) : 0; last = now;
    sky(t); belt(t);
    if (!still) riders.forEach(function (r) { r.x -= SPEED * dt; });
    riders = riders.filter(function (r) { return r.x > -2; });
    var right = riders.length ? riders[riders.length - 1].x : -999;
    if (right < MX - GAP) emit();
    riders.forEach(function (r, k) { crate(r, t, k); });
    machine(t);
    spark = spark.filter(function (s) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt; if (s.life > 0) { g.fillStyle = s.life > 0.35 ? '#ffd23f' : '#ff7ad9'; g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2); } return s.life > 0; });
  }
  function loop(now) { raf = 0; if (!vis || d.hidden) return; if (now - last >= 66 || !last) draw(now); raf = requestAnimationFrame(loop); }
  function prefill() { /* a full belt on the first paint */ for (var x = 14; x < MX - GAP + 1; x += GAP) { if (!queue.length) break; var q = queue[qi % queue.length]; qi++; riders.push({ q: q, x: x + 34 }); lastOut = q; } }
  function start() { var cw = cv.clientWidth || 320; W = cw < 520 ? 200 : cw < 900 ? 260 : 320; MX = W - 42; cv.width = W; g.imageSmoothingEnabled = false; queue = castQueue(); if (!queue.length) return; prefill(); t0 = performance.now(); draw(t0);
    if (still) return;
    if (w.IntersectionObserver) new IntersectionObserver(function (es) { vis = es[es.length - 1].isIntersecting; if (vis && !raf) { last = 0; raf = requestAnimationFrame(loop); } }).observe(cv);
    d.addEventListener('visibilitychange', function () { if (!d.hidden && vis && !raf) { last = 0; raf = requestAnimationFrame(loop); } });
    raf = requestAnimationFrame(loop); }
  /* LIVE (Jake Nov 23 2026: "the live hatches dont seem live"). The fast world only holds the viewer's own pets, so the newest pets of
   * the whole game come from the published pet shards (view/p/NNNNN.json, 2,000 ids each): the burn rows the page already reads name
   * recent pet ids (pet:feed:205414 ...), so the shard with the newest ids is the one holding that id or the next. Hatch burns on the
   * chain (and in the mempool) that are newer than the newest pet shown ride in as cracking eggs, so a hatch shows up within a block.
   * Every item says how long ago it happened; nothing old is called live. Refreshes every 2 minutes. */
  var shown = {}, newestBlock = 0, folderP = null, lastShard = 0;
  function tipNow() { var t = 0; try { t = (w.V2Mock && V2Mock.state && V2Mock.state().tip) || 0; } catch (e) { } try { t = Math.max(t, (w.V2Split && V2Split.healthTip && V2Split.healthTip()) || 0); } catch (e) { } return t; }
  function tagOf(r) { var h = String(r && r.tag || ''), o = ''; if (!/^[0-9a-f]+$/i.test(h) || h.length % 2) return h; for (var i = 0; i < h.length; i += 2) o += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return o; }
  function rows() { try { var S = V2Mock.state(); return { chain: S.rows || [], pool: S.mempool || [] }; } catch (e) { return { chain: [], pool: [] }; } }
  function eggCrate() { var c = d.createElement('canvas'); c.width = c.height = 32; var x = c.getContext('2d'), E = ['....XXXX....', '..XXWWWWXX..', '.XWWWWWWWWX.', '.XWWSWWWWSX.', 'XWWWWWWWWWWX', 'XWWWWWWWWWWX', 'XKWKWWWKWWWX', 'XWKWKWKWKWKX', 'XWWWWKWWWKWX', 'XWSWWWWWWWWX', '.XWWWWWWWSX.', '.XWWWWWWWWX.', '..XXWWWWXX..', '....XXXX....'], col = { X: '#000', W: '#fff6dc', S: '#f2c14e', K: '#2b2b2b' };
    x.fillStyle = '#241a3d'; x.fillRect(0, 0, 32, 32); E.forEach(function (row, y) { for (var i = 0; i < 12; i++) if (col[row[i]]) { x.fillStyle = col[row[i]]; x.fillRect(4 + i * 2, 2 + y * 2, 2, 2); } }); return c; }
  var EGG = null;
  function hatchBurns() { var R = rows(), out = [];
    function take(r, pend) { var t = tagOf(r), m = /^pet:hatch(\d*|zap)$/.exec(t); if (!m) return; var n = m[1] === 'zap' ? 1 : (+m[1] || 1);
      out.push({ tx: r.tx_hash, block: pend ? 0 : (r.block_index | 0), src: r.source, n: n, zap: m[1] === 'zap', pend: pend }); }
    R.pool.forEach(function (r) { take(r, true); }); for (var i = 0; i < R.chain.length && out.length < 40; i++) take(R.chain[i], false);
    return out; }
  function agoTxt(block, tip) { if (!block) return 'hatching now (waiting for a block)'; return 'hatched ' + ago(Math.max(0, tip - block)) + ' · block ' + block.toLocaleString('en-US'); }
  function eggItem(b, tip) { EGG = EGG || [eggCrate()]; return { fr: EGG, tier: 3, egg: true, key: 'tx' + b.tx, block: b.block || tip + 1,
    line: '🥚 ' + short(b.src) + ' ' + (b.zap ? 'cracked a ⚡ zap egg' : b.n > 1 ? 'hatched ' + b.n + ' eggs' : 'hatched an egg') + ' · ' + (b.block ? agoTxt(b.block, tip).replace(/^hatched /, '') : 'waiting for a block') }; }
  function petItem(p, wd, tip) { var V = w.V2Rules || {}, sp = V.petSpeciesLabel ? V.petSpeciesLabel(p) : p.species;
    if (/^hyb/.test(String(p.species))) sp = String(p.species).split(':').slice(1).map(function (x) { return V.speciesLabel ? V.speciesLabel(x) : x; }).join(' × ');
    var t = Math.max(0, Math.min(3, p.tier | 0));
    return { fr: offFrames(V2Render.petFrames(p, wd)), tier: t, id: p.id, key: 'p' + p.id, block: p.hatchBlock | 0,
      line: '#' + Number(p.id).toLocaleString('en-US') + (p.name ? ' ' + p.name : '') + ' · ' + TIERN[t] + ' ' + sp + ' · ' + agoTxt(p.hatchBlock | 0, tip) + (p.owner ? ' · ' + short(p.owner) : '') }; }
  function folder() { if (folderP) return folderP; var B = w.V2BootSync, root = B && B.base && B.base(); if (!root || !w.fetch) return Promise.resolve('');
    folderP = fetch(root + '/xp/v1/world/latest.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (l) {
      var u = l && (l.manifest || l.url); if (!u) return ''; u = /^https?:/.test(u) ? u : root + u; return u.slice(0, u.lastIndexOf('/') + 1); }, function () { return ''; });
    setTimeout(function () { folderP = null; }, 10 * 60e3); return folderP; }
  function refId() { var R = rows(), best = 0; R.chain.slice(0, 400).concat(R.pool).forEach(function (r) { var m = /^pet:[a-z]+:(\d{3,7})\b/.exec(tagOf(r)); if (m) best = Math.max(best, +m[1]); }); return best; }
  /* the newest ids in the shards, then V2Split.ensurePet for each (it decodes art and owners; the shard comes from the HTTP cache) */
  function newestPets() { var ref = refId(); if (!ref || !w.V2Split || !V2Split.ensurePet) return Promise.resolve([]);
    return folder().then(function (f) { if (!f) return [];
      var s0 = Math.max(lastShard, Math.floor(ref / 2000)), names = [s0, s0 + 1].map(function (s) { return ('00000' + s).slice(-5); });
      return Promise.all(names.map(function (nm) { return fetch(f + 'view/p/' + nm + '.json').then(function (r) { return r.ok ? r.json() : null; }, function () { return null; }); })).then(function (packs) {
        var recs = []; packs.forEach(function (pk, k) { if (pk && pk.pets) { lastShard = Math.max(lastShard, s0 + k); Object.keys(pk.pets).forEach(function (id) { var r = pk.pets[id]; if (r && r.hatchBlock != null && !r.released) recs.push(r); }); } });
        recs.sort(function (a, b) { return (b.hatchBlock - a.hatchBlock) || (b.id - a.id); }); recs = recs.slice(0, 16);
        var out = [], chain = Promise.resolve();
        recs.forEach(function (r) { chain = chain.then(function () { return V2Split.ensurePet(r.id).then(function (p) { if (p) out.push(p); }, function () { }); }); });
        return chain.then(function () { return out; }); }); }); }
  function fullWorldPets(wd) { var ps = wd && wd.pets; if (!ps || ps.length < 50000) return []; var best = [];
    for (var i = 0; i < ps.length; i++) { var p = ps[i]; if (!p || p.hatchBlock == null || p.released) continue; if (best.length < 16 || cmp(p, best[best.length - 1]) < 0) { best.push(p); best.sort(cmp); if (best.length > 16) best.pop(); } }
    return best; function cmp(a, b) { return (b.hatchBlock - a.hatchBlock) || (b.id - a.id); } }
  var refreshing = false;
  function refresh() { if (refreshing || !w.V2Render || !V2Render.petFrames) return; var M = w.V2Mock, wd = null; try { wd = M && M.world && M.world(); } catch (e) { } if (!wd) return;
    refreshing = true; var full = fullWorldPets(wd);
    (full.length ? Promise.resolve(full) : newestPets()).then(function (pets) {
      var tip = tipNow(), items = [];
      pets.forEach(function (p) { try { items.push(petItem(p, wd, tip)); } catch (e) { } });
      var top = items.reduce(function (m, it) { return Math.max(m, it.block); }, 0);
      /* hatch burns newer than the newest pet shown (or all of them, when no pet art could be read) ride in as eggs */
      hatchBurns().forEach(function (b) { if (!b.block || b.block > top || !items.length) items.push(eggItem(b, tip)); });
      items.sort(function (a, b) { return b.block - a.block; }); /* newest first: it comes out of the machine next and the ticker names it */
      if (!items.length) return;
      items = items.slice(0, 16);
      var fresh = items.filter(function (it) { return !shown[it.key]; });
      if (!live) { live = true; queue = items; qi = 0; riders = riders.filter(function (r) { return r.x < MX - GAP * 2; }); }
      else if (fresh.length) { queue = items; qi = 0; }
      items.forEach(function (it) { shown[it.key] = 1; });
      newestBlock = items[0].block;
      say(items[0].line); /* the ticker always names the newest hatch, not whichever crate is passing */
      if (fresh.length && fresh.length < items.length) { var tk = $('hatchTick'); if (tk) { tk.classList.remove('fv3-new'); void tk.offsetWidth; tk.classList.add('fv3-new'); } }
      var old = tip && newestBlock && tip - newestBlock > 144; /* nothing in the last day: say so, don't call it live */
      var lb = d.querySelector('#hatchTick b'); if (lb) lb.textContent = old ? 'LATEST HATCHES' : 'LIVE HATCHES';
      d.documentElement.classList.toggle('fv3-quiet', !!old);
      if (still) { riders = []; prefill(); draw(performance.now()); }
    }).then(function () { refreshing = false; }, function () { refreshing = false; }); }
  function goLive() { refresh(); return live; }
  cv.addEventListener('click', function (e) { var r = cv.getBoundingClientRect(), gx = (e.clientX - r.left) * W / r.width, hit = null;
    riders.forEach(function (x) { if (gx >= x.x - 35 && gx <= x.x) hit = x; }); if (hit && hit.q.id) location.href = 'pet.html?id=' + hit.q.id; else if (gx >= MX) location.href = $('heroHatch').href; });
  cv.style.cursor = 'pointer';
  function boot() { start(); var n = 0, tm = setInterval(function () { if (goLive() || ++n > 400) { clearInterval(tm); setInterval(refresh, 120000); } }, 3000); }
  if (w.PetCore) boot(); else w.addEventListener('load', boot);
  w.V2FrontHero = { live: function () { return live; }, refresh: refresh };
})();
