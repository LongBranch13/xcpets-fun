/* XCPETS watch mode (watch.html): a shareable, read-only live view for spectators. Owner Nov 1 2026 7:42 PM CT [pt2615u] "Do spectators link".
 * DISPLAY ONLY. No wallet, no burns, no sign sheet. It reads the replayed world after V2Mock.boot and the same event list as the Live Feed
 * (V2Live.events in js/v2-live.js), and never touches rules, tags, costs or the replay.
 *  - the stage: the newest animated events play one after another on one inline 128x80 pixel canvas (V2LifeAnim / V2CemAnim .paint, whole-pixel
 *    scale); new events from a fresh block go to the front of the queue. Reduced motion shows each event's key frame, no movement.
 *  - the ticker: the latest events with the pet's sprite (crowns, frames, fire, flames and auras filtered out, as on the Live Feed).
 *  - ?addr=<bitcoin address>: that player's pets, and only the events about them. A copy-link button shares the exact view.
 * Block times come from Counterparty Core (api.counterparty.io:4000, then api.unspendablelabs.com:4000), shared with the Live Feed's cache. */
(function (root) {
  'use strict';
  var M = root.V2Mock, R = root.V2Render, V = root.V2Rules, L = root.V2Live, d = document, $ = function (id) { return d.getElementById(id); };
  if (!M || !R || !V || !L || !$('wtStage')) return;
  var NOPE = /crown|frame|fire|flame|aura/i, QMAX = 14, TICK = 30, HOLD = 14, CORE = ['https://api.counterparty.io:4000/v2', 'https://api.unspendablelabs.com:4000/v2'];
  var BUILD = (function () { try { var m = /[?&]v=([0-9a-f]{6,})/.exec((d.currentScript && d.currentScript.src) || ''); return m ? m[1] : ''; } catch (e) { return ''; } })();
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function reduced() { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  /* ---- the address in the link ---- */
  var ADDR_RE = /^(bc1[02-9ac-hj-np-z]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,39}|tb1[02-9ac-hj-np-z]{11,87}|[mn2][1-9A-HJ-NP-Za-km-z]{25,39})$/i;
  function readAddr() { try { var a = (new URLSearchParams(location.search).get('addr') || '').trim(); return ADDR_RE.test(a) ? a : ''; } catch (e) { return ''; } }
  var ADDR = readAddr();
  function short(a) { return a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-6) : a; }
  /* ---- block times (CT), the Live Feed's cache ---- */
  var BT_KEY = 'xcpets-live-bt', BT = (function () { try { return JSON.parse(localStorage.getItem(BT_KEY)) || {}; } catch (e) { return {}; } })(), btAsk = {};
  function getJson(path) { var i = 0; return new Promise(function (res, rej) { (function next() { if (i >= CORE.length) return rej(new Error('core')); var u = CORE[i++] + path, ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = setTimeout(function () { if (ac) ac.abort(); }, 8000);
      fetch(u, ac ? { signal: ac.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).then(res, function () { clearTimeout(t); next(); }); })(); }); }
  function needTime(b) { if (BT[b] || btAsk[b]) return; btAsk[b] = 1; getJson('/blocks/' + b).then(function (j) { var t = j && j.result && j.result.block_time; if (!t) return; BT[b] = t;
      try { var o = JSON.parse(localStorage.getItem(BT_KEY)) || {}; o[b] = t; localStorage.setItem(BT_KEY, JSON.stringify(o)); } catch (e) {} paintTimes(); }, function () {}); }
  function nearest(b) { var best = null, bd = 1e9; for (var k in BT) { var x = Math.abs(k - b); if (x < bd) { bd = x; best = +k; } } return best; }
  function timeOf(b) { if (BT[b]) return { t: BT[b], est: false }; var n = nearest(b); return n == null ? null : { t: BT[n] + (b - n) * 600, est: true }; }
  var CT = (function () { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return null; } })();
  function timeTxt(b) { var x = timeOf(b); if (!x) return ''; var t = new Date(x.t * 1000); return (x.est ? '~' : '') + (CT ? CT.format(t) : t.toISOString().slice(0, 16).replace('T', ' ')) + ' CT'; }
  function paintTimes() { Array.prototype.forEach.call(d.querySelectorAll('.wt-time[data-b]'), function (el) { el.textContent = timeTxt(+el.getAttribute('data-b')); }); }
  /* ---- sprites ---- */
  var W = null, EV = [], MINE = null, seen = {}, firstBuild = true;
  function frames(p) { var ids = []; try { ids = (R.worn(W, p.id) || []).map(function (g) { return g.item; }).filter(function (it) { return it && !NOPE.test(it); }); } catch (e) {}
    try { var f = R.framesWith(p.art, p.stage, ids, []); if (f && f.length && f[0] && f[0].data) return f; } catch (e) {} return R.petFrames(p, W); }
  function thumbs(box, still) { Array.prototype.forEach.call(box.querySelectorAll('canvas[data-id]:not([data-done])'), function (c) { var p = W.byId[c.getAttribute('data-id')]; c.setAttribute('data-done', '1'); if (!p || !p.art) return; R.lazy(c, function () { return frames(p); }, still); }); }
  function nm(id) { var p = W.byId[id]; return '#' + id + (p && p.name ? ' ' + p.name : ''); }
  function line(e, links) { return e.t.map(function (x) { return typeof x === 'string' ? esc(x) : x && x.pet != null ? (links ? '<a href="pet.html?id=' + x.pet + '">' + esc(nm(x.pet)) + '</a>' : esc(nm(x.pet))) : ''; }).join(''); }
  function key(e) { return e.tx + ':' + e.cat + ':' + e.pet; }
  function petsOf(e) { var o = []; if (e.pet != null) o.push(+e.pet); (e.ids || []).forEach(function (i) { o.push(+i); }); e.t.forEach(function (x) { if (x && x.pet != null) o.push(+x.pet); }); return o; }
  function mineEv(e) { if (!MINE) return true; return petsOf(e).some(function (i) { return MINE[i]; }); }
  /* ---- build the world view ---- */
  function build() { var w = M.world(); if (!w || !w.pets) return false; if (W && w === W && EV.length) return false; W = w;
    MINE = null; if (ADDR) { MINE = {}; var A = ADDR.toLowerCase(); w.pets.forEach(function (p) { if (p && !p.released && String(p.owner || '').toLowerCase() === A) MINE[p.id] = 1; }); }
    var all = L.events(w, V).filter(mineEv), fresh = [];
    if (!firstBuild) all.forEach(function (e) { if (!seen[key(e)]) fresh.push(e); }); all.forEach(function (e) { seen[key(e)] = 1; });
    EV = all; stageQueue(fresh); firstBuild = false; return true; }
  /* ---- the stage ---- */
  var animP = null, Q = [], cur = null, f = 0, hold = 0, paused = false, raf = 0, last = 0, vis = true, k = 4;
  function loadAnims() { if (animP) return animP; var S = ['js/v2-life-anim.js', 'js/v2-cem-anim.js', 'js/v2-mg-anim.js'];
    animP = S.reduce(function (p, src) { return p.then(function () { return new Promise(function (res) { var t = d.createElement('script'); t.src = src + (BUILD ? '?v=' + BUILD : ''); t.async = false; t.onload = res; t.onerror = res; d.body.appendChild(t); }); }); }, Promise.resolve()); return animP; }
  function lib(e) { return e.anim.lib === 'cem' ? root.V2CemAnim : root.V2LifeAnim; }
  function len(e) { var A = lib(e); return (A && A.LEN && A.LEN[e.anim.ev.kind]) || 48; }
  function keyF(e) { var A = lib(e); return Math.min(len(e) - 1, (A && A.KEY_F && A.KEY_F[e.anim.ev.kind]) || len(e) - 1); }
  function stageQueue(fresh) { var base = EV.filter(function (e) { return e.anim; }).slice(0, QMAX);
    if (!Q.length) { Q = base.slice(); return; }
    var nf = fresh.filter(function (e) { return e.anim; }); if (!nf.length) return; /* new events jump the queue, newest first */
    Q = nf.concat(Q.filter(function (e) { return nf.indexOf(e) < 0; })).slice(0, QMAX + nf.length); nf.forEach(function (e) { e.wtNew = 1; }); }
  function fit() { var c = $('wtStage'), box = c.parentNode, avail = Math.max(128, Math.min(box.clientWidth || 512, 768)); k = Math.max(1, Math.floor(avail / 128));
    if (c.width !== 128 * k) { c.width = 128 * k; c.height = 80 * k; } c.style.width = 128 * k + 'px'; c.style.height = 80 * k + 'px'; }
  function paintNow() { var c = $('wtStage'); if (!cur) return; var A = lib(cur); if (!A || !A.paint) return;
    try { A.paint(c, Object.assign({ block: cur.block }, cur.anim.ev), reduced() ? keyF(cur) : Math.min(f, len(cur) - 1), W); } catch (x) { if (root.console) console.warn('[watch] paint', x); next(); } }
  function caption() { var el = $('wtCap'); if (!el || !cur) return; var i = Q.indexOf(cur);
    el.innerHTML = '<span class="wt-ico" aria-hidden="true">' + cur.icon + '</span> ' + line(cur, true) + (cur.wtNew ? ' <span class="wt-new">NEW</span>' : '') +
      '<span class="wt-capmeta"><span class="wt-time" data-b="' + cur.block + '">' + esc(timeTxt(cur.block)) + '</span> · block ' + fmt(cur.block) + ' · ' + (i + 1) + ' of ' + Q.length + '</span>'; needTime(cur.block); }
  function show(e) { cur = e; f = 0; hold = 0; caption(); paintNow(); }
  function next(step) { if (!Q.length) { cur = null; idle(); return; } var i = cur ? Q.indexOf(cur) : -1; i = (i + (step || 1) + Q.length) % Q.length; show(Q[i]); }
  function idle() { var c = $('wtStage'), g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#141233'; g.fillRect(0, 0, c.width, c.height);
    var cap = $('wtCap'); if (cap) cap.textContent = ADDR ? 'Nothing animated about this player\u2019s pets in the last ' + Math.round(L.WINDOW / 144) + ' days yet. New events show up here as they land.' : 'Waiting for the next event…'; }
  var RED_MS = 4000, redT = 0;
  function loop(ts) { raf = 0; if (!vis || d.hidden) return; raf = requestAnimationFrame(loop); if (paused || !cur) return;
    if (reduced()) { if (!redT) redT = ts; if (ts - redT > RED_MS) { redT = ts; next(); } return; }
    if (ts - last < 100) return; last = ts; /* 10 frames a second, the animations' own speed */
    if (f < len(cur) - 1) { f++; paintNow(); } else if (++hold > HOLD) next(); }
  function kick() { if (!raf && vis && !d.hidden) raf = requestAnimationFrame(loop); }
  function setPaused(p) { paused = p; var b = $('wtPause'); b.textContent = p ? '▶ Play' : '⏸ Pause'; b.setAttribute('aria-pressed', p ? 'true' : 'false'); kick(); }
  /* ---- ticker, pets, status ---- */
  var CAT = { birth: 'Birth', feed: 'Feed', stage: 'Stage-up', mythic: 'Mythic', death: 'Death', god: 'God', gear: 'Gear', other: 'Game' };
  function ticker() { var box = $('wtList'); if (!box) return; var vis2 = EV.slice(0, TICK);
    box.innerHTML = vis2.length ? vis2.map(function (e) { var p = e.pet != null && W.byId[e.pet];
      return '<li class="wt-row lv-' + e.cat + (e.hot ? ' wt-hot' : '') + '"><span class="wt-th">' + (p && p.art ? '<canvas class="wt-cv' + (e.dead || (p.dead && !p.zombie) ? ' wt-dead' : '') + '" width="32" height="32" data-id="' + p.id + '" aria-hidden="true"></canvas>' : '<span aria-hidden="true">' + e.icon + '</span>') + '</span>' +
        '<span class="wt-body"><span><span aria-hidden="true">' + e.icon + '</span> ' + line(e, true) + '</span><span class="wt-meta"><span class="wt-time" data-b="' + e.block + '">' + esc(timeTxt(e.block)) + '</span> · block ' + fmt(e.block) + ' · ' + CAT[e.cat] + '</span></span></li>'; }).join('')
      : '<li class="wt-empty muted">' + (ADDR ? 'No events about this player\u2019s pets in the last ' + Math.round(L.WINDOW / 144) + ' days.' : 'Nothing in the last ' + Math.round(L.WINDOW / 144) + ' days.') + '</li>';
    var bs = {}; vis2.forEach(function (e) { bs[e.block] = 1; }); Object.keys(bs).slice(0, 12).forEach(function (b) { needTime(+b); }); thumbs(box, true); }
  function petsPanel() { var sec = $('wtPets'); if (!sec) return; if (!ADDR) { sec.hidden = true; return; } sec.hidden = false;
    var L2 = W.pets.filter(function (p) { return p && MINE[p.id]; }), alive = L2.filter(function (p) { return !p.dead || p.zombie; });
    L2.sort(function (a, b) { return ((a.dead && !a.zombie) ? 1 : 0) - ((b.dead && !b.zombie) ? 1 : 0) || (b.stage | 0) - (a.stage | 0) || (b.tier | 0) - (a.tier | 0) || a.id - b.id; });
    $('wtPetsH').textContent = 'Pets of ' + short(ADDR) + ': ' + fmt(L2.length) + (L2.length === 1 ? ' pet' : ' pets') + ' (' + fmt(alive.length) + ' alive)';
    var SN = V.STAGE_NAMES || [], SHOW = 60;
    $('wtGrid').innerHTML = L2.length ? L2.slice(0, SHOW).map(function (p) { var dead = p.dead && !p.zombie;
      return '<a class="wt-pet' + (dead ? ' wt-dead' : '') + '" href="pet.html?id=' + p.id + '"><canvas width="32" height="32" data-id="' + p.id + '" aria-hidden="true"></canvas><span class="wt-pn">#' + p.id + (p.name ? ' ' + esc(p.name) : '') + '</span><span class="wt-ps">' + esc((p.zombie ? 'Zombie' : dead ? 'Dead' : SN[p.stage] || '') + ' · ' + (V.speciesLabel ? V.speciesLabel(p.species) : p.species)) + '</span></a>'; }).join('') + (L2.length > SHOW ? '<p class="small muted">and ' + fmt(L2.length - SHOW) + ' more on <a href="play.html?addr=' + encodeURIComponent(ADDR) + '">the full list</a>.</p>' : '')
      : '<p class="muted">No pets for this address yet. Check the address, or this player has not hatched one.</p>';
    thumbs($('wtGrid'), false); }
  function status() { var el = $('wtStatus'); if (!el || !W) return; var beh = M.behind ? M.behind() : 0, live = W.pets.filter(function (p) { return p && !p.dead && !p.released && !p.community; }).length;
    el.innerHTML = '<span class="lv-dot" aria-hidden="true"></span> Block <b>' + fmt(W.tip) + '</b>' + (timeTxt(W.tip) ? ' (<span class="wt-time" data-b="' + W.tip + '">' + esc(timeTxt(W.tip)) + '</span>)' : '') + ' · <b>' + fmt(live) + '</b> pets alive' + (beh ? ' · catching up ' + fmt(beh) + ' block' + (beh === 1 ? '' : 's') : '') + ' · new blocks checked every minute'; needTime(W.tip); }
  function refresh() { try { var ch = build(); if (ch) { ticker(); petsPanel(); if (!cur || (Q.length && Q[0].wtNew && cur !== Q[0])) loadAnims().then(function () { if (Q.length) show(Q[0]); else idle(); kick(); }); } status(); } catch (e) { if (root.console) console.warn('[watch] refresh', e); } }
  /* ---- the share bar ---- */
  function shareUrl() { return 'https://xcpets.fun/watch.html' + (ADDR ? '?addr=' + encodeURIComponent(ADDR) : ''); }
  function setAddr(a) { ADDR = a; try { history.replaceState(null, '', location.pathname + (a ? '?addr=' + encodeURIComponent(a) : '')); } catch (e) {}
    $('wtWho').textContent = a ? 'Watching ' + short(a) + '\u2019s pets' : 'Watching everyone'; $('wtAll').hidden = !a; $('wtLink').value = shareUrl();
    W = null; EV = []; Q = []; cur = null; seen = {}; firstBuild = true; refresh(); }
  function wire() { $('wtPause').onclick = function () { setPaused(!paused); }; $('wtNext').onclick = function () { next(1); kick(); }; $('wtPrev').onclick = function () { next(-1); kick(); };
    $('wtForm').addEventListener('submit', function (ev) { ev.preventDefault(); var a = $('wtAddr').value.trim(), er = $('wtErr');
      if (a && !ADDR_RE.test(a)) { er.textContent = 'That does not look like a Bitcoin address (bc1…, 1… or 3…).'; return; } er.textContent = ''; setAddr(a); });
    $('wtAll').onclick = function () { $('wtAddr').value = ''; setAddr(''); };
    $('wtCopy').onclick = function () { var u = shareUrl(), b = $('wtCopy'), done = function () { b.textContent = '✓ Copied'; setTimeout(function () { b.textContent = '🔗 Copy link'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { $('wtLink').select(); }); else { $('wtLink').select(); try { d.execCommand('copy'); done(); } catch (e) {} } };
    if (root.IntersectionObserver) new IntersectionObserver(function (es) { vis = es[es.length - 1].isIntersecting; kick(); }).observe($('wtStage'));
    d.addEventListener('visibilitychange', kick); root.addEventListener('resize', function () { fit(); paintNow(); }); }
  function start() { fit(); wire(); $('wtAddr').value = ADDR; $('wtWho').textContent = ADDR ? 'Watching ' + short(ADDR) + '\u2019s pets' : 'Watching everyone'; $('wtAll').hidden = !ADDR; $('wtLink').value = shareUrl();
    if (reduced()) { $('wtPause').hidden = true; $('wtMotion').hidden = false; }
    refresh(); setInterval(paintTimes, 60e3); if (M.onFresh) M.onFresh(refresh);
    setInterval(function () { if (d.hidden) return; try { M.refresh(refresh); } catch (e) {} }, 60e3); }
  root.V2Watch = { refresh: refresh, queue: function () { return Q; }, current: function () { return cur; } };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window);
