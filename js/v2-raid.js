/* XCPETS Raids page (raid.html, branch raids, Oct 24 2026). Display + one burn button; every rule lives in js/v2-rules.js (raid*).
 * Attack = the normal burn flow: V2UI.confirmPlans('Raid attack', [{ tag: 'pet:raid:ID', amount }]) -> XCP Wallet. The site never signs. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); };
  var hrs = function (blocks) { var h = blocks * 10 / 60; return h < 1 ? 'under an hour' : h < 48 ? 'about ' + Math.round(h) + ' hours' : 'about ' + Math.round(h / 24) + ' days'; };
  var STAGE = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  function world() { var M = window.V2Mock; try { return M && M.world ? M.world() : null; } catch (e) { return null; } }
  function tip() { var M = window.V2Mock, S = M && M.state && M.state(); return (S && S.tip) || 0; }
  function me() { return (window.V2Mock && V2Mock.ME) || (window.V2UI && V2UI.ME) || null; }
  var last = '', selPet = null;
  function draw() { var el = $('raidBox'), V = window.V2Rules; if (!el || !V || !V.raidInfo) return; var w = world(), T = tip(); if (!w || !T) return;
    var b = T + 1, I = window.XCPETS_RAID_DEMO || V.raidInfo(w, b), R = I.raid, ME = me(), key = JSON.stringify([T, ME, R && R.left, R && R.board.length, R && R.settled, selPet]); if (key === last) return; last = key;
    var h = '';
    if (!I.on && !R) { h = '<div class="rd-wait"><h3>Raids start at block ' + fmt(I.gate) + '</h3><p>' + (I.gate > b ? 'In ' + fmt(I.gate - b) + ' blocks (' + hrs(I.gate - b) + ').' : 'Waiting for the opening block hash.') + ' A boss appears, everyone burns to hit it, and if it falls every attacker gets a badge.</p></div>'; }
    else if (!R) { h = '<div class="rd-wait"><h3>Raid 1 opens at block ' + fmt(I.nextOpen) + '</h3><p>Waiting for the opening block hash to pick the boss.</p></div>'; }
    else { var B = R.boss, pct = Math.max(0, Math.min(100, R.left / R.hp * 100)), st = R.live ? 'live' : R.result === 'won' || R.killBlock != null ? 'won' : b <= R.end ? 'live' : 'escaped';
      h += '<div class="rd-stage rd-' + st + (B.event ? ' rd-event' : '') + '">' + (window.V2RaidAnim ? V2RaidAnim.stage(B, st) : '<div class="rd-boss"><img src="img/raids/' + esc(B.art) + '.png" alt="' + esc(B.name) + '"' + (st === 'won' ? ' class="rd-dead"' : '') + '></div>') + '<div class="rd-info">' +
        '<p class="rd-tag">Raid ' + R.n + (B.event ? ' · EVENT BOSS' : '') + (B.champion ? ' · LORD KEK VS ' + esc(String(B.name).toUpperCase()) : '') + '</p><h3>' + esc(B.name) + '</h3>' +
        (B.champion ? '<p class="small">Everyone burns to help Lord Kek defeat ' + esc(B.name) + '. Every hit is Lord Kek striking ' + esc(B.name) + '.</p>' : '') +
        '<div class="rd-hp" role="progressbar" aria-valuemin="0" aria-valuemax="' + R.hp + '" aria-valuenow="' + R.left + '"><b class="ra-lag" style="width:' + pct.toFixed(2) + '%"></b><i style="width:' + pct.toFixed(2) + '%"></i><span>' + fmt(R.left) + ' / ' + fmt(R.hp) + ' HP</span></div>' +
        '<p class="small">' + (st === 'live' ? 'Open until block ' + fmt(R.end) + ' (' + fmt(R.end - b + 1) + ' blocks left, ' + hrs(R.end - b + 1) + ').' :
          st === 'won' ? '<b>Defeated</b> at block ' + fmt(R.killBlock) + ' by #' + R.killPet + '. ' + (R.settled ? 'Rewards counted at block ' + fmt(R.countsAt) + '.' : 'Rewards count at block ' + fmt(R.countsAt) + ' (6 confirmations).') :
          '<b>Escaped</b> at block ' + fmt(R.end) + ' with HP left. No rewards this time.') + (st !== 'live' ? ' Next raid opens at block ' + fmt(I.nextOpen) + '.' : '') + '</p>' +
        (R.settled && R.lucky != null ? '<p class="small">🍀 Lucky drop: <a href="pet.html?id=' + R.lucky + '">#' + R.lucky + '</a> (Boss Relic + ' + V.RAID.RELIC_SPINS + ' saved Pepe Wheel spins)</p>' : '') + '</div></div>';
      if (st === 'live') h += attackBox(w, b, ME, R);
      h += '<h3 class="rd-h">Damage leaderboard</h3>' + (R.board.length ? '<table class="rd-board"><thead><tr><th>#</th><th>Pet</th><th>Damage</th><th>Hits</th></tr></thead><tbody>' + R.board.slice(0, 25).map(function (x) {
        return '<tr' + (x.owner === ME ? ' class="rd-me"' : '') + '><td>' + (x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank) + '</td><td><a href="pet.html?id=' + x.petId + '">#' + x.petId + ' ' + esc(x.name) + '</a>' + (x.petId === R.killPet ? ' 🗡️' : '') + '</td><td>' + fmt(x.dmg) + '</td><td>' + x.hits + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted small">No hits yet. Be the first.</p>');
      if (R.hits.length) h += '<details class="rd-log"><summary>Hit log (' + R.hits.length + ')</summary><ol>' + R.hits.slice(-30).reverse().map(function (x) { return '<li>Block ' + fmt(x.block) + ': #' + x.petId + (R.boss.champion ? ' helped Lord Kek hit for ' : ' hit for ') + fmt(x.hit) + ' (burn ' + fmt(x.amount) + ' times ' + (x.mult / 100).toFixed(2) + (x.crit > 1 ? ' times ' + x.crit + (x.crit === 3 ? ' MEGA CRIT' : ' CRIT') : '') + ')</li>'; }).join('') + '</ol></details>'; }
    if (I.past && I.past.length) h += '<h3 class="rd-h">Past raids</h3><ul class="rd-past">' + I.past.map(function (x) { return '<li>Raid ' + x.n + ': ' + esc(x.boss.name) + ' · ' + (x.result === 'won' ? 'defeated (killing blow #' + x.killPet + ')' : x.result === 'escaped' ? 'escaped' : 'counting') + '</li>'; }).join('') + '</ul>';
    h += '<details class="rd-how"><summary>How raids work</summary><ul><li>A new boss every ' + fmt(V.RAID.EVERY) + ' blocks (about a week). Each raid lasts ' + fmt(V.RAID.LEN) + ' blocks (about 3 days).</li>' +
      '<li>Attack = burn XCPETS with the memo <code>pet:raid:ID</code> (at least ' + V.RAID.MIN + '). One attack per pet per chain day (144 blocks).</li>' +
      '<li>Damage = burn amount times your pet multiplier (1.00 for a Hatchling up to 1.50 for a Legendary Mythic) times the crit roll (1 time, 2 times at 20%, 3 times at 5%).</li>' +
      '<li>If the boss falls: every attacker gets a raid badge, the top 3 by damage and the killing blow get trophies, and one lucky drop goes to an attacker (more damage = better odds). If it escapes, nobody gets anything.</li>' +
      '<li>Results count after 6 confirmations. More on the <a href="rules.html#raids">rules page</a>.</li></ul></details>';
    el.innerHTML = h; bind(el, w, b, R); animate(el, R, b); }
  /* animation state survives the innerHTML rebuilds: last HP %, hit count and status per raid */
  var AS = {};
  function animate(el, R, b) { var A = window.V2RaidAnim; if (!A || !R) return; var wrap = el.querySelector('.ra-wrap'), bar = el.querySelector('.rd-hp');
    var pct = Math.max(0, Math.min(100, R.left / R.hp * 100)), st = R.live ? 'live' : R.result === 'won' || R.killBlock != null ? 'won' : b <= R.end ? 'live' : 'escaped', p = AS[R.n];
    if (!p) { AS[R.n] = { pct: pct, hits: R.hits.length, st: st }; if (wrap && st === 'live' && !A.reduced()) wrap.classList.add('ra-enter'); return; }
    A.hp(bar, p.pct, pct); var fresh = R.hits.slice(p.hits).slice(-5);
    fresh.forEach(function (x, i) { setTimeout(function () { A.hit(wrap, { hit: x.hit, crit: x.crit, petId: x.petId, kill: st === 'won' && p.st !== 'won' && i === fresh.length - 1 }); }, i * 700); });
    if (st === 'won' && p.st !== 'won' && !fresh.length) A.defeat(wrap);
    if (st === 'escaped' && p.st === 'live') A.escape(wrap);
    AS[R.n] = { pct: pct, hits: R.hits.length, st: st }; }
  function attackBox(w, b, ME, R) { var V = window.V2Rules;
    if (!ME) return '<div class="rd-atk"><p>Connect your wallet to attack with your pets.</p></div>';
    var mine = w.pets.filter(function (p) { return p.owner === ME && !p.dead && !p.released; }); if (!mine.length) return '<div class="rd-atk"><p>You have no pets yet. <a href="play.html">Hatch one</a> to join the raid.</p></div>';
    var min = V.raidPlan(0, w, b, 0).amount, rows = mine.map(function (p) { var why = V.raidWhy(w, p, ME, min, b);
      return '<label class="rd-pet' + (why ? ' rd-no' : '') + '"><input type="radio" name="rdpet" value="' + p.id + '"' + (why ? ' disabled' : '') + (selPet === p.id && !why ? ' checked' : '') + '> #' + p.id + ' ' + esc(p.name) + ' <span class="muted small">' + STAGE[p.stage] + ' · ' + (V.raidMult(p) / 100).toFixed(2) + ' times' + (why ? ' · ' + esc(why) : '') + '</span></label>'; }).join('');
    return '<div class="rd-atk"><h3 class="rd-h">Attack</h3><div class="rd-pets">' + rows + '</div><p><label>Burn <input id="rdAmt" type="number" min="' + min + '" step="any" value="' + min + '"> XCPETS</label> <button class="btn" id="rdGo">' + (R.boss.champion ? '⚔️ Help Lord Kek' : '⚔️ Attack') + '</button></p><p class="small muted" id="rdEst">Pick a pet.</p></div>'; }
  function bind(el, w, b, R) { var V = window.V2Rules, go = $('rdGo'), amt = $('rdAmt'), est = $('rdEst'); if (!go) return;
    function upd() { var p = selPet && w.byId[selPet], a = Number(amt.value) || 0; est.textContent = p ? 'Hit for about ' + fmt(Math.floor(a * V.raidMult(p) / 100)) + ' damage, ' + fmt(Math.floor(a * V.raidMult(p) / 100) * 2) + ' on a crit, ' + fmt(Math.floor(a * V.raidMult(p) / 100) * 3) + ' on a mega crit.' : 'Pick a pet.'; }
    el.querySelectorAll('input[name=rdpet]').forEach(function (x) { x.onchange = function () { selPet = Number(x.value); upd(); }; });
    amt.oninput = upd; upd();
    go.onclick = function () { var p = selPet && w.byId[selPet]; if (!p) { est.textContent = 'Pick a pet first.'; return; } var pl = V.raidPlan(p.id, w, b, amt.value), why = V.raidWhy(w, p, me(), pl.amount, b);
      if (why) { est.textContent = 'Not now: ' + why; return; }
      if (!window.V2UI || !V2UI.confirmPlans) { est.textContent = 'The game is still loading.'; return; }
      V2UI.confirmPlans('Raid attack on ' + R.boss.name, [pl]); }; }
  function boot() { if (!$('raidBox')) return; draw(); setInterval(draw, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.V2Raid = { draw: function () { last = ''; draw(); },
    /* preview / recording helper: play one effect on the current stage. kind = hit | crit2 | crit3 | defeat | escape */
    play: function (kind) { var A = window.V2RaidAnim, wrap = document.querySelector('#raidBox .ra-wrap'); if (!A || !wrap) return;
      if (kind === 'defeat') return A.defeat(wrap); if (kind === 'escape') return A.escape(wrap);
      A.hit(wrap, { hit: kind === 'crit3' ? 36000 : kind === 'crit2' ? 24000 : 12000, crit: kind === 'crit3' ? 3 : kind === 'crit2' ? 2 : 1 }); } };
})();
