/* XCPETS quest-clarity-1103 (UI only; owner OK "Put it live" Nov 3 2026 5:37 PM CT). Display only: no burns, no rule changes.
 *  1) V2QuestClarity.outcomes(w, p, code, b): what a quest can bring home, with this pet's odds from V2Rules.questOdds (js/v2-rules.js).
 *  2) V2QuestClarity.lastLine(w, p): the last Homecoming result, kept on the pet card after the 1-day Homecoming box is gone.
 *  3) "My cooldowns" in Gooby's No-Tail Motel (#breedPanel): every pet of the connected wallet with breed-ready and quest-ready timers.
 * The three numbers below are not exported by V2Rules; they MIRROR js/v2-rules.js and tools/quest-clarity-test.js fails if they ever differ:
 *   QUEST_STAT_CAP = 3, AMBUSH_1_IN = 69 (FUNTRUMP's own quests: 2 in 69), JACKPOT = { twin1In: 5, mutation1In: 5, hidden1In: 3, legMix1In: 2 }. */
(function () {
  'use strict';
  var MIRROR = { QUEST_STAT_CAP: 3, AMBUSH_1_IN: 69, AMBUSH_FT: 2, JACKPOT: { twin1In: 5, mutation1In: 5, hidden1In: 3, legMix1In: 2 } };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };
  var pct = function (bp) { return String(Number((bp / 100).toFixed(2))) + '%'; };
  var hrs = function (blocks) { var h = blocks / 6; return h < 1 ? 'under an hour' : h < 48 ? 'about ' + Math.round(h) + ' hours' : 'about ' + Math.round(h / 24) + ' days'; };
  var STAT = { vigor: 'Vigor', spark: 'Spark', grit: 'Grit', zoom: 'Zoom', luck: 'Luck' };
  function V() { return window.V2Rules; }
  function world() { var M = window.V2Mock; try { return M && M.world ? M.world() : null; } catch (e) { return null; } }
  function tip() { var M = window.V2Mock, S = M && M.state && M.state(); return S && S.tip ? S.tip : 0; }
  function me() { return (window.V2Mock && V2Mock.ME) || ''; }
  /* what each tier brings, per quest (read from questHome in js/v2-rules.js: Haul n = 2, Loot n = 1; Cold Haul = 1 Jackpot Egg, Cold Loot = 1 saved spin) */
  function prize(code, tier) {
    var two = tier === 'haul';
    if (code === 'spam') return two ? '2 everyday gear pieces' : '1 everyday gear piece';
    if (code === 'kek') return two ? '2 rare gear pieces' : '1 rare gear piece';
    if (code === 'mine') return two ? '2 gold rare gear pieces (a rare piece if no gold piece fits)' : '1 gold rare gear piece (a rare piece if no gold piece fits)';
    if (code === 'wiz') return two ? '6 saved spins' : '3 saved spins';
    if (code === 'cold') return two ? '1 Jackpot Egg' : '1 saved spin';
    return ''; }
  /* POWER SHARDS (quest-shards-1103, gated by V2Rules.shardsOn; numbers read from V2Rules.QUEST_SHARDS / SHARD_CAP / SHARD_STAT_MAX, not mirrored) */
  function shardsOn(b) { var R = V(); return !!(R && R.shardsOn && R.shardsOn(b) && R.QUEST_SHARDS); }
  function shardWord(n) { return n + ' Power Shard' + (n === 1 ? '' : 's'); }
  function prizeS(code, tier) { var R = V(), n = R.QUEST_SHARDS[code][tier === 'haul' ? 0 : 1];
    if (code === 'cold' && tier === 'loot') return shardWord(n); /* Cold Loot: the shard replaces the saved spin */
    return prize(code, tier) + ' + ' + shardWord(n); }
  function eggNote(b) { var R = V(), J = MIRROR.JACKPOT, s = 'Jackpot Egg = a free Legendary hybrid egg (twins 1 in ' + J.twin1In + ', mutation 1 in ' + J.mutation1In + ', hidden trait 1 in ' + J.hidden1In + ', three-way look 1 in ' + J.legMix1In + ').';
    var cap = R.breedsLeft ? R.breedsLeft({}, b).cap : 6;
    if (R.jackpotNobreedOn && R.jackpotNobreedOn(b)) s += ' It counts as a child of this pet but uses none of its ' + cap + ' lifetime breeds. No cooldown, and the egg comes even when the pet has no breeds left.'; /* jackpot-nobreed-1103 (gated) */
    else if (R.jackpotChildOn && R.jackpotChildOn(b)) s += ' It counts as a child: it uses 1 of this pet\u2019s ' + cap + ' lifetime breeds (twins count once). No cooldown, and the egg comes even when the pet has no breeds left.';
    return s; }
  function outcomes(w, p, code, b) { var R = V(); if (!R || !R.QUESTS || !R.QUESTS[code] || !R.questOdds) return '';
    var Q = R.QUESTS[code], od = R.questOdds(w, p, code, b), T = R.QUEST_TIERS, base = Q.odds, isFT = p && p.species === 'funtrump' && !p.community;
    var boostLeft = Math.max(0, MIRROR.QUEST_STAT_CAP - ((p && p.questBoost) || 0)), favs = Q.fav.map(function (k) { return STAT[k] || k; }).join(' or '), sh = shardsOn(b), room = sh && R.shardRoom ? R.shardRoom(p || {}) : 0;
    var roomTxt = sh ? (room ? ' (this pet can still gain ' + room + ')' : ' (this pet already has all ' + R.SHARD_CAP + ' shard points; the shards are skipped)') : '';
    var row = function (ico, name, bp, b0, what) { return '<li><span class="qc-t">' + ico + ' ' + esc(name) + '</span><b class="qc-p">' + pct(bp) + '</b>' + (bp !== b0 ? '<span class="qc-base">base ' + pct(b0) + '</span>' : '') + '<span class="qc-w">' + what + '</span></li>'; };
    var h = '<details class="qc-out"><summary>What it can bring home</summary><ul>' +
      (sh ? row('🏆', T.haul, od.haul, base[0], esc(prizeS(code, 'haul')) + esc(roomTxt)) + row('🎒', T.loot, od.loot, base[1], esc(prizeS(code, 'loot')) + esc(roomTxt)) :
      row('🏆', T.haul, od.haul, base[0], esc(prize(code, 'haul')) + ' + 1 ' + esc(favs) + (boostLeft ? ' (this pet can still gain ' + boostLeft + ')' : ' (this pet already has the most stat gains: ' + MIRROR.QUEST_STAT_CAP + ')')) +
      row('🎒', T.loot, od.loot, base[1], esc(prize(code, 'loot')))) +
      row('🕳️', T.empty, od.empty, base[2], 'nothing') + '</ul>';
    h += '<p class="qc-n">Any result: ' + (isFT ? MIRROR.AMBUSH_FT : 1) + ' in ' + MIRROR.AMBUSH_1_IN + ' FUNTRUMP Ambush = a bonus Jackpot Egg' + (isFT ? ' (FUNTRUMP\u2019s badge always)' : ' + FUNTRUMP badge') + '. Always: the ' + esc(Q.badge) + ' and ' + (Q.look.by === 'haul' ? esc(Q.look.name) + ' progress on a ' + esc(T.haul) : esc(Q.look.name) + ' progress') + '. No pet dies on a quest.</p>';
    if (sh) h += '<p class="qc-n qc-sh">💠 Power Shard = +1 to ' + esc(favs) + ' for good, spread across both stats. Up to ' + R.SHARD_CAP + ' per pet, ' + R.SHARD_STAT_MAX + ' in one stat. Shard points count in Power, fights and rankings, and pass to eggs at half strength.</p>';
    if (od.shift) h += '<p class="qc-n">This pet\u2019s boost: +' + pct(od.shift) + ' moved from ' + esc(T.empty) + ' to ' + esc(T.haul) + ' (' + esc(favs) + ' above the Mythic average' + (od.gearPts ? ', ' + esc(Q.slot) + ' gear' : '') + ').</p>';
    else h += '<p class="qc-n">Raise the odds: ' + esc(favs) + ' above the Mythic average, or wear ' + esc(Q.slot) + ' gear.</p>';
    if (code === 'cold') h += '<p class="qc-n">' + esc(eggNote(b)) + '</p>';
    h += '<p class="qc-n">Away ' + fmt(Q.len) + ' blocks (' + hrs(Q.len) + '), then Nap Time ' + fmt(Q.len / 2) + ' blocks (no quests; fights, breeding and feeding are fine).</p></details>';
    return h; }
  function rewardWord(r) { return r.kind === 'gear' ? (r.star ? '★ ' : '') + r.label : r.kind === 'spins' ? r.n + ' saved spin' + (r.n > 1 ? 's' : '') : r.kind === 'egg' ? (r.ambush ? 'FUNTRUMP Ambush Jackpot Egg #' : 'Jackpot Egg #') + r.petId : r.kind === 'stat' ? '+1 ' + (STAT[r.stat] || r.stat) : r.kind === 'shards' ? '💠 ' + shardWord(r.n) + ' (' + Object.keys(r.stats || {}).map(function (k) { return (STAT[k] || k) + ' +' + r.stats[k]; }).join(', ') + ')' : ''; }
  function lastLine(w, p) { var R = V(), H = p && p.questHist; if (!R || !H || !H.length) return ''; var q = H[H.length - 1], Q = R.QUESTS[q.code] || {};
    var got = (q.rewards || []).map(rewardWord).filter(Boolean);
    return '<p class="qc-last"><b>Last quest:</b> ' + esc(Q.name || q.code) + ', ' + esc(R.QUEST_TIERS[q.tier]) + (got.length ? ': ' + esc(got.join(', ')) : ' (nothing this time)') + ' <span class="muted">(home at block ' + fmt(q.end) + ')</span>' + (H.length > 1 ? ' · ' + H.length + ' quests in all' : '') + '</p>'; }
  /* ---- My cooldowns ---- */
  function timers(w, p, b) { var R = V(), out = { breed: null, bWhy: '', quest: null, qWhy: '', left: null };
    var bl = R.breedsLeft ? R.breedsLeft(p, b) : null; if (bl && bl.on) out.left = bl;
    var why = R.breedable ? R.breedable(p, b) : null, cool = R.mgBreedCool ? R.mgBreedCool(p) : R.BREED_COOLDOWN;
    if (bl && bl.on && bl.left <= 0) out.bWhy = 'no breeds left';
    else if (!why) out.breed = 0;
    else if (/cooldown/.test(why) && p.lastBreed != null) out.breed = Math.max(0, p.lastBreed + cool - b);
    else if (/quest/.test(why) && p.quest) { out.breed = Math.max(0, p.quest.end - b); out.bWhy = 'away on a quest'; }
    else out.bWhy = why;
    if (!R.questOn || !R.questOn(b)) out.qWhy = 'quests not open';
    else if (!R.isMythic(p)) out.qWhy = 'not Mythic';
    else { var I = R.questInfo(w, p, b) || {};
      if (I.away) { out.quest = I.away.end - b + (R.QUESTS[I.away.code].len / 2); out.qWhy = 'away: ' + I.away.name + ', home in ' + fmt(I.away.left) + ' blocks, then Nap Time'; }
      else if (I.napUntil) { out.quest = I.napUntil - b; out.qWhy = 'Nap Time'; }
      else out.quest = 0; }
    return out; }
  function cell(n, why) { if (n === 0) return '<span class="qc-ok">Ready</span>' + (why ? '<small>' + esc(why) + '</small>' : '');
    if (n == null) return '<span class="qc-no">—</span><small>' + esc(why) + '</small>';
    return '<b>' + fmt(n) + ' blocks</b><small>' + hrs(n) + (why ? ' · ' + esc(why) : '') + '</small>'; }
  var SORTS = { either: 'Soonest ready (breed or quest)', breed: 'Soonest breed-ready', quest: 'Soonest quest-ready', id: 'Pet number' };
  var st = { sort: 'either', all: false }, lastKey = '';
  try { var sv = localStorage.getItem('xcpets-cooldowns-sort'); if (SORTS[sv]) st.sort = sv; } catch (e) {}
  function key(t, k) { var x = k === 'either' ? [t.breed, t.quest].filter(function (v) { return v != null; }) : [t[k]]; x = x.filter(function (v) { return v != null; }); return x.length ? Math.min.apply(null, x) : Infinity; }
  function paint(force) { var R = V(), w = world(), host = $('breedPanel'); if (!R || !w || !w.pets || !host) return; var b = tip() + 1, a = me();
    var k = [w.tip, b, a, st.sort, st.all].join('|'); if (!force && k === lastKey && $('myCooldowns')) return; lastKey = k;
    var el = $('myCooldowns'); if (!el) { el = document.createElement('div'); el.id = 'myCooldowns'; el.className = 'qc-cool'; var at = $('motelBook') || $('motelDesk'); if (at && at.parentNode) at.parentNode.insertBefore(el, at.nextSibling); else host.appendChild(el); }
    var h = '<h3 class="qc-h">⏱️ My cooldowns</h3>';
    if (!a) { el.innerHTML = h + '<p class="small muted">Connect a wallet to see when each of your pets can breed or quest again.</p>'; return; }
    var pets = w.pets.filter(function (p) { return p.owner === a && !p.dead && !p.released && !p.community; }).map(function (p) { return { p: p, t: timers(w, p, b) }; });
    if (!pets.length) { el.innerHTML = h + '<p class="small muted">No living pets in this wallet.</p>'; return; }
    pets.sort(function (x, y) { if (st.sort === 'id') return x.p.id - y.p.id; return key(x.t, st.sort) - key(y.t, st.sort) || x.p.id - y.p.id; });
    var nB = pets.filter(function (r) { return r.t.breed === 0; }).length, nQ = pets.filter(function (r) { return r.t.quest === 0; }).length, live = pets.filter(function (r) { return key(r.t, 'either') < Infinity; }), nNo = pets.length - live.length, list = st.all ? pets : live, show = st.all ? pets : live.slice(0, 25);
    h += '<p class="small">' + fmt(pets.length) + ' pets · <b>' + fmt(nB) + '</b> can breed now · <b>' + fmt(nQ) + '</b> can quest now. Block ' + fmt(b - 1) + '; 6 blocks is about an hour.</p>' +
      '<label class="small">Sort: <select id="qcSort">' + Object.keys(SORTS).map(function (s) { return '<option value="' + s + '"' + (s === st.sort ? ' selected' : '') + '>' + SORTS[s] + '</option>'; }).join('') + '</select></label>' +
      '<div class="qc-wrap"><table class="qc-tab"><thead><tr><th>Pet</th><th>Breed</th><th>Breeds left</th><th>Quest</th></tr></thead><tbody>' + show.map(function (r) { var p = r.p, t = r.t;
        return '<tr><td><a href="pet.html?id=' + p.id + '">#' + p.id + ' ' + esc(p.name || '') + '</a>' + (R.isMythic(p) ? ' <span class="qc-m">MYTHIC</span>' : '') + '</td><td>' + cell(t.breed, t.bWhy) + '</td><td>' + (t.left ? t.left.left + ' of ' + t.left.cap : '—') + '</td><td>' + cell(t.quest, t.qWhy) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (list.length > show.length || nNo ? '<p class="small muted">' + (st.all ? 'Showing all ' + fmt(pets.length) + ' pets.' : 'Showing ' + fmt(show.length) + ' of ' + fmt(live.length) + ' pets with a timer' + (nNo ? '; ' + fmt(nNo) + ' more can\u2019t breed or quest yet (not Adult or not Mythic)' : '') + '.') + '</p><button type="button" class="q" id="qcAll">' + (st.all ? 'Show only pets with a timer' : 'Show all ' + fmt(pets.length)) + '</button>' : '');
    el.innerHTML = h;
    var s = $('qcSort'); if (s) s.onchange = function () { st.sort = s.value; try { localStorage.setItem('xcpets-cooldowns-sort', st.sort); } catch (e) {} paint(true); };
    var m = $('qcAll'); if (m) m.onclick = function () { st.all = !st.all; paint(true); }; }
  function css() { if ($('qcCss') || !document.head) return; var s = document.createElement('style'); s.id = 'qcCss'; s.textContent =
    '.qc-out{margin-top:6px;font-size:12px;line-height:1.4}.qc-out summary{cursor:pointer;font-weight:700}.qc-out ul{list-style:none;margin:6px 0;padding:0}' +
    '.qc-out li{display:grid;grid-template-columns:1fr auto;gap:0 6px;padding:4px 0;border-top:1px dashed rgba(0,0,0,.25)}.qc-out .qc-p{text-align:right}.qc-out .qc-base{grid-column:2;text-align:right;font-size:10px;opacity:.7}.qc-out .qc-w{grid-column:1/3;font-size:11px}' +
    '.pc-q .qc-out{grid-column:1/-1;grid-row:3}.pc-q:has(.ip-why) .qc-out{grid-column:2/-1}.pc-q:has(.qc-out) .ip-why{grid-column:1;grid-row:3;align-self:start;margin-top:6px}.qc-n{margin:4px 0;font-size:11px}.qc-last{margin:6px 0;font-size:12px}' +
    '.qc-sh{background:rgba(79,157,255,.12);padding:3px 5px;border-left:3px solid #4f9dff}.qc-cool{margin:14px 0;padding:10px;border:3px solid #1a0d1f;background:#fff4d6;color:#2b1928;box-shadow:4px 4px 0 #1a0d1f}.qc-h{margin:0 0 6px;font-family:"Press Start 2P",monospace;font-size:12px}' +
    '.qc-wrap{overflow-x:auto;margin:8px 0}.qc-tab{border-collapse:collapse;width:100%;font-size:12px}.qc-tab th,.qc-tab td{border-bottom:1px solid rgba(0,0,0,.2);padding:5px 6px;text-align:left;vertical-align:top}' +
    '.qc-tab td small{display:block;font-size:10px;opacity:.75}.qc-tab a{color:inherit;font-weight:700}.qc-ok{color:#11772a;font-weight:700}.qc-no{opacity:.6}.qc-m{font-size:9px;background:#1a0d1f;color:#ffd84a;padding:1px 3px}' +
    '@media (max-width:480px){.qc-tab th:nth-child(3),.qc-tab td:nth-child(3){display:none}.qc-tab{font-size:11px}}';
    document.head.appendChild(s); }
  css();
  window.V2QuestClarity = { outcomes: outcomes, lastLine: lastLine, timers: timers, paint: paint, MIRROR: MIRROR };
  if (document.body && $('breedPanel')) { setTimeout(paint, 600); setInterval(paint, 3000); }
})();
