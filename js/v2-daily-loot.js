/* XCPETS DAILY LOOT (Nov 23 2026, owner "who does it best" list, item 3: "three daily chores with a chest at the end", Clash Royale / Duolingo).
 * DISPLAY ONLY and HEALTHY: the three ticks are visits and free actions, never money spent; nothing here asks for a burn, nothing is signed.
 *   👋 Check in          open Play today
 *   🗺️ Visit a place     open the Circus, the Motel, the Raid or the Rare Room
 *   📖 Open your Petdex  (js/v2-petdex.js fires 'xcpets:petdex-open')
 * All three = the chest unlocks: it shakes, bursts, and gives today's meme card (one of the curated HatchBot memes, hb-memes/manifest.json,
 * the same card for everyone on a calendar day) with a Share button. A chest streak counts days in a row the chest was opened.
 * Kept per browser in localStorage 'xcpets-loot' (calendar day, local time). Shown inside the Today card on Play (js/v2-today.js asks html()).
 * REAL PRIZES (Jake okayed Nov 27 2026; rules V2Rules.loot*, from ACTIVATE_LOOT_BLOCK): on Play with a wallet, once the gate is on, opening the chest
 * signs one pet:loot claim (1 dander) through the normal confirm sheet. The prize (Pantry meals or an egg, never gear) is rolled by the rules when the
 * burn confirms; the page waits for it (localStorage 'xcpets-loot-wait') and then plays the reveal. The day and streak then come from the chain
 * (lootInfo), the meme card is a small bonus under the prize. Nothing here signs: the wallet does, after the player approves. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.V2Loot = api;
  if (root && root.document) api.start();
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  var KEY = 'xcpets-loot', TICKS = [['in', '👋', 'Check in'], ['place', '🗺️', 'Visit a place'], ['dex', '📖', 'Open your Petdex']];
  var PLACES = { fight: 1, breed: 1, raid: 1, rare: 1 };
  function dayNo(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return Math.round(d.getTime() / 864e5); }
  /** step(state, today, event) -> new state. Pure: the whole daily logic, node-tested (tools/daily-loot-test.js). */
  function step(s, today, ev) {
    s = s && typeof s === 'object' ? Object.assign({}, s) : {};
    if (s.day !== today) { var kept = s.opened && s.day === today - 1 ? s.streak || 0 : 0; s = { day: today, t: {}, opened: 0, streak: kept, best: s.best || 0, last: s.opened ? s.day : s.last }; }
    s.t = Object.assign({}, s.t);
    if (ev === 'in' || ev === 'place' || ev === 'dex') s.t[ev] = 1;
    if (ev === 'open' && ready(s) && !s.opened) { s.opened = 1; s.streak = (s.last === today - 1 ? s.streak || 0 : 0) + 1; s.best = Math.max(s.best || 0, s.streak); s.last = today; }
    return s; }
  function ready(s) { return !!(s && s.t && s.t['in'] && s.t.place && s.t.dex); }
  function done(s) { return TICKS.filter(function (k) { return s && s.t && s.t[k[0]]; }).length; }
  /** memeFor(list, day): the same card for everyone on a calendar day, walking the list in a fixed shuffled order. */
  function memeFor(list, day) { if (!list || !list.length) return null; var n = list.length, i = ((day * 7919) % n + n) % n; return list[i]; }

  /* ---------------------------------------------------------------- page */
  var d = root && root.document, S = null, memes = null;
  function $(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } }
  function fire(ev) { S = step(load() || S, dayNo(Date.now()), ev); save(S); repaint(); return S; }
  function state() { return S = step(load() || S, dayNo(Date.now()), null); }
  function css() { if ($('dlCss')) return; var s = d.createElement('style'); s.id = 'dlCss'; s.textContent =
    '.dl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:10px;padding:8px 10px;border:2px solid #2b2b2b;border-radius:10px;background:rgba(255,226,122,.14)}' +
    '.dl-h{font:10px "Press Start 2P",monospace;margin-right:4px}.dl-t{font-size:13px;padding:3px 8px;border:2px dashed #2b2b2b;border-radius:999px;opacity:.75;white-space:nowrap}' +
    '.dl-t.on{border-style:solid;background:#55c35a;color:#fff;opacity:1;text-shadow:1px 1px 0 #2b2b2b}' +
    '.dl-chest{margin-left:auto;font:11px/1.4 "Press Start 2P",monospace;padding:8px 10px;border:3px solid #2b2b2b;border-radius:10px;background:#c9c2a8;color:#2b2b2b;cursor:pointer;box-shadow:0 3px 0 #2b2b2b;white-space:nowrap}' +
    '.dl-chest.ready{background:#ffe27a;animation:dlGlow 1s steps(2) infinite}.dl-chest.got{background:#fff;opacity:.85}' +
    '@keyframes dlGlow{50%{box-shadow:0 3px 0 #2b2b2b,0 0 0 4px rgba(255,201,60,.7);transform:rotate(-2deg)}}' +
    '#dlOv{position:fixed;inset:0;z-index:100011;background:rgba(10,8,22,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:14px;cursor:pointer}' +
    '#dlOv .dl-big{font-size:96px;line-height:1;animation:dlShake .12s steps(2) 9,dlBurst .3s steps(3) 1.1s forwards;filter:drop-shadow(4px 4px 0 #000)}' +
    '@keyframes dlShake{0%{transform:rotate(-8deg)}100%{transform:rotate(8deg)}}@keyframes dlBurst{to{transform:scale(2.2);opacity:0}}' +
    '#dlOv .dl-card{display:none;max-width:min(420px,90vw);background:#fff8dc;border:4px solid #000;border-radius:12px;box-shadow:6px 6px 0 #000;padding:10px;text-align:center;color:#2b2b2b;animation:dlIn .35s steps(4)}' +
    '#dlOv.open .dl-card{display:block}#dlOv.open .dl-big{display:none}@keyframes dlIn{from{transform:scale(.3) rotate(-10deg)}}' +
    '#dlOv .dl-card img{width:100%;border:3px solid #000;border-radius:8px;image-rendering:auto;display:block}' +
    '#dlOv .dl-cap{font:20px/1.15 Bangers,Impact,sans-serif;letter-spacing:.5px;margin:8px 0 4px}#dlOv .dl-sub{font-size:13px;opacity:.8}' +
    '#dlOv .dl-row{display:flex;gap:8px;justify-content:center;margin-top:8px}#dlOv .dl-row button{font:10px/1.4 "Press Start 2P",monospace;padding:8px 10px;border:3px solid #2b2b2b;border-radius:10px;background:#7ad7ff;cursor:pointer;box-shadow:0 3px 0 #2b2b2b}' +
    '#dlOv .dl-title{font:26px Bangers,Impact,sans-serif;letter-spacing:1px;color:#ffe27a;text-shadow:3px 3px 0 #000}' +
    '#dlOv .dl-prize{font:40px/1.05 Bangers,Impact,sans-serif;letter-spacing:1px;color:#7a3cff;margin:6px 0 2px;text-shadow:2px 2px 0 #ffe27a}' +
    '#dlOv .dl-ico{font-size:72px;line-height:1;margin:4px 0;filter:drop-shadow(0 0 16px #ffd23f)}#dlOv .dl-p2{font:18px/1.2 Bangers,Impact,sans-serif;letter-spacing:.5px}' +
    '#dlOv .dl-odds{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:8px 0}#dlOv .dl-odds span{font-size:11px;border:2px solid #2b2b2b;border-radius:8px;padding:2px 6px;background:#fff}#dlOv .dl-odds span.hit{background:#7a3cff;color:#fff}' +
    '#dlOv .dl-days{display:flex;gap:4px;justify-content:center;margin:8px 0}#dlOv .dl-days i{font-style:normal;width:30px;height:30px;border:2px solid #2b2b2b;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:#eee}' +
    '#dlOv .dl-days i.on{background:#ffd23f}#dlOv .dl-days i.gold{background:linear-gradient(#ffe680,#e0a800)}#dlOv .dl-days i.now{outline:3px solid #7a3cff}' +
    '#dlOv .dl-go{display:block;width:100%;margin-top:8px;font:22px Bangers,Impact,sans-serif;letter-spacing:1px;padding:8px;border:3px solid #000;border-radius:12px;background:#ffd23f;box-shadow:0 4px 0 #000;cursor:pointer}' +
    '#dlOv .dl-fine{font-size:12px;opacity:.75;margin-top:6px}#dlOv .dl-card.gold{background:linear-gradient(135deg,#fff3b0,#ffcf40)}' +
    '#dlOv .dl-meme{display:flex;gap:8px;align-items:center;text-align:left;background:#111;color:#fff;border-radius:10px;padding:6px;margin-top:10px;font-size:12px}#dlOv .dl-meme img{width:52px;height:52px;object-fit:cover;border:0;border-radius:6px}' +
    '#dlOv .dl-meme b{color:#ffe27a}#dlOv .dl-meme a{color:#7ad7ff;cursor:pointer;text-decoration:underline}' +
    '#dlOv .dl-wait{font-size:64px;animation:dlShake .2s steps(2) infinite}' +
    '@media (prefers-reduced-motion:reduce){.dl-chest.ready,#dlOv .dl-big,#dlOv .dl-card,#dlOv .dl-wait{animation:none}}';
    d.head.appendChild(s); }
  /** html(): the strip for the Today card. */
  function html() { css(); var s = state(), r = ready(s), c = chain();
    if (c) { var I = c.I, lb = I.claimed ? '✅ ' + shortPrize(I.last) + (I.streak > 1 ? ' · 🔥' + I.streak : '') : wait() ? '⛏️ Rolling…' : r ? (I.chest === 'lucky' ? '💎 LUCKY CHEST' : I.chest === 'gold' ? '🏆 GOLD CHEST' : '🎁 OPEN CHEST') : '🔒 ' + done(s) + '/3';
      return '<div class="dl" id="dlStrip"><span class="dl-h">DAILY LOOT</span>' + TICKS.map(function (k) { return '<span class="dl-t' + (s.t[k[0]] ? ' on' : '') + '">' + (s.t[k[0]] ? '✓' : k[1]) + ' ' + k[2] + '</span>'; }).join('') +
        '<button type="button" class="dl-chest' + (I.claimed ? ' got' : r && !wait() ? ' ready' : '') + '" data-loot="open">' + lb + '</button></div>'; }
    return '<div class="dl" id="dlStrip"><span class="dl-h">DAILY LOOT</span>' + TICKS.map(function (k) { return '<span class="dl-t' + (s.t[k[0]] ? ' on' : '') + '">' + (s.t[k[0]] ? '✓' : k[1]) + ' ' + k[2] + '</span>'; }).join('') +
      '<button type="button" class="dl-chest' + (s.opened ? ' got' : r ? ' ready' : '') + '" data-loot="open">' + (s.opened ? '✅ Opened' + (s.streak > 1 ? ' · 🔥' + s.streak : '') : r ? '🎁 OPEN CHEST' : '🔒 ' + done(s) + '/3') + '</button></div>'; }
  function repaint() { var el = $('dlStrip'); if (el) el.outerHTML = html(); }
  function getMemes(cb) { if (memes) return cb(memes); fetch('hb-memes/manifest.json', { cache: 'force-cache' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (j) { memes = Array.isArray(j) ? j : []; cb(memes); }, function () { cb([]); }); }
  /* ---------------------------------------------------------------- real prizes (rules: pet:loot) */
  var WKEY = 'xcpets-loot-wait', WT = null, PZ = { meal1: ['🍖', '1 FREE MEAL'], meal3: ['🍖', '3 FREE MEALS'], egg: ['🥚', 'FREE EGG!'], golden: ['🌟', 'GOLDEN EGG!'], lucky: ['💎', 'LUCKY EGG!'] };
  var ODDS = [['meal1', '🍖 1 meal'], ['meal3', '🍖 3 meals'], ['egg', '🥚 Egg'], ['golden', '🌟 Golden Egg'], ['lucky', '💎 Lucky Egg']];
  /** chain(): the rules' chest for the connected wallet on Play, or null (no wallet, not Play, or before ACTIVATE_LOOT_BLOCK: the meme-only chest). */
  function chain() { var V = root.V2Rules, U = root.V2UI; if (!V || !V.lootInfo || !V.lootOn || !U || !U.world || !U.ME) return null; var w; try { w = U.world(); } catch (e) { return null; } if (!w) return null;
    var nb = (w.tip || 0) + 1; if (!V.lootOn(nb)) return null; var I = V.lootInfo(w, U.ME, nb); return I ? { V: V, U: U, w: w, nb: nb, I: I } : null; }
  function shortPrize(L) { if (!L) return 'Opened'; var z = PZ[L.prize] || ['🎁', 'Prize']; return z[0] + ' ' + (L.meals && !L.petId ? L.meals + ' meal' + (L.meals === 1 ? '' : 's') : L.prize === 'egg' ? 'Egg' : L.prize === 'golden' ? 'Golden Egg' : 'Lucky Egg'); }
  function wait() { try { var x = JSON.parse(localStorage.getItem(WKEY) || 'null'); return x && Date.now() - x.t < 3 * 3600e3 ? x : null; } catch (e) { return null; } }
  function setWait(x) { try { if (x) localStorage.setItem(WKEY, JSON.stringify(x)); else localStorage.removeItem(WKEY); } catch (e) { } }
  function days(st, I) { var o = '', base = Math.floor(Math.max(0, st - 1) / 7) * 7; for (var i = 1; i <= 7; i++) { var n = base + i; o += '<i class="' + (n <= st ? 'on' : '') + (n % 7 === 0 ? ' gold' : '') + (n === st ? ' now' : '') + '">' + (n % 30 === 0 ? '💎' : n % 7 === 0 ? '🏆' : n <= st ? '✓' : n) + '</i>'; } return '<div class="dl-days" aria-label="Chest streak">' + o + '</div>'; }
  function overlay(inner, cls) { css(); var old = $('dlOv'); if (old) old.remove(); var ov = d.createElement('div'); ov.id = 'dlOv'; ov.className = 'open'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Daily loot chest');
    ov.innerHTML = inner; d.body.appendChild(ov); ov.addEventListener('click', function (e) { var b = e.target.closest('[data-dl]'); if (b) return; if (!e.target.closest('.dl-card')) ov.remove(); }); return ov; }
  function memeRow(cb) { getMemes(function (L) { var m = memeFor(L, dayNo(Date.now())); cb(m ? '<div class="dl-meme"><img alt="" src="hb-memes/' + encodeURIComponent(m.file) + '"><div><b>Bonus: meme of the day</b><br>“' + esc(m.caption) + '” Just for laughs. <a data-dl="share">Share</a></div></div>' : '', m); }); }
  /** claimSheet(c): the chest before today's claim: streak, what today's chest can give, one button that opens the normal sign sheet. */
  function claimSheet(c) { var I = c.I, st = I.next, ch = I.chest;
    var head = ch === 'lucky' ? '💎 LUCKY CHEST' : ch === 'gold' ? '🏆 GOLD CHEST' : 'DAILY LOOT', what = ch === 'lucky' ? 'Day ' + st + ': a <b>Lucky Egg</b> (Legendary for sure) + 3 meals + the Loot Goblin title.' : ch === 'gold' ? 'Day ' + st + ': a <b>Golden Egg</b> (3 tries at the best rarity) + 3 meals.' :
      'Day ' + st + ' of your streak.' + (I.floor ? ' From day 3 it can’t be less than 3 meals.' : '') + ' Day ' + (st + I.toGold) + ' = 🏆 Gold Chest.';
    var ov = overlay('<div class="dl-title">' + head + '</div><div class="dl-card' + (ch ? ' gold' : '') + '"><div class="dl-ico">' + (ch === 'lucky' ? '💎' : ch === 'gold' ? '🏆' : '🧰') + '</div>' + days(st, I) +
      '<div class="dl-sub">' + what + '</div>' + (ch ? '' : '<div class="dl-odds">' + ODDS.map(function (o, i) { return '<span>' + o[1] + ' ' + [60, 25, 10, 4, 1][i] + '%</span>'; }).join('') + '</div>') +
      '<button type="button" class="dl-go" data-dl="claim">🎁 OPEN CHEST</button><div class="dl-fine">Opening signs one tiny claim: 1 dander of XCPETS plus the Bitcoin fee. The next Bitcoin block rolls your prize. Meals go to your Pantry, eggs to My Pets. Never gear.</div>' +
      '<div class="dl-row"><button type="button" data-dl="close">Later</button></div></div>');
    ov.addEventListener('click', function (e) { var b = e.target.closest('[data-dl]'); if (!b) return; var k = b.getAttribute('data-dl'); if (k === 'close') return ov.remove(); if (k === 'claim') claim(c, ov); }); }
  function claim(c, ov) { var U = c.U; if (U.viewBlock && U.viewBlock()) return; var plan = c.V.lootPlan(), why = U.sendWhy ? U.sendWhy(plan) : null;
    if (why) { ov.remove(); return U.toast ? U.toast('⚠️ ' + why) : null; } ov.remove();
    U.confirmPlans('🎁 Daily Loot', [plan], function () { setWait({ day: c.I.day, t: Date.now() }); fire('open'); waiting(); watch(); }); }
  function waiting() { overlay('<div class="dl-title">OPENING…</div><div class="dl-card"><div class="dl-wait" aria-hidden="true">🧰</div><div class="dl-p2">Your claim is on its way.</div><div class="dl-sub">The next Bitcoin block rolls your prize (usually about 10 minutes). You can close this: the chest pops open here when it lands.</div><div class="dl-row"><button type="button" data-dl="close">OK</button></div></div>')
      .addEventListener('click', function (e) { if (e.target.closest('[data-dl="close"]')) $('dlOv').remove(); }); }
  /** watch(): after a claim, check the world every few seconds; when today's claim is in it, play the reveal once. */
  function watch() { if (WT) return; WT = setInterval(function () { var x = wait(); if (!x) { clearInterval(WT); WT = null; return; } var c = chain(); if (!c) return;
      if (c.I.claimed && c.I.last && c.I.last.day >= x.day) { setWait(null); clearInterval(WT); WT = null; repaint(); reveal(c, c.I.last, true); } }, 4000); }
  /** reveal(c, L, fresh): the prize from the chain: chest shakes and bursts, then the prize, what to do with it, and the meme as a small bonus. */
  function reveal(c, L, fresh) { var z = PZ[L.prize] || ['🎁', 'PRIZE'], ch = L.chest, p = L.petId ? c.w.byId[L.petId] : null, V = c.V, reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var tier = p && V.TIER_LABELS ? V.TIER_LABELS[p.tier] : null, sp = p && V.speciesLabel ? V.speciesLabel(p.species) : '', PI = V.pantryInfo ? V.pantryInfo(c.w, c.U.ME, c.nb) : null;
    var sub = (p ? '#' + p.id + (tier ? ' · ' + tier + ' ' + sp : '') + (L.meals ? '<br>+ ' + L.meals + ' meals in your Pantry' : '') : '+' + L.credit + ' XCPETS of meals in your Pantry') + (ch === 'lucky' ? '<br>🏅 Loot Goblin title earned' : '');
    var act = p ? '<button type="button" class="dl-go" data-dl="pet">' + z[0] + ' SEE YOUR EGG</button>' : '<button type="button" class="dl-go" data-dl="pantry">🥫 ' + (PI && PI.ids && PI.ids.length ? 'SEE YOUR PANTRY' : 'PICK PETS TO EAT IT') + '</button>';
    var lvl = { meal1: 1, meal3: 2, egg: 2, golden: 3, lucky: 4 }[L.prize] || 1;
    memeRow(function (mh, m) {
      var ov = overlay('<div class="dl-title">' + (ch === 'lucky' ? 'LUCKY CHEST!' : ch === 'gold' ? 'GOLD CHEST!' : fresh ? 'YOU WON!' : 'TODAY’S PRIZE') + '</div><div class="dl-big" aria-hidden="true">' + (ch === 'lucky' ? '💎' : ch === 'gold' ? '🏆' : '🧰') + '</div>' +
        '<div class="dl-card' + (ch ? ' gold' : '') + '"><div class="dl-ico" aria-hidden="true">' + z[0] + '</div><div class="dl-prize">' + z[1] + '</div><div class="dl-p2">' + sub + '</div>' +
        (ch ? '' : '<div class="dl-odds">' + ODDS.map(function (o) { return '<span class="' + (o[0] === L.prize ? 'hit' : '') + '">' + o[1] + '</span>'; }).join('') + '</div>') + days(L.streak || 1) +
        '<div class="dl-sub">Saved on Bitcoin for good. Streak: <b>' + (L.streak || 1) + '</b> day' + (L.streak === 1 ? '' : 's') + '. A new chest unlocks next game day.</div>' + act + mh +
        '<div class="dl-row"><button type="button" data-dl="close">Close</button></div></div>');
      ov.className = fresh && !reduced ? '' : 'open';
      var S2 = root.V2Sfx; if (fresh && S2 && S2.knock) { [0, 300, 600, 900].forEach(function (t) { setTimeout(function () { S2.knock(); }, t); }); setTimeout(function () { S2.crack(); S2.reveal(lvl); }, 1100); }
      if (fresh && !reduced) setTimeout(function () { ov.classList.add('open'); }, 1300);
      ov.addEventListener('click', function (e) { var b = e.target.closest('[data-dl]'); if (!b) return; var k = b.getAttribute('data-dl'); e.stopPropagation();
        if (k === 'share') return share(m, b, L); ov.remove();
        if (k === 'pet' && p && c.U.detail) c.U.detail(p.id);
        if (k === 'pantry') { var pc = $('pantryCard'); if (root.V2Pantry && V2Pantry.state) { V2Pantry.state().open = true; V2Pantry.state().seen = ''; if (V2Pantry.paint) V2Pantry.paint(); } if (pc && pc.scrollIntoView) pc.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }); }); }
  function openChest() { var c = chain(); if (c) { if (c.I.claimed && c.I.last) return reveal(c, c.I.last, false); if (wait()) { watch(); return waiting(); } }
    var s0 = state(); if (c && ready(s0)) return claimSheet(c);
    var s = s0; if (!ready(s)) { var miss = TICKS.filter(function (k) { return !s.t[k[0]]; }).map(function (k) { return k[2].toLowerCase(); }); if (root.V2UI && V2UI.toast) V2UI.toast('Chest locked: ' + miss.join(', ') + ' first.'); else alert('Chest locked: ' + miss.join(', ') + ' first.'); return; }
    var first = !s.opened; if (first) s = fire('open'); var day = s.day;
    getMemes(function (L) { var m = memeFor(L, day); css(); var ov = d.createElement('div'); ov.id = 'dlOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Daily loot chest');
      ov.innerHTML = '<div class="dl-title">' + (first ? 'MEME OF THE DAY!' : 'TODAY’S MEME') + '</div><div class="dl-big" aria-hidden="true">🎁</div>' +
        '<div class="dl-card">' + (m ? '<img alt="' + esc(m.caption) + '" src="hb-memes/' + encodeURIComponent(m.file) + '"><div class="dl-cap">' + esc(m.caption) + '</div>' : '<div class="dl-cap">gm. WAGMI.</div>') +
        '<div class="dl-sub"><b>Just for laughs:</b> the words on the card are part of the meme, not a prize. Nothing was added to your wallet.' + (root.V2Rules && V2Rules.lootOn && V2Rules.lootOn(((root.V2UI && V2UI.world && (V2UI.world() || {}).tip) || 0) + 1) ? ' <b>Real prizes:</b> open the chest on Play with your wallet connected.' : '') + ' Chest streak: <b>' + s.streak + '</b> day' + (s.streak === 1 ? '' : 's') + ' (best ' + s.best + '). A new chest unlocks tomorrow.</div>' +
        '<div class="dl-row"><button type="button" data-dl="share">📤 Share</button><button type="button" data-dl="close">Close</button></div></div>';
      d.body.appendChild(ov); var S2 = root.V2Sfx, reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (S2 && S2.knock) { [0, 300, 600, 900].forEach(function (t) { setTimeout(function () { S2.knock(); }, t); }); setTimeout(function () { S2.crack(); S2.reveal(3); }, 1100); }
      setTimeout(function () { ov.classList.add('open'); }, reduced || !first ? 0 : 1300);
      ov.addEventListener('click', function (e) { var b = e.target.closest('[data-dl]'); if (b && b.getAttribute('data-dl') === 'share') { e.stopPropagation(); return share(m, b); } if (!e.target.closest('.dl-card') || b) ov.remove(); }); }); }
  function share(m, b, L) { var t = (L ? '🎁 My XCPETS Daily Loot: ' + shortPrize(L) + (L.streak > 1 ? ' (🔥 ' + L.streak + '-day streak)' : '') + '\n' : '') + '🐸 Today’s XCPETS meme: ' + (m ? m.caption : 'gm') + '\nxcpets.fun' + (m ? '/hb-memes/' + encodeURIComponent(m.file) : '');
    try { if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { navigator.share({ text: t }).catch(function () { }); return; } } catch (e) { }
    try { navigator.clipboard.writeText(t).then(function () { b.textContent = '✅ Copied'; }); } catch (e) { } }
  function start() { if (!d) return; var go = function () { var page = d.body && d.body.getAttribute('data-split'); if (/practice/.test(location.pathname)) return;
      if (page === 'play') fire('in'); else if (PLACES[page]) fire('place'); if (wait()) watch(); };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
    root.addEventListener('xcpets:petdex-open', function () { fire('dex'); });
    d.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-loot="open"]'); if (b) { e.preventDefault(); e.stopPropagation(); openChest(); } }, true); }
  return { step: step, ready: ready, done: done, memeFor: memeFor, dayNo: dayNo, html: html, state: state, open: openChest, start: start, fire: fire, chain: chain, shortPrize: shortPrize, reveal: reveal };
});
