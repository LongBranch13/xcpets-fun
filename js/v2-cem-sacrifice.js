/* XCPETS Pet Cemetery: feed a zombie or add halo points without leaving the cemetery (Nov 22 2026, cemetery step 4). Display + send only.
 * V2CemSacrifice.open({ kind: 'zfeed' | 'rpl', z, w, V, R, ME, b, send(plans, title) })
 * Lists your living pets from this browser's Discard pile that the rules would accept (V.cemOfferWhy; starred pets never listed), weakest first.
 * Nothing is pre-ticked. Halo points: Common 1, Uncommon 3, Rare 10, Legendary 33 (V.CEM.POINTS). The burns are the same ones My Pets sends:
 * the fewest of the run form (V.cemRunsPlan) or id lists packed into 34-byte tags (V.cemPlan), priced per pet (V.cemPetAmount), and they go
 * through the cemetery's own guarded sign sheet (send). A Legendary or Mythic pick asks once more before signing. */
(function () {
  'use strict';
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'], MAXB = 34;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function net() { return (window.LiveEngine && LiveEngine.CFG && LiveEngine.CFG.network) || 'mainnet'; }
  function ls(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.map(Number) : []; } catch (e) { return []; } }
  function fmt(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); }
  function tierOf(p) { return Math.max(0, Math.min(3, (p && p.tier) | 0)); }
  function myth(p) { return !!(p && (p.mythicCare || p.stage >= 5)); }
  /** candidates(o): living Discarded pets of o.ME the rules accept for this zombie, weakest first. */
  function candidates(o) { var w = o.w, V = o.V, me = o.ME, b = o.b, hid = {}, kept = {}, n = net();
    ls('xcpets-hidden-' + n + '-' + me).forEach(function (id) { hid[id] = 1; }); ls('xcpets-keep-' + n + '-' + me).forEach(function (id) { kept[id] = 1; });
    /* Nov 25 2026 (G Money discarded ~17,000 pets on chain and this sheet said "No pets in your Discard pile"): pets discarded ON CHAIN are in the
     * pile on every device. The rules accept only those (cemOfferWhy 'only a discarded pet can be offered'); the browser list alone was never enough. */
    (w.pets || []).forEach(function (a) { if (a.owner === me && a.hd === me) hid[a.id] = 1; });
    if (!(V.retiredUI && V.retiredUI(w))) (w.pets || []).forEach(function (a) { if (a.skipBy === me) hid[a.id] = 1; });
    return (w.pets || []).filter(function (a) { return a.owner === me && hid[a.id] && !kept[a.id] && !a.dead && !a.released && !(V.isZ && V.isZ(a)) && a.id !== o.z && !(V.cemOfferWhy && V.cemOfferWhy(w, a, me, b)); })
      .sort(function (a, c) { return tierOf(a) - tierOf(c) || (a.stage | 0) - (c.stage | 0) || a.id - c.id; }); }
  /** browserOnly(o): pets only in this browser's Discard pile (not discarded on chain). The rules refuse them, so the sheet says how to fix it. */
  function browserOnly(o) { var w = o.w, me = o.ME, n = 0; ls('xcpets-hidden-' + net() + '-' + me).forEach(function (id) { var a = w.byId && w.byId[id]; if (a && a.owner === me && a.hd !== me && !a.dead && !a.released && !(a.zombie && !a.zombie.end)) n++; }); return n; }
  /** plans(o, ids): the fewest burns for these pets (run form or packed id lists), each priced per pet. */
  function plans(o, ids) { var w = o.w, V = o.V, b = o.b, kind = o.kind, z = o.z, s = ids.slice().sort(function (a, c) { return a - c; }), list = [], cur = [];
    var fits = function (g) { var p = V.cemPlan(w, kind, z, g, b); return p && p.tag && p.tag.length <= MAXB ? p : null; };
    s.forEach(function (id) { var g = cur.concat([id]); if (cur.length && !fits(g)) { list.push(fits(cur)); cur = [id]; } else cur = g; }); if (cur.length) list.push(fits(cur));
    if (list.some(function (p) { return !p; })) list = null;
    var runs = V.cemRunsPlan ? V.cemRunsPlan(w, kind, z, s, o.ME, b) : null, pick = runs && runs.length && (!list || runs.length <= list.length) ? runs : list;
    return (pick || []).map(function (p) { return V.cemPetAmount ? V.cemPetAmount(w, p, b) : p; }); }
  function css() { if (document.getElementById('cemSacCss')) return; var s = document.createElement('style'); s.id = 'cemSacCss';
    s.textContent = '.csac-bg{position:fixed;inset:0;z-index:9000;background:rgba(5,4,12,.78);display:flex;align-items:flex-end;justify-content:center;padding:max(8px,env(safe-area-inset-top,0px)) max(8px,env(safe-area-inset-right,0px)) 0 max(8px,env(safe-area-inset-left,0px))}' +
      '.csac{width:100%;max-width:640px;max-height:92vh;display:flex;flex-direction:column;background:#1c1830;color:#f3ecd8;border:3px solid #000;box-shadow:0 -4px 0 #000;font-family:"Comic Neue","Comic Sans MS",sans-serif}' +
      '.csac-h{display:flex;gap:10px;align-items:center;padding:12px 14px 6px}.csac-h b{font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:26px;letter-spacing:.05em;color:#ffc93c;text-shadow:2px 2px 0 #000;line-height:1.05;flex:1}' +
      '.csac-x{background:#2f2a4a;color:#f3ecd8;border:3px solid #000;font:16px/1 "Press Start 2P",monospace;padding:6px 8px;cursor:pointer}' +
      '.csac-p{margin:0 14px 8px;font-size:15px;line-height:1.4}.csac-p b{color:#7dff6a}' +
      '.csac-q{display:flex;flex-wrap:wrap;gap:6px;margin:0 14px 8px}.csac-q button{font:9px "Press Start 2P",monospace;background:#f3ecd8;color:#111;border:2px solid #000;box-shadow:2px 2px 0 #000;padding:6px 8px;cursor:pointer}' +
      '.csac-l{overflow:auto;padding:0 14px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;flex:1;min-height:120px}' +
      '.csac-t{display:grid;grid-template-columns:40px 1fr;gap:6px;align-items:center;background:#2f2a4a;border:3px solid #000;padding:5px;cursor:pointer;text-align:left;color:inherit;font:inherit;min-width:0}' +
      '.csac-t canvas{width:40px;height:40px;image-rendering:pixelated;background:#0f0d1e}.csac-t[aria-pressed=true]{background:#3c2a12;box-shadow:inset 0 0 0 3px #ff4d4d}' +
      '.csac-t span{min-width:0;font-size:13px;line-height:1.2;overflow-wrap:anywhere}.csac-t i{font:normal 7px/1.3 "Press Start 2P",monospace;display:inline-block;border:2px solid #000;padding:1px 3px;margin-top:2px}' +
      '.csac-t i.common{background:#c8ccd4;color:#111}.csac-t i.uncommon{background:#7dff6a;color:#0b1a08}.csac-t i.rare{background:#6ac8ff;color:#041826}.csac-t i.legendary{background:#ffc93c;color:#221400}.csac-t i.mythic{background:#b07cff;color:#14052a}' +
      '.csac-t em{display:block;font:normal 7px/1.4 "Press Start 2P",monospace;color:#fff3b0}' +
      '.csac-more{grid-column:1/-1;font:9px "Press Start 2P",monospace;background:#f3ecd8;color:#111;border:2px solid #000;box-shadow:2px 2px 0 #000;padding:10px;cursor:pointer}' +
      '.csac-e{margin:0 14px 12px;border:3px dashed #b9b4d0;padding:10px;background:#0f0d1e;font-size:15px}.csac-e a{color:#9fe8ff}' +
      '.csac-f{border-top:3px solid #000;padding:10px 14px max(12px,env(safe-area-inset-bottom,0px));display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;background:#141126}' +
      '.csac-f p{margin:0;font-size:14px;line-height:1.35;flex:1 1 200px}.csac-f p b{color:#ffc93c}.csac-warn{color:#ff8a8a}' +
      '.csac-go{font-family:Bangers,Impact,sans-serif;font-size:22px;letter-spacing:.05em;background:#7dff6a;color:#0b1a08;border:3px solid #000;box-shadow:3px 3px 0 #000;padding:6px 14px;cursor:pointer}.csac-go[disabled]{opacity:.5;cursor:not-allowed}.csac-go.warn{background:#ff4d4d;color:#1a0000}' +
      '.csac-t:focus-visible,.csac-go:focus-visible,.csac-x:focus-visible,.csac-q button:focus-visible{outline:3px solid #fff3b0;outline-offset:2px}';
    document.head.appendChild(s); }
  function close() { var el = document.getElementById('cemSac'); if (el) el.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function open(o) { close(); css(); var w = o.w, V = o.V, R = o.R, Z = w.byId && w.byId[o.z]; if (!Z) return; var halo = o.kind === 'rpl', C = V.CEM || {}, P = C.POINTS || [1, 3, 10, 33];
    var L = candidates(o), bo = browserOnly(o), sel = {}, confirm = false, nm = esc(Z.name || '#' + Z.id), res = V.cemResInfo ? V.cemResInfo(w, Z, o.b) : { points: 0, min: C.RES_MIN || 25 }, min = res.min || C.RES_MIN || 25;
    var per = V.cemCost(w, halo ? 'rpl' : 'zmeal', o.b);
    var bg = document.createElement('div'); bg.className = 'csac-bg'; bg.id = 'cemSac'; bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    var intro = halo ? 'Every pet you sacrifice adds <b>halo points</b>: Common ' + P[0] + ', Uncommon ' + P[1] + ', Rare ' + P[2] + ', Legendary ' + P[3] + '. ' + nm + ' has <b>' + res.points + ' of ' + min + '</b>. The pets are used up when the Resurrection is tried, win or lose.'
      : 'Every pet you sacrifice is <b>eaten for good</b>. One meal resets its hunger, so it is safe from hunters for another ' + (window.V2CemGuide ? V2CemGuide.time(C.FERAL || 432) : '3 days') + '. Rarer pets make it stronger; a starving (ripe) pet counts 1.5 times.';
    bg.innerHTML = '<div class="csac" role="dialog" aria-modal="true" aria-labelledby="csacH"><div class="csac-h"><b id="csacH">' + (halo ? '😇 Add halo points to ' : '🍖 Feed ') + nm + '</b><button type="button" class="csac-x" aria-label="Close">✕</button></div>' +
      '<p class="csac-p">' + intro + '</p>' + (L.length ? '<div class="csac-q">' + (halo ? '<button type="button" data-q="fill">✨ FILL TO ' + min + '</button>' : '<button type="button" data-q="one">🍖 PICK THE WEAKEST</button>') + '<button type="button" data-q="none">CLEAR</button></div><div class="csac-l" role="group" aria-label="Your Discarded pets"></div>'
        : '<p class="csac-e">No pets in your Discard pile that can be sacrificed. Discard unwanted pets in <a href="play.html#petsPanel">My Pets</a> (🗑️) first. Starred and tokenized pets can’t be sacrificed.</p>') +
      (bo ? '<p class="csac-p csac-bo">' + fmt(bo) + ' pet' + (bo === 1 ? ' is' : 's are') + ' only hidden in this browser. Zombies eat only pets discarded on chain: open <a href="play.html#petsPanel">My Pets</a> and tap <b>Make my browser discards permanent</b> (1 dander).</p>' : '') +
      '<div class="csac-f"><p id="csacSum">Tick the pets to sacrifice.</p><button type="button" class="csac-go" id="csacGo" disabled>' + (halo ? '😇 Sacrifice' : '🍖 Feed') + '</button></div></div>';
    document.body.appendChild(bg); document.addEventListener('keydown', onKey);
    var list = bg.querySelector('.csac-l');
    /* Nov 25 2026: a big wallet can have 15,000+ discarded pets. Draw them a page at a time (the old one-shot list built every tile and then
     * searched the whole list once per pet, which froze the page). */
    var shown = 0, PAGE = 240;
    function tile(p) { var t = tierOf(p), m = myth(p); return '<button type="button" class="csac-t" data-id="' + p.id + '" aria-pressed="false"><canvas width="32" height="32" data-p="' + p.id + '" aria-hidden="true"></canvas><span>' + esc(p.name || '#' + p.id) + ' <span class="muted">#' + p.id + '</span><br><i class="' + (m ? 'mythic' : TID[t]) + '">' + (m ? 'MYTHIC' : TL[t].toUpperCase()) + '</i>' + (halo ? '<em>+' + P[t] + ' HALO</em>' : p.neglected ? '<em>RIPE ×1.5</em>' : '') + '</span></button>'; }
    function more() { if (!list) return; var old = list.querySelector('.csac-more'); if (old) old.remove(); var part = L.slice(shown, shown + PAGE), box = document.createElement('div');
      box.innerHTML = part.map(tile).join(''); var cs = box.querySelectorAll('canvas[data-p]');
      for (var i = 0; i < cs.length; i++) (function (c, p) { if (c && p && p.art && R && R.lazy) R.lazy(c, function () { return R.framesWith(p.art, p.stage, []); }, true); })(cs[i], part[i]);
      while (box.firstChild) list.appendChild(box.firstChild); shown += part.length;
      if (shown < L.length) { var mb = document.createElement('button'); mb.type = 'button'; mb.className = 'csac-more'; mb.textContent = 'Show ' + fmt(Math.min(PAGE, L.length - shown)) + ' more (' + fmt(L.length - shown) + ' left)'; list.appendChild(mb); }
      if (bg.querySelectorAll) bg.querySelectorAll('.csac-t').forEach(function (t) { t.setAttribute('aria-pressed', sel[+t.getAttribute('data-id')] ? 'true' : 'false'); }); }
    more();
    function ids() { return Object.keys(sel).map(Number); }
    function sum() { var I = ids(), n = I.length, go = bg.querySelector('#csacGo'), s = bg.querySelector('#csacSum'); confirm = false; go.classList.remove('warn');
      bg.querySelectorAll('.csac-t').forEach(function (t) { t.setAttribute('aria-pressed', sel[+t.getAttribute('data-id')] ? 'true' : 'false'); });
      if (!n) { go.disabled = true; go.textContent = halo ? '😇 Sacrifice' : '🍖 Feed'; s.textContent = 'Tick the pets to sacrifice.'; return; }
      var PL = plans(o, I), amt = PL.reduce(function (a, p) { return a + Number(p.amount || 0); }, 0), pts = I.reduce(function (a, id) { return a + P[tierOf(w.byId[id])]; }, 0), big = I.filter(function (id) { var p = w.byId[id]; return tierOf(p) >= 3 || myth(p); }).length;
      go.disabled = !PL.length; go.textContent = (halo ? '😇 Sacrifice ' : '🍖 Feed ') + n + ' pet' + (n === 1 ? '' : 's');
      s.innerHTML = '<b>' + n + ' pet' + (n === 1 ? '' : 's') + '</b> gone for good · ' + (halo ? '+' + pts + ' halo points (' + (res.points + pts) + ' of ' + min + ') · ' : '') + fmt(Math.round(amt * 1e8) / 1e8) + ' XCPETS · ' + PL.length + ' burn' + (PL.length === 1 ? '' : 's') + (big ? '<br><span class="csac-warn">⚠ ' + big + ' Legendary or Mythic pet' + (big === 1 ? '' : 's') + ' ticked.</span>' : ''); }
    bg.addEventListener('click', function (e) { var t = e.target.closest('.csac-t'), q = e.target.closest('[data-q]');
      if (e.target.closest('.csac-x')) return close();
      if (e.target.closest('.csac-more')) return more();
      if (t) { var id = +t.getAttribute('data-id'); if (sel[id]) delete sel[id]; else sel[id] = 1; sum(); return; }
      if (q) { var k = q.getAttribute('data-q'); sel = {};
        if (k === 'one' && L.length) sel[L[0].id] = 1;
        if (k === 'fill') { var need = min - res.points, got = 0; L.filter(function (p) { return !myth(p) && tierOf(p) < 3; }).slice().sort(function (a, c) { return tierOf(c) - tierOf(a) || a.id - c.id; }).forEach(function (p) { if (got < need) { sel[p.id] = 1; got += P[tierOf(p)]; } }); }
        sum(); return; } });
    function sendIds(I) { var PL = plans(o, I); if (!PL.length) return; close(); o.send(PL, (halo ? '😇 Halo points for ' : '🍖 Zombie meal for ') + (Z.name || '') + ' #' + Z.id + ' (' + I.length + ' pet' + (I.length === 1 ? '' : 's') + ')'); }
    bg.querySelector('#csacGo').addEventListener('click', function () { var I = ids(); if (!I.length) return;
      if (window.V2SacGuard) return V2SacGuard.check({ w: w, ids: I, me: o.ME, verb: halo ? 'give them as halo points to ' + (Z.name || '#' + Z.id) : 'feed them to ' + (Z.name || 'the zombie'), onGo: function (keep) { /* sac-guard (Nov 23 2026): special pets named, the easy way leaves them out */
        I.forEach(function (id) { if (keep.indexOf(id) < 0) { delete sel[id]; var t = bg.querySelector('.csac-t[data-id="' + id + '"]'); if (t) t.setAttribute('aria-pressed', 'false'); } }); sum(); if (keep.length) sendIds(keep); } });
      var big = I.filter(function (id) { var p = w.byId[id]; return tierOf(p) >= 3 || myth(p); });
      if (big.length && !confirm) { confirm = true; this.classList.add('warn'); this.textContent = '⚠ Yes, sacrifice ' + (big.length === 1 ? 'the Legendary' : 'all ' + big.length + ' Legendary/Mythic'); return; }
      var PL = plans(o, I); if (!PL.length) return; close(); o.send(PL, (halo ? '😇 Halo points for ' : '🍖 Zombie meal for ') + (Z.name || '') + ' #' + Z.id + ' (' + I.length + ' pet' + (I.length === 1 ? '' : 's') + ')'); });
    var first = bg.querySelector('.csac-t,.csac-x'); if (first) first.focus(); }
  window.V2CemSacrifice = { open: open, close: close, _candidates: candidates, _plans: plans };
})();
