/* XCPETS intuitive pass (Oct 20 2026, scope file design/intuitive-pass-build-scope-2026-10-20.md items 1-14, 16-24, 26-29; NOT 15 or 25).
 * DISPLAY ONLY: no rule, burn-tag or replay change. Adds small '?' taps, tap-to-expand and one bottom sheet (#ipSheet).
 * Every number shown comes from the live engine objects (V2Rules / PetCore / the replayed world). */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  function $(id) { return d.getElementById(id); }
  /* cast-cold-storage: help text names come from V2Community (replay state) when it is loaded; else the original line */
  function cpNo() { var C = window.V2Community, st = C && C.current(); return '#' + (st ? st.nextNo : 3); }
  function cpT(k, d) { var C = window.V2Community, st = C && C.current(), t = null; try { t = st && C.text[k] ? C.text[k](st) : null; } catch (e) { t = null; } return esc(t == null ? d : t); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function V() { return window.V2Rules; }
  /* similar-bugs-fix: the cost the engine charges right now (halvings + Fire Sale), never a hardcoded base */
  function costNow(k) { var R = V(); if (!R || !R.COSTS) return ''; try { var U = window.V2UI, w = W(), tip = U && U.S ? U.S().tip : null; if (w && tip != null && R.costsAt) { var c = R.costsAt(w, (tip || 0) + 1); if (c[k] != null) return fmt(c[k]); } } catch (e) { } return fmt(R.COSTS[k]); }
  function W() { try { return window.V2UI && V2UI.world ? V2UI.world() : null; } catch (e) { return null; } }
  function me() { return (window.V2UI && V2UI.ME) || ls('xcpets-v2-me') || ''; }
  function viewOnly() { try { return !!(window.V2UI && V2UI.viewOnly && V2UI.viewOnly()); } catch (e) { return false; } }
  var BPD = 144;
  function stageNames() { return ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic']; }
  /* where a tip's "More" link goes (item 27: section anchors, not whole pages) */
  var MORE = { feed: 'how-it-works.html#feed', hatch: 'pets.html#tiers', gear: 'how-it-works.html#gear', fight: 'how-it-works.html#battles', breed: 'how-it-works.html#breeding', community: 'how-it-works.html#community', rules: 'rules.html' };
  function more(k, t) { return MORE[k] ? '<p class="small ip-more"><a href="' + MORE[k] + '">' + esc(t || 'More in the guide') + ' ↗</a></p>' : ''; }

  // ------------------------------------------------------------------ the one bottom sheet
  var sheet;
  function sheetEl() { if (sheet) return sheet; sheet = d.createElement('div'); sheet.id = 'ipSheet'; sheet.className = 'ip-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.hidden = true;
    sheet.innerHTML = '<div class="ip-sh-bg" data-ipclose></div><div class="ip-sh-box"><button type="button" class="q ip-sh-x" data-ipclose aria-label="Close">✕</button><div class="ip-sh-body"></div></div>';
    d.body.appendChild(sheet); sheet.addEventListener('click', function (e) { if (e.target.closest('[data-ipclose]')) close(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); }); return sheet; }
  function open(h) { var s = sheetEl(); s.querySelector('.ip-sh-body').innerHTML = h; s.hidden = false; html.classList.add('ip-sheet-on'); var x = s.querySelector('.ip-sh-x'); try { x.focus({ preventScroll: true }); } catch (e) { } return s; }
  function close() { if (sheet) { sheet.hidden = true; html.classList.remove('ip-sheet-on'); } }
  function q(key, arg, label) { return '<button type="button" class="ip-q" data-ip="' + esc(key) + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + ' aria-label="' + esc(label || 'What is this?') + '">?</button>'; }

  // ------------------------------------------------------------------ engine-backed helpers
  function pet(id) { var w = W(); return w && w.byId ? w.byId[id] : null; }
  function careNext(w, p) { /* item 4: next stage from the engine's own per-pet thresholds (V2Render.careTarget -> V2Rules.petThresholds).
     * meal-count-fix (Oct 27 2026, display only): the target is the LOWER of the next stage and the pet's Mythic line (a Mythic shortcut at 21,000 can
     * come before Adult/Elder: the pet then goes straight to Mythic), meals are counted by stepping V2Rules.mealFor() with those thresholds (care per
     * meal, never the XCPETS a meal burns), and the earliest block is the start of the chain day of the last meal. */
    var R = V(); if (!w || !p || p.dead || p.stage >= 5 || !window.V2Render || !V2Render.careTarget) return null; var tip = w.tip, ct = V2Render.careTarget(w, p, tip), th = ct.th, s = p.stage, sk = th[5] <= th[s + 1],
      at = sk ? th[5] : th[s + 1], need = at - p.care; if (!(need > 0)) return null;
    var meals = null, c = p.care, n = 0, m; if (R && R.mealFor) { while (c < at && n < 999) { m = R.mealFor(c, p.species, tip + 1, th); if (!(m > 0)) break; c += m; n++; } if (c >= at) meals = n; }
    var per = p.nextCare || p.nextMeal || 0; if (meals == null && per > 0) meals = Math.ceil(need / per); /* fallback: engine without mealFor */
    var today = Math.floor(tip / BPD), first = p.fedToday ? (today + 1) * BPD : tip + 1, earliest = meals ? (meals === 1 ? first : (Math.floor(first / BPD) + meals - 1) * BPD) : null;
    return { next: sk ? stageNames()[5] : stageNames()[s + 1], at: at, need: need, meals: meals, per: per, skip: sk, earliest: earliest, ct: ct }; }
  function careShort(w, p) { var n = careNext(w, p); return n && n.meals ? '→ ' + n.next + ' in ' + n.meals + ' meal' + (n.meals === 1 ? '' : 's') : ''; }
  function stageLadder(w, p) { var ct = V2Render.careTarget(w, p, w.tip), th = ct.th, n = stageNames();
    return '<ol class="ip-ladder">' + th.map(function (v, i) { var sk = i > p.stage && i < 5 && v >= th[5]; /* meal-count-fix: stages the Mythic shortcut jumps over */ return '<li class="' + (i === p.stage ? 'on' : i < p.stage ? 'done' : '') + '">' + n[i] + ' <span class="muted">' + fmt(v) + (sk ? ' · skipped' : '') + '</span></li>'; }).join('') + '</ol>'; }

  // ------------------------------------------------------------------ tips (each one is one tap away)
  var TIPS = {
    neglect: function (id) { var w = W(), p = pet(id), R = window.V2Render, si = p && R && R.starveInfo ? R.starveInfo(w, p) : null, meal = p && p.nextMeal;
      return '<h3>🍽️ Hungry, neglected, starving</h3><ul class="ip-list"><li><b>Day 3 unfed</b> = neglected: can\'t fight or breed.</li><li><b>7 full days unfed</b> = it dies (Pet Cemetery). Mythic pets never starve.</li><li><b>One meal fixes it</b>' + (meal ? ': this pet\'s meal is ' + fmt(meal) + ' XCPETS' : '') + '.</li>' +
        (si ? '<li>#' + p.id + ' dies in ~' + esc(si.left) + ' (block ' + fmt(si.at) + ') unless fed.</li>' : '') + '</ul>' + (p && d.getElementById('pets') && window.V2UI ? '<p><button type="button" class="btn" data-ipopen="' + p.id + '">🍽️ Feed #' + p.id + ' ▸</button></p>' : '') + more('feed', 'Feeding rules'); },
    care: function (id) { var w = W(), p = pet(id); if (!w || !p) return '<p>Loading…</p>'; var n = careNext(w, p), ct = V2Render.careTarget(w, p, w.tip);
      return '<h3>📈 #' + p.id + ' care: ' + fmt(p.care) + '</h3>' + stageLadder(w, p) +
        (n ? '<p>' + esc(stageNames()[p.stage]) + ' → <b>' + n.next + '</b> at ' + fmt(n.at) + ' care: ' + fmt(n.need) + ' to go' + (n.meals ? ' · ' + n.meals + ' meal' + (n.meals === 1 ? '' : 's') + ' (one per chain day, up to ' + fmt(n.per) + ' care each) · earliest ~block ' + fmt(n.earliest) : '') + '.' + (n.skip && p.stage < 4 ? ' The Mythic shortcut comes first, so it skips ' + (p.stage < 3 ? 'Adult and Elder' : 'Elder') + '.' : '') + '</p>' : p.stage >= 5 ? '<p>Mythic: fully grown. Mythic pets never starve.</p>' : '') +
        (ct.discount ? '<p class="small">' + TIPS.mythic() + '</p>' : '') + more('feed', 'Stages and meals'); },
    mythic: function () { var c = V() && V().MYTHIC_DISCOUNT_CARE; return '<b>Mythic shortcut:</b> once an address raises a living Mythic, every pet it owns reaches Mythic at ' + fmt(c || 21000) + ' care instead of 69,069. That\'s why a Mythic can show less care than a pet still growing.'; },
    mythicRank: function () { return '<h3>Why is this Mythic\'s care lower?</h3><p>' + TIPS.mythic() + '</p>' + more('feed', 'Stages'); },
    hatch: function () { var T = (window.PetCore && PetCore.TIERS) || [], rows = T.slice(0, 4).map(function (t) { return '<tr><td>' + esc(t.name) + '</td><td>' + (t.chance / 100) + '%</td><td>+' + (t.statBonus || 0) + ' stats</td></tr>'; }).join('');
      return '<h3>🥚 Hatch odds and upkeep</h3><table class="ip-tbl"><tr><th>Tier</th><th>Chance</th><th>Bonus</th></tr>' + rows + '</table>' +
        '<ul class="ip-list"><li>Pepe, Wojak, Chud, Peepo, Doge: any tier. Bobo, Mumu, Sarutobi, Lenny: Uncommon+. Snibby, KEVIN: Rare+. Dodo: Legendary only.</li><li>' + cpT('help-egg', '1 in 777 eggs is a Bitcoin Wizard.') + '</li>' +
        '<li><b>Upkeep:</b> every egg needs one meal per chain day. Crack One Open = 1 pet · Crack Pack = 12 pets · Yolk Booster Box = 144 pets · <b>⚡ Electric Shock Box = 1,000 mouths to feed</b>.</li></ul>' + more('hatch', 'Tiers and species'); },
    roll: function () { var w = W(), S = window.V2UI && V2UI.S ? V2UI.S() : null, p = S && pet(S.pet || S.rollPet), Vr = V(), L = (Vr && Vr.SLOT_LABELS) || {}, SL = (Vr && Vr.V2_SLOTS) || [];
      var h = '<h3>🎡 Gear roll (' + costNow('roll') + ')</h3><ul class="ip-list"><li>A gear roll is a Pepe Wheel spin: it picks a random living pet of yours (rarer pets more often: Common 1 · Uncommon 2 · Rare 4 · Legendary 8) and puts one random piece straight on it. If that slot is still locked, the piece waits in the pet\'s bag 🎒.</li><li>Open slots (1–6) grow with age (days 2, 5, 10) and how often it was fed (50% and 80% of days).</li><li>Each copy you already own makes that piece 10% less likely.</li><li>★ signature pieces only roll on Legendary pets.</li><li>Lucky drops: growing a stage (25%) or a meal (2%) gives +1 saved Pepe Wheel spin. Saved spins never expire; use them in the Rare Room, up to 10 per tiny burn.</li></ul>';
      if (p && SL.length) { var open = p.openSlots || SL.slice(0, p.capacity || 1), age = p.ageDays | 0, nx = [2, 5, 10].filter(function (a) { return a > age; })[0];
        h += '<p><b>#' + p.id + ' ' + esc(p.name) + ':</b> ' + open.length + ' of 6 open (' + open.map(function (s) { return esc(L[s] || s); }).join(', ') + ').' + (open.length < 6 ? ' Locked: ' + SL.filter(function (s) { return open.indexOf(s) < 0; }).map(function (s) { return esc(L[s] || s); }).join(', ') + '.' + (nx ? ' Next age unlock at day ' + nx + ' (now day ' + age + ').' : '') : '') + '</p>'; }
      return h + more('gear', 'Gear rules'); },
    slot: function (s) { var L = (V() && V().SLOT_LABELS) || {}; return '<h3>🔒 ' + esc(L[s] || s) + ' is locked</h3><p>Slots open in this order: Headwear, Grip, Outfits, Drip, Guise, Footwear. You start with 1. One more opens at age 2, 5 and 10 days, one when 50% of days were fed, and one at 80% (3+ fed days). Max 6. Mythic pets have all 6 slots. Slots never close once open.</p>' + more('gear', 'Gear rules'); },
    fight: function () { var w = W(), FO = window.UXB && UXB.faceoff ? UXB.faceoff() : null;
      var h = '<h3>⚔️ How a fight is decided</h3><table class="ip-tbl"><tr><td><b>VIG</b> Vigor</td><td>HP = 40 + 2×Vigor + Grit + 6×stage</td></tr><tr><td><b>SPA</b> Spark</td><td>hit = 4 + Spark÷3 + gear power + 0–7</td></tr><tr><td><b>GRI</b> Grit</td><td>more HP, blocks Grit÷6 per hit</td></tr><tr><td><b>ZOO</b> Zoom</td><td>goes first more often, dodge Zoom÷5 %</td></tr><tr><td><b>LUC</b> Luck</td><td>crit (×2) 5 + Luck÷4 %</td></tr></table><p class="small">⚡ Power = Vigor + Spark + Grit + Zoom + Luck.</p>' +
        '<p class="small"><b>No win %:</b> the dice come from the accept burn\'s own block hash and tx id, which don\'t exist until the opponent accepts, so an exact chance can\'t be shown before the fight.</p>';
      var ids = []; d.querySelectorAll('#faceoff .fside[data-side]').forEach(function (b) { var s = b.querySelector('[data-fsp]'); if (s) ids.push(+s.getAttribute('data-fsp')); });
      if (w && ids.length) { h += '<p><b>At stake</b> (loser gives the winner ONE of these, picked at random; ★ pieces are safe):</p><ul class="ip-list">' + ids.map(function (id) { var p = w.byId[id], g = p ? V().wornOf(w, id).filter(function (x) { return !x.legendary; }) : [];
        return '<li>#' + id + ' ' + esc(p ? p.name : '') + ': ' + (g.length ? g.map(function (x) { return esc(x.label); }).join(', ') + ' (1 in ' + g.length + ' each)' : 'nothing takeable') + '</li>'; }).join('') + '</ul>'; }
      return h + more('fight', 'Fight rules'); },
    breed: function () { var A = $('bA') && $('bA').value, B = $('bB') && $('bB').value, w = W(), a = A && pet(+A), b = B && pet(+B), m = me();
      var h = '<h3>💞 What the motel can give</h3><ul class="ip-list"><li><b>Different species:</b> a hybrid 68.4773435% of the time, otherwise a pure baby of one parent\'s species (50/50).</li><li><b>Same species:</b> always that species, plus a bred-true bonus (+3 stat 50% · rarer pattern 30% · rarer eye 20%).</li><li>Any hybrid parent: the baby is always a hybrid.</li><li><b>Two owners:</b> the partner has 144 blocks (~1 day) to accept, which burns their 135. The egg goes to the sender.</li><li>Parents then rest 1,008 blocks (~1 week).</li></ul>';
      if (a && b) h += '<p><b>Picked:</b> #' + a.id + ' ' + esc(a.name) + ' × #' + b.id + ' ' + esc(b.name) + (a.owner !== b.owner ? ' · two owners: needs an accept' : ' · same owner: the egg comes when the burn confirms') + '.</p>';
      if (a && b && window.V2UI && V2UI.breedSum) { try { var s = V2UI.breedSum(a, b, w); if (typeof s === 'string') h += '<div class="small ip-bsum">' + s + '</div>'; } catch (e) { } }
      return h + more('breed', 'Breeding rules'); },
    cold: function () { return '<h3>🧊 What happens in Cold Storage?</h3><p>Community pets stay community pets until they reach Mythic. Then they go into Cold Storage and become real pets anyone can hatch and breed. This goes for the Bitcoin Wizard and every community pet after him.</p><p class="small">' + cpT('help-cold', 'Nakamoto (#1) is no longer hatched. The Bitcoin Wizard (#2) now comes from the 1 in 777 hatch roll.') + '</p>' + more('community', 'Community pets'); },
    community: function () { return '<h3>🔔 Community pet ' + cpNo() + '</h3><p>Feeding and gear rolls open when pet ' + cpNo() + ' arrives. There\'s no date yet.</p><p>Get told first: the XCPETS Telegram announces it.</p><p><a class="btn" href="https://t.me/xcpets" target="_blank" rel="noopener">🔔 Join t.me/xcpets</a></p>' + more('community', 'Community pets'); },
    glossary: function (k) { return glossary(k); },
    bundle: function () { return '<h3>🍽️ Feeding many pets</h3>' + (window.XCPETS_FEED_ALL_PAUSED === true ? '<p>Feed all is paused for a fix.</p>' : '') + '<p>"Feed all hungry" feeds every hungry pet in ONE burn (pet:fa). You see pets · XCPETS · burns before anything is signed, and your wallet asks once per burn.</p>' + more('feed'); }
  };

  // ------------------------------------------------------------------ item 11: glossary
  var GLOSS = [['care', 'Care', 'What a pet gets from its meals. Halvings make meals cost less, never give less care: each meal still gives its full care. Care moves it up the stages: Hatchling 69 · Juvenile 8,349 · Adult 22,149 · Elder 41,469 · Mythic 69,069.'],
    ['chainday', 'Chain day', '144 Bitcoin blocks (~24 h). One meal per pet per chain day; one fight per pet per chain day.'],
    ['block', 'Block', 'A Bitcoin block, about every 10 minutes. Burns count once they are in a block.'],
    ['neglected', 'Neglected', '3+ chain days unfed: can\'t fight or breed. 7 full days unfed and it dies.'],
    ['lucky', 'Lucky drop', 'A free +1 saved Pepe Wheel spin that drops by itself: 25% when a pet grows a stage, 2% per meal. Saved spins never expire; spend them in the Rare Room, up to 10 per tiny burn.'],
    ['bredtrue', 'Bred-true', 'Same-species parents: the baby keeps the species and gets a bonus (+3 stat, rarer pattern or rarer eye).'],
    ['hybrid', 'Hybrid', 'A mix of two (or three) species. Different species give a hybrid 68.4773435% of the time.'],
    ['score', 'Pet Score', 'One number for how strong and rare a pet is, used to sort and rank.'],
    ['power', 'Power', 'Vigor + Spark + Grit + Zoom + Luck.'],
    ['tag', 'Burn tag', 'The short text on a burn, like pet:feed:891. The game reads every tag from Bitcoin to rebuild all pets.'],
    ['burn', 'Burn', 'Destroying XCPETS on Counterparty. Every action is one, signed in your own XCP Wallet. Burns are final.'],
    ['mythicdisc', 'Mythic shortcut', 'Raise a Mythic yourself (hatched, bred or granted and never left you, or more than half its care fed by you) and all your pets reach Mythic at 21,000 care. Gifted or bought Mythics don\'t count.'],
    ['stash', 'Stash', 'All your gear, worn and unworn.'],
    ['cold', 'Cold Storage', 'Where community pets go at Mythic. After that anyone can hatch and breed them.']];
  function glossary(k) { return '<h3>📖 Glossary</h3><dl class="ip-gloss">' + GLOSS.map(function (g) { return '<dt id="ipg-' + g[0] + '"' + (g[0] === k ? ' class="on"' : '') + '>' + g[1] + '</dt><dd>' + esc(g[2]) + '</dd>'; }).join('') + '</dl>' +
    (d.getElementById('pets') ? '<p class="small"><button type="button" class="q" data-iptour>▶ Replay the 4-step tour</button></p>' : '') + more('rules', 'All burn tags'); }
  function tools() { var h = d.querySelector('header.nav'); if (!h) return null; var t = $('ipTools'); if (!t) { t = d.createElement('span'); t.id = 'ipTools'; t.className = 'ip-tools'; h.appendChild(t); } return t; }
  function glossBtn() { var nav = tools(); if (!nav || d.getElementById('ipGloss')) return; var b = d.createElement('button'); b.type = 'button'; b.id = 'ipGloss'; b.className = 'ip-navq'; b.setAttribute('data-ip', 'glossary'); b.setAttribute('aria-label', 'Glossary'); b.title = 'Glossary: what the words mean'; b.textContent = '📖'; nav.appendChild(b); }

  // ------------------------------------------------------------------ delegated taps (capture: a '?' inside a card never opens the card)
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-ip]'); if (t) { e.preventDefault(); e.stopPropagation(); var f = TIPS[t.getAttribute('data-ip')]; if (f) open(f(t.getAttribute('data-arg'))); return; }
    var o = e.target.closest('[data-ipopen]'); if (o) { e.preventDefault(); close(); if (window.V2UI && V2UI.detail) V2UI.detail(+o.getAttribute('data-ipopen')); return; }
    var r = e.target.closest('[data-iptour]'); if (r) { close(); tour(true); return; }
    var w = e.target.closest('.ip-why'); if (w) { e.preventDefault(); e.stopPropagation(); open('<h3>Why can\'t I tap this?</h3><p>' + esc(w.getAttribute('data-why')) + '</p>'); }
  }, true);

  // ------------------------------------------------------------------ item 1: one pop-up at a time, deep links win, backlog chip
  var t0 = Date.now(), held = [], chip;
  function deepLink() { return /^#(lair|dressing-room|drip-den|kekimus|no-tail-motel|gooby-inn|pet-\d+|battle-\d+|hatchPanel|petsPanel)/.test(location.hash); }
  function returning() { return !!me(); }
  if (d.getElementById('pets') && (deepLink() || returning())) html.classList.add('ip-hold');
  function holdOn() { return html.classList.contains('ip-hold'); }
  /* flow-fixes (2026-10-22): the backlog is a small chip in the header corner (never over page controls, hidden while a pop-up is open), with ✕ = skip all.
   * Held hatch/gear results and fight/breed replays (window.V2Held, v2.js) are listed too: one sheet, ▶ Watch all / Skip all. */
  function heldN() { return window.V2Held ? V2Held.count() : 0; }
  function chipUi() { var n = held.length + heldN() + (d.querySelector('#inReqBox.on') ? 1 : 0) + (d.getElementById('eggPop') ? 1 : 0), wrap = $('ipAwayWrap');
    if (!n) { if (wrap) wrap.hidden = true; if (Date.now() - t0 > 20000 && !heldN()) html.classList.remove('ip-hold'); return; }
    if (!wrap) { wrap = d.createElement('span'); wrap.id = 'ipAwayWrap'; wrap.className = 'ip-awaywrap'; wrap.innerHTML = '<button type="button" id="ipAway" class="ip-away"></button><button type="button" id="ipAwayX" class="ip-awayx" aria-label="Dismiss: skip all" title="Dismiss (skip all)">✕</button>';
      var tl = tools(); if (tl) tl.insertBefore(wrap, tl.firstChild); else { wrap.classList.add('ip-awayfix'); d.body.appendChild(wrap); } chip = $('ipAway'); chip.onclick = awaySheet; $('ipAwayX').onclick = skipAll; }
    wrap.hidden = false; chip.textContent = '🔔 ' + n; chip.title = n + ' thing' + (n === 1 ? '' : 's') + ' happened while you were away'; chip.setAttribute('aria-label', chip.title); }
  window.V2IpChip = function () { setTimeout(chipUi, 0); };
  function skipAll() { close(); var rq = d.querySelector('#inReqBox.on'); if (rq) { var lb = [].slice.call(rq.querySelectorAll('button')).filter(function (b) { return /later/i.test(b.textContent); })[0]; if (lb) lb.click(); else rq.classList.remove('on'); }
    var eg = d.getElementById('eggPop'); if (eg) eg.remove(); held = []; if (window.V2Held) V2Held.skip(); html.classList.remove('ip-hold'); chipUi(); }
  function watchAll() { close(); held = []; html.classList.remove('ip-hold'); if (window.V2Held) V2Held.run(); chipUi(); }
  function awaySheet() { var L = [], rq = d.querySelector('#inReqBox.on'), eg = d.getElementById('eggPop');
    if (rq) L.push('<li>' + esc((rq.querySelector('h2,h3,#irqTitle') || rq).textContent.trim().slice(0, 90)) + '</li>'); if (eg) L.push('<li>🥚 ' + esc(eg.textContent.replace(/\s+/g, ' ').trim().slice(0, 90)) + '</li>');
    held.forEach(function (h) { L.push('<li>' + h + '</li>'); }); if (window.V2Held) V2Held.list().forEach(function (h) { L.push('<li>' + esc(h) + '</li>'); });
    var pops = rq || eg || heldN(), s = open('<h3>While you were away</h3><ul class="ip-list">' + L.join('') + '</ul>' + (pops ? '<p class="row"><button type="button" class="btn" id="ipShowPops">▶ Watch all</button> <button type="button" class="q" id="ipSkipAll">Skip all</button></p>' : ''));
    var b = s.querySelector('#ipShowPops'); if (b) b.onclick = watchAll; var k = s.querySelector('#ipSkipAll'); if (k) k.onclick = skipAll;
    if (!pops) { held = []; html.classList.remove('ip-hold'); setTimeout(chipUi, 0); } }
  function watchToasts() { var t = $('toasts'); if (!t || t._ip) return; t._ip = 1;
    new MutationObserver(function (ms) { if (!holdOn() || Date.now() - t0 > 20000) return; ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType !== 1 || !n.classList.contains('toast') || n.getAttribute('data-calm') || Date.now() - lastTap < 1500) return; held.push(n.innerHTML); n.remove(); chipUi(); }); }); }).observe(t, { childList: true }); }
  var lastTap = 0; d.addEventListener('pointerdown', function () { lastTap = Date.now(); }, true);
  /* deep links win: until the player touches the page, an automatic jump (e.g. the arena replaying a missed fight) is undone,
   * back to the #target they opened (or the top). The scene still plays; it just doesn't move the page. */
  var touched = false; ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(function (ev) { d.addEventListener(ev, function () { touched = true; }, { capture: true, passive: true }); });
  if (holdOn()) { var pin = function () { if (touched || window.__ipNoPin || Date.now() - t0 > 20000) return window.removeEventListener('scroll', pinS); var h = location.hash && d.getElementById(location.hash.slice(1)), y = h ? h.getBoundingClientRect().top + window.scrollY : 0; if (Math.abs(window.scrollY - y) > 200) window.scrollTo(0, y); }, pend = 0, pinS = function () { if (!pend) pend = setTimeout(function () { pend = 0; pin(); }, 120); }; window.addEventListener('scroll', pinS, { passive: true }); }
  function viewOnlyAccept() { var v = viewOnly(); html.classList.toggle('ip-view', v);
    if (!v) return; d.querySelectorAll('#inReqBox button, #motelReqs button, #motelDesk button, #fPending button').forEach(function (b) { if (/accept/i.test(b.textContent) && !b.classList.contains('ip-hide')) b.classList.add('ip-hide'); }); }

  // ------------------------------------------------------------------ item 2 + 14: urgency badge + next-best-action line
  function myLive(w) { var m = me(); if (!w || !m) return []; return w.pets.filter(function (p) { return p.owner === m && !p.dead && !p.released && !p.community; }); }
  function urgent(w) { return myLive(w).filter(function (p) { return p.neglected && !p.mythicCare && p.deathBlock != null && p.deathBlock > w.tip; }); }
  function left(blocks) { var m = blocks * 10, dd = Math.floor(m / 1440), h = Math.round((m % 1440) / 60); return dd ? dd + 'd ' + h + 'h' : h + 'h'; }
  function badge(w) { var tab = $('tabAlive'); if (!tab) return; var n = urgent(w).length;
    var b = $('ipUrg'); if (!n) { if (b) b.remove(); return; }
    if (!b) { b = d.createElement('button'); b.type = 'button'; b.id = 'ipUrg'; b.className = 'ip-urg'; b.title = 'Neglected pets (3+ days unfed): they die after 7 unfed days. Tap to sort by most urgent.'; tab.parentNode.insertBefore(b, tab.nextSibling);
      b.onclick = function () { var s = $('fSort'); if (s) { s.value = 'urgent'; s.dispatchEvent(new Event('change', { bubbles: true })); } var pp = $('petsPanel'); if (pp) pp.scrollIntoView({ behavior: 'smooth' }); }; }
    b.textContent = '🪦 ' + n; b.setAttribute('aria-label', n + ' neglected pets, sort by most urgent'); }
  function nba(w) { var box = $('ipNba'), pp = $('petsPanel'), L = myLive(w); if (!pp || !w) return; var day = Math.floor(w.tip / BPD);
    if (ls('xcpets-ip-nba') === String(day) || !L.length) { if (box) box.remove(); return; }
    var starve = urgent(w), hungry = L.filter(function (p) { return p.hungry && p.nextMeal; }), line = '';
    if (starve.length) line = '🪦 ' + starve.length + ' neglected pet' + (starve.length === 1 ? '' : 's') + ' · first dies in ~' + left(Math.min.apply(null, starve.map(function (p) { return p.deathBlock - w.tip; }))) + ' · <a href="#" data-ipnba="urgent">see most urgent ▸</a>';
    else if (hungry.length) line = '🍽️ ' + hungry.length + ' hungry · ' + (window.XCPETS_FEED_ALL_PAUSED === true ? 'Feed all is paused for a fix.' /* feed-all-pause */ : '<a href="#" data-ipnba="feed">Feed all hungry ▸</a>');
    else { var f = L.filter(function (p) { return p.stage >= 2 && !p.neglected && !(p.fightDays && p.fightDays[day]); })[0]; if (f) line = '⚔️ #' + f.id + ' ' + esc(f.name) + ' can fight today · <a href="#kekimus">Kekimus ▸</a>'; }
    if (!line) { if (box) box.remove(); return; }
    if (!box) { box = d.createElement('p'); box.id = 'ipNba'; box.className = 'small ip-nba'; var tabs = pp.querySelector('.pettabs'); pp.insertBefore(box, tabs ? tabs.nextSibling : pp.firstChild.nextSibling);
      box.addEventListener('click', function (e) { var a = e.target.closest('[data-ipnba]'), x = e.target.closest('.ip-x'); if (x) { ls('xcpets-ip-nba', String(day)); box.remove(); return; } if (!a) return; e.preventDefault();
        if (a.getAttribute('data-ipnba') === 'urgent') { var s = $('fSort'); s.value = 'urgent'; s.dispatchEvent(new Event('change', { bubbles: true })); }
        else { var fb = $('bFeedHungry'); if (fb) { fb.scrollIntoView({ block: 'center', behavior: 'smooth' }); fb.classList.add('ip-flash'); setTimeout(function () { fb.classList.remove('ip-flash'); }, 1600); } } }); }
    box.innerHTML = line + ' <button type="button" class="q ip-x" aria-label="Hide until tomorrow">✕</button>'; }

  // ------------------------------------------------------------------ item 3 + 4: chips and care line on the cards (+ detail)
  function decorateCards(w) { if (!w) return; d.querySelectorAll('#pets .pet.card[data-pid]:not([data-ipd])').forEach(function (c) { c.setAttribute('data-ipd', '1'); var id = +c.dataset.pid, p = w.byId[id]; if (!p) return;
    c.querySelectorAll('.chips .chip.warn').forEach(function (ch) { if (/neglected|starves/.test(ch.textContent)) { ch.setAttribute('data-ip', 'neglect'); ch.setAttribute('data-arg', id); ch.classList.add('ip-tap'); ch.setAttribute('role', 'button'); ch.tabIndex = 0; } });
    var cl = c.querySelector('.bar + .small.muted'); if (cl && !p.dead) { var s = careShort(w, p); cl.insertAdjacentHTML('beforeend', (s ? ' <span class="ip-next">' + esc(s) + '</span>' : '') + q('care', id, 'Care and next stage')); } }); }
  function decorateDetail(w) { var di = $('dInfo'), t = $('dTitle'); if (!di || !w || di.querySelector('.ip-q[data-ip=care]')) return; var m = /#(\d+)/.exec((t && t.textContent) || ''); if (!m) return; var p = w.byId[+m[1]]; if (!p || p.dead) return;
    var s = careShort(w, p); di.insertAdjacentHTML('afterbegin', '<p class="small ip-dcare">' + (s ? esc(s) + ' ' : '') + q('care', p.id, 'Care and next stage') + '</p>'); }

  // ------------------------------------------------------------------ item 5: 🧾 receipt chip
  function receipt() { var pd = $('pending'); if (!pd) return; var nav = d.querySelector('header.nav'), b = $('ipRcpt');
    if (!b) { b = d.createElement('button'); b.type = 'button'; b.id = 'ipRcpt'; b.className = 'ip-rcpt'; b.title = 'Your burns: pending + recent'; tools().appendChild(b);
      b.onclick = function () { var x = $('pending'); open('<h3>🧾 Your burns</h3><p class="small muted">Pending ones say "waiting for a block". Tap a tx to see it on the explorer.</p><div class="ip-rc">' + (x ? x.innerHTML : 'None yet.') + '</div>'); }; }
    var n = (pd.textContent.match(/waiting for a block/g) || []).length; b.innerHTML = '🧾' + (n ? '<span class="ip-cnt">' + n + '</span>' : ''); b.setAttribute('aria-label', 'Your burns' + (n ? ', ' + n + ' pending' : '')); }

  // ------------------------------------------------------------------ item 6: disabled buttons say why; view-only shows "Connect to burn"
  var WHY = { bGo: 'Pick two guests first. Both must be Adult or older, alive and not neglected, and not resting from a breed in the last 1,008 blocks.', bFeedHungry: 'No pet is hungry right now: each pet eats once per chain day (144 blocks).', cfeedBtn: 'Community feeding opens when pet #3 arrives.', crollBtn: 'Community gear rolls open when pet #3 arrives.' };
  function why() { d.querySelectorAll('button:disabled').forEach(function (b) { if (!b.offsetParent || (b.nextElementSibling && b.nextElementSibling.classList.contains('ip-why'))) return; var t = b.title || WHY[b.id] || (/pick your pet/i.test(b.textContent) ? 'Pick your pet on the left card first, then an opponent.' : '');
      if (!t || /^[◀▶]$/.test(b.textContent.trim())) return; var s = d.createElement('button'); s.type = 'button'; s.className = 'ip-q ip-why'; s.textContent = '?'; s.setAttribute('data-why', t); s.setAttribute('aria-label', 'Why is this off?'); b.insertAdjacentElement('afterend', s); });
    d.querySelectorAll('.ip-why').forEach(function (s) { var b = s.previousElementSibling; if (!b || !b.disabled || !b.offsetParent) s.remove(); });
    var hb = $('hatchBtn'), rl = $('reload'); if (hb && rl && !$('ipConn')) { if (!hb.offsetParent && !$('wconnect').offsetParent === false) { } }
    if (hb && rl) { var need = !hb.offsetParent && (viewOnly() || !me()), c = $('ipConn'); if (need && !c) { c = d.createElement('button'); c.type = 'button'; c.id = 'ipConn'; c.className = 'btn ghost'; c.textContent = '🔌 Connect to burn'; c.onclick = function () { var wc = $('wconnect'); if (wc) { wc.scrollIntoView({ block: 'center' }); wc.click(); } }; rl.parentNode.insertBefore(c, rl); } else if (!need && c) c.remove(); } }

  // ------------------------------------------------------------------ items 7, 8, 9, 10: '?' next to existing headings
  function addQ(sel, key, label) { var h = d.querySelector(sel); if (!h || h.querySelector('.ip-q[data-ip="' + key + '"]')) return; h.insertAdjacentHTML('beforeend', ' ' + q(key, null, label)); }
  function heads() { addQ('#hatchPanel > h2', 'hatch', 'Hatch odds and upkeep'); addQ('#battlePanel > h3', 'fight', 'How fights work, what\'s at stake'); addQ('#breedPanel > h2', 'breed', 'Breeding odds');
    var rb = d.querySelector('#invPanel .lair-h') ; if (rb && !rb.querySelector('[data-ip=roll]')) rb.insertAdjacentHTML('beforeend', ' ' + q('roll', null, 'How gear rolls work'));
    /* locked Lair slots: tap says why */ d.querySelectorAll('#invPanel [data-slot].locked:not([data-ip]), #invPanel .slot.locked:not([data-ip])').forEach(function (s) { s.setAttribute('data-ip', 'slot'); s.setAttribute('data-arg', s.getAttribute('data-slot') || ''); });
    /* fight stat letters get their full names on hover / long-press */ d.querySelectorAll('#faceoff .sk:not([title])').forEach(function (k) { var n = { VIG: 'Vigor', SPA: 'Spark', GRI: 'Grit', ZOO: 'Zoom', LUC: 'Luck' }[k.textContent]; if (n) k.title = n; }); }

  // ------------------------------------------------------------------ item 13: first-visit tour (no pets, no address)
  var STEPS = [['hatchPanel', '1/4 · Hatch', 'Burn {hatch} XCPETS to hatch an egg. Tier and species come from the Bitcoin block.'], ['petsPanel', '2/4 · Feed daily', 'One meal per pet per chain day. 7 days unfed and it dies.'], ['invPanel', '3/4 · Gear in The Rare Room', 'Spin the Pepe Wheel ({roll} XCPETS a spin) for gear and dress your pets here.'], ['arenaPanel', '4/4 · Fight and breed', 'Fight at X Circus Kekimus, breed at Gooby\'s No-Tail Motel.']];
  function tour(force) { if (!$('hatchPanel')) return; if (!force && (ls('xcpets-ip-tour') || me())) return; var i = 0, box = d.createElement('div'); box.className = 'ip-tour'; box.setAttribute('role', 'dialog'); d.body.appendChild(box);
    function show() { d.querySelectorAll('.ip-tour-on').forEach(function (x) { x.classList.remove('ip-tour-on'); }); var s = STEPS[i], el = $(s[0]); if (el) { el.classList.add('ip-tour-on'); el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      box.innerHTML = '<b>' + s[1] + '</b><p class="small">' + esc(s[2].replace('{hatch}', costNow('hatch')).replace('{roll}', costNow('roll'))) + '</p><div class="row"><button type="button" class="btn" data-t="n">' + (i < 3 ? 'Next ▸' : 'Done') + '</button><button type="button" class="q" data-t="x">Skip</button></div>'; }
    box.onclick = function (e) { var t = e.target.getAttribute('data-t'); if (!t) return; if (t === 'n' && i < 3) { i++; return show(); } ls('xcpets-ip-tour', '1'); box.remove(); d.querySelectorAll('.ip-tour-on').forEach(function (x) { x.classList.remove('ip-tour-on'); }); };
    show(); }

  // ------------------------------------------------------------------ item 16: community panel collapses to one line while there's no community pet
  function community(w) { var cp = $('communityPanel'); if (!cp || cp._ip || !w || !window.V2Render || !V2Render.communityGap || !V2Render.communityGap(w)) return; cp._ip = 1;
    var h = cp.querySelector('h2'), body = d.createElement('div'); body.className = 'ip-cbody'; while (h.nextSibling) body.appendChild(h.nextSibling); cp.appendChild(body); cp.classList.add('ip-collapsed');
    var t = d.createElement('button'); t.type = 'button'; t.className = 'q ip-ctog'; t.setAttribute('aria-expanded', 'false'); t.innerHTML = 'Community pet #' + (V2Render.COMMUNITY_NEXT_NO || 3) + ' coming soon · details ▾'; h.insertAdjacentElement('afterend', t);
    t.onclick = function () { var o = cp.classList.toggle('ip-collapsed'); t.setAttribute('aria-expanded', String(!o)); t.innerHTML = 'Community pet #' + (V2Render.COMMUNITY_NEXT_NO || 3) + ' coming soon · ' + (o ? 'details ▾' : 'hide ▴'); }; }
  function notify() { /* item 24 */ ['cfeedBtn', 'crollBtn'].forEach(function (id, k) { var b = $(id); if (!b || !b.disabled || k || $('ipNotify')) return; var a = d.createElement('button'); a.type = 'button'; a.id = 'ipNotify'; a.className = 'q'; a.setAttribute('data-ip', 'community'); a.textContent = '🔔 tell me'; b.parentNode.insertBefore(a, b.nextSibling.nextSibling || null); }); }

  // ------------------------------------------------------------------ items 18, 19, 23, 28, 29
  function cemeteryLink() { if (!/cemetery\.html/.test(location.pathname)) return; var m = me(), st = $('status'); if (!m || $('ipCemMine') || !st) return;
    var p = d.createElement('p'); p.className = 'small'; p.id = 'ipCemMine'; p.innerHTML = '<a href="play.html?sort=urgent#petsPanel">🪦 My pets closest to dying ▸</a>'; st.parentNode.insertBefore(p, st.nextSibling); }
  function rankingMine() { var f = $('uxpFind'), go = $('uxpFindGo'), m = me(); if (!f || !go || $('ipMine') || !m) return; var a = d.createElement('button'); a.type = 'button'; a.id = 'ipMine'; a.className = 'q'; a.textContent = 'Jump to mine';
    a.onclick = function () { var w = window.V2Mock && V2Mock.world ? V2Mock.world() : W(), best = null; if (w && w.pets) w.pets.forEach(function (p) { if (p.owner === m && !p.dead && (!best || p.care > best.care)) best = p; });
      if (!best) return; f.value = '#' + best.id; go.click(); }; go.insertAdjacentElement('afterend', a); }
  function coldQ() { if (!/archive\.html/.test(location.pathname)) return; var h = d.querySelector('main h1, main h2'); if (h && !h.querySelector('[data-ip=cold]')) h.insertAdjacentHTML('beforeend', ' ' + q('cold', null, 'What happens to them now?')); }
  function reloadTip() { var r = $('reload'); if (r && !r._ip) { r._ip = 1; r.title = 'Refresh from Bitcoin (new blocks every ~10 min)'; r.setAttribute('aria-label', 'Refresh from Bitcoin (new blocks every ~10 min)'); } }
  function recent() { var f = $('addrView'), inp = $('avAddr'); if (!f || !inp) return; var cur = new URLSearchParams(location.search).get('addr'), L = []; try { L = JSON.parse(ls('xcpets-ip-recent') || '[]'); } catch (e) { }
    if (cur && /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/.test(cur) && L[0] !== cur) { L = [cur].concat(L.filter(function (x) { return x !== cur; })).slice(0, 5); ls('xcpets-ip-recent', JSON.stringify(L)); }
    var others = L.filter(function (x) { return x !== cur; }).slice(0, 4); if (!others.length || $('ipRecent')) return;
    var b = d.createElement('div'); b.id = 'ipRecent'; b.className = 'small ip-recent'; b.innerHTML = '<span class="muted">Recent:</span> ' + others.map(function (a) { return '<a class="chip" href="play.html?addr=' + encodeURIComponent(a) + '" title="' + esc(a) + '">' + esc(a.slice(0, 6) + '…' + a.slice(-4)) + '</a>'; }).join(' ');
    var help = $('avHelp'); (help || f.lastElementChild).insertAdjacentElement('beforebegin', b); }
  function sortParam() { var s = new URLSearchParams(location.search).get('sort'), el = $('fSort'); if (s === 'urgent' && el && el.value !== 'urgent' && !el._ip) { el._ip = 1; el.value = 'urgent'; el.dispatchEvent(new Event('change', { bubbles: true })); } }

  // ------------------------------------------------------------------ item 26: pet page action row (owner only)
  function petActions() { if (!/pet\.html/.test(location.pathname)) return; var id = +new URLSearchParams(location.search).get('id'), w = window.V2Mock && V2Mock.world ? V2Mock.world() : null, p = w && w.byId ? w.byId[id] : null, m = me(), a = d.querySelector('a.btn[href^="play.html#pet-"]');
    if (!a || $('ipActs') || !m) return; var row = d.createElement('span'); row.id = 'ipActs'; row.className = 'ip-acts';
    row.innerHTML = ' <a class="btn ghost" href="play.html#pet-' + id + '">🍽️ Feed</a> <a class="btn ghost" href="rare-room.html#rare-room">🎲 Roll / gear</a> <a class="btn ghost" href="fight.html#battle-' + id + '">⚔️ Fight</a> <a class="btn ghost" href="breed.html#no-tail-motel">💞 Breed</a>'; a.insertAdjacentElement('afterend', row); }

  // ------------------------------------------------------------------ exports used by page code
  window.IPQ = { q: q, open: open, close: close, careShort: careShort, careNext: careNext, careSheet: function (id) { return TIPS.care(id); },
    mythicQ: function (p) { return p && p.stage === 5 && !p.community ? q('mythicRank', null, 'Why is this Mythic\'s care lower?') : ''; },
    urgency: function (w, p) { if (p.dead || p.mythicCare || p.deathBlock == null) return Infinity; return p.deathBlock - (w ? w.tip : 0); } };

  // ------------------------------------------------------------------ loop (cheap; everything is idempotent)
  function tick() { var w = W(); glossBtn(); reloadTip(); recent(); watchToasts(); chipUi(); viewOnlyAccept(); receipt(); why(); heads(); notify(); coldQ(); cemeteryLink(); rankingMine(); petActions(); sortParam();
    if (w) { badge(w); nba(w); decorateCards(w); decorateDetail(w); community(w); } }
  function boot() { tick(); setInterval(tick, 1200); /* the old 4-step tour is replay-only now (help button, data-iptour) */ }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
