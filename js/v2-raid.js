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
  /* hit meter (raid-meter, Oct 24 2026): arcade HP bar (segments, damage trail, color zones), combo slot and a live 'last hits' ticker. Display only. */
  function zone(pct) { return window.V2RaidAnim && V2RaidAnim.zone ? V2RaidAnim.zone(pct) : pct > 60 ? 'g' : pct > 30 ? 'y' : pct > 10 ? 'r' : 'd'; }
  function critTag(c) { return c === 3 ? ' <b class="rm-c3">3 TIMES!</b>' : c === 2 ? ' <b class="rm-c2">2 TIMES!</b>' : ''; }
  function meter(R, pct, st, w) { var z = st === 'won' ? 'k' : zone(pct), nm = function (id) { var p = w && w.byId && w.byId[id]; return p ? ' ' + esc(p.name) : ''; };
    var tick = R.hits.slice(-5).reverse().map(function (x) { return '<li><span class="rm-who">#' + x.petId + nm(x.petId) + '</span><span class="rm-dmg">-' + fmt(x.hit) + critTag(x.crit) + (x.petId === R.killPet && R.killBlock === x.block ? ' <b class="rm-kb">FINAL BLOW</b>' : '') + '</span></li>'; }).join('');
    return '<div class="rd-meter rm-z-' + z + '"><div class="rm-top"><span class="rm-lbl">' + (z === 'd' ? 'DANGER!' : z === 'k' ? 'DEFEATED' : 'BOSS HP') + '</span><span class="rm-pct">' + (pct > 0 && pct < 1 ? '<1' : Math.ceil(pct)) + '%</span></div>' +
      '<div class="rd-hp" role="progressbar" aria-label="Boss HP" aria-valuemin="0" aria-valuemax="' + R.hp + '" aria-valuenow="' + R.left + '"><b class="ra-lag" style="width:' + pct.toFixed(2) + '%"></b><i style="width:' + pct.toFixed(2) + '%"></i><em class="rm-seg" aria-hidden="true"></em><span>' + fmt(R.left) + ' / ' + fmt(R.hp) + ' HP</span></div>' +
      '<div class="rm-combo" aria-hidden="true"></div>' + (tick ? '<div class="rm-tick"><p class="rm-th">Last hits</p><ol aria-live="polite">' + tick + '</ol></div>' : '') + '</div>'; }
  function shown() { var p = $('raidPanel'); return !!(p && !p.hidden && p.getAttribute('aria-hidden') !== 'true' && !p.classList.contains('split-off')); }
  function draw() { var el = $('raidBox'), V = window.V2Rules; if (!el || !V || !V.raidInfo || !shown()) return; var w = world(), T = tip(); if (!w || !T) return;
    var b = T + 1, I = window.XCPETS_RAID_DEMO || V.raidInfo(w, b), R = I.raid, ME = me(), key = JSON.stringify([T, ME, R && R.left, R && R.board.length, R && R.settled, selPet]); if (key === last) return; last = key;
    scene(w, I, R, b);
    var h = '';
    if (!I.on && !R) { h = '<div class="rd-wait"><h3>Raids start at block ' + fmt(I.gate) + '</h3><p>' + (I.gate > b ? 'In ' + fmt(I.gate - b) + ' blocks (' + hrs(I.gate - b) + ').' : 'Waiting for the opening block hash.') + ' A boss appears, everyone burns to hit it, and if it falls every attacker gets a badge.</p></div>'; }
    else if (!R) { h = '<div class="rd-wait"><h3>The next raid opens at block ' + fmt(I.nextOpen) + '</h3><p>Waiting for the opening block hash to pick the boss.</p></div>'; }
    else { var B = R.boss, pct = Math.max(0, Math.min(100, R.left / R.hp * 100)), st = R.live ? 'live' : R.result === 'won' || R.killBlock != null ? 'won' : b <= R.end ? 'live' : 'escaped';
      h += '<div class="rd-stage rd-' + st + (B.event ? ' rd-event' : '') + '">' + (window.V2RaidAnim ? V2RaidAnim.stage(B, st) : '<div class="rd-boss"><img src="img/raids/' + esc(B.art) + '.png" alt="' + esc(B.name) + '"' + (st === 'won' ? ' class="rd-dead"' : '') + '></div>') + '<div class="rd-info">' +
        '<p class="rd-tag">Raid ' + R.n + (B.event ? ' · EVENT BOSS' : '') + (B.champion ? ' · LORD KEK VS ' + esc(String(B.name).toUpperCase()) : '') + '</p><h3>' + esc(B.name) + '</h3>' +
        (B.champion ? '<p class="small">Everyone burns to help Lord Kek defeat ' + esc(B.name) + '. Every hit is Lord Kek striking ' + esc(B.name) + '.</p>' : '') +
        meter(R, pct, st, w) +
        '<p class="small">' + (st === 'live' ? 'Open until block ' + fmt(R.end) + ' (' + fmt(R.end - b + 1) + ' blocks left, ' + hrs(R.end - b + 1) + ').' :
          st === 'won' ? '<b>Defeated</b> at block ' + fmt(R.killBlock) + (R.killPet != null ? ' by #' + R.killPet : ' by a community burn') + '. ' + (R.settled ? 'Rewards counted at block ' + fmt(R.countsAt) + '.' : 'Rewards count at block ' + fmt(R.countsAt) + ' (6 confirmations).') :
          '<b>Escaped</b> at block ' + fmt(R.end) + ' with HP left. No rewards this time.') + (st !== 'live' ? ' Next raid opens at block ' + fmt(I.nextOpen) + '.' : '') + '</p>' +
        (R.v2 ? '<p class="small rd-chip">🧱 Community chip: <b>' + fmt(R.chipTotal) + '</b> damage from ' + R.chipWallets + ' wallet' + (R.chipWallets === 1 ? '' : 's') + '. Every feed, breed and hatch while the raid is open hits the boss for ' + V.RAID.CHIP_PCT + '% of the burn.' + (R.settled && R.result === 'won' ? ' 🎡 ' + R.spinWallets + ' wallet' + (R.spinWallets === 1 ? '' : 's') + ' got ' + V.RAID.V2_SPINS + ' saved spin' + (V.RAID.V2_SPINS === 1 ? '' : 's') + '.' : ' If it falls, every wallet that hit it gets ' + V.RAID.V2_SPINS + ' saved Pepe Wheel spin' + (V.RAID.V2_SPINS === 1 ? '' : 's') + '.') + '</p>' : '') +
        (R.settled && R.lucky != null ? '<p class="small">🍀 Lucky drop: <a href="pet.html?id=' + R.lucky + '">#' + R.lucky + '</a> (Boss Relic + ' + V.RAID.RELIC_SPINS + ' saved Pepe Wheel spins)</p>' : '') + '</div></div>';
      if (st === 'live') h += attackBox(w, b, ME, R);
      h += '<h3 class="rd-h">Damage leaderboard</h3>' + (R.board.length ? '<table class="rd-board"><thead><tr><th>#</th><th>Pet</th><th>Damage</th><th>Hits</th></tr></thead><tbody>' + R.board.slice(0, 25).map(function (x) {
        return '<tr' + (x.owner === ME ? ' class="rd-me"' : '') + '><td>' + (x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank) + '</td><td><a href="pet.html?id=' + x.petId + '">#' + x.petId + ' ' + esc(x.name) + '</a>' + (x.petId === R.killPet ? ' 🗡️' : '') + '</td><td class="rm-pd"><i style="--w:' + Math.max(3, Math.round(x.dmg / (R.board[0].dmg || 1) * 100)) + '"></i><span>' + fmt(x.dmg) + '</span></td><td>' + x.hits + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted small">No hits yet. Be the first.</p>');
      if (R.hits.length) h += '<details class="rd-log"><summary>Hit log (' + R.hits.length + ')</summary><ol>' + R.hits.slice(-30).reverse().map(function (x) { return '<li>Block ' + fmt(x.block) + ': #' + x.petId + (R.boss.champion ? ' helped Lord Kek hit for ' : ' hit for ') + fmt(x.hit) + ' (burn ' + fmt(x.amount) + ' times ' + (x.mult / 100).toFixed(2) + (x.crit > 1 ? ' times ' + x.crit + (x.crit === 3 ? ' MEGA CRIT' : ' CRIT') : '') + ')</li>'; }).join('') + '</ol></details>'; }
    if (I.past && I.past.length) h += '<h3 class="rd-h">Past raids</h3><ul class="rd-past">' + I.past.map(function (x) { return '<li>Raid ' + x.n + ': ' + esc(x.boss.name) + ' · ' + (x.result === 'won' ? 'defeated (killing blow ' + (x.killPet != null ? '#' + x.killPet : 'by the community') + ')' : x.result === 'escaped' ? 'escaped' : 'counting') + '</li>'; }).join('') + '</ul>';
    h += '<details class="rd-how"><summary>How raids work</summary><ul><li>A new boss every ' + fmt(V.RAID.EVERY) + ' blocks (about a week). Each raid lasts ' + fmt(V.RAID.LEN) + ' blocks (about 3 days).</li>' +
      '<li>Attack = burn XCPETS with the memo <code>pet:raid:ID</code> (at least ' + V.RAID.MIN + '). One attack per pet per chain day (144 blocks).</li>' +
      '<li>Damage = burn amount times your pet multiplier (1.00 for a Hatchling up to 1.50 for a Legendary Mythic) times the crit roll (1 time, 2 times at 20%, 3 times at 5%).</li>' +
      '<li>If the boss falls: every attacker gets a raid badge, the top 3 by damage and the killing blow get trophies, and one lucky drop goes to an attacker (more damage = better odds). If it escapes, nobody gets anything.</li>' +
      (V.raidV2Gate && V.raidV2Gate() != null ? '<li>From block ' + fmt(V.raidV2Gate()) + ': bosses have 1/' + V.RAID.V2_DIV + ' of their old HP, every feed, breed and hatch during a raid chips ' + V.RAID.CHIP_PCT + '% of its burn into the boss, and every wallet that hits a fallen boss gets ' + V.RAID.V2_SPINS + ' saved spin.</li>' : '') +
      '<li>Results count after 6 confirmations. More on the <a href="rules.html#raids">rules page</a>.</li></ul></details>';
    el.innerHTML = h; bind(el, w, b, R); animate(el, R, b); }
  /* living-scenes (Nov 22 2026): hand the same raid to the canvas scene at the top of the page (js/v2-raid-scene.js). Display only. */
  function scene(w, I, R, b) { var RS = window.V2RaidScene; if (!RS || (RS._state && RS._state().demo)) return; try {
    if (!R) { RS.set({ mode: 'wait', nextIn: Math.max(0, (I.on ? I.nextOpen : I.gate) - b) || null }); return; }
    var st = R.live ? 'live' : R.result === 'won' || R.killBlock != null ? 'won' : b <= R.end ? 'live' : 'escaped', sp = function (id) { var p = w && w.byId && w.byId[id]; return p ? p.species : 'pepe'; };
    RS.set({ w: w, mode: st, boss: { name: R.boss.name, art: R.boss.art, champion: R.boss.champion || null }, hp: R.hp, left: R.left, blocksLeft: Math.max(0, R.end - b + 1), killPet: R.killPet,
      hits: R.hits.map(function (x) { return { petId: x.petId, hit: x.hit, crit: x.crit, sp: sp(x.petId), pet: w && w.byId ? w.byId[x.petId] : null }; }) }); } catch (e) { } }
  /* animation state survives the innerHTML rebuilds: last HP %, hit count and status per raid */
  var AS = {};
  function animate(el, R, b) { var A = window.V2RaidAnim; if (!A || !R) return; var wrap = el.querySelector('.ra-wrap'), bar = el.querySelector('.rd-hp');
    var pct = Math.max(0, Math.min(100, R.left / R.hp * 100)), st = R.live ? 'live' : R.result === 'won' || R.killBlock != null ? 'won' : b <= R.end ? 'live' : 'escaped', p = AS[R.n];
    if (!p) { AS[R.n] = { pct: pct, hits: R.hits.length, st: st }; if (wrap && st === 'live' && !A.reduced()) wrap.classList.add('ra-enter'); return; }
    A.hp(bar, p.pct, pct); var fresh = R.hits.slice(p.hits).slice(-5), li = el.querySelectorAll('.rm-tick li');
    for (var k = 0; k < fresh.length && k < li.length; k++) li[k].classList.add('rm-new');
    fresh.forEach(function (x, i) { setTimeout(function () { A.hit(wrap, { hit: x.hit, crit: x.crit, petId: x.petId, kill: st === 'won' && p.st !== 'won' && i === fresh.length - 1 }); }, i * 700); });
    if (st === 'won' && p.st !== 'won' && !fresh.length) A.defeat(wrap);
    if (st === 'escaped' && p.st === 'live') A.escape(wrap);
    AS[R.n] = { pct: pct, hits: R.hits.length, st: st }; }
  /* pet-picker (owner Jake Nov 22 2026: one fun, easy pet picker everywhere): the old radio list of every pet is replaced by the shared picker
   * (js/v2-pick.js): YOUR HITTER vs THE BOSS on top, "hits for about N" under it, then shelves of big sprite cards. Same raidPlan / raidWhy / confirm. */
  var PS = { shelf: 'best', st: {} }, PC = { k: '', all: null };
  function hitters(w, b, ME) { var V = window.V2Rules, k = [b, ME, w.pets.length, tip()].join('|'); if (PC.k === k && PC.w === w) return PC.all;
    var min = V.raidPlan(0, w, b, 0).amount, all = []; for (var i = 0; i < w.pets.length; i++) { var p = w.pets[i]; if (p.owner !== ME || p.dead || p.released) continue; all.push({ p: p, why: V.raidWhy(w, p, ME, min, b) || null, m: V.raidMult(p) }); }
    all.sort(function (x, y) { return (!!x.why - !!y.why) || y.m - x.m || x.p.id - y.p.id; }); PC = { k: k, w: w, all: all }; return all; }
  function dmg(p, a) { var V = window.V2Rules; return Math.floor((Number(a) || 0) * V.raidMult(p) / 100); }
  function attackBox(w, b, ME, R) { var V = window.V2Rules;
    if (!ME) return '<div class="rd-atk"><p>Connect your wallet to attack with your pets.</p></div>';
    var all = hitters(w, b, ME); if (!all.length) return '<div class="rd-atk"><p>You have no pets yet. <a href="play.html">Hatch one</a> to join the raid.</p></div>';
    var min = V.raidPlan(0, w, b, 0).amount;
    return '<div class="rd-atk"><h3 class="rd-h">Attack</h3><div id="rdPick"></div><p><label>Burn <input id="rdAmt" type="number" min="' + min + '" step="any" value="' + (PS.amt || min) + '"> XCPETS</label> <button class="btn" id="rdGo">' + (R.boss.champion ? '⚔️ Help Lord Kek' : '⚔️ Attack') + '</button></p><p class="small muted" id="rdEst">Pick a pet.</p></div>'; }
  function pick(w, b, ME, R) { var el = $('rdPick'), PK = window.V2Pick, V = window.V2Rules; if (!el) return; if (!PK) { setTimeout(function () { last = ''; draw(); }, 400); return; } /* the picker script loads after this one */ var all = hitters(w, b, ME), p = selPet && w.byId[selPet], amt = $('rdAmt'), a = amt ? amt.value : V.raidPlan(0, w, b, 0).amount;
    var ready = all.filter(function (x) { return !x.why; }), deco = function (c) { c = Object.assign({}, c); c.stat = '× ' + (c.m / 100).toFixed(2); c.line = STAGE[c.p.stage] + ' · ⚡ ' + (window.UXB && UXB.power ? UXB.power(c.p) : ''); return c; };
    var n = PS.st.n || 24, dec = function (L) { return L.slice(0, n).map(deco).concat(L.slice(n)); };
    var B = R.boss, bossArt = '<span class="pk2-big"><img src="img/raids/' + esc(B.art) + '.png" alt=""></span>';
    PK.render(el, { id: 'raid', w: w, mid: 'VS', active: 'A',
      slots: [{ key: 'A', label: 'YOUR HITTER', pet: p, empty: 'Pick a pet', buddy: p && p.id === PK.buddy(), clear: true, sub: p ? '× ' + (V.raidMult(p) / 100).toFixed(2) + ' damage' : '' },
        { key: 'B', label: B.champion ? 'LORD KEK VS' : 'THE BOSS', pet: { id: 0, name: B.name, tier: 3 }, art: bossArt, tagline: fmt(R.left) + ' HP left', locked: true }],
      verdict: p ? { tone: 'good', big: 'HITS FOR ABOUT ' + fmt(dmg(p, a)), small: fmt(dmg(p, a) * 2) + ' on a crit, ' + fmt(dmg(p, a) * 3) + ' on a mega crit. Older and rarer pets hit harder.' } : { tone: 'wait', big: 'PICK WHO HITS THE BOSS', small: 'Each pet can hit once per chain day.' },
      prompt: 'Pick your hitter', shelf: PS.shelf, searchList: PS.st.q ? dec(all.filter(function (c) { return PK.match(c.p, PS.st.q); })) : null, searchPh: 'Search ' + fmt(all.length) + ' pets: name, #number, species', selected: p ? p.id : '',
      shelves: [{ id: 'best', label: '⭐ Hardest hitters', list: dec(ready), why: 'Your pets that can hit today, biggest damage first.', empty: 'None of your pets can hit right now. Try 📋 All my pets to see why.' },
        { id: 'fav', label: '★ Favorites', list: dec(PK.favOf(all)), why: 'Tap the ☆ on any pet to keep it here.', empty: 'No favorites yet. Tap the ☆ on a pet.' },
        { id: 'recent', label: '🕘 Recent', list: dec(PK.recentOf(all)), why: 'Pets you picked lately, here and in other places.', empty: 'Nothing picked yet.' },
        { id: 'all', label: '📋 All my pets', list: dec(all), why: 'Every living pet. The ones that can\u2019t hit say why.', empty: 'No living pets yet.' }],
      drop: [document.getElementById('raidScene')], onRedraw: function () { pick(w, b, ME, R); },
      onSlot: function () { }, onClear: function () { selPet = null; last = ''; draw(); },
      onShelf: function (id) { PS.shelf = id; pick(w, b, ME, R); },
      onPick: function (c) { selPet = c.p.id; PK.used(c.p.id, true); PS.st.q = ''; last = ''; draw(); } }, PS.st); }
  function bind(el, w, b, R) { var V = window.V2Rules, go = $('rdGo'), amt = $('rdAmt'), est = $('rdEst'); if (!go) return; pick(w, b, me(), R);
    function upd() { var p = selPet && w.byId[selPet], a = Number(amt.value) || 0; PS.amt = amt.value; est.textContent = p ? 'Hit for about ' + fmt(Math.floor(a * V.raidMult(p) / 100)) + ' damage, ' + fmt(Math.floor(a * V.raidMult(p) / 100) * 2) + ' on a crit, ' + fmt(Math.floor(a * V.raidMult(p) / 100) * 3) + ' on a mega crit.' : 'Pick a pet.';
      var vb = el.querySelector('#rdPick .pk2-v b'), vs = el.querySelector('#rdPick .pk2-v span'); if (p && vb) { vb.textContent = 'HITS FOR ABOUT ' + fmt(dmg(p, a)); if (vs) vs.textContent = fmt(dmg(p, a) * 2) + ' on a crit, ' + fmt(dmg(p, a) * 3) + ' on a mega crit. Older and rarer pets hit harder.'; } }
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
      A.hit(wrap, { hit: kind === 'crit3' ? 36000 : kind === 'crit2' ? 24000 : 12000, crit: kind === 'crit3' ? 3 : kind === 'crit2' ? 2 : 1, kill: kind === 'final' }); } };
})();
