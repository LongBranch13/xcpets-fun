/* XCPETS badges v1 (Oct 22 2026). DISPLAY ONLY: computed from the replayed world + the burn rows; never changes the world,
 * so replay-check stays SAME. Owner answers (Oct 22): badges tied to a pet are lost with the pet (released / no longer owned);
 * weekly boards close every 1,008 blocks from WEEK_ANCHOR; all-time top 3 (gold/silver/bronze) are lost when passed;
 * hybrids don't count for the dex; no community-pet badges; joke badges are public; no gameplay effect. */
(function (root) {
  'use strict';
  var ACTIVATE_BADGES_BLOCK = 972641; /* display gate: deploy Oct 22 2026 ~12:20 PM CT, tip 972,635 + 6 (owner approved) */
  var WEEK = 1008, WEEK_ANCHOR = 971501 /* = V2_FROM_BLOCK, first v2 block */;
  var DEX = ['pepe', 'wojak', 'chud', 'peepo', 'doge', 'bobo', 'mumu', 'sarutobi', 'lenny', 'snibby', 'kevin', 'dodo', 'nakamoto'];
  var TIER_NAMES = ['bronze', 'silver', 'gold'], TIER_RAR = ['uncommon', 'rare', 'legendary'], RAR_SCORE = { common: 1, uncommon: 3, rare: 10, legendary: 33 };
  /* id, name, flavour, rule, rarity or tier thresholds, pet-scoped? */
  var DEFS = [
    ['burn-chain', 'CHAIN GANG', 'Block after block after block.', 'Burns in {N} blocks in a row', [3, 6, 12]],
    ['daily-burn', 'NUMBER GO UP', 'Line only goes one way.', 'A burn on {N} chain days in a row', [7, 30, 100]],
    ['feed-streak', 'GOOD BOI KEEPER', 'Who\u2019s a good pet? Yours.', 'One pet fed {N} days in a row', [7, 30, 100], 1],
    ['perfect-month', 'NEVER SKIPPED LEG DAY', '30 days, zero hungry pets.', '30 days in a row with every pet fed (3+ pets)', 'rare'],
    ['first-win', 'FIRST BLOOD, BROTHER', 'OHHH! What a debut!', 'Win your first arena fight', 'common', 1],
    ['belt', 'TITLE BELT', 'The gold comes out of the case!', 'A pet wins 3 fights in a row', 'rare', 1],
    ['ten-wins', 'DOUBLE DIGITS', 'Ten, brother. TEN.', '{N} arena wins across your pets', [10, 25, 100]],
    ['upset', 'DAVID VS CHAD', 'Nobody saw that coming!', 'Win against a stronger pet', 'rare', 1],
    ['comeback', 'RETURN OF THE KEK', 'Down but never out.', 'Win right after losing 3+ in a row', 'uncommon', 1],
    ['top-burner-week', 'BURN LORD (WEEKLY)', 'Most fire this week.', '#1 burner of a weekly board (every 1,008 blocks)', 'rare'],
    ['top-burner-all', 'PERMABURN GOD', 'Ash is the new gold.', 'Top 3 burner of all time (gold #1, silver #2, bronze #3)', 'top3'],
    ['top-feeder-week', 'SPOON KING (WEEKLY)', 'Fed the most mouths this week.', '#1 feeder of a weekly board (every 1,008 blocks)', 'rare'],
    ['top-feeder-all', 'HAND OF THE FEEDER', 'Feeds the whole server.', 'Top 3 feeder of all time (gold #1, silver #2, bronze #3)', 'top3'],
    ['first-hybrid', 'MAD SCIENTIST', 'Pepe + Dodo? Sure, why not.', 'Own a bred hybrid', 'uncommon', 1],
    ['bred-true', 'PURE BLOOD', 'Like parent, like pet.', 'Own a baby the same species as both parents', 'uncommon', 1],
    ['breeder', 'BREEDER', 'Gooby keeps your room key on a hook.', '{N} breeds with your pets', [1, 10, 50]],
    ['single-mother', 'SINGLE MOTHER', 'The other wallet went out for sats. Never came back.', 'Own an egg from a two-wallet breed', 'uncommon', 1],
    ['dex', 'GOTTA BURN EM ALL', 'Pok\u00e9dex, but on Bitcoin.', 'Own {N} different species (hybrids don\u2019t count)', [5, 9, 13]],
    ['legendary', 'SHINY HUNTER', 'Gold glow, big ego.', 'Own a Legendary pet', 'rare', 1],
    ['nakamoto', 'SATOSHI SAW YOU', '1 in 777. Touch grass never.', 'Hatch a Nakamoto', 'legendary', 1],
    ['black-eye', 'RIGHT IN THE EYE', 'Somebody call the medic!', 'A pet loses a fight', 'common', 1],
    ['ngmi', 'NGMI', 'WAGMI \u2192 NGMI, speedrun.', 'A pet loses 5 fights in a row', 'uncommon', 1],
    ['rip', 'PRESS F', 'Gone but not forgotten.', 'A pet in the Pet Cemetery', 'common', 1]
  ];
  var DEF = {}; DEFS.forEach(function (d, i) { DEF[d[0]] = { id: d[0], name: d[1], flavour: d[2], rule: d[3], kind: d[4], pet: !!d[5], order: i }; });
  function bestRun(nums) { nums = nums.slice().sort(function (a, b) { return a - b; }); var best = 0, run = 0, prev = null, at = null, bestAt = null;
    nums.forEach(function (n) { run = prev != null && n === prev + 1 ? run + 1 : n === prev ? run : 1; prev = n; if (run > best) { best = run; bestAt = n; } }); return { n: best, at: bestAt }; }
  function tierFor(th, n) { var t = -1; for (var i = 0; i < th.length; i++) if (n >= th[i]) t = i; return t; }
  function power(s) { s = (s && s.stats) || {}; return ['vigor', 'spark', 'grit', 'zoom', 'luck'].reduce(function (a, k) { return a + (s[k] || 0); }, 0); }
  function add(out, addr, id, o) { if (!addr) return; var L = out[addr] || (out[addr] = {}), d = DEF[id], cur = L[id];
    var b = Object.assign({ id: id }, o); b.rarity = typeof d.kind === 'string' && d.kind !== 'top3' ? d.kind : TIER_RAR[b.tier];
    if (!cur || (b.tier || 0) > (cur.tier || 0) || ((b.tier || 0) === (cur.tier || 0) && (b.block || 0) < (cur.block || 0))) L[id] = Object.assign(b, cur && cur.count ? { count: cur.count } : {}); }
  /** compute(w, rows, V) -> { byAddr: {addr: [badge]}, byPet: {petId: [badge]} }. Pure; same inputs => same badges. */
  function compute(w, rows, V) {
    V = V || root.V2Rules; var out = {}, byPet = {}, tip = w.tip || 0, dayOf = function (b) { return Math.floor(b / (V.BLOCKS_PER_DAY || 144)); };
    var bad = {}; (w.log || []).forEach(function (l) { if (l.kind === 'rejected' && l.tx) bad[l.tx] = 1; });
    var feedTx = {}; (w.log || []).forEach(function (l) { if ((l.kind === 'feed' || l.kind === 'cfeed') && l.tx) feedTx[l.tx] = 1; });
    var burns = (V.readBurns ? V.readBurns(rows || []) : []).filter(function (r) { return !bad[r.tx_hash] && r.block_index <= tip; });
    var A = {}; burns.forEach(function (r) { var a = A[r.source] || (A[r.source] = { blocks: [], days: [], burn: 0, feed: 0 }); a.blocks.push(r.block_index); a.days.push(dayOf(r.block_index)); a.burn += r.amount; if (feedTx[r.tx_hash]) a.feed += r.amount; });
    Object.keys(A).forEach(function (addr) { var a = A[addr];
      [['burn-chain', bestRun(a.blocks), function (x) { return x; }], ['daily-burn', bestRun(a.days), function (x) { return x * 144; }]].forEach(function (z) {
        var t = tierFor(DEF[z[0]].kind, z[1].n); if (t >= 0) add(out, addr, z[0], { tier: t, n: z[1].n, block: z[2](z[1].at) }); }); });
    /* weekly boards: week k = [ANCHOR + k*WEEK, ANCHOR + (k+1)*WEEK); a week counts once its last block <= tip */
    var weeks = {}; burns.forEach(function (r) { if (r.block_index < WEEK_ANCHOR) return; var k = Math.floor((r.block_index - WEEK_ANCHOR) / WEEK), W = weeks[k] || (weeks[k] = { burn: {}, feed: {}, last: {} });
      W.burn[r.source] = (W.burn[r.source] || 0) + r.amount; W.last[r.source] = r.block_index; if (feedTx[r.tx_hash]) W.feed[r.source] = (W.feed[r.source] || 0) + r.amount; });
    function top(m, last) { return Object.keys(m).filter(function (k) { return m[k] > 0; }).sort(function (x, y) { return m[y] - m[x] || (last ? last[x] - last[y] : 0) || (x < y ? -1 : 1); }); }
    Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) { var end = WEEK_ANCHOR + (k + 1) * WEEK - 1; if (end > tip) return; var W = weeks[k];
      [['top-burner-week', W.burn], ['top-feeder-week', W.feed]].forEach(function (z) { var t = top(z[1], W.last)[0]; if (!t) return; var L = out[t] = out[t] || {}, c = L[z[0]];
        if (c) { c.count++; c.weeks.push(k + 1); } else L[z[0]] = { id: z[0], rarity: 'rare', block: end, count: 1, weeks: [k + 1] }; }); });
    var tb = {}, tf = {}; Object.keys(A).forEach(function (k) { tb[k] = A[k].burn; tf[k] = A[k].feed; });
    [['top-burner-all', top(tb)], ['top-feeder-all', top(tf)]].forEach(function (z) { z[1].slice(0, 3).forEach(function (addr, i) { add(out, addr, z[0], { tier: 2 - i, rank: i + 1, block: tip }); }); });
    /* pet-scoped: only pets the address still owns (released = lost) */
    var owned = function (p) { return p && p.owner && !p.released && !(p.art && p.art.community); };
    function petBadge(p, id, o) { add(out, p.owner, id, Object.assign({ petId: p.id }, o)); var L = byPet[p.id] || (byPet[p.id] = {}), d = DEF[id], b = Object.assign({ id: id, petId: p.id }, o);
      b.rarity = typeof d.kind === 'string' ? d.kind : TIER_RAR[b.tier]; if (!L[id] || (b.tier || 0) > (L[id].tier || 0)) L[id] = b; }
    var st = {}; /* per-pet fight streaks, same order as V2ArenaFun.streaks */
    (w.fights || []).filter(function (f) { return f.status === 'done'; }).sort(function (a, b) { return a.acceptBlock - b.acceptBlock || a.id - b.id; }).forEach(function (f) {
      var W = st[f.winner] || (st[f.winner] = { win: 0, loss: 0 }), L = st[f.loser] || (st[f.loser] = { win: 0, loss: 0 }), Wp = w.byId[f.winner], Lp = w.byId[f.loser], b = f.acceptBlock;
      var sw = f.winner === f.a ? f.snapA : f.snapB, sl = f.winner === f.a ? f.snapB : f.snapA;
      if (owned(Wp)) { petBadge(Wp, 'first-win', { block: b, fight: f.id }); if (W.win + 1 >= 3) petBadge(Wp, 'belt', { block: b, fight: f.id });
        if (sw && sl && power(sw) < power(sl)) petBadge(Wp, 'upset', { block: b, fight: f.id }); if (W.loss >= 3) petBadge(Wp, 'comeback', { block: b, fight: f.id }); }
      if (owned(Lp)) { petBadge(Lp, 'black-eye', { block: b, fight: f.id }); if (L.loss + 1 >= 5) petBadge(Lp, 'ngmi', { block: b, fight: f.id }); }
      W.win++; W.loss = 0; L.loss++; L.win = 0; });
    var wins = {}, dex = {}, breeds = {}, alive = {};
    w.pets.forEach(function (p) { if (!owned(p)) return; var o = p.owner;
      wins[o] = (wins[o] || 0) + (p.wins || 0);
      var fr = bestRun(Object.keys(p.feedDays || {}).map(Number)), ft = tierFor(DEF['feed-streak'].kind, fr.n); if (ft >= 0) petBadge(p, 'feed-streak', { tier: ft, n: fr.n, block: fr.at * 144 });
      var sp = p.species, kids = p.parents && p.parents.length === 2;
      if (DEX.indexOf(sp) >= 0) { (dex[o] = dex[o] || {})[sp] = 1; }
      if (p.tier === 3) petBadge(p, 'legendary', { block: p.hatchBlock });
      if (sp === 'nakamoto' && !kids) petBadge(p, 'nakamoto', { block: p.hatchBlock });
      if (p.dead) petBadge(p, 'rip', { block: p.deathBlock });
      if (kids) { var pa = w.byId[p.parents[0]], pb = w.byId[p.parents[1]];
        if (p.hybrid || /^hyb/.test(sp)) petBadge(p, 'first-hybrid', { block: p.hatchBlock });
        else if (pa && pb && pa.species === sp && pb.species === sp) petBadge(p, 'bred-true', { block: p.hatchBlock });
        if (pa && pb && pa.owner !== pb.owner) petBadge(p, 'single-mother', { block: p.hatchBlock });
        if (!(p.twinOf && p.twinOf < p.id)) [pa, pb].forEach(function (q, i) { if (owned(q) && !(i === 1 && pa && pa.owner === q.owner)) breeds[q.owner] = (breeds[q.owner] || 0) + 1; }); }
      if (!p.dead || p.deathBlock) { var hd = dayOf(p.hatchBlock || 0) + 1, dd = p.dead && p.deathBlock ? dayOf(p.deathBlock) - 1 : dayOf(tip) - 1; /* full days the pet was alive */
        if (p.stage < 5 && dd >= hd) (alive[o] = alive[o] || []).push({ from: hd, to: dd, fed: p.feedDays || {} }); } });
    Object.keys(wins).forEach(function (o) { var t = tierFor(DEF['ten-wins'].kind, wins[o]); if (t >= 0) add(out, o, 'ten-wins', { tier: t, n: wins[o] }); });
    Object.keys(dex).forEach(function (o) { var n = Object.keys(dex[o]).length, t = tierFor(DEF.dex.kind, n); if (t >= 0) add(out, o, 'dex', { tier: t, n: n }); });
    Object.keys(breeds).forEach(function (o) { var t = tierFor(DEF.breeder.kind, breeds[o]); if (t >= 0) add(out, o, 'breeder', { tier: t, n: breeds[o] }); });
    /* perfect month: 30 full chain days in a row where the address had 3+ living non-Mythic pets and every one of them was fed that day */
    Object.keys(alive).forEach(function (o) { var P = alive[o]; if (P.length < 3) return; var lo = Infinity, hi = -1; P.forEach(function (x) { lo = Math.min(lo, x.from); hi = Math.max(hi, x.to); });
      var run = 0; for (var d = lo; d <= hi; d++) { var n = 0, ok = true; for (var i = 0; i < P.length && ok; i++) { var x = P[i]; if (d < x.from || d > x.to) continue; n++; if (!x.fed[d]) ok = false; }
        run = ok && n >= 3 ? run + 1 : 0; if (run >= 30) { add(out, o, 'perfect-month', { block: (d + 1) * 144 }); break; } } });
    var byAddr = {}; Object.keys(out).forEach(function (a) { byAddr[a] = sortList(Object.keys(out[a]).map(function (k) { return out[a][k]; })); });
    var bp = {}; Object.keys(byPet).forEach(function (id) { bp[id] = sortList(Object.keys(byPet[id]).map(function (k) { return byPet[id][k]; })); });
    return { byAddr: byAddr, byPet: bp, tip: tip };
  }
  function sortList(L) { return L.sort(function (x, y) { return RAR_SCORE[y.rarity] - RAR_SCORE[x.rarity] || DEF[x.id].order - DEF[y.id].order; }); }
  function score(list) { return (list || []).reduce(function (a, b) { return a + RAR_SCORE[b.rarity] * (b.count || 1); }, 0); }
  function img(b) { var d = DEF[b.id], t = typeof d.kind === 'string' && d.kind !== 'top3' ? '' : '-' + TIER_NAMES[b.tier]; return 'img/badges/' + b.id + t + '.png'; }
  function label(b) { var d = DEF[b.id], s = d.name; if (b.rank) s += ' #' + b.rank; else if (b.tier != null) s += ' \u00b7 ' + TIER_NAMES[b.tier].toUpperCase(); if (b.count > 1) s += ' \u00d7' + b.count; return s; }
  function ruleText(b) { var d = DEF[b.id], th = Array.isArray(d.kind) ? d.kind : null; return d.rule.replace('{N}', th ? th[b.tier || 0] : ''); }
  /** recapLine(res) -> one line for the daily recap data (HatchBot does NOT post badges) */
  function recapLine(res, sinceBlock) { var tot = 0, wallets = 0, fresh = 0; Object.keys(res.byAddr).forEach(function (a) { var L = res.byAddr[a]; if (L.length) wallets++; tot += L.length; L.forEach(function (b) { if (sinceBlock != null && b.block > sinceBlock) fresh++; }); });
    return 'Badges: ' + tot + ' held by ' + wallets + ' wallets' + (sinceBlock != null ? ' (' + fresh + ' new since block ' + sinceBlock + ')' : ''); }
  var API = { DEFS: DEF, LIST: DEFS.map(function (d) { return d[0]; }), WEEK: WEEK, WEEK_ANCHOR: WEEK_ANCHOR, DEX: DEX, compute: compute, score: score, img: img, label: label, ruleText: ruleText, recapLine: recapLine, TIER_NAMES: TIER_NAMES, ACTIVATE_BADGES_BLOCK: ACTIVATE_BADGES_BLOCK };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.V2Badges = API;
  if (typeof document === 'undefined' || !document.getElementById) return;
  /* ------------------------------------------------------------------ UI (play.html My Pets strip, pet.html row) */
  var memo = { w: null, r: null };
  function get() { var M = root.V2Mock; if (!M || !M.world) return null; var w = M.world(); if (!w || !w.pets || !w.pets.length) return null; if (memo.w !== w) { memo.w = w; memo.r = compute(w, (M.state() || {}).rows || []); } return memo.r; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function chip(b, i) { return '<button type="button" class="bdg bdg-' + b.rarity + '" data-i="' + i + '" title="' + esc(label(b) + ': ' + DEF[b.id].flavour) + '"><img src="' + img(b) + '" alt="' + esc(label(b)) + '" width="32" height="32"></button>'; }
  function detailHtml(b) { var d = DEF[b.id]; return '<img src="' + img(b) + '" alt="" width="64" height="64"><div><b>' + esc(label(b)) + '</b><i>\u201c' + esc(d.flavour) + '\u201d</i><span>' + esc(ruleText(b)) + (b.block ? ' \u00b7 block ' + Number(b.block).toLocaleString('en-US') : '') + (b.petId ? ' \u00b7 <a href="pet.html?id=' + b.petId + '">#' + b.petId + '</a>' : '') + '</span></div>'; }
  function strip(el, list, title) { var all = el.getAttribute('data-all') === '1', narrow = root.matchMedia && root.matchMedia('(max-width:600px)').matches, max = narrow && !all ? 8 : 999;
    if (!list || !list.length) { el.innerHTML = '<span class="bdg-none small muted">' + esc(title) + ': none yet. Feed, fight and breed to earn some.</span>'; return; }
    el.innerHTML = '<div class="bdg-head"><b>' + esc(title) + '</b> <span class="muted small">' + list.length + '</span></div><div class="bdg-row">' + list.slice(0, max).map(chip).join('') +
      (list.length > max ? '<button type="button" class="bdg-more small">+' + (list.length - max) + ' \u203a See all</button>' : (all && narrow && list.length > 8 ? '<button type="button" class="bdg-more small" data-less="1">Show less</button>' : '')) + '</div><div class="bdg-detail" hidden></div>';
    el.querySelectorAll('.bdg').forEach(function (bt) { bt.onclick = function () { var D = el.querySelector('.bdg-detail'), i = +bt.getAttribute('data-i'); if (!D.hidden && D.getAttribute('data-i') == i) { D.hidden = true; return; } D.setAttribute('data-i', i); D.innerHTML = detailHtml(list[i]); D.hidden = false; }; });
    var m = el.querySelector('.bdg-more'); if (m) m.onclick = function () { el.setAttribute('data-all', m.getAttribute('data-less') ? '0' : '1'); strip(el, list, title); }; }
  var last = null;
  function paint() { var M0 = root.V2Mock, tip0 = M0 && M0.state && (M0.state() || {}).tip; if (!(tip0 + 1 >= ACTIVATE_BADGES_BLOCK) && !/[?&]preview=badges\b/.test(location.search)) return; var r = get(); if (!r || r === last) return; last = r; var page = document.body && document.body.getAttribute('data-v2page');
    if (page === 'pet') { var id = +(new URLSearchParams(location.search).get('id') || 0), st = document.getElementById('stats'); if (!id || !st) return;
      var el = document.getElementById('petBadges'); if (!el) { el = document.createElement('div'); el.id = 'petBadges'; el.className = 'bdg-strip'; st.parentNode.insertBefore(el, st.nextSibling); } strip(el, r.byPet[id] || [], 'Badges'); return; }
    var panel = document.getElementById('petsPanel'), me = root.V2Mock && root.V2Mock.ME; if (!panel || !me) return;
    var el2 = document.getElementById('myBadges'); if (!el2) { el2 = document.createElement('div'); el2.id = 'myBadges'; el2.className = 'bdg-strip'; var h = panel.querySelector('h2'); panel.insertBefore(el2, h ? h.nextSibling : panel.firstChild); }
    strip(el2, r.byAddr[me] || [], 'Your badges'); }
  var css = document.createElement('style'); css.textContent = '.bdg-strip{margin:6px 0 10px}.bdg-head{font-family:"Press Start 2P",monospace;font-size:10px;margin-bottom:6px;color:#ffc93c}.bdg-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
    '.bdg{background:none;border:0;padding:0;cursor:pointer;line-height:0;border-radius:6px}.bdg img{width:64px;height:64px;image-rendering:pixelated;image-rendering:crisp-edges}.bdg:focus-visible{outline:2px solid #ff7a1a}' +
    '.bdg-more{background:#181327;color:#ece6ff;border:2px solid #ff7a1a;border-radius:8px;padding:6px 8px;cursor:pointer;min-height:32px}.bdg-detail{display:flex;gap:10px;align-items:center;margin-top:8px;padding:8px;background:#181327;border:2px solid #2c2440;border-radius:10px}' +
    '.bdg-detail[hidden]{display:none}.bdg-detail img{image-rendering:pixelated;flex:none}.bdg-detail b{display:block;font-family:"Press Start 2P",monospace;font-size:10px;color:#ffc93c}.bdg-detail i{display:block;margin:4px 0}.bdg-detail span{font-size:12px;opacity:.85;overflow-wrap:anywhere}' +
    '@media (max-width:600px){.bdg img{width:32px;height:32px}.bdg-row{gap:4px}}';
  document.head.appendChild(css);
  setInterval(paint, 2000); setTimeout(paint, 300);
})(typeof window !== 'undefined' ? window : this);
