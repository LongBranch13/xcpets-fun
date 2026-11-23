/* PLACE BAR (places round two, Nov 23 2026; DISPLAY ONLY, no burns, no rule changes).
 * One "what now" bar right under each place scene (Circus, Motel, Raid), the same layout everywhere: what you do here in one line, your own
 * numbers for this place as chips, and one big button for the main action. The button only scrolls to (or opens) the control the page already
 * has: the Challenge card (#faceoff), the Gene Pool Matchmaker, the raid attack box. With no wallet the bar says how to start instead of zeros.
 * js/v2.js calls V2PlaceBar.render(w) after each render. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function go(sel) { var e = document.querySelector(sel); if (e && e.scrollIntoView) e.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }
  function css() { if (document.getElementById('pbCss')) return; var s = document.createElement('style'); s.id = 'pbCss'; s.textContent =
    '.pbar{background:#1b1430;border:3px solid #000;border-radius:10px;box-shadow:4px 4px 0 #000;padding:10px 12px;margin:0 0 12px;color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center}' +
    '.pbar .pb-what{font-family:"Comic Neue",cursive;font-size:16px;line-height:1.35;grid-column:1/-1}' +
    '.pbar .pb-chips{display:flex;flex-wrap:wrap;gap:6px;min-width:0}' +
    '.pbar .pb-chip{font-family:"Press Start 2P",monospace;font-size:9px;line-height:1.4;padding:5px 7px;border-radius:6px;background:#2a2050;border:2px solid #000;color:#cfc6e8;white-space:nowrap}.pbar .pb-chip b{color:#ffd24a;font-weight:400}' +
    '.pbar .pb-go{font-family:"Press Start 2P",monospace;font-size:10px;background:#3ddc84;color:#06210f;border:3px solid #000;border-radius:8px;box-shadow:3px 3px 0 #000;padding:10px 12px;cursor:pointer;min-height:44px;white-space:nowrap}' +
    '.pbar .pb-go:focus-visible{outline:3px solid #fff;outline-offset:2px}.pbar .pb-go:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000}' +
    '@media (max-width:420px){.pbar{grid-template-columns:minmax(0,1fr)}.pbar .pb-go{justify-self:stretch}}';
    document.head.appendChild(s); }
  function mount(after, id) { var a = document.querySelector(after); if (!a || !a.parentNode) return null; var el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; el.className = 'pbar'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'What to do here'); }
    if (el.previousElementSibling !== a && !(id === 'pbBreed' && el.previousElementSibling && el.previousElementSibling.id === 'mmSheet')) a.parentNode.insertBefore(el, a.nextSibling); return el; }
  function paint(el, o) { var h = '<div class="pb-what">' + o.what + '</div><div class="pb-chips">' + (o.chips || []).map(function (c) { return '<span class="pb-chip">' + c + '</span>'; }).join('') + '</div>' +
      (o.btn ? '<button type="button" class="pb-go">' + esc(o.btn) + '</button>' : '');
    if (el._h !== h) { el.innerHTML = h; el._h = h; } var b = el.querySelector('.pb-go'); if (b) b.onclick = o.on; }
  function mineLive(w, ME) { var U = window.V2UI; return (U && U.mine ? U.mine(w) : w.pets.filter(function (p) { return p.owner === ME; })).filter(function (p) { return !p.dead && !p.released; }); }
  function fight(w, ME, b) { var V = window.V2Rules, el = mount('#arStage', 'pbFight'); if (!el) return;
    if (!ME) return paint(el, { what: 'Burn to fight another keeper’s pet. The winner takes the pot. <b>Connect a wallet</b> to pick a fighter, or type an address below to look around.', chips: [] });
    var mine = mineLive(w, ME), ready = 0, won = 0, lost = 0, open = 0, mineIds = {}; mine.forEach(function (p) { mineIds[p.id] = 1; if (V.fightable && !V.fightable(p, b)) ready++; });
    (w.fights || []).forEach(function (f) { if (f.status === 'done') { var W = f.winners || (f.winner != null ? [f.winner] : []), L = f.losers || (f.loser != null ? [f.loser] : []);
        W.forEach(function (id) { if (mineIds[id]) won++; }); L.forEach(function (id) { if (mineIds[id]) lost++; }); }
      else if (f.status === 'open' && !mineIds[f.a] && (V.FIGHT_WINDOW == null || b - 1 - f.block <= V.FIGHT_WINDOW)) open++; });
    paint(el, { what: 'Burn to fight another keeper’s pet. The winner takes the pot.', chips: ['<b>' + fmt(ready) + '</b> ready', 'record <b>' + fmt(won) + '-' + fmt(lost) + '</b>', '<b>' + fmt(open) + '</b> open challenge' + (open === 1 ? '' : 's')],
      btn: ready ? 'PICK A FIGHT' : null, on: function () { go('#faceoff'); } }); }
  function breed(w, ME, b) { var el = mount('#motelScene', 'pbBreed'); if (!el) return;
    if (!ME) return paint(el, { what: 'Two adult pets check in, one egg checks out. <b>Connect a wallet</b> and Gooby finds your best pairs.', chips: [] });
    var st = window.V2Motel && V2Motel._state ? V2Motel._state() : {}, lounge = (st.lounge || []).length, r = window.V2Matchmaker ? V2Matchmaker.suggest(w, ME, b - 1) : { n: 0, picks: [] };
    paint(el, { what: 'Two adult pets check in, one egg checks out. Tap the pool for Gooby’s best pairs.', chips: ['<b>' + fmt(r.n) + '</b> ready to breed', '<b>' + fmt(lounge) + '</b> on cooldown'],
      btn: r.picks.length ? 'MATCHMAKER' : null, on: function () { if (window.V2Matchmaker) V2Matchmaker.open(w); } }); }
  function raid(w, ME, b) { var V = window.V2Rules, el = mount('#raidScene', 'pbRaid'); if (!el || !V.raidInfo) return; var I = V.raidInfo(w, b), R = I.raid;
    var what = 'Everyone hits the same boss. If it falls in time, every attacker gets loot.';
    if (!R || !R.live) return paint(el, { what: what, chips: [I.nextOpen ? 'next raid at block <b>' + fmt(I.nextOpen) + '</b>' : 'no raid open'], btn: 'HOW RAIDS WORK', on: function () { go('#raidBox'); } });
    var my = 0; if (ME) (R.board || []).forEach(function (x) { if (x.owner === ME) my += x.dmg || 0; });
    paint(el, { what: what, chips: [esc(R.boss && R.boss.name || 'Boss') + ' <b>' + Math.ceil(R.left / R.hp * 100) + '%</b>', '<b>' + fmt(Math.max(0, R.end - b + 1)) + '</b> blocks left'].concat(ME ? ['you: <b>' + fmt(my) + '</b> dmg'] : []),
      btn: ME ? 'ATTACK' : 'HOW RAIDS WORK', on: function () { go('#raidBox'); } }); }
  function render(w) { if (!w || !window.V2Rules) return; var sp = document.body && document.body.getAttribute('data-split'), U = window.V2UI, ME = U && U.ME, tip = (U && U.S && U.S().tip) || w.tip || 0, b = tip + 1; css();
    try { if (sp === 'fight') fight(w, ME, b); else if (sp === 'breed') breed(w, ME, b); else if (sp === 'raid') raid(w, ME, b); } catch (e) { if (window.console) console.warn('placebar', e); } }
  window.V2PlaceBar = { render: render };
})();
