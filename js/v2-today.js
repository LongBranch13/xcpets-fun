/* TODAY card (Nov 22 2026, owner: "fix all these things", plan upgrade 1). Display only: no burns, no rule changes, nothing signed.
 * On play.html, at the top of the page: what needs you today, in one look, in the game's meme voice.
 *   🍖 hungry pets      -> jumps to the existing "Feed hungry" button (the wallet still signs that burn)
 *   🪦 pets in danger   -> sorts My Pets by most urgent (Nov 28 2026: never counts discarded pets, V2Own.riskList)
 *   🚑 Save your best N (Nov 28 2026, Jake: "no one is feeding 2900 pets"): the NEXT button names the few pets worth a meal
 *      (js/v2-save-best.js), with the price and a 3 / 12 / 24 / all picker, and Feed these N opens the normal Feed selected sheet.
 *      The plain ones can be let go: Discard them (the usual Discard pile, free, undo) or take them to the Meat Grinder.
 *   ⚔️ pets that can fight today -> X Circus Kekimus
 *   🧹 one-burn button for the existing Daily chores (feed + WAGMI + spins), shown while pets are hungry
 *   🍽️ countdown to the next feed day (every 144 blocks)
 *   ⏱️ ready now: how many pets can breed / quest right now and when the next one is ready (timers from V2QuestClarity.timers,
 *      the same numbers as "My cooldowns" in the Motel on breed.html, which the button opens). Quest counts only once the full
 *      world is loaded, because the fast world has no quest data.
 *   🔥 check-in streak  -> days in a row this browser opened the game (visits only, never money spent)
 * It replaces the one-line "next best action" hint (#ipNba) while it shows. Reads the page's world (V2Mock.world) every 2 s
 * and repaints only when the tip, the wallet or the pet count changed. */
