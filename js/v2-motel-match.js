/* GENE POOL MATCHMAKER (places round two, Nov 23 2026; DISPLAY ONLY, no burns, no rule changes).
 * Tap Gooby's pool with no pair picked: Gooby looks through MY pets that can breed right now (V2Rules.breedPicker, stage 3+, the same list as
 * the desk) and suggests up to three pairs, each with the same odds the desk card shows (V2Motel.odds):
 *   RAREST EGG      the pair with the best expected egg tier (tier up chance counts most)
 *   NEW HYBRID      two different pure species whose hybrid I don't own yet (hybrid chance = HYBRID_RATE)
 *   PUREBRED PAIR   two pets of the same species (100% that species), highest tier
 * Pairs that the rules would refuse (relatives: kinWhy; reserved pairs: resPairWhy) are skipped. "Check in this pair" only fills #bA/#bB and
 * re-renders the motel, so the player still confirms the burn with the usual bell. One representative pet per (species, tier) keeps the
 * search small for wallets with thousands of pets. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'];
  function name(p) { return '#' + p.id + (p.name ? ' ' + p.name : ''); }
  function roots(V, s) { return V.isHybrid(s) ? s.replace(/^hyb3?:/, '').split(':').sort().join(':') : s; }
  /* the pets I could check in right now, one per (species, tier), best tier first */
  function ready(w, V, ME, tip) { var L = V.breedPicker(w, ME, tip, null, window.V2UI && V2UI.pendingBreedIds ? V2UI.pendingBreedIds() : null), seen = {}, out = [];
    L.mine.forEach(function (x) { var p = x.p; if (x.why || p.stage < 3) return; var k = p.species + '|' + p.tier; if (seen[k]) { seen[k].n++; return; } seen[k] = { p: p, n: 1 }; out.push(seen[k]); });
    out.sort(function (a, b) { return (b.p.tier - a.p.tier) || (a.p.id - b.p.id); }); return out.slice(0, 80); }
  function okPair(V, A, B, b) { if (A.id === B.id) return false; try { if (V.breedV2On && V.breedV2On(b) && V.kinWhy && V.kinWhy(A, B)) return false; if (V.resPairWhy && V.resPairWhy(A, B, b)) return false; } catch (e) { return false; } return true; }
  /* another ready pet of the same species and tier (the list keeps one per kind) */
  function twin(w, ME, A) { var V = window.V2Rules, b = (w.tip || 0) + 1; for (var i = 0; i < w.pets.length; i++) { var q = w.pets[i]; if (q.owner === ME && q.id !== A.id && q.species === A.species && q.tier === A.tier && q.stage >= 3 && !V.breedable(q, b)) return q; } return null; }
  function suggest(w, ME, tip) { var V = window.V2Rules, M = window.V2Motel; if (!V || !M || !M.odds || !w || !ME) return { picks: [], n: 0 };
    var b = (tip || w.tip || 0) + 1, R = ready(w, V, ME, tip), mine = (window.V2UI && V2UI.mine ? V2UI.mine(w) : w.pets.filter(function (p) { return p.owner === ME; })), own = {};
    mine.forEach(function (p) { if (V.isHybrid(p.species)) own[roots(V, p.species)] = 1; });
    var all = [];
    for (var i = 0; i < R.length; i++) for (var j = i; j < R.length; j++) { var A = R[i].p, B = j === i ? (R[i].n > 1 ? twin(w, ME, A) : null) : R[j].p;
      if (!B || !okPair(V, A, B, b)) continue; var od = M.odds(V, A, B), T = od.tier;
      all.push({ A: A, B: B, od: od, ex: (T.up * (od.hiT + 1) + T.hi * od.hiT + T.lo * od.loT) / 100,
        nh: A.species !== B.species && !V.isHybrid(A.species) && !V.isHybrid(B.species) && !own[[A.species, B.species].sort().join(':')], pure: A.species === B.species }); }
    all.sort(function (x, y) { return y.ex - x.ex || (x.A.id + x.B.id) - (y.A.id + y.B.id); });
    var picks = [], used = {}, pet = {}; /* prefer pairs with pets not already suggested, so the three cards show different guests */
    function add(k, f) { for (var pass = 0; pass < 2; pass++) for (var q = 0; q < all.length; q++) { var x = all[q], key = [x.A.id, x.B.id].sort().join(':'); if (used[key] || !f(x) || (!pass && (pet[x.A.id] || pet[x.B.id]))) continue; used[key] = 1; pet[x.A.id] = pet[x.B.id] = 1; x.goal = k; picks.push(x); return; } }
    add('rare', function () { return true; }); add('hyb', function (x) { return x.nh; }); add('pure', function (x) { return x.pure; });
    return { picks: picks, n: R.reduce(function (s, x) { return s + x.n; }, 0) }; }
  var GOAL = { rare: ['RAREST EGG', 'Best shot at a rarer egg'], hyb: ['NEW HYBRID FOR YOU', 'A hybrid you don’t own yet'], pure: ['PUREBRED PAIR', 'Same species, 100% that species'] };
  function bar(od) { var T = od.tier, seg = [[T.up, '#ff6fb5', TL[od.hiT + 1] || TL[od.hiT]], [T.hi, '#ffd24a', TL[od.hiT]], [T.lo, '#8a7be0', TL[od.loT]]].filter(function (s) { return s[0] > 0.05; });
    return '<div class="mm-bar" aria-hidden="true">' + seg.map(function (s) { return '<i style="width:' + s[0].toFixed(1) + '%;background:' + s[1] + '"></i>'; }).join('') + '</div>' +
      '<div class="mm-odds">' + seg.map(function (s) { return Math.round(s[0]) + '% ' + esc(s[2]); }).join(' · ') + ' egg</div>'; }
  function spLine(od) { return od.sp.map(function (q) { return esc(q[0]) + ' ' + (q[1] === 100 ? '100' : q[1] < 10 ? q[1].toFixed(1) : Math.round(q[1])) + '%'; }).join(', '); }
  function sprite(c, p, w) { try { var R = window.V2Render; if (!R || !R.petFrames) return; R.animate ? R.animate(c, R.petFrames(p, w, { noHunger: true })) : null; } catch (e) { } }
  function css() { if (document.getElementById('mmCss')) return; var s = document.createElement('style'); s.id = 'mmCss'; s.textContent =
    '#mmSheet{background:#1b1430;border:3px solid #000;border-radius:12px;box-shadow:4px 4px 0 #000,0 0 0 2px #2aa8e0 inset;padding:12px;margin:10px 0;color:#fff;display:grid;gap:10px}' +
    '#mmSheet h3{font-family:"Press Start 2P",monospace;font-size:12px;line-height:1.6;color:#7fd8ff;margin:0;display:flex;justify-content:space-between;gap:8px;align-items:center}' +
    '#mmSheet .mm-x{background:none;border:0;color:#cfc6e8;font-size:18px;cursor:pointer;min-width:32px;min-height:32px}' +
    '#mmSheet .mm-say{font-family:"Comic Neue",cursive;font-size:15px;color:#cfc6e8}' +
    '.mm-pick{background:#251a42;border:2px solid #000;border-radius:10px;padding:10px;display:grid;gap:6px}' +
    '.mm-goal{font-family:"Press Start 2P",monospace;font-size:9px;color:#ff6fb5}.mm-sub{font-size:13px;color:#cfc6e8}' +
    '.mm-pair{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:700}.mm-pair canvas{width:40px;height:40px;image-rendering:pixelated;background:#3a2b66;border:2px solid #000;border-radius:6px}' +
    '.mm-pair a{color:#fff}.mm-bar{display:flex;height:10px;border:2px solid #000;border-radius:4px;overflow:hidden;background:#120c24}.mm-bar i{display:block}' +
    '.mm-odds,.mm-sp{font-size:14px;color:#cfc6e8}.mm-go{font-family:"Press Start 2P",monospace;font-size:9px;background:#3ddc84;color:#06210f;border:3px solid #000;border-radius:8px;box-shadow:3px 3px 0 #000;padding:9px 10px;cursor:pointer;justify-self:start;min-height:40px}' +
    '.mm-go:focus-visible,.mm-x:focus-visible{outline:3px solid #fff;outline-offset:2px}';
    document.head.appendChild(s); }
  function close() { var e = document.getElementById('mmSheet'); if (e) e.remove(); }
  function use(x) { var a = document.getElementById('bA'), b = document.getElementById('bB'); if (!a || !b) return; a.value = String(x.A.id); b.value = String(x.B.id);
    try { var st = window.V2Motel && V2Motel._state && V2Motel._state(); if (st) { st.fresh = null; st.pickSide = null; st.bubble = 'Room #' + x.A.id + ' + #' + x.B.id + '. Gooby approves.'; st.lt = performance.now(); } } catch (e) { }
    try { a.dispatchEvent(new Event('change', { bubbles: true })); b.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
    close(); if (window.V2UI && V2UI.render) V2UI.render(); var bell = document.getElementById('bGo') || document.getElementById('motelDesk'); if (bell && bell.scrollIntoView) bell.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  /* open the sheet under the motel scene. Returns Gooby's line for the speech bubble. */
  function open(w) { var U = window.V2UI, ME = U && U.ME, box = document.getElementById('motelScene'); if (!box) return null; css(); close();
    if (!ME) return 'Connect a wallet and Gooby finds your best pairs.';
    var tip = (U.S && U.S().tip) || w.tip, r = suggest(w, ME, tip), el = document.createElement('section'); el.id = 'mmSheet'; el.setAttribute('aria-label', 'Gene Pool Matchmaker');
    var h = '<h3><span>GENE POOL MATCHMAKER</span><button type="button" class="mm-x" aria-label="Close">✕</button></h3>';
    if (!r.picks.length) h += '<div class="mm-say">' + (r.n ? 'Gooby sees ' + r.n + ' ready guest' + (r.n === 1 ? '' : 's') + ' but no pair that can share a room. Pick a partner from Other Pets below.' : 'None of your pets can check in right now. Adults only, and no breed cooldown. "My cooldowns" below says when.') + '</div>';
    else { h += '<div class="mm-say">Gooby: “' + r.picks.length + ' good room' + (r.picks.length === 1 ? '' : 's') + ' for you tonight. No questions asked.”</div>';
      r.picks.forEach(function (x, i) { h += '<div class="mm-pick"><span class="mm-goal">' + GOAL[x.goal][0] + '</span><span class="mm-sub">' + GOAL[x.goal][1] + '</span>' +
        '<div class="mm-pair"><canvas width="32" height="32" data-mm="' + i + 'a"></canvas>+<canvas width="32" height="32" data-mm="' + i + 'b"></canvas><span><a href="pet.html?id=' + x.A.id + '">' + esc(name(x.A)) + '</a> + <a href="pet.html?id=' + x.B.id + '">' + esc(name(x.B)) + '</a></span></div>' +
        bar(x.od) + '<div class="mm-sp">Baby: ' + spLine(x.od) + '</div><button type="button" class="mm-go" data-mm-go="' + i + '">CHECK IN THIS PAIR</button></div>'; }); }
    el.innerHTML = h; box.parentNode.insertBefore(el, box.nextSibling);
    el.querySelector('.mm-x').onclick = close;
    el.querySelectorAll('[data-mm-go]').forEach(function (bt) { bt.onclick = function () { use(r.picks[+bt.getAttribute('data-mm-go')]); }; });
    el.querySelectorAll('canvas[data-mm]').forEach(function (c) { var k = c.getAttribute('data-mm'), x = r.picks[+k.slice(0, -1)]; if (x) sprite(c, k.slice(-1) === 'a' ? x.A : x.B, w); });
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return r.picks.length ? 'Gooby found ' + r.picks.length + ' good pair' + (r.picks.length === 1 ? '' : 's') + '. Look below.' : 'No pair ready tonight. Gooby checked.'; }
  window.V2Matchmaker = { open: open, close: close, suggest: suggest };
})();
