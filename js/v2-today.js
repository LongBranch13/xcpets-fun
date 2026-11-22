/* TODAY card (Nov 22 2026, owner: "fix all these things", plan upgrade 1). Display only: no burns, no rule changes, nothing signed.
 * On play.html, at the top of the page: what needs you today, in one look, in the game's meme voice.
 *   🍖 hungry pets      -> jumps to the existing "Feed hungry" button (the wallet still signs that burn)
 *   🪦 pets in danger   -> sorts My Pets by most urgent
 *   ⚔️ pets that can fight today -> X Circus Kekimus
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
      '#todayCard .td-streak{margin-left:auto;font:11px/1.4 "Press Start 2P",monospace;padding:6px 10px;border:2px solid #2b2b2b;border-radius:8px;background:#ffe27a;color:#2b2b2b;box-shadow:0 3px 0 #2b2b2b;white-space:nowrap}' +
      '#todayCard .td-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}' +
      '@media (max-width:640px){#todayCard .td-grid{grid-template-columns:1fr}}' +
      '#todayCard .td-tile{display:flex;align-items:center;gap:12px;text-align:left;font:inherit;color:inherit;cursor:pointer;padding:12px;border-radius:10px;border:3px solid #2b2b2b;background:rgba(255,255,255,.06);box-shadow:0 4px 0 #2b2b2b;transition:transform .08s steps(2)}' +
      '#todayCard .td-tile:hover{transform:translateY(-2px)}#todayCard .td-tile:active{transform:translateY(2px);box-shadow:0 1px 0 #2b2b2b}' +
      '#todayCard .td-ico{font-size:30px;line-height:1;image-rendering:pixelated}' +
      '#todayCard .td-n{font:16px "Press Start 2P",monospace;display:block;margin-bottom:4px}' +
      '#todayCard .td-say{font-size:13px;opacity:.85}' +
      '#todayCard .td-hot{border-color:#ff5b5b;background:rgba(255,91,91,.12);animation:tdPulse 1.2s steps(2) infinite}' +
      '#todayCard .td-ok{opacity:.8}' +
      '@keyframes tdPulse{50%{box-shadow:0 4px 0 #2b2b2b,0 0 0 3px rgba(255,91,91,.45)}}' +
      '@media (prefers-reduced-motion:reduce){#todayCard .td-hot{animation:none}}' +
      'body.has-today #ipNba{display:none}';
    d.head.appendChild(s);
  }
  function card() {
    var c = $('todayCard'); if (c) return c;
    var main = d.querySelector('main'); if (!main) return null;
    css(); c = d.createElement('section'); c.id = 'todayCard'; c.className = 'panel'; c.setAttribute('aria-label', 'Today');
    main.insertBefore(c, main.firstChild); /* first thing on Play once a wallet has pets */
    c.addEventListener('click', function (e) {
      var t = e.target.closest('[data-td]'); if (!t) return; var k = t.getAttribute('data-td');
      if (k === 'feed') { var fb = $('bFeedHungry'); if (fb) { fb.scrollIntoView({ block: 'center', behavior: 'smooth' }); fb.classList.add('ip-flash'); setTimeout(function () { fb.classList.remove('ip-flash'); }, 1600); } }
      else if (k === 'urgent') { var s = $('fSort'); if (s) { s.value = 'urgent'; s.dispatchEvent(new Event('change', { bubbles: true })); } var pp = $('petsPanel'); if (pp) pp.scrollIntoView({ behavior: 'smooth' }); }
      else if (k === 'fight') location.href = 'fight.html';
      else if (k === 'pets') { var p2 = $('petsPanel'); if (p2) p2.scrollIntoView({ behavior: 'smooth' }); }
    });
    return c;
  }
  function tile(k, ico, n, label, say, cls) {
    return '<button type="button" class="td-tile ' + (cls || '') + '" data-td="' + k + '"><span class="td-ico" aria-hidden="true">' + ico + '</span><span><span class="td-n">' + n + ' ' + label + '</span><span class="td-say">' + say + '</span></span></button>';
  }
  var last = '';
  function paint() {
    var w = null; try { w = window.V2Mock && V2Mock.world && V2Mock.world(); } catch (e) { w = null; }
    var m = me(), c = $('todayCard');
    if (!w || !w.pets || !m) { if (c) c.hidden = true; d.body.classList.remove('has-today'); return; }
    var key = m + '|' + w.tip + '|' + w.pets.length + '|' + (w._full ? 1 : 0); if (key === last && c && !c.hidden) return; last = key;
    var day = Math.floor((w.tip || 0) / BPD), L = w.pets.filter(function (p) { return p.owner === m && !p.dead && !p.released && !p.community; });
    if (!L.length) { if (c) c.hidden = true; d.body.classList.remove('has-today'); return; }
    c = card(); if (!c) return; c.hidden = false; d.body.classList.add('has-today');
    var hungry = L.filter(function (p) { return p.hungry && p.nextMeal; }).length;
    var danger = L.filter(function (p) { return p.neglected && !p.mythicCare && p.deathBlock != null && p.deathBlock > w.tip; });
    var soon = danger.length ? Math.min.apply(null, danger.map(function (p) { return p.deathBlock - w.tip; })) : 0;
    var fight = L.filter(function (p) { return p.stage >= 2 && !p.neglected && !(p.fightDays && p.fightDays[day]); }).length;
    var partial = w._pages && !w._full;
    c.innerHTML = '<h2 class="sec" data-ico="flame">Today <span class="td-day">game day ' + fmt(day) + (partial ? ' · still loading your pets' : '') + '</span>' +
      '<span class="td-streak" title="Days in a row you opened XCPETS on this device. Best: ' + STREAK.best + '">🔥 ' + STREAK.n + '-day streak</span></h2>' +
      '<div class="td-grid">' +
      (hungry ? tile('feed', '🍖', fmt(hungry), 'hungry', pick(SAY.hungry, day), '') : tile('pets', '🍖', '0', 'hungry', pick(SAY.fed, day), 'td-ok')) +
      (danger.length ? tile('urgent', '🪦', fmt(danger.length), 'in danger', 'first one dies in ~' + left(soon) + ' · ' + pick(SAY.danger, day), 'td-hot') : tile('pets', '🪦', '0', 'in danger', pick(SAY.safe, day), 'td-ok')) +
      (fight ? tile('fight', '⚔️', fmt(fight), 'can fight', pick(SAY.fight, day), '') : tile('pets', '⚔️', '0', 'can fight', pick(SAY.rest, day), 'td-ok')) +
      '</div>';
  }
  function go() { paint(); setInterval(paint, 2000); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
  window.V2Today = { paint: paint };
})();
