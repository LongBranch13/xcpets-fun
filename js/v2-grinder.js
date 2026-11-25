/* 🥩 THE MEAT GRINDER screen (owner Nov 23 2026: "Yes, build it as shown"). UI only: the rule is pet:grind in js/v2-rules.js
 * (ACTIVATE_GRIND_BLOCK). The button lives in ⚙️ More → Care on My Pets (owner: new My Pets controls go in More) and shows once the
 * Grinder is open (?grinder=preview shows it before, read-only, for screenshots). The sheet shows the machine with the player's own
 * discarded pets in the hopper, the meat meter, what one grind would give (V2Rules.grindPreview), and one GRIND button that opens the
 * usual sign sheet (V2UI.confirmPlans). The game never signs. When a grind of this wallet confirms, a SPLORCH card shows what came out
 * (once per grind, remembered in localStorage). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NF = new Intl.NumberFormat('en-US');
  function fmt(n) { return NF.format(Number(n) || 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var PREVIEW = /[?&]grinder=preview/.test(location.search);
  function D() { return window.__demo; } function V() { return window.V2Rules || {}; } function U() { return window.V2UI || {}; }
  function me() { return window.V2Mock && V2Mock.ME; }
  function tipB(w) { return ((w && w.tip) || 0) + 1; }
  function open_(w) { var v = V(); return !!(v.grindOn && v.grindOn(tipB(w))); }
  function viewOnly() { return !!(U().viewOnly && U().viewOnly()); }
  function net() { return (window.LiveEngine && LiveEngine.CFG && LiveEngine.CFG.network) || 'mainnet'; }

  function css() { if ($('mgrCss')) return; var s = document.createElement('style'); s.id = 'mgrCss';
    s.textContent = '.mgr-bg{position:fixed;inset:0;z-index:10050;background:rgba(5,4,12,.86);display:flex;align-items:center;justify-content:center;padding:12px}' +
      '.mgr{position:relative;width:100%;max-width:440px;max-height:94vh;overflow:auto;background:#0e1610;color:#f3ecd8;border:3px solid #000;box-shadow:0 0 0 3px #ff6b6b,7px 7px 0 #000;padding:14px;font-family:"Comic Neue","Comic Sans MS",sans-serif}' +
      '.mgr h3{margin:0;font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:42px;line-height:.95;letter-spacing:2px;color:#ff6b6b;text-shadow:3px 3px 0 #000}.mgr .mgr-sub{margin:4px 0 10px;font-size:15px}' +
      '.mgr-meatchip{position:absolute;top:14px;right:14px;font:9px "Press Start 2P",monospace;color:#ffd166;border:2px solid #000;background:#2a2210;padding:6px 8px}' +
      '.mgr-mach{position:relative;height:280px;background:#16221a;border:3px solid #000;box-shadow:0 0 0 3px #3ddc84,5px 5px 0 #000;overflow:hidden;margin:6px 0 12px}' +
      '.mgr-hop{position:absolute;left:50%;top:12px;width:220px;margin-left:-130px;height:104px;background:#5b6470;border:3px solid #000;clip-path:polygon(0 0,100% 0,72% 100%,28% 100%)}' +
      '.mgr-pets{position:absolute;left:50%;top:18px;width:200px;margin-left:-120px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px}' +
      '.mgr-pets canvas{width:40px;height:40px;image-rendering:pixelated;border:2px solid #000;background:#0f0d1e;animation:mgBob 2.4s ease-in-out infinite}.mgr-pets canvas:nth-child(2n){animation-delay:.6s}.mgr-pets canvas:nth-child(3n){animation-delay:1.2s}' +
      '@keyframes mgBob{0%,100%{transform:translateY(-5px) rotate(-8deg)}50%{transform:translateY(4px) rotate(8deg)}}' +
      '.mgr-body{position:absolute;left:50%;top:116px;width:160px;margin-left:-90px;height:100px;background:#8a2f2f;border:3px solid #000;box-shadow:inset -10px -10px 0 #6a2020,inset 8px 8px 0 #b44a4a;text-align:center}' +
      '.mgr-body b{display:block;margin-top:16px;font:10px/1.6 "Press Start 2P",monospace;color:#ffd166;text-shadow:2px 2px 0 #000}.mgr-body i{display:block;margin:8px auto 0;width:104px;height:16px;background:repeating-linear-gradient(90deg,#ddd 0 8px,#000 8px 12px);border:2px solid #000}' +
      '.mgr-crank{position:absolute;left:50%;top:132px;margin-left:72px;animation:mgSpin 1.2s linear infinite}@keyframes mgSpin{to{transform:rotate(360deg)}}.mgr.go .mgr-crank{animation-duration:.25s}' +
      '.mgr-chute{position:absolute;left:24px;top:220px;width:84px;height:20px;background:#5b6470;border:3px solid #000}' +
      '.mgr-saus{position:absolute;left:16px;top:248px;display:flex;gap:6px;animation:mgOut 1.6s ease-out infinite}.mgr-saus span{width:44px;height:18px;border-radius:10px;background:#e86a7d;border:3px solid #000;box-shadow:inset -5px -4px 0 #b84a5b}' +
      '@keyframes mgOut{0%{transform:translateX(-20px);opacity:0}30%{opacity:1}100%{transform:translateX(40px);opacity:0}}' +
      '.mgr-spl{position:absolute;right:10px;bottom:10px;font-family:Bangers,Impact,sans-serif;font-size:22px;color:#ffd166;text-shadow:2px 2px 0 #000;transform:rotate(-6deg)}' +
      '.mgr.go .mgr-mach{animation:mgShake .12s linear infinite}@keyframes mgShake{50%{transform:translate(2px,-2px)}}' +
      '.mgr-lbl{display:flex;justify-content:space-between;font:9px "Press Start 2P",monospace;color:#9be08a;margin-top:4px}' +
      '.mgr-bar{position:relative;height:22px;background:#0d140f;border:3px solid #000;margin:4px 0}.mgr-bar>div{height:100%;background:repeating-linear-gradient(135deg,#e86a7d 0 10px,#c9566a 10px 20px)}' +
      '.mgr-bar span{position:absolute;top:-3px;bottom:-3px;width:3px;background:#000}.mgr-small{font-size:13px;line-height:1.35}' +
      '.mgr-box{background:#16221a;border:2px solid #2c4a26;padding:8px 10px;font-size:14px;line-height:1.45;margin:8px 0}' +
      '.mgr-go{display:block;width:100%;margin-top:6px;font-family:Bangers,Impact,sans-serif;font-size:30px;letter-spacing:2px;color:#fff;background:#ff4d4d;border:3px solid #000;box-shadow:4px 4px 0 #000;padding:10px;min-height:56px;text-shadow:2px 2px 0 #000;cursor:pointer}' +
      '.mgr-go:disabled{opacity:.45;cursor:not-allowed}.mgr-no{display:block;width:100%;margin-top:8px;font:700 15px "Comic Neue",sans-serif;color:#f3ecd8;background:#243328;border:3px solid #000;box-shadow:3px 3px 0 #000;padding:8px;min-height:44px;cursor:pointer}' +
      '.mgr-big{text-align:center;font-family:Bangers,Impact,sans-serif;font-size:72px;line-height:1;color:#ffd166;text-shadow:4px 4px 0 #000;transform:rotate(-4deg);margin:14px 0 4px;animation:mgPop .5s cubic-bezier(.2,1.8,.4,1)}@keyframes mgPop{from{transform:scale(.3) rotate(-12deg)}}' +
      '.mgr-rw{display:flex;align-items:center;gap:12px;background:#16221a;border:3px solid #000;padding:10px;margin:8px 0}.mgr-rw.sp{box-shadow:0 0 0 2px #3ddc84}.mgr-rw.egg{box-shadow:0 0 0 2px #ffd166}.mgr-rw.gold{box-shadow:0 0 0 3px #ffd166;background:#2a2210}' +
      '.mgr-rw b{display:block;font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:26px}.mgr-rw.sp b{color:#9be08a}.mgr-rw.egg b{color:#ffd166}.mgr-rw.miss{opacity:.8}.mgr-rw.miss b{font-size:20px}' +
      '.mgr-rw canvas{width:48px;height:48px;image-rendering:pixelated;border:2px solid #000;background:#0f0d1e}' +
      '#mgOpen{white-space:nowrap}' +
      '@media (prefers-reduced-motion:reduce){.mgr-pets canvas,.mgr-crank,.mgr-saus,.mgr-big,.mgr.go .mgr-mach{animation:none!important}}' +
      '@media (max-width:420px){.mgr h3{font-size:34px}.mgr-mach{height:262px}.mgr-saus{top:232px}.mgr-chute{top:208px}}';
    document.head.appendChild(s); }
  function crank() { return '<svg class="mgr-crank" aria-hidden="true" width="56" height="56" viewBox="0 0 60 60"><rect x="26" y="4" width="8" height="52" fill="#c9c9c9" stroke="#000" stroke-width="3"/><rect x="4" y="26" width="52" height="8" fill="#c9c9c9" stroke="#000" stroke-width="3"/><circle cx="30" cy="30" r="9" fill="#ffd166" stroke="#000" stroke-width="3"/></svg>'; }
  function sprite(c, p, w) { try { if (window.V2Render && V2Render.lazy && V2Render.petFrames) V2Render.lazy(c, function () { return V2Render.petFrames(p, w); }, true); } catch (e) { } }
  /* browser-only discards: pets hidden in this browser that are not discarded on chain yet (the Grinder only takes on-chain discards) */
  function browserOnly(w) { var hid = (U().hiddenIds && U().hiddenIds()) || [], a = me(), n = 0; hid.forEach(function (id) { var p = w.byId[id]; if (p && p.owner === a && !p.dead && !p.released && p.hd !== a) n++; }); return n; }

  var bg = null;
  function close() { if (bg) bg.remove(); bg = null; document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function shell() { css(); close(); bg = document.createElement('div'); bg.className = 'mgr-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-labelledby', 'mgT');
    bg.innerHTML = '<div class="mgr"></div>'; document.body.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) close(); }; document.addEventListener('keydown', onKey); return bg.querySelector('.mgr'); }
  function open() { var d = D(), v = V(); if (!d || !d.world || !v.grindPreview) return; var w = d.world(), a = me(), box = shell(), b = tipB(w), on = open_(w);
    var R = (w.grind && a && w.grind[a]) || { meat: 0 }, meat = R.meat || 0, G = v.GRIND || { SPIN_EVERY: 250, EGG_EVERY: 1000, COST: 69, MEAT: [1, 2, 5, 20] };
    var pv = on && a ? v.grindPreview(w, a, b) : { ok: false, n: 0, meat: 0, byTier: [0, 0, 0, 0], ids: [], why: on ? 'Connect your wallet to use the Grinder.' : 'The Meat Grinder opens soon.' };
    var nextEgg = (Math.floor(meat / G.EGG_EVERY) + 1) * G.EGG_EVERY, pct = Math.round((meat % G.EGG_EVERY) / G.EGG_EVERY * 100), bo = a ? browserOnly(w) : 0;
    var hop = (pv.ids || []).slice(0, 6).map(function (id) { return w.byId[id]; }).filter(Boolean);
    var cost = v.grindPlan && on && a && pv.ok ? v.grindPlan(w, a, b).amount : G.COST;
    var T = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    box.innerHTML = '<span class="mgr-meatchip">MEAT ' + fmt(meat) + '</span><h3 id="mgT">THE MEAT<br>GRINDER</h3><p class="mgr-sub">Your junk goes in. Spins and eggs come out.</p>' +
      '<div class="mgr-mach" aria-hidden="true"><div class="mgr-hop"></div><div class="mgr-pets">' + hop.map(function (p) { return '<canvas width="32" height="32" data-mg="' + p.id + '"></canvas>'; }).join('') + '</div>' +
      '<div class="mgr-body"><b>GRIND-O-MATIC<br>9000</b><i></i></div>' + crank() + '<div class="mgr-chute"></div><div class="mgr-saus"><span></span><span></span></div><div class="mgr-spl">SPLORCH</div></div>' +
      '<div class="mgr-lbl"><span>NEXT SAUSAGE EGG</span><span>' + fmt(meat) + ' / ' + fmt(nextEgg) + '</span></div>' +
      '<div class="mgr-bar"><div style="width:' + pct + '%"></div><span style="left:25%"></span><span style="left:50%"></span><span style="left:75%"></span></div>' +
      '<div class="mgr-small">Every ' + fmt(G.SPIN_EVERY) + ' meat: a free Pepe Wheel spin. Every ' + fmt(G.EGG_EVERY) + ': a Sausage Egg (never Common).</div>' +
      '<div class="mgr-box">' + (pv.ok ? '<b>Ready to grind: ' + fmt(pv.n) + ' pet' + (pv.n === 1 ? '' : 's') + '</b><br>' + pv.byTier.map(function (c, i) { return c ? fmt(c) + ' ' + T[i] + ' (' + G.MEAT[i] + ' each)' : ''; }).filter(Boolean).join(' · ') + ' = <b style="color:#ffd166">' + fmt(pv.meat) + ' meat</b>' +
        '<br>You get: ' + (pv.spins ? '<b>' + pv.spins + ' spin' + (pv.spins === 1 ? '' : 's') + '</b>' : 'no spin yet') + (pv.eggs ? ' + <b>' + pv.eggs + ' Sausage Egg' + (pv.eggs === 1 ? '' : 's') + '</b>' : '') + ' + a ' + (Math.round(pv.goldPct * 10) / 10) + '% shot at a Golden Sausage (a sure Legendary)' : esc(pv.why || 'Nothing to grind.')) + '</div>' +
      (bo ? '<div class="mgr-box">🗑️ ' + fmt(bo) + ' more pet' + (bo === 1 ? ' is' : 's are') + ' only hidden in this browser. Only permanent discards go in the Grinder. <button type="button" class="q" id="mgPerm">Make them permanent</button></div>' : '') +
      '<button type="button" class="mgr-go"' + (pv.ok && !viewOnly() && !PREVIEW ? '' : ' disabled') + '>GRIND ' + fmt(pv.n || 0) + ' PET' + (pv.n === 1 ? '' : 'S') + '</button>' +
      '<p class="mgr-small" style="margin:8px 0 0;opacity:.85">One burn, ' + fmt(cost) + ' XCPETS' + (pv.n > (G.MAX || 2000) ? '' : '') + ', up to ' + fmt(G.MAX || 2000) + ' pets. Ground pets are gone for good. Gods, Mythics, Wizards and tokenized pets never go in.' + (viewOnly() ? ' View only: nothing can be ground from here.' : '') + '</p>' +
      '<button type="button" class="mgr-no">Not now</button>';
    box.querySelectorAll('[data-mg]').forEach(function (c) { var p = w.byId[c.getAttribute('data-mg')]; if (p) sprite(c, p, w); });
    box.querySelector('.mgr-no').onclick = close;
    var pm = box.querySelector('#mgPerm'); if (pm) pm.onclick = function () { close(); var m = $('hdMigrate'); if (m) m.click(); else if (U().toast) U().toast('Open the 🗑️ Discard pile at the bottom of My Pets and press "Make my browser discards permanent".'); };
    box.querySelector('.mgr-go').onclick = function () { if (!pv.ok || viewOnly() || PREVIEW) return; var plan = v.grindPlan(w, a, tipB(w)); if (!plan || !plan.ok) return;
      var cp = d.confirmPlans || U().confirmPlans; if (!cp) return;
      /* Nov 24 2026 (one safety check for every pet button): the Grinder takes every pet discarded on chain, so special ones (Legendary,
       * starred, fed in the last 2 days) get the same sheet as a sacrifice; to keep one, add it back from the Discard pile first. */
      if (window.V2SacGuard && !open._sg) { var gx = (plan.ids || []).slice(); return V2SacGuard.check({ w: w, ids: gx, me: a, verb: 'grind them', all: true,
        allNote: 'The Grinder takes every pet you discarded on chain. To keep one, cancel and use "Add discarded pets back" in the Discard pile first.',
        onGo: function () { open._sg = true; try { box.querySelector('.mgr-go').onclick(); } finally { open._sg = false; } } }); }
      box.classList.add('go');
      setTimeout(function () { close(); cp('🥩 Meat Grinder: ' + fmt(plan.n) + ' pet' + (plan.n === 1 ? '' : 's') + ' → ' + fmt(plan.meat) + ' meat', [{ tag: plan.tag, amount: plan.amount, label: plan.label }], function () { if (U().toast) U().toast('🥩 Into the Grinder! Your spins and eggs show up when the burn confirms.', 8000); }); }, 500); }; }

  /* the result card, once per confirmed grind of this wallet */
  function seenKey() { return 'xcpets-grind-seen-' + net() + '-' + (me() || ''); }
  function result(w, last) { var box = shell(), v = V(), G = v.GRIND || { EGG_EVERY: 1000 }, a = me(), R = w.grind[a], pets = (last.newPets || []).map(function (id) { return w.byId[id]; }).filter(Boolean);
    var T = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    box.innerHTML = '<div class="mgr-big">SPLORCH!</div><p style="text-align:center;font-size:17px;font-weight:700;margin:4px 0 8px">' + fmt(last.n) + ' pets ground into <span style="color:#ff6b6b">' + fmt(last.meat) + ' meat</span></p>' +
      (last.spins ? '<div class="mgr-rw sp"><svg aria-hidden="true" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="#ffd166" stroke="#000" stroke-width="3"/><path d="M22 3v38M3 22h38M8 8l28 28M36 8L8 36" stroke="#000" stroke-width="2"/><circle cx="22" cy="22" r="5" fill="#ff4d4d" stroke="#000" stroke-width="2"/></svg><div><b>+' + last.spins + ' PEPE WHEEL SPIN' + (last.spins === 1 ? '' : 'S') + '</b><span class="mgr-small">Saved for the Pepe Wheel in The Rare Room.</span></div></div>' : '') +
      pets.map(function (p) { return '<div class="mgr-rw ' + (p.golden ? 'gold' : 'egg') + '"><canvas width="32" height="32" data-mg="' + p.id + '"></canvas><div><b>' + (p.golden ? 'GOLDEN SAUSAGE!' : 'SAUSAGE EGG') + '</b><span class="mgr-small">#' + p.id + ' hatched: ' + T[Math.min(3, p.tier | 0)] + ' ' + esc(p.name || p.species) + '</span></div></div>'; }).join('') +
      (!last.golden ? '<div class="mgr-rw miss"><svg aria-hidden="true" width="44" height="44" viewBox="0 0 44 44"><ellipse cx="22" cy="24" rx="15" ry="18" fill="#c9a43a" stroke="#000" stroke-width="3"/></svg><div><b>GOLDEN SAUSAGE: NOT THIS TIME</b><span class="mgr-small">Grind more at once for a better shot (up to 10%).</span></div></div>' : '') +
      '<p class="mgr-small" style="text-align:center">Meat now ' + fmt(R.meat) + ' · next Sausage Egg at ' + fmt((Math.floor(R.meat / G.EGG_EVERY) + 1) * G.EGG_EVERY) + '</p>' +
      (pets.length ? '<button type="button" class="mgr-go" id="mgSee" style="background:#3ddc84;color:#06210f;text-shadow:none">SEE MY NEW PET' + (pets.length > 1 ? 'S' : '') + '</button>' : '') + '<button type="button" class="mgr-no">Nice</button>';
    box.querySelectorAll('[data-mg]').forEach(function (c) { var p = w.byId[c.getAttribute('data-mg')]; if (p) sprite(c, p, w); });
    box.querySelector('.mgr-no').onclick = close; var see = box.querySelector('#mgSee'); if (see) see.onclick = function () { close(); location.href = 'pet.html?id=' + pets[0].id; };
    try { if (window.V2Sfx && V2Sfx.play) V2Sfx.play('win'); } catch (e) { } }
  function watch(w) { var a = me(); if (!a || !w || !w.grind || !w.grind[a] || !w.grind[a].last || viewOnly()) return; var last = w.grind[a].last, k = String(last.block) + ':' + last.n, seen = null;
    try { seen = localStorage.getItem(seenKey()); } catch (e) { }
    if (seen === k) return; try { localStorage.setItem(seenKey(), k); } catch (e) { }
    if (seen == null && w.tip - last.block > 144) return; /* a new browser: don't replay old grinds */ if (!bg) result(w, last); }

  function place() { var d = D(); if (!d || !d.world) return; var w; try { w = d.world(); } catch (e) { return; } if (!w || !w.pets) return;
    var show = open_(w) || PREVIEW, b = $('mgOpen');
    if (!show) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'q'; b.id = 'mgOpen'; b.onclick = open; }
    var a = me(), R = (w.grind && a && w.grind[a]) || null; b.textContent = '🥩 Meat Grinder' + (R && R.meat ? ' (' + fmt(R.meat) + ' meat)' : ''); b.title = 'Grind your discarded pets into spins and Sausage Eggs';
    var care = $('mpcCare'), anc = $('bulkAnchor'), cp = $('cpOpen');
    if (care) { if (b.parentNode !== care) care.insertBefore(b, cp && cp.parentNode === care ? cp.nextSibling : ($('mpcNext') && $('mpcNext').parentNode === care ? $('mpcNext') : null)); }
    else if (anc && anc.parentNode && b.parentNode !== anc.parentNode) anc.parentNode.insertBefore(b, anc.nextSibling);
    try { watch(w); } catch (e) { } }
  function init() { if (!$('bulkAnchor') && !$('petsPanel')) return; place(); setInterval(place, 4000); }
  window.V2Grinder = { open: open, place: place, result: result };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
