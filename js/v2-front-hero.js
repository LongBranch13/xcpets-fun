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
      go.href = 'play.html#petsPanel'; tx.textContent = 'Back to my pets'; go.classList.add('fv3-back');
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
  function liveQueue(wd) {
    var ps = wd && wd.pets; if (!ps || !ps.length || !w.V2Render || !V2Render.petFrames) return null;
    var best = []; /* top 24 by hatch block without sorting 160k pets */
    for (var i = 0; i < ps.length; i++) { var p = ps[i]; if (!p || p.hatchBlock == null || p.dead) continue;
      if (best.length < 24) { best.push(p); if (best.length === 24) best.sort(cmp); continue; }
      if (cmp(p, best[23]) < 0) { best[23] = p; best.sort(cmp); } }
    best.sort(cmp);
    var V = w.V2Rules || {}, out = [];
    best.reverse().forEach(function (p) { try { var sp = V.speciesLabel ? V.speciesLabel(p.species) : p.species;
      if (/^hyb/.test(String(p.species))) sp = String(p.species).split(':').slice(1).map(function (x) { return V.speciesLabel ? V.speciesLabel(x) : x; }).join(' × ');
      out.push({ fr: offFrames(V2Render.petFrames(p, wd)), tier: Math.max(0, Math.min(3, p.tier | 0)), id: p.id,
        line: '#' + Number(p.id).toLocaleString('en-US') + (p.name ? ' ' + p.name : '') + ' · ' + TIERN[Math.max(0, Math.min(3, p.tier | 0))] + ' ' + sp + ' · hatched ' + ago((wd.tip || p.hatchBlock) - p.hatchBlock) + ' by ' + short(p.owner) }); } catch (e) { } });
    return out.length ? out : null;
    function cmp(a, b) { return (b.hatchBlock - a.hatchBlock) || (b.id - a.id); }
  }
  function say(t) { var s = $('hatchTickTxt'); if (s && s.textContent !== t) s.textContent = t; }

  function emit() { if (!queue.length) return; var q = queue[qi % queue.length]; qi++;
    riders.push({ q: q, x: MX - 2, born: performance.now() });
    if (!still) for (var k = 0; k < 12; k++) spark.push({ x: MX - 4, y: 26, vx: -Math.random() * 40, vy: -20 - Math.random() * 30, life: 0.7 });
    lastOut = q; say(q.demo ? 'warming up the hatchery…' : q.line); }
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
  function goLive() { if (live) return true; var M = w.V2Mock, wd = null; try { wd = M && M.world && M.world(); } catch (e) { }
    var q = liveQueue(wd); if (!q) return false; live = true; queue = q; qi = 0; riders = riders.filter(function (r) { return r.x < MX - GAP * 2; });
    if (still) { riders = []; prefill(); draw(performance.now()); say(lastOut.line); } return true; }
  cv.addEventListener('click', function (e) { var r = cv.getBoundingClientRect(), gx = (e.clientX - r.left) * W / r.width, hit = null;
    riders.forEach(function (x) { if (gx >= x.x - 35 && gx <= x.x) hit = x; }); if (hit && hit.q.id) location.href = 'pet.html?id=' + hit.q.id; else if (gx >= MX) location.href = $('heroHatch').href; });
  cv.style.cursor = 'pointer';
  function boot() { start(); var n = 0, tm = setInterval(function () { if (goLive() || ++n > 400) clearInterval(tm); }, 1500); }
  if (w.PetCore) boot(); else w.addEventListener('load', boot);
  w.V2FrontHero = { live: function () { return live; } };
})();
