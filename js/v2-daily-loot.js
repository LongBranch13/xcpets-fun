/* XCPETS DAILY LOOT (Nov 23 2026, owner "who does it best" list, item 3: "three daily chores with a chest at the end", Clash Royale / Duolingo).
 * DISPLAY ONLY and HEALTHY: the three ticks are visits and free actions, never money spent; nothing here asks for a burn, nothing is signed.
 *   👋 Check in          open Play today
 *   🗺️ Visit a place     open the Circus, the Motel, the Raid or the Rare Room
 *   📖 Open your Petdex  (js/v2-petdex.js fires 'xcpets:petdex-open')
 * All three = the chest unlocks: it shakes, bursts, and gives today's meme card (one of the curated HatchBot memes, hb-memes/manifest.json,
 * the same card for everyone on a calendar day) with a Share button. A chest streak counts days in a row the chest was opened.
 * Kept per browser in localStorage 'xcpets-loot' (calendar day, local time). Shown inside the Today card on Play (js/v2-today.js asks html()). */
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
    '@media (prefers-reduced-motion:reduce){.dl-chest.ready,#dlOv .dl-big,#dlOv .dl-card{animation:none}}';
    d.head.appendChild(s); }
  /** html(): the strip for the Today card. */
  function html() { css(); var s = state(), r = ready(s);
    return '<div class="dl" id="dlStrip"><span class="dl-h">DAILY LOOT</span>' + TICKS.map(function (k) { return '<span class="dl-t' + (s.t[k[0]] ? ' on' : '') + '">' + (s.t[k[0]] ? '✓' : k[1]) + ' ' + k[2] + '</span>'; }).join('') +
      '<button type="button" class="dl-chest' + (s.opened ? ' got' : r ? ' ready' : '') + '" data-loot="open">' + (s.opened ? '✅ Opened' + (s.streak > 1 ? ' · 🔥' + s.streak : '') : r ? '🎁 OPEN CHEST' : '🔒 ' + done(s) + '/3') + '</button></div>'; }
  function repaint() { var el = $('dlStrip'); if (el) el.outerHTML = html(); }
  function getMemes(cb) { if (memes) return cb(memes); fetch('hb-memes/manifest.json', { cache: 'force-cache' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (j) { memes = Array.isArray(j) ? j : []; cb(memes); }, function () { cb([]); }); }
  function openChest() { var s = state(); if (!ready(s)) { var miss = TICKS.filter(function (k) { return !s.t[k[0]]; }).map(function (k) { return k[2].toLowerCase(); }); if (root.V2UI && V2UI.toast) V2UI.toast('Chest locked: ' + miss.join(', ') + ' first.'); else alert('Chest locked: ' + miss.join(', ') + ' first.'); return; }
    var first = !s.opened; if (first) s = fire('open'); var day = s.day;
    getMemes(function (L) { var m = memeFor(L, day); css(); var ov = d.createElement('div'); ov.id = 'dlOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Daily loot chest');
      ov.innerHTML = '<div class="dl-title">' + (first ? 'MEME OF THE DAY!' : 'TODAY’S MEME') + '</div><div class="dl-big" aria-hidden="true">🎁</div>' +
        '<div class="dl-card">' + (m ? '<img alt="' + esc(m.caption) + '" src="hb-memes/' + encodeURIComponent(m.file) + '"><div class="dl-cap">' + esc(m.caption) + '</div>' : '<div class="dl-cap">gm. WAGMI.</div>') +
        '<div class="dl-sub"><b>Just for laughs:</b> the words on the card are part of the meme, not a prize. Nothing was added to your wallet. Chest streak: <b>' + s.streak + '</b> day' + (s.streak === 1 ? '' : 's') + ' (best ' + s.best + '). A new chest unlocks tomorrow.</div>' +
        '<div class="dl-row"><button type="button" data-dl="share">📤 Share</button><button type="button" data-dl="close">Close</button></div></div>';
      d.body.appendChild(ov); var S2 = root.V2Sfx, reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (S2 && S2.knock) { [0, 300, 600, 900].forEach(function (t) { setTimeout(function () { S2.knock(); }, t); }); setTimeout(function () { S2.crack(); S2.reveal(3); }, 1100); }
      setTimeout(function () { ov.classList.add('open'); }, reduced || !first ? 0 : 1300);
      ov.addEventListener('click', function (e) { var b = e.target.closest('[data-dl]'); if (b && b.getAttribute('data-dl') === 'share') { e.stopPropagation(); return share(m, b); } if (!e.target.closest('.dl-card') || b) ov.remove(); }); }); }
  function share(m, b) { var t = '🐸 Today’s XCPETS meme: ' + (m ? m.caption : 'gm') + '\nxcpets.fun' + (m ? '/hb-memes/' + encodeURIComponent(m.file) : '');
    try { if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { navigator.share({ text: t }).catch(function () { }); return; } } catch (e) { }
    try { navigator.clipboard.writeText(t).then(function () { b.textContent = '✅ Copied'; }); } catch (e) { } }
  function start() { if (!d) return; var go = function () { var page = d.body && d.body.getAttribute('data-split'); if (/practice/.test(location.pathname)) return;
      if (page === 'play') fire('in'); else if (PLACES[page]) fire('place'); };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
    root.addEventListener('xcpets:petdex-open', function () { fire('dex'); });
    d.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-loot="open"]'); if (b) { e.preventDefault(); e.stopPropagation(); openChest(); } }, true); }
  return { step: step, ready: ready, done: done, memeFor: memeFor, dayNo: dayNo, html: html, state: state, open: openChest, start: start, fire: fire };
});