(function () {
  'use strict';
  if (!document.body || document.body.getAttribute('data-split') !== 'play' || /practice/.test(location.pathname)) return;
  var d = document, BPD = 144;
  function $(id) { return d.getElementById(id); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function me() { return (window.V2UI && V2UI.ME) || ls('xcpets-v2-me') || ''; }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function left(blocks) { var m = blocks * 10, dd = Math.floor(m / 1440), h = Math.round((m % 1440) / 60); return dd ? dd + 'd ' + h + 'h' : h + 'h'; }
  function pick(list, n) { return list[Math.abs(n | 0) % list.length]; }
  var SAY = {
    hungry: ['bro they haven’t eaten in blocks', 'feed us or we NGMI', 'tummy rumbling louder than the mempool', 'stack sats, stack snacks'],
    fed: ['everyone’s fed. WAGMI.', 'full bellies, diamond paws', 'chef’s kiss. go touch grass.'],
    danger: ['this is not financial advice: FEED THEM', 'they’re one block from the cemetery', 'Coach Peepo is worried'],
    safe: ['nobody is starving. based.', 'zero pets in danger'],
    fight: ['sand, blood, glory', 'the Circus is calling', 'go get that W'],
    rest: ['all fought out for today', 'rest day. hydrate.']
  };
  /* check-in streak: one count per calendar day this browser opens Play. Kept per device, visits only. */
  function streak() {
    var today = new Date(); today.setHours(0, 0, 0, 0); var t = today.getTime(), s = null;
    try { s = JSON.parse(ls('xcpets-today-streak') || 'null'); } catch (e) { s = null; }
    if (!s || !s.last) s = { last: t, n: 1, best: 1 };
    else if (s.last !== t) { var gap = Math.round((t - s.last) / 864e5); s.n = gap === 1 ? s.n + 1 : 1; s.last = t; s.best = Math.max(s.best || 1, s.n); }
    ls('xcpets-today-streak', JSON.stringify(s)); return s;
  }
  var STREAK = streak();
  function css() {
    if ($('tdCss')) return; var s = d.createElement('style'); s.id = 'tdCss';
    s.textContent = 
      '#todayCard h2{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 8px}' +
      '#todayCard .td-day{font:12px "Press Start 2P",monospace;opacity:.75}' +
      '#todayCard .td-next{font-size:12px;opacity:.85;white-space:nowrap}' +
      '#todayCard .td-streak{margin-left:auto;font:11px/1.4 "Press Start 2P",monospace;padding:6px 10px;border:2px solid #2b2b2b;border-radius:8px;background:#ffe27a;color:#2b2b2b;box-shadow:0 3px 0 #2b2b2b;white-space:nowrap}' +
      '#todayCard .td-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}' +
      '@media (max-width:640px){#todayCard .td-grid{grid-template-columns:1fr}#todayCard .td-next{white-space:normal;font-size:10px;line-height:1.6}}' +
      '#todayCard .td-tile{display:flex;align-items:center;gap:12px;text-align:left;font:inherit;color:inherit;cursor:pointer;padding:12px;border-radius:10px;border:3px solid #2b2b2b;background:rgba(255,255,255,.06);box-shadow:0 4px 0 #2b2b2b;transition:transform .08s steps(2)}' +
      '#todayCard .td-tile:hover{transform:translateY(-2px)}#todayCard .td-tile:active{transform:translateY(2px);box-shadow:0 1px 0 #2b2b2b}' +
      '#todayCard .td-ico{font-size:30px;line-height:1;image-rendering:pixelated}' +
      '#todayCard .td-n{font:16px "Press Start 2P",monospace;display:block;margin-bottom:4px}' +
      '#todayCard .td-say{font-size:13px;opacity:.85}' +
      '#todayCard .td-hot{border-color:#ff5b5b;background:rgba(255,91,91,.12);animation:tdPulse 1.2s steps(2) infinite}' +
      '#todayCard .td-ok{opacity:.8}' +
      '@keyframes tdPulse{50%{box-shadow:0 4px 0 #2b2b2b,0 0 0 3px rgba(255,91,91,.45)}}' +
      '@media (prefers-reduced-motion:reduce){#todayCard .td-hot{animation:none}}' +
      '#todayCard .td-chores{display:block;width:100%;margin-top:10px;font:12px/1.5 "Press Start 2P",monospace;padding:12px;border:3px solid #2b2b2b;border-radius:10px;background:#ffe27a;color:#2b2b2b;box-shadow:0 4px 0 #2b2b2b;cursor:pointer}' +
      '#todayCard .td-chores:active{transform:translateY(2px);box-shadow:0 1px 0 #2b2b2b}' +
      '#todayCard .td-ready{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;width:100%;margin-top:10px;text-align:left;font:inherit;font-size:13px;color:inherit;cursor:pointer;padding:10px 12px;border:2px dashed #2b2b2b;border-radius:10px;background:rgba(255,255,255,.04)}' +
      '#todayCard .td-ready b{font:12px "Press Start 2P",monospace}#todayCard .td-ready .td-go{margin-left:auto;opacity:.8;white-space:nowrap}' +
      '#todayCard .td-next-btn{display:flex;align-items:center;gap:10px;width:100%;margin:4px 0 10px;padding:12px 14px;text-align:left;font:inherit;color:#2b2b2b;cursor:pointer;border:3px solid #2b2b2b;border-radius:12px;background:#ffe27a;box-shadow:0 4px 0 #2b2b2b;animation:tdGlow 1.4s steps(2) infinite}' +
      '#todayCard .td-next-btn b{display:block;font:20px/1.1 Bangers,Impact,sans-serif;letter-spacing:.5px}#todayCard .td-next-btn small{display:block;font-size:12px;opacity:.8}' +
      '#todayCard .td-next-btn .td-nx{font:9px "Press Start 2P",monospace;background:#2b2b2b;color:#ffe27a;padding:4px 6px;border-radius:6px}#todayCard .td-next-btn .td-ico{font-size:26px}#todayCard .td-next-btn .td-go{margin-left:auto;font-size:26px}' +
      '#todayCard .td-next-btn.td-calm{background:#d8f5d0;animation:none}#todayCard .td-next-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #2b2b2b}' +
      '@keyframes tdGlow{50%{box-shadow:0 4px 0 #2b2b2b,0 0 0 5px rgba(255,201,60,.55),0 0 18px rgba(255,201,60,.8)}}@media (prefers-reduced-motion:reduce){#todayCard .td-next-btn{animation:none}}' +
      '#todayCard .td-save{margin:4px 0 10px;padding:12px 14px;color:#2b2b2b;border:3px solid #2b2b2b;border-radius:12px;background:#ffe27a;box-shadow:0 4px 0 #2b2b2b;animation:tdGlow 1.4s steps(2) infinite}' +
      '#todayCard .td-save.td-calm{background:#fff3c4;animation:none}#todayCard .td-save .td-next-btn{margin:0;padding:0;border:0;box-shadow:none;background:none;animation:none}' +
      '#todayCard .td-why{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 0}#todayCard .td-why span{font-size:12px;background:rgba(43,43,43,.1);border:1px solid rgba(43,43,43,.3);border-radius:20px;padding:2px 8px}' +
      '#todayCard .td-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}' +
      '#todayCard .td-n4{display:inline-flex;border:2px solid #2b2b2b;border-radius:8px;overflow:hidden}#todayCard .td-n4 button{font:10px "Press Start 2P",monospace;border:0;border-right:2px solid #2b2b2b;padding:8px 10px;background:#fff6cf;color:#2b2b2b;cursor:pointer}' +
      '#todayCard .td-n4 button:last-child{border-right:0}#todayCard .td-n4 button[aria-pressed="true"]{background:#2b2b2b;color:#ffe27a}' +
      '#todayCard .td-feedn{font:19px Bangers,Impact,sans-serif;letter-spacing:.5px;border:3px solid #2b2b2b;border-radius:10px;padding:6px 14px;background:#5ee07d;color:#14301b;box-shadow:0 3px 0 #2b2b2b;cursor:pointer}' +
      '#todayCard .td-feedn:active{transform:translateY(2px);box-shadow:0 1px 0 #2b2b2b}' +
      '#todayCard .td-let{font:inherit;font-size:13px;line-height:1.3;border:2px dashed #2b2b2b;border-radius:10px;padding:7px 10px;background:transparent;color:#2b2b2b;cursor:pointer}' +
      '#todayCard .td-star{border-color:#ffc93c;background:rgba(255,201,60,.08)}#todayCard .td-chores i{display:block;font:12px/1.4 system-ui,sans-serif;font-style:normal;opacity:.8;margin-top:4px}' +
      '@media (max-width:640px){#todayCard .td-n4{width:100%}#todayCard .td-n4 button{flex:1 1 0}#todayCard .td-feedn,#todayCard .td-let{flex:1 1 100%}}' +
      'body.has-today #ipNba{display:none}';
    d.head.appendChild(s);
  }
  function card() {
    var c = $('todayCard'); if (c) return c;
    var main = d.querySelector('main'); if (!main) return null;
    css(); c = d.createElement('section'); c.id = 'todayCard'; c.className = 'panel'; c.setAttribute('aria-label', 'Today');
    if (!(window.XcpTopStrip && XcpTopStrip.mountMain(c, 10))) main.insertBefore(c, main.firstChild); /* first thing on Play once a wallet has pets (smooth: in the reserved top box, js/v2-header.js) */
    c.addEventListener('click', function (e) {
      var t = e.target.closest('[data-td]'); if (!t) return; var k = t.getAttribute('data-td');
      if (k === 'feed') { var fb = $('bFeedHungry'); if (fb) { fb.scrollIntoView({ block: 'center', behavior: 'smooth' }); fb.classList.add('ip-flash'); setTimeout(function () { fb.classList.remove('ip-flash'); }, 1600); } }
      else if (k === 'urgent') { var s = $('fSort'); if (s) { s.value = 'urgent'; s.dispatchEvent(new Event('change', { bubbles: true })); } var pp = $('petsPanel'); if (pp) pp.scrollIntoView({ behavior: 'smooth' }); }
      else if (k === 'fight') location.href = 'fight.html';
      else if (k === 'chores') { var db = $('dcBtn'); if (db && !db.disabled) db.click(); else if (db) db.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      else if (k === 'ready') location.href = 'breed.html#myCooldowns';
      else if (k === 'pets') { var p2 = $('petsPanel'); if (p2) p2.scrollIntoView({ behavior: 'smooth' }); }
      else if (k === 'dex' && window.V2Petdex) V2Petdex.open(); /* Petdex (Nov 23 2026, js/v2-petdex.js) */
      else if (k === 'loot' && window.V2Loot) V2Loot.open();
      else if (k === 'raid') location.href = 'raid.html';
      else if (k === 'saven') { ls(nKey(), t.getAttribute('data-n')); last = ''; paint(); }
      else if (k === 'savego') saveGo();
      else if (k === 'letgo') letGo(false);
      else if (k === 'grind') letGo(true);
    });
    return c;
  }
  function tile(k, ico, n, label, say, cls) {
    return '<button type="button" class="td-tile ' + (cls || '') + '" data-td="' + k + '"><span class="td-ico" aria-hidden="true">' + ico + '</span><span><span class="td-n">' + n + ' ' + label + '</span><span class="td-say">' + say + '</span></span></button>';
  }
  /* ready now: breed and quest timers for the wallet's pets (display only; read with the same helper as the Motel table) */
  function ready(w, L) {
    var Q = window.V2QuestClarity, R = window.V2Rules; if (!Q || !Q.timers || !R || !R.breedable) return '';
    var b = (w.tip || 0) + 1, quests = !!(w._full && R.questOn && R.questOn(b)), nB = 0, nQ = 0, nextB = Infinity, nextQ = Infinity;
    for (var i = 0; i < L.length; i++) {
      var t = null; try { t = Q.timers(w, L[i], b); } catch (e) { t = null; } if (!t) continue;
      if (t.breed === 0) nB++; else if (t.breed > 0 && t.breed < nextB) nextB = t.breed;
      if (quests) { if (t.quest === 0) nQ++; else if (t.quest > 0 && t.quest < nextQ) nextQ = t.quest; }
    }
    if (!nB && nextB === Infinity && !nQ && nextQ === Infinity) return '';
    var bits = ['<span>🥚 <b>' + fmt(nB) + '</b> can breed now' + (!nB && nextB < Infinity ? ' · next in ~' + left(nextB) : '') + '</span>'];
    if (quests && (nQ || nextQ < Infinity)) bits.push('<span>🗺️ <b>' + fmt(nQ) + '</b> can quest now' + (!nQ && nextQ < Infinity ? ' · next in ~' + left(nextQ) : '') + '</span>');
    return '<button type="button" class="td-ready" data-td="ready" title="Breed and quest timers for every pet: My cooldowns in the Motel">⏱️ ' + bits.join('') + '<span class="td-go">see every timer ›</span></button>';
  }
  /* NEXT (Nov 23 2026, "who does it best" #3: one glowing "next thing" button). Exactly one suggestion, in this order: pets about to die (the one
   * thing worth a burn, because it saves them), then the free daily loot steps, then the fun stuff. It never suggests spending for its own sake. */
  /* SAVE YOUR BEST (Nov 28 2026). SB = V2SaveBest.rank(...): the pets in danger a meal can still save, best first. */
  var SB = null, SBN = 0;
  function nKey() { return 'xcpets-today-saven-' + me(); }
  function wantN() { var v = ls(nKey()); return v === 'all' ? 'all' : (+v > 0 ? +v : 12); }
  var TAG = { fav: '☆ favourite', gear: '🎒 wears gear', legendary: '👑 Legendary', mythic: '🌕 Mythic', 'rare-species': '🦄 rare species', hybrid: '🧬 hybrid', grant: '🏆 one of a kind', deed: '📜 tokenized', event: '🎰 jackpot', 'legend-hatch': '✨ legend hatch', weird: '🌀 weird', mutant: '🌀 mutant', grown: '🌱 grown up', level: '⏫ one meal from next stage' };
  function plainIds() { if (!SB) return []; var V2 = window.V2UI, out = []; SB.risk.forEach(function (p) { var y = SB.why(p.id); if (!(y && y.score >= V2SaveBest.WORTH) && !(V2 && V2.isKept && V2.isKept(p.id))) out.push(p.id); }); return out; }
  function saveCard(soon) {
    var r = SB, risk = r.risk.length, can = r.ranked.length, wn = wantN(), n = wn === 'all' ? (r.worth || can) : V2SaveBest.pick(r, wn), plain = plainIds().length, t = r.tallyOf(n), chips = '', h;
    SBN = n;
    Object.keys(TAG).forEach(function (k) { if (t[k]) chips += '<span>' + TAG[k] + (n > 1 ? ' ×' + fmt(t[k]) : '') + '</span>'; });
    if (!r.worth) {
      h = '<div class="td-save td-calm"><span class="td-next-btn td-calm" style="cursor:default"><span class="td-nx">NEXT</span><span class="td-ico" aria-hidden="true">👋</span><span><b>Let ' + fmt(risk) + ' plain pet' + (risk === 1 ? '' : 's') + ' go</b><small>' +
        (risk === 1 ? 'it passes' : 'they pass') + ' on in ~' + left(soon) + '. None of them is special (no favourite, gear, Legendary or grown-up pet), so you don’t have to feed ' + (risk === 1 ? 'it' : 'them') + '.</small></span></span>';
    } else {
      h = '<div class="td-save"><span class="td-next-btn" style="cursor:default"><span class="td-nx">NEXT</span><span class="td-ico" aria-hidden="true">🚑</span><span><b>Save your ' + (n === 1 ? 'best pet' : fmt(n) + ' best pets') + ' · ' + fmt(r.cost(n)) + ' XCPETS</b><small>' +
        fmt(risk) + ' pet' + (risk === 1 ? '' : 's') + ' in danger, the first passes on in ~' + left(soon) + '. ' + (n === 1 ? 'This one is' : 'These ' + fmt(n) + ' are') + ' worth a meal:</small></span></span>' +
        (chips ? '<div class="td-why">' + chips + '</div>' : '');
    }
    var opts = [3, 12, 24].filter(function (x) { return x < (r.worth || can); });
    h += '<div class="td-acts">';
    if (r.worth) h += '<span class="td-n4" role="group" aria-label="How many to save">' + opts.map(function (x) { return '<button type="button" data-td="saven" data-n="' + x + '" aria-pressed="' + (n === x) + '">' + x + '</button>'; }).join('') +
      '<button type="button" data-td="saven" data-n="all" aria-pressed="' + (n === (r.worth || can)) + '">All ' + fmt(r.worth || can) + ' best</button></span>' +
      '<button type="button" class="td-feedn" data-td="savego" title="Opens the usual Feed selected sheet with these pets. You sign it in your wallet.">Feed ' + (n === 1 ? 'it' : 'these ' + fmt(n)) + ' ›</button>';
    if (plain) h += '<button type="button" class="td-let" data-td="letgo" title="Puts them in your Discard pile: free, Undo any time. Discarded pets are never counted or nagged about again.">👋 Let the ' + fmt(plain) + ' plain one' + (plain === 1 ? '' : 's') + ' go (free)</button>' +
      (window.V2Grinder ? '<button type="button" class="td-let" data-td="grind" title="Discard them, then the Meat Grinder turns discarded pets into spins and Sausage Eggs.">🥩 Grind them for spins</button>' : '');
    if (!r.worth && can) h += '<button type="button" class="td-let" data-td="urgent">or pick some to feed ›</button>';
    return h + '</div></div>';
  }
  function feedFn() { return (window.V2UI && V2UI.feedIds) || (window.__demo && __demo.feedIds) || null; } /* Feed selected's own path (v2.js feedAsync, list burns) */
  function saveGo() { var f = feedFn(); if (!SB || !f) return; var ids = SB.ranked.slice(0, SBN).map(function (p) { return p.id; }); if (ids.length) f('Save your ' + (ids.length === 1 ? 'best pet' : ids.length + ' best pets'), ids); }
  function letGo(grind) { var dz = (window.V2UI && V2UI.discardIds) || (window.__demo && __demo.discardIds), ids = plainIds(); if (!dz || !ids.length) return; dz(ids); /* the one Discard path (v2.js discardIds: starred pets and zombies skipped, Undo, then the permanent pet:hd burn is offered) */ last = ''; setTimeout(paint, 50);
    if (grind && window.V2Grinder) setTimeout(function () { try { V2Grinder.open(); } catch (e) { } }, 400); }
  function nextBtn(w, L, danger, soon, fight, LT) {
    var n = null, R = window.V2Loot;
    if (danger.length && soon <= 288 && SB) return saveCard(soon);
    if (danger.length && soon <= 288) n = ['urgent', '🚑', 'Check ' + fmt(danger.length) + ' pet' + (danger.length === 1 ? '' : 's') + ' in danger', 'first one dies in ~' + left(soon)];
    else if (R && LT && R.ready(LT) && !LT.opened) n = ['loot', '🎁', 'Open today’s loot chest', 'you earned it'];
    else if (window.V2Petdex && LT && !LT.t.dex) n = ['dex', '📖', 'Check your Petdex', 'see what you’re missing'];
    else if (LT && !LT.t.place) n = fight ? ['fight', '⚔️', 'Visit X Circus Kekimus', fmt(fight) + ' pet' + (fight === 1 ? '' : 's') + ' can fight today'] : ['raid', '👹', 'Check on the Raid Boss', 'see who is hitting it'];
    else if (danger.length && (!SB || SB.worth)) n = ['urgent', '🪦', SB ? 'Save your best pets in danger' : 'Check ' + fmt(danger.length) + ' pet' + (danger.length === 1 ? '' : 's') + ' in danger', SB ? fmt(SB.worth) + ' worth a meal, first one dies in ~' + left(soon) : 'first one dies in ~' + left(soon)];
    else n = ['pets', '😎', 'All done today. WAGMI.', 'go touch grass, your pets are fine'];
    return '<button type="button" class="td-next-btn' + (n[0] === 'pets' ? ' td-calm' : '') + '" data-td="' + n[0] + '"><span class="td-nx">NEXT</span><span class="td-ico" aria-hidden="true">' + n[1] + '</span><span><b>' + n[2] + '</b><small>' + n[3] + '</small></span><span class="td-go">›</span></button>';
  }
  var last = '';
  function paint() {
    var w = null; try { w = window.V2Mock && V2Mock.world && V2Mock.world(); } catch (e) { w = null; }
    var m = me(), c = $('todayCard');
    if (!w || !w.pets || !m) { if (c) c.hidden = true; d.body.classList.remove('has-today'); return; }
    var dcb = $('dcBtn'), LT = window.V2Loot ? V2Loot.state() : null, key = m + '|' + w.tip + '|' + w.pets.length + '|' + (w._full ? 1 : 0) + '|' + (dcb && !dcb.disabled ? 1 : 0) + '|' + (LT ? JSON.stringify(LT.t) + LT.opened : ''); if (key === last && c && !c.hidden) return; last = key;
    var day = Math.floor((w.tip || 0) / BPD), L = w.pets.filter(function (p) { return V2Own.isLiving(p, m); });
    if (!L.length) { if (c) c.hidden = true; d.body.classList.remove('has-today'); return; }
    c = card(); if (!c) return; c.hidden = false; d.body.classList.add('has-today');
    var feedAll = 0, hungry = L.filter(function (p) { if (p.nextMeal && V2Own.canEat(p, m)) { feedAll += p.nextMeal; return true; } return false; }).length; /* Nov 25 2026: discarded pets and zombies can't be fed, so they aren't "hungry" here */
    /* Nov 28 2026: discarded pets are never "in danger" (V2Own.riskList), and the nudge names the few worth saving (V2SaveBest) */
    SB = window.V2SaveBest ? V2SaveBest.rank(w, m, { kept: window.V2UI && V2UI.isKept }) : null;
    var danger = SB ? SB.risk : V2Own.riskList(w, m);
    var gone = 0, dzo = { set: V2Own.pileIds(m), pend: null }; L.forEach(function (p) { if (V2Own.starving(p, m, w.tip) && V2Own.discarded(p, m, dzo)) gone++; }); /* shown so the drop from the old count makes sense */
    var soon = danger.length ? Math.min.apply(null, danger.map(function (p) { return p.deathBlock - w.tip; })) : 0;
    var fight = L.filter(function (p) { return p.stage >= 2 && !p.neglected && !(p.fightDays && p.fightDays[day]); }).length;
    var partial = w._pages && !w._full;
    var nextIn = BPD - ((w.tip || 0) % BPD); /* players asked almost daily when the next feed day starts (Telegram review, Nov 22 2026) */
    c.innerHTML = '<h2 class="sec" data-ico="flame">Today <span class="td-day">game day ' + fmt(day) + (partial ? ' · still loading your pets' : '') + '</span>' +
      '<span class="td-next" title="A new game day starts every 144 blocks. Pets fed today can eat again then.">🍽️ new feed day in ~' + left(nextIn) + ' (' + nextIn + ' block' + (nextIn === 1 ? '' : 's') + ')</span>' +
      '<span class="td-streak" title="Days in a row you opened XCPETS on this device. Best: ' + STREAK.best + '">🔥 ' + STREAK.n + '-day streak</span></h2>' +
      nextBtn(w, L, danger, soon, fight, LT) +
      '<div class="td-grid">' +
      (danger.length && SB ? tile('urgent', '⭐', fmt(SB.worth), 'worth saving', SB.worth ? 'favourites, gear, Legendary, weird, grown-up and about-to-level pets' : 'the pets in danger are all plain ones', SB.worth ? 'td-star' : 'td-ok')
        : hungry ? tile('feed', '🍖', fmt(hungry), 'hungry', pick(SAY.hungry, day), '') : tile('pets', '🍖', '0', 'hungry', pick(SAY.fed, day), 'td-ok')) +
      (danger.length ? tile('urgent', '🪦', fmt(danger.length), 'in danger', 'first one dies in ~' + left(soon) + ' · ' + (gone ? 'your ' + fmt(gone) + ' discarded pets aren’t counted' : pick(SAY.danger, day)), SB && !SB.worth ? '' : 'td-hot') : tile('pets', '🪦', '0', 'in danger', pick(SAY.safe, day), 'td-ok')) +
      (fight ? tile('fight', '⚔️', fmt(fight), 'can fight', pick(SAY.fight, day), '') : tile('pets', '⚔️', '0', 'can fight', pick(SAY.rest, day), 'td-ok')) +
      '</div>' + ready(w, L) + (window.V2Loot ? V2Loot.html() : '') + (window.V2Petdex ? V2Petdex.todayHtml() : '') +
      /* one burn for the whole routine: the existing Daily chores (pet:dc, live since block 974,163); the wallet still signs it */
      /* Nov 28 2026: the price is on the button before anyone taps it (Jake's 1,608 hungry pets were about 832,000 XCPETS) */
      (hungry && $('dcBtn') && !$('dcBtn').disabled ? '<button type="button" class="td-chores" data-td="chores">🧹 Do it all in one burn: feed everyone, WAGMI, use your spins<i>' + fmt(hungry) + ' pet' + (hungry === 1 ? '' : 's') + ' · about ' + fmt(Math.round(feedAll)) + ' XCPETS' + (SB && SB.worth && hungry > 2 * SB.worth ? ' · most of them are plain pets: saving your best costs less' : '') + '</i></button>' : '');
  }
  /* smooth (Nov 26 2026): the card used to wait for the 2 s timer, so it landed ~2.3 s after opening Play and pushed the page down. Until the
   * page has a world it checks every 150 ms (just a null check) and paints the moment one is there, then every 2 s as before. */
  function hasWorld() { try { var w0 = window.V2Mock && V2Mock.world && V2Mock.world(); return !!(w0 && w0.pets); } catch (e) { return false; } }
  function go() { paint(); var n = 0; (function soon() { if (hasWorld() || n++ > 100) return; setTimeout(function () { paint(); soon(); }, 150); })(); setInterval(paint, 2000); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
  window.V2Today = { paint: paint };
})();
