/* XCPETS Daily chores (PLAN item 8, branch chores-audit-1101, PREVIEW ONLY until the gate is set at deploy).
 * One burn `pet:dc:F[:AA:RUNS]` = WAGMI check-in + feed every pet that eats (never a discarded one) + use all saved spins, in that order.
 * This file is UI only: a "🧹 Daily chores" button under the WAGMI bar, a sign sheet that lists every part, and a
 * pixel animation when your chores burn confirms. The rule lives in js/v2-rules.js (case 'chores', ACTIVATE_DAILY_CHORES_BLOCK).
 * While the gate is null the button stays hidden (?chores=preview shows a disabled preview for screenshots). The site never signs. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, U = function () { return window.V2UI; }, V = function () { return window.V2Rules; };
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var PREVIEW = /[?&]chores=preview/.test(location.search);
  var fmt = function (n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); };
  var dander = function (a) { return Math.round(Number(a) * 1e8); };
  function css() { if ($('dcCss')) return; var s = document.createElement('style'); s.id = 'dcCss'; s.textContent =
    '.dc-row{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;margin:6px auto 2px;max-width:640px}' +
    '.dc-btn{font:inherit;font-weight:700;padding:8px 14px;border-radius:10px;border:2px solid #2b2b2b;background:#ffe27a;color:#2b2b2b;cursor:pointer;box-shadow:0 3px 0 #2b2b2b}' +
    '.dc-btn[disabled]{opacity:.55;cursor:default}.dc-note{font-size:12px;opacity:.8}' +
    '.dc-anim{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:9999;pointer-events:none;display:flex;gap:18px;padding:14px 18px;background:#1d1d2b;border:3px solid #ffe27a;border-radius:6px;image-rendering:pixelated;font:700 14px/1.2 monospace;color:#fff}' +
    '.dc-step{display:flex;flex-direction:column;align-items:center;gap:6px;opacity:.25;transform:scale(.8)}' +
    '.dc-step.on{opacity:1;transform:scale(1);animation:dcPop .35s steps(4) both}.dc-step.skip{opacity:.35;filter:grayscale(1)}' +
    '.dc-px{width:40px;height:40px;background-size:100% 100%;image-rendering:pixelated}' +
    '@keyframes dcPop{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}' +
    '.dc-broom{position:absolute;bottom:-14px;left:0;width:24px;height:24px;animation:dcSweep 1.6s steps(8) infinite}' +
    '@keyframes dcSweep{0%{left:0}50%{left:calc(100% - 24px)}100%{left:0}}' +
    '@media (prefers-reduced-motion:reduce){.dc-step.on,.dc-broom{animation:none}}';
    document.head.appendChild(s); }
  /* tiny pixel sprites (8x8, drawn to a data URL once) */
  var SPR = { wagmi: ['..yyyy..', '.yyyyyy.', 'yy.yy.yy', 'yyyyyyyy', 'yy....yy', 'yyy..yyy', '.yyyyyy.', '..yyyy..'],
    feed: ['......w.', '.....ww.', '..rrrw..', '.rrrrr..', 'rrrrrr..', 'rrrrr...', '.rrr....', '........'],
    spins: ['..pppp..', '.pggppp.', 'pggggppp', 'pggwwppp', 'pppwwggp', 'pppggggp', '.pppggp.', '..pppp..'],
    broom: ['......b.', '.....b..', '....b...', '...b....', '.yyy....', 'yyyy....', 'yyy.....', 'y.y.....'] };
  var COL = { y: '#ffd23f', w: '#f4f4f4', r: '#d8452f', p: '#7a4cd8', g: '#3fd27a', b: '#8a5a2b' }, URL = {};
  function px(k) { if (URL[k]) return URL[k]; var c = document.createElement('canvas'); c.width = c.height = 8; var x = c.getContext('2d');
    SPR[k].forEach(function (row, y) { row.split('').forEach(function (ch, i) { if (COL[ch]) { x.fillStyle = COL[ch]; x.fillRect(i, y, 1, 1); } }); }); return (URL[k] = c.toDataURL()); }
  /* the animation: three pixel steps light up in order (WAGMI → feed → spins); a skipped part stays grey; a broom sweeps under them */
  function play(ev) { css(); var parts = (ev && ev.parts) || [], done = function (k) { var p = parts.filter(function (x) { return x.part === k; })[0]; return p ? (p.done ? 'on' : 'skip') : 'skip'; };
    var el = document.createElement('div'); el.className = 'dc-anim'; el.setAttribute('role', 'status');
    el.innerHTML = [['wagmi', 'WAGMI'], ['feed', 'Fed' + (ev && ev.petIds ? ' ' + ev.petIds.length : '')], ['spins', 'Spins']].map(function (s) {
      return '<div class="dc-step" data-k="' + s[0] + '"><div class="dc-px" style="background-image:url(' + px(s[0]) + ')"></div><span>' + s[1] + '</span></div>'; }).join('') +
      '<div class="dc-broom dc-px" style="background-image:url(' + px('broom') + ')"></div>';
    document.body.appendChild(el); var steps = el.querySelectorAll('.dc-step'), t = RM.matches ? 0 : 450;
    [].forEach.call(steps, function (s, i) { setTimeout(function () { s.className = 'dc-step ' + done(s.dataset.k); }, t * (i + 1)); });
    setTimeout(function () { el.remove(); }, RM.matches ? 1800 : 3200); }
  /* chores-skip-discards-1103 (owner Nov 3 2026 3:15 PM CT [pt2751u] "daily chores is useless because it feeds discards"): UI only.
   * Discard is browser-only (V2UI.hiddenIds, no rule state), so the rule feeds exactly the places the tag names; the SITE picks them. Daily chores now
   * passes only your hungry, NOT discarded pets to V2Rules.dailyChoresPlan (its o.ids option), the same as Feed all hungry / Feed selected (noDiscarded).
   * A discarded pet becomes a 0 (must not eat) place in the runs, so it is never in the burn. The sheet shows the pets it will really feed
   * (every burn, not only the first) and how many discarded pets were left out. Rule files untouched. */
  function hiddenSet() { var u = U(); try { return new Set(((u && u.hiddenIds && u.hiddenIds()) || []).map(Number)); } catch (e) { return new Set(); } }
  function plan() { var u = U(), v = V(), w = u && u.world && u.world(), tip = u && u.S ? u.S().tip : 0; if (!w || !u.ME || !v.dailyChoresPlan) return null;
    var nb = (tip || w.tip) + 1, h = hiddenSet(), eats = v.frEats || function (p) { return p && p.hungry; }, ids = [], gone = 0;
    w.pets.forEach(function (p) { if (p.owner !== u.ME || !p.hungry) return; if (h.has(p.id)) { if (!p.dead && !p.released && eats(p, nb)) gone++; return; } ids.push(p.id); });
    var set = new Set(ids); ids.indexOf = function (x) { return set.has(x) ? 0 : -1; }; /* the planner asks ids.indexOf(id) >= 0 per pet; a Set keeps big wallets fast */
    var P = v.dailyChoresPlan(w, u.ME, nb, { ids: ids }); if (!P) return null;
    P.feedTotal = P.plans.reduce(function (a, q) { return a + (q && q.petIds ? q.petIds.length : q && q.petId != null ? 1 : 0); }, 0); P.discardedSkipped = gone; return P; }
  function feedLine(P) { var n = P.feedTotal != null ? P.feedTotal : P.parts.feed; return n ? '✓ feed ' + fmt(n) + ' pet' + (n === 1 ? '' : 's') : '– no pet needs food'; }
  function goneLine(P) { var g = P.discardedSkipped || 0; return g ? '– ' + fmt(g) + ' discarded pet' + (g === 1 ? '' : 's') + ' left out (not fed)' : ''; }
  function sheetParts(P) { var p = P.parts; return '<ul class="dc-parts small" style="text-align:left;margin:6px auto;max-width:420px;padding-left:18px">' +
    '<li>' + (p.wagmi ? '✓ WAGMI check-in' : '– WAGMI: already said today') + '</li>' +
    '<li>' + feedLine(P) + '</li>' + (goneLine(P) ? '<li class="dc-gone">' + goneLine(P) + '</li>' : '') +
    '<li>' + (p.spins ? '✓ use all saved spins' : '– no saved spins') + '</li>' +
    '<li>' + P.plans.length + ' burn' + (P.plans.length === 1 ? '' : 's') + ' instead of ' + P.oldBurns + ' (fewer signatures, less network fee)</li></ul>'; }
  function sheetTitle(P) { var p = P.parts, bits = [];
    bits.push(p.wagmi ? '✓ WAGMI check-in' : '– WAGMI (already said today)');
    bits.push(feedLine(P)); if (goneLine(P)) bits.push(goneLine(P));
    bits.push(p.spins ? '✓ use all saved spins' : '– no saved spins');
    var dan = P.plans.reduce(function (s, q) { return s + dander(q.amount || 0); }, 0);
    return '🧹 Daily chores · ' + bits.join(' · ') + ' · ' + P.plans.length + ' burn' + (P.plans.length === 1 ? '' : 's') + ' instead of ' + P.oldBurns + ' · ' + (dan < 1e8 ? fmt(dan) + ' dander' : fmt(dan / 1e8) + ' XCPETS'); }
  function go() { var u = U(), P = plan(); if (!P) return u.toast('🧹 Nothing to do today: WAGMI said, pets fed, no saved spins.');
    var why = u.sendWhy(P.plans[0]); if (why) return u.toast('⚠️ ' + why);
    u.confirmPlans('🧹 Daily chores', P.plans, function () { u.toast('🧹 Sent. Your chores run when the burn confirms.'); u.render(); });
    var b = $('cfBody'); if (b && !b.querySelector('.dc-parts')) b.insertAdjacentHTML('afterbegin', sheetParts(P)); }
  function ensure() { var bar = $('streakBar'), u = U(), v = V(); if (!bar || !u || !v || !v.dailyChoresGate) return;
    var gate = v.dailyChoresGate(), on = gate != null || PREVIEW, row = $('dcRow');
    if (!on || !u.ME || bar.style.display === 'none') { if (row) row.style.display = 'none'; return; }
    css(); if (!row) { row = document.createElement('div'); row.id = 'dcRow'; row.className = 'dc-row'; bar.parentNode.insertBefore(row, bar.nextSibling); }
    row.style.display = ''; var tip = (u.S && u.S().tip) || 0, live = gate != null && tip + 1 >= gate, P = live ? plan() : null;
    var note = !live ? (gate == null ? 'Preview: opens when the rule goes live' : 'Opens at block ' + fmt(gate)) : P ? (P.feedTotal ? 'feeds ' + fmt(P.feedTotal) + ' pet' + (P.feedTotal === 1 ? '' : 's') + ' · ' : '') + P.plans.length + ' burn' + (P.plans.length === 1 ? '' : 's') + ' instead of ' + P.oldBurns + (P.discardedSkipped ? ' · ' + fmt(P.discardedSkipped) + ' discarded left out' : '') : 'All done today';
    row.innerHTML = '<button class="dc-btn" id="dcBtn" type="button"' + (live && P ? '' : ' disabled') + '>🧹 Daily chores</button><span class="dc-note">WAGMI + feed + spins in one burn · ' + note + '</span>';
    var b = $('dcBtn'); if (b && !b.disabled) b.onclick = go; }
  /* watch the log for your own confirmed chores burns and queue the pixel animation once per tx */
  var seen = {}; try { seen = JSON.parse(localStorage.getItem('xcpets.dcSeen') || '{}'); } catch (e) { seen = {}; }
  function watch() { var u = U(), w = u && u.world && u.world(); if (!w || !u.ME || !w.log) return;
    w.log.forEach(function (ev) { if (ev.kind !== 'chores' || ev.src !== u.ME) return; var k = ev.tx || (ev.block + ':' + ev.msg); if (seen[k]) return; seen[k] = 1;
      if (window.__demo && __demo.queueAnim) __demo.queueAnim(function () { play(ev); }, '🧹 Daily chores'); else play(ev); });
    try { localStorage.setItem('xcpets.dcSeen', JSON.stringify(seen)); } catch (e) {} }
  var first = true;
  setInterval(function () { ensure(); if (first) { var u = U(), w = u && u.world && u.world(); if (w && w.log) { w.log.forEach(function (ev) { if (ev.kind === 'chores') seen[ev.tx || (ev.block + ':' + ev.msg)] = 1; }); first = false; } } else watch(); }, 2000);
  window.V2Chores = { play: play, plan: plan, hiddenSet: hiddenSet, sheetTitle: sheetTitle, ensure: ensure, demo: function () { play({ parts: [{ part: 'wagmi', done: true }, { part: 'feed', done: true }, { part: 'spins', done: false }], petIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }); } };
})();
