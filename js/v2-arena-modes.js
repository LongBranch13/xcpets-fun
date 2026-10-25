/* XCPETS arena modes UI (Oct 22 2026; branch arena-modes, NOT LIVE). Sudden Death + Tag Team card in X Circus Kekimus.
 * Burns (rules in js/v2-rules.js modeBurn, gated by ACTIVATE_ARENA_MODES_BLOCK, null = off): pet:sd:A:B 690, pet:tt:A1.A2:B1.B2 1,380 (690 when the
 * team has two owners, partner burns pet:join:N:ID 690), accept = pet:accept:N. The site never signs: confirmPlans -> wallet.
 * Flow: tap a mode chip, tap your pet picture(s), tap an opponent picture (Tag Team auto-fills their partner), tap Challenge. While the gate is
 * off the button shows the send guard reason ("coming soon"), so no burn can be wasted. No pop-ups; display + composer only. */
(function () {
  'use strict';
  /* power-tooltip-values (Oct 25 2026, display only): hovers show the pet's real numbers (js/v2-power-tip.js) */
  function ptA(p) { return window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.power(p)) : ''; } 
  var $ = function (id) { return document.getElementById(id); }, V = function () { return window.V2Rules; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pow(p) { var s = p.stats || {}; return ['vigor', 'spark', 'grit', 'zoom', 'luck'].reduce(function (a, k) { return a + (s[k] || 0); }, 0); }
  var MODES = { sd: { chip: '⚡ Sudden Death', hint: 'First clean hit wins. Loser drops 2 gear pieces.' }, tt: { chip: '🤝 Tag Team', hint: '2 of yours vs 2 of theirs. Tag in when one falls.' } };
  var S = { mode: 'sd', mine: [], theirs: [], friend: '', alt: 0 };
  function U() { return window.V2UI; }
  function ok(p, w, b) { return p && !p.dead && !p.released && !p.neglected && p.stage >= 2 && !p.community && !(p.fightDays || {})[V().day(b)] && !V().inOpenFight(w, p.id, b); }
  function tip(w) { return (U() && U().S && U().S().tip) || w.tip || 0; }
  function card(w, p, on, tag) { return '<button type="button" class="ez-c t' + p.tier + (on ? ' on' : '') + '" data-am="' + p.id + '" aria-pressed="' + !!on + '" title="#' + p.id + ' ' + esc(p.name) + '">' + (tag ? '<span class="ez-tag">' + esc(tag) + '</span>' : '') +
    '<span class="ez-sp" data-amsp="' + p.id + '"></span><b class="ez-nm">' + esc(p.name || '') + '</b><span class="ez-id">#' + p.id + ' · <span' + ptA(p) + '>⚡' + pow(p) + '</span></span></button>'; }
  function sprites(root, w) { var R = window.V2Render; if (!R) return; root.querySelectorAll('[data-amsp]').forEach(function (s) { if (s.firstChild) return; var p = w.byId[s.getAttribute('data-amsp')]; if (!p) return; var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'sprite'; s.appendChild(c);
    if (R.lazy && R.petFrames) R.lazy(c, function () { return R.petFrames(p, w); }, true); }); }
  function stablemates(w, p, b, not) { return w.pets.filter(function (q) { return q.owner === p.owner && q.id !== p.id && not.indexOf(q.id) < 0 && ok(q, w, b); }).sort(function (a, c) { return pow(c) - pow(a) || a.id - c.id; }); }
  function plan(w) { var A = S.mine, B = S.theirs; if (S.mode === 'sd') return A[0] && B[0] ? { tag: 'pet:sd:' + A[0] + ':' + B[0], amount: V().COSTS.sd } : null;
    var a2 = S.friend ? +S.friend : A[1]; if (!A[0] || !a2 || !B[0] || !B[1]) return null; return { tag: 'pet:tt:' + A[0] + '.' + a2 + ':' + B[0] + '.' + B[1], amount: V().modeTeamCost(w, [A[0], a2]) }; }
  function render() { var el = $('arModes'), u = U(); if (!el || !u || !V() || !V().simulateSudden) return; var w = u.world(); if (!w || !w.pets) return; var ME = u.ME, b = tip(w) + 1;
    var mine = ME ? w.pets.filter(function (p) { return p.owner === ME && ok(p, w, b); }).sort(function (a, c) { return pow(c) - pow(a) || a.id - c.id; }) : [];
    var need = S.mode === 'sd' ? 1 : (S.friend ? 1 : 2); S.mine = S.mine.filter(function (id) { return mine.some(function (p) { return p.id === id; }); }).slice(0, need);
    var lead = w.byId[S.mine[0]], lp = lead ? pow(lead) : (mine[0] ? pow(mine[0]) : 60);
    var opp = w.pets.filter(function (p) { return p.owner && p.owner !== ME && ok(p, w, b); }).sort(function (a, c) { return Math.abs(pow(a) - lp) - Math.abs(pow(c) - lp) || a.id - c.id; }).slice(0, 10);
    S.theirs.forEach(function (id) { var p = w.byId[id]; if (p && opp.indexOf(p) < 0) opp.unshift(p); });
    var pl = plan(w), why = !ME ? 'Connect your wallet or view an address first' : !pl ? (S.mine.length < need ? 'Pick your pet' + (need > 1 ? 's' : '') : 'Pick an opponent') : (u.sendWhy ? u.sendWhy(pl) : null);
    var bl = window.V2ArenaFun && V2ArenaFun.belts ? V2ArenaFun.belts(w) : {};
    var h = '<h3 class="ar-h">🎪 Arena modes</h3><div class="am-chips" role="group" aria-label="Fight mode">' + Object.keys(MODES).map(function (k) { return '<button type="button" class="q am-chip' + (S.mode === k ? ' on' : '') + '" data-ammode="' + k + '" aria-pressed="' + (S.mode === k) + '">' + MODES[k].chip + '</button>'; }).join('') + '</div>' +
      '<p class="small am-hint">' + MODES[S.mode].hint + '</p>' +
      '<p class="small muted am-step">1 · Your pet' + (need > 1 ? 's (lead, then partner)' : '') + '</p><div class="am-row">' + (mine.length ? mine.slice(0, 12).map(function (p) { var i = S.mine.indexOf(p.id); return card(w, p, i >= 0, i === 0 ? (S.mode === 'tt' ? 'LEAD' : 'YOU') : i === 1 ? 'PARTNER' : ''); }).join('') : '<span class="small muted">No pet ready to fight (Juvenile+, fed, not fought today).</span>') + '</div>' +
      (S.mode === 'tt' ? '<details class="small am-friend"' + (S.friend ? ' open' : '') + '><summary>Partner from a friend?</summary><label>Their pet # <input id="amFriend" inputmode="numeric" size="7" value="' + esc(S.friend) + '"></label> <span class="muted">They join with one 690 burn.</span></details>' : '') +
      '<p class="small muted am-step">2 · Opponent' + (S.mode === 'tt' ? ' (their partner fills in, tap again to swap)' : '') + '</p><div class="am-row">' + opp.map(function (p) { var i = S.theirs.indexOf(p.id); return card(w, p, i >= 0, i === 0 ? 'THEM' : i === 1 ? 'PARTNER' : ''); }).join('') + '</div>' +
      '<p class="am-go"><button type="button" class="btn ico-flame" id="amGo"' + (why ? ' disabled' : '') + '>' + (why ? '🚫 ' + esc(why) : '⚔️ Challenge · burn ' + fmt(pl.amount) + ' XCPETS') + '</button></p>' + openList(w, ME, b) +
      '<p class="small muted am-belts">Belts: Classic ' + beltTxt(bl.classic) + ' · ⚡ ' + beltTxt(bl.sd) + ' · 🤝 ' + beltTxt(bl.tt) + '</p>';
    el.innerHTML = h; sprites(el, w); bind(el, w);
  }
  function beltTxt(x) { return x ? '#' + x.id + ' (' + x.n + ')' : 'in the case'; }
  function openList(w, ME, b) { var rows = (w.fights || []).filter(function (f) { return f.mode && ((f.status === 'open' && b - f.block <= V().FIGHT_WINDOW) || (f.status === 'done' && b - f.acceptBlock <= 1008)); }).slice(-8).reverse();
    if (!rows.length) return ''; return '<div class="am-open small">' + rows.map(function (f) { var ic = f.mode === 'sd' ? '⚡' : '🤝', side = function (ids) { return ids.filter(function (x) { return x != null; }).map(function (id) { return '#' + id; }).join(' & '); };
      var t = ic + ' ' + side([f.a, f.a2]) + ' vs ' + side([f.b, f.b2]), act = '';
      if (f.status === 'done') act = ' · 🏆 ' + side(f.winners || [f.winner]) + ' <button type="button" class="q" data-amplay="' + f.id + '">▶</button>';
      else { var B = w.byId[f.b], jn = (f.needJoin || []).filter(function (id) { return !f.joins[id] && w.byId[id] && w.byId[id].owner === ME; })[0];
        if (jn) act = ' <button type="button" class="btn" data-amjoin="' + f.id + ':' + jn + '">Join with #' + jn + ' · 690</button>';
        else if (!f.accepted && B && B.owner === ME) act = ' <button type="button" class="btn ico-flame" data-amacc="' + f.id + '">Accept · ' + fmt(V().acceptCost(w, f.id)) + '</button>';
        else act = ' · ' + (f.accepted ? 'waiting for the partner' : 'waiting to be accepted'); }
      return '<div>' + t + act + '</div>'; }).join('') + '</div>'; }
  function bind(el, w) { var u = U();
    el.querySelectorAll('[data-ammode]').forEach(function (x) { x.onclick = function () { S.mode = x.dataset.ammode; S.mine = []; S.theirs = []; render(); }; });
    el.querySelectorAll('.am-row [data-am]').forEach(function (x) { x.onclick = function () { var id = +x.dataset.am, p = w.byId[id], b = tip(w) + 1;
      if (p.owner === u.ME) { var i = S.mine.indexOf(id), need = S.mode === 'sd' || S.friend ? 1 : 2; if (i >= 0) S.mine.splice(i, 1); else { if (S.mine.length >= need) S.mine = need > 1 ? [S.mine[0]] : []; S.mine.push(id); } }
      else if (S.mode === 'sd') S.theirs = S.theirs[0] === id ? [] : [id];
      else { if (S.theirs[0] === id) { var m = stablemates(w, p, b, S.mine); S.alt = (S.alt + 1) % Math.max(1, m.length); S.theirs = m.length ? [id, m[S.alt].id] : [id]; } else { var m2 = stablemates(w, p, b, S.mine); S.alt = 0; S.theirs = m2.length ? [id, m2[0].id] : [id]; } }
      render(); }; });
    var fr = $('amFriend'); if (fr) fr.onchange = function () { S.friend = String(fr.value || '').replace(/\D/g, ''); render(); };
    var go = $('amGo'); if (go) go.onclick = function () { var pl = plan(w); if (!pl) return; u.confirmPlans((S.mode === 'sd' ? 'Sudden Death' : 'Tag Team') + ' challenge', [pl], function () { S.theirs = []; render(); }); };
    el.querySelectorAll('[data-amacc]').forEach(function (x) { x.onclick = function () { var id = +x.dataset.amacc; u.confirmPlans('Accept fight ' + id, [{ tag: 'pet:accept:' + id, amount: V().acceptCost(w, id) }], function () { if (u.afterAccept) u.afterAccept(String(id)); }); }; });
    el.querySelectorAll('[data-amjoin]').forEach(function (x) { x.onclick = function () { var k = x.dataset.amjoin.split(':'); u.confirmPlans('Join Tag Team fight ' + k[0], [{ tag: 'pet:join:' + k[0] + ':' + k[1], amount: V().COSTS.join }]); }; });
    el.querySelectorAll('[data-amplay]').forEach(function (x) { x.onclick = function () { var f = w.fights[+x.dataset.amplay - 1]; if (window.V2ArenaScene && f) { V2ArenaScene.sequence(f, { restart: true }); var sc = $('arScene') || $('arenaPanel'); if (sc) sc.scrollIntoView({ block: 'center' }); } }; }); }
  function mount() { var panel = $('arenaPanel'), body = $('arenaBody'); if (!panel || !body) return false; if (!$('arModes')) { var d = document.createElement('div'); d.id = 'arModes'; d.className = 'am-card'; body.parentNode.insertBefore(d, body.nextSibling); }
    var css = document.createElement('style'); css.textContent = '.am-card{margin:14px 0 4px;padding:10px;border:2px solid #4b3f7a;border-radius:12px;background:#120e22}.am-chips{display:flex;gap:6px;flex-wrap:wrap}.am-chip{min-height:40px}.am-chip.on{border-color:#ffd166;background:#3a2a10;color:#ffd166}' +
      '.am-hint{margin:6px 0}.am-step{margin:8px 0 4px}.am-row{display:flex;gap:6px;overflow-x:auto;scroll-snap-type:x mandatory;padding:6px 2px 4px;-webkit-overflow-scrolling:touch}.am-row .ez-c{position:relative}.am-go{margin:10px 0 4px}.am-go .btn{width:100%;min-height:48px}.am-go .btn[disabled]{opacity:.7}' +
      '.am-open div{padding:4px 0;border-top:1px dashed #2c2440;overflow-wrap:anywhere}.am-friend input{width:7em}.am-belts{margin-top:8px}'; document.head.appendChild(css); return true; }
  var last = null; function tick() { var u = U(); if (!u || !$('arenaPanel')) return; if (!$('arModes') && !mount()) return; var w = u.world(); if (w !== last) { last = w; render(); } }
  setInterval(tick, 1500); setTimeout(tick, 200);
  window.V2ArenaModes = { render: render, state: function () { return S; } };
})();
