/* XCPETS X Circus Kekimus battle arena (DRAFT 2026-10-19, battle-arena branch; NOT LIVE). Display + burn-composer only, on top of the EXISTING on-chain fight flow:
 * pet:fight:A:B (690, opens a challenge to pet B, 144-block window) and pet:accept:ID (690, only B's owner; loser gives one gear piece, black eye).
 * No new rules, tags or amounts. "Post challenge" fills the existing #fMine/#fTheirs and clicks #fGo (the same path the face-off button uses);
 * "Accept" calls the same confirmPlans('Accept fight N', [{ tag: 'pet:accept:N', amount: 690 }]) as the current Battles panel. The site never signs:
 * the wallet does. Random pairing is a documented later idea (PROJECT_BRIEF), not built. */
(function () {
  'use strict';
  var V = window.V2Rules, $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pow(p) { return window.UXB && UXB.power ? UXB.power(p) : Object.keys(p.stats || {}).reduce(function (a, k) { return a + (p.stats[k] || 0); }, 0); }
  function score(w, p) { var s = window.PetScore && PetScore.of(w, p); return s ? s.score : null; }
  function left(n) { return n <= 0 ? 'expiring' : n >= 12 ? '~' + Math.round(n / 6) + ' h (' + n + ' blk)' : '~' + n * 10 + ' min (' + n + ' blk)'; }
  function lbl(w, id) { var p = w.byId[id]; return (p ? esc(p.name) + ' ' : '') + '<span class="muted">#' + id + '</span>'; }
  function card(w, p) { if (!p) return '<div class="ar-pet">?</div>'; var s = p.stats || {}, sc = score(w, p);
    return '<div class="ar-pet"><b>' + lbl(w, p.id) + '</b><div class="ar-sub">' + esc(p.species) + ' · ' + esc(p.stageName || '') + (p.blackEye ? ' · 🤕' : '') + '</div>' +
      '<div class="ar-st">⚡' + pow(p) + ' <span title="Vigor/Spark/Grit/Zoom/Luck">V' + (s.vigor | 0) + ' S' + (s.spark | 0) + ' G' + (s.grit | 0) + ' Z' + (s.zoom | 0) + ' L' + (s.luck | 0) + '</span>' + (sc != null ? ' · ⭐' + sc : '') + '</div></div>'; }
  /** pure data, testable in Node: open challenges, recent results, leaderboard */
  function data(w, tip) { tip = tip || w.tip || 0;
    var open = w.fights.filter(function (f) { return f.status === 'open' && tip - f.block <= V.FIGHT_WINDOW; }).map(function (f) { return { f: f, left: f.expires - tip }; }).sort(function (a, b) { return a.left - b.left; });
    var done = w.fights.filter(function (f) { return f.status === 'done'; }).sort(function (a, b) { return b.acceptBlock - a.acceptBlock || b.id - a.id; });
    var lb = w.pets.filter(function (p) { return (p.wins || 0) + (p.losses || 0) > 0 && !p.released; }).map(function (p) { var f = p.wins + p.losses, s = window.PetScore && PetScore.of(w, p);
      return { p: p, wins: p.wins || 0, losses: p.losses || 0, rate: f ? p.wins / f : 0, bpts: s ? s.breakdown.battles.points : null }; })
      .sort(function (a, b) { return b.wins - a.wins || b.rate - a.rate || a.p.id - b.p.id; });
    return { open: open, done: done, lb: lb }; }
  var shown = { res: 8, lb: 10 };
  function render(w) { var box = $('arenaBody'), U = window.V2UI; if (!box || !U || !w) return; var ME = U.ME, tip = (U.S && U.S().tip) || w.tip, d = data(w, tip);
    var my = U.fighters(w, ME), th = U.fighters(w, ME, true), selA = $('arA') && $('arA').value, selB = $('arB') && $('arB').value;
    var o = function (p) { return '<option value="' + p.id + '">' + esc(p.name) + ' #' + p.id + ' · ⚡' + pow(p) + '</option>'; };
    var SP = window.V2Sponsor, st = SP ? SP.state : null; if (SP) { SP.load(tip); st = SP.state; } /* fixed rotating sponsor, no reads */
    
    var CH = window.V2ArenaScene ? V2ArenaScene.champion(w) : null;
    var h = '<div class="ar-scene"><canvas id="arScene" width="320" height="180" role="img" aria-label="X Circus Kekimus arena: crowd in the stands, a tunnel, and ' + (CH ? 'the champion statue of ' + esc(CH.p.name) + ' #' + CH.p.id + ' (' + CH.streak + '-win streak)' : 'an empty plinth awaiting a champion') + '"></canvas><button type="button" class="q ar-ann ar-ann-sand" id="arVoice" aria-pressed="' + (window.V2Announcer && V2Announcer.voiceOn() ? 'true' : 'false') + '">' + (window.V2Announcer && V2Announcer.voiceOn() ? '🔊' : '🔇') + ' Announcer</button></div>' + (SP ? '<div class="ar-wallwrap">' + SP.billboard(st || SP.compute([], tip)) + '</div>' : '') + '<div class="ar-post"><b class="ar-h">⚔️ Post a challenge</b><label class="small">Your fighter <select id="arA" class="pick">' + (my.map(o).join('') || '<option value="">no eligible pet</option>') + '</select></label>' +
      '<label class="small">vs <select id="arB" class="pick">' + th.slice().sort(function (a, b) { return pow(b) - pow(a) || a.id - b.id; }).slice(0, 400).map(o).join('') + '</select></label>' +
      '<button type="button" class="btn ico-flame" id="arPost"' + (my.length ? '' : ' disabled') + '>Post challenge · ' + fmt(V.COSTS.fight) + ' XCPETS</button>' +
      '<button type="button" class="q ar-qm" id="arQuick"' + (my.length ? '' : ' disabled') + '>🎲 Quick match</button><span class="small ar-qmsg" id="arQmsg" aria-live="polite"></span>' +
      '<div class="small ar-hint">Juvenile+ pets · 1 battle per pet per day · winner takes a gear piece</div><details class="small muted ar-help"><summary>How fights work</summary>Burns <code>pet:fight:YOURS:THEIRS</code>, ' + fmt(V.COSTS.fight) + ' XCPETS. The owner of the other pet has ' + V.FIGHT_WINDOW + ' blocks to accept (' + fmt(V.COSTS.accept) + '). Loser hands over one gear piece and gets a black eye. You sign in your wallet.</details></div>';
    h += '<h3 class="ar-h">📯 Open challenges (' + d.open.length + ')</h3>' + (d.open.length ? '<div class="ar-list">' + d.open.map(function (x) { var f = x.f, B = w.byId[f.b], mineB = B && B.owner === ME;
      return '<div class="ar-row' + (mineB ? ' ar-mine' : '') + '"><div class="ar-vs">' + card(w, w.byId[f.a]) + '<span class="ar-x">VS</span>' + card(w, B) + '</div><div class="ar-meta">fight ' + f.id + ' · ⏳ ' + left(x.left) + ' · accept by block ' + fmt(f.expires) +
        (mineB ? ' <button type="button" class="btn ico-flame" data-aracc="' + f.id + '">Accept · ' + fmt(V.COSTS.accept) + '</button>' : ' <span class="muted small">waiting for #' + f.b + '’s owner</span>') + '</div></div>'; }).join('') + '</div>'
      : '<p class="muted small">No open challenges right now. Post one above.</p>');
    h += '<div class="ar-hist"><h3 class="ar-h">📜 Fight history <span class="muted small">· tap to replay</span></h3><div id="arHist"></div></div>';
    h += '<div class="ar-cols"><div hidden><h3 class="ar-h">📜 Recent results</h3>' + (d.done.slice(0, shown.res).map(function (f) {
      return '<div class="ar-res">🏆 ' + lbl(w, f.winner) + ' beat ' + lbl(w, f.loser) + (f.spoils ? ' · took ' + esc(f.spoils.label) : '') + ' <span class="muted small">blk ' + fmt(f.acceptBlock) + '</span>' + (function (sl) { return sl ? ' <span class="sp-card small">· ' + esc(sl) + '</span>' : ''; })(SP && st ? SP.line(st, f.acceptBlock) : '') + ' <button type="button" class="q" data-arview="' + f.id + '">▶</button></div>'; }).join('') || '<p class="muted small">No fights yet.</p>') + '</div>';
    h += '<div><h3 class="ar-h">🥇 Arena leaderboard</h3>' + (d.lb.length ? '<table class="ar-lb"><tr><th>#</th><th>Pet</th><th>W</th><th>L</th><th>Win %</th><th title="Pet Score battles points (max 100)">⭐ Btl</th></tr>' + d.lb.slice(0, shown.lb).map(function (x, i) {
      return '<tr' + (x.p.owner === ME ? ' class="ar-mine"' : '') + '><td>' + (i + 1) + '</td><td>' + lbl(w, x.p.id) + '</td><td>' + x.wins + '</td><td>' + x.losses + '</td><td>' + Math.round(100 * x.rate) + '%</td><td>' + (x.bpts == null ? '–' : x.bpts) + '</td></tr>'; }).join('') + '</table>' : '<p class="muted small">No battles yet.</p>') + '</div></div>';
    box.innerHTML = h; var dl = /^#battle-(\d+)$/.exec(location.hash || ''); if (dl && !render._dl) { render._dl = 1; selA = dl[1]; setTimeout(function () { var ap = $('arenaPanel'); if (ap) ap.scrollIntoView({ block: 'start' }); }, 300); } if (selA && $('arA')) $('arA').value = selA; if (window.V2ArenaScene) V2ArenaScene.mount($('arScene'), w); if (selA) $('arA').value = selA; if (selB) $('arB').value = selB;
    var RV = window.V2Rivals ? V2Rivals.rivals(w) : {};
    if (window.V2Picker && $('arHist')) V2Picker.mount($('arHist'), { w: w, me: ME, per: 8, sorts: ['newest', 'score', 'power'], records: function () { return d.done.map(function (f) { var A = w.byId[f.a], B = w.byId[f.b], k = f.a < f.b ? f.a + ':' + f.b : f.b + ':' + f.a, r = RV[k];
        return { key: String(f.id), f: f, pets: [A, B].filter(Boolean), newest: f.acceptBlock * 1e4 + f.id, html: function () { var sl = SP && st ? SP.line(st, f.acceptBlock) : '';
          return '<b>#' + f.a + ' vs #' + f.b + '</b><span>🏆 ' + esc(String((w.byId[f.winner] || {}).name || '#' + f.winner).slice(0, 10)) + '</span><small>' + (r && r.n >= 2 ? '⚔️ rivals · ' : '') + 'blk ' + fmt(f.acceptBlock) + ' · ▶</small>'; } }; }); },
      onPick: function (r) { if (window.V2ArenaScene) V2ArenaScene.sequence(r.f); else U.playFight(r.f); } });
    var rp = /^#replay-(\d+)$/.exec(location.hash || ''); if (rp && !render._rp && w.fights[rp[1] - 1]) { render._rp = 1; setTimeout(function () { if (window.V2ArenaScene) V2ArenaScene.sequence(w.fights[rp[1] - 1]); }, 600); }
    if ($('arVoice')) $('arVoice').onclick = function () { var on = !V2Announcer.voiceOn(); V2Announcer.setVoice(on); this.textContent = (on ? '🔊' : '🔇') + ' Announcer'; this.setAttribute('aria-pressed', on ? 'true' : 'false'); if (on) V2Announcer.speak('Announcer on'); };
    if ($('arQuick')) $('arQuick').onclick = function () { var q = window.V2QuickMatch && V2QuickMatch(w, my, th, tip, $('arA').value);
      if (!q) { $('arQmsg').textContent = '✋ No fair opponent free today'; return; } $('arA').value = q.a.id; $('arB').value = q.b.id;
      if ($('arB').value !== String(q.b.id)) { var op = document.createElement('option'); op.value = q.b.id; op.textContent = q.b.name + ' #' + q.b.id + ' · ⚡' + pow(q.b); $('arB').appendChild(op); $('arB').value = q.b.id; }
      $('arQmsg').textContent = '#' + q.a.id + ' ⚡' + pow(q.a) + ' vs #' + q.b.id + ' ⚡' + pow(q.b) + ' · tap Post to sign'; $('arPost').classList.add('ar-flash'); setTimeout(function () { $('arPost').classList.remove('ar-flash'); }, 1600); };
    $('arPost').onclick = function () { var a = $('arA').value, b = $('arB').value, sa = $('fMine'), sb = $('fTheirs'); if (!a || !b || !sa || !sb) return U.toast('Pick both pets');
      sa.value = a; sb.value = b; if (sa.value !== a || sb.value !== b) return U.toast('That pair can’t fight right now'); $('fGo').click(); };
    box.querySelectorAll('[data-aracc]').forEach(function (x) { x.onclick = function () { var id = x.dataset.aracc; U.confirmPlans('Accept fight ' + id, [{ tag: 'pet:accept:' + id, amount: 690 }], function () { U.afterAccept(id); }); }; });
    box.querySelectorAll('[data-arview]').forEach(function (x) { x.onclick = function () { var fv = w.fights[x.dataset.arview - 1]; if (window.V2ArenaScene) V2ArenaScene.sequence(fv); else U.playFight(fv); }; }); }
  window.V2Arena = { render: render, data: data };
})();
