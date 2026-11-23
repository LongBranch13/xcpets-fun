/* XCPETS sacrifice guard (Nov 23 2026, UI only: no rule, tag or replay change).
 * A player once fed a Juvenile God to a seance by accident ("I accidentally included him in a sacrifice"). Before any pet is fed to a zombie,
 * pledged to a Resurrection or offered at an altar, this sheet stops and names the special ones in the pick: Gods, Mythics, Legendaries,
 * Bitcoin Wizards, starred pets and pets fed in the last 2 chain days. The easy button leaves them out; keeping them in takes a tick first.
 * V2SacGuard.check({ w, ids, me, verb, onGo(ids) }): calls onGo at once when nothing is special, else shows the sheet.
 * V2SacGuard.flags(w, p, me): the reasons for one pet ([] = ordinary). */
(function () {
  'use strict';
  var FED_RECENT = 288; /* 2 chain days of 144 blocks */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function net() { return (window.LiveEngine && LiveEngine.CFG && LiveEngine.CFG.network) || 'mainnet'; }
  function kept(me, id) { try { if (window.V2UI && V2UI.isKept) return !!V2UI.isKept(id); var v = JSON.parse(localStorage.getItem('xcpets-keep-' + net() + '-' + me) || '[]'); return Array.isArray(v) && v.map(Number).indexOf(+id) >= 0; } catch (e) { return false; } }
  function ago(n) { return n < 6 ? 'just now' : n < 144 ? 'about ' + Math.max(1, Math.round(n / 6)) + ' hour' + (Math.round(n / 6) > 1 ? 's' : '') + ' ago' : 'yesterday'; }
  function flags(w, p, me) { var f = []; if (!p) return f; var tip = (w && w.tip) || 0;
    if (p.resurrected || p.mythicGod) f.push({ k: 'god', t: '😇 GOD' });
    if (p.stage >= 5 || p.mythicCare || p.ascended) f.push({ k: 'mythic', t: '🌕 MYTHIC' });
    else if ((p.tier | 0) >= 3) f.push({ k: 'leg', t: '👑 LEGENDARY' });
    if (p.species === 'wizard') f.push({ k: 'wiz', t: '🧙 WIZARD' });
    if (kept(me, p.id)) f.push({ k: 'star', t: '⭐ STARRED' });
    if (p.lastFed != null && tip - p.lastFed >= 0 && tip - p.lastFed < FED_RECENT) f.push({ k: 'fed', t: '🍖 FED ' + ago(tip - p.lastFed).toUpperCase() });
    return f; }
  function css() { if (document.getElementById('sgCss')) return; var s = document.createElement('style'); s.id = 'sgCss';
    s.textContent = '.sg-bg{position:fixed;inset:0;z-index:9600;background:rgba(5,4,12,.82);display:flex;align-items:center;justify-content:center;padding:12px}' +
      '.sg{width:100%;max-width:520px;max-height:90vh;overflow:auto;background:#1c1830;color:#f3ecd8;border:3px solid #000;box-shadow:0 0 0 3px #ff4d4d,6px 6px 0 #000;padding:14px;font-family:"Comic Neue","Comic Sans MS",sans-serif}' +
      '.sg h3{margin:0 0 6px;font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:28px;letter-spacing:.04em;color:#ff6b6b;text-shadow:2px 2px 0 #000;line-height:1.05}' +
      '.sg p{margin:6px 0;font-size:15px;line-height:1.4}.sg-l{list-style:none;padding:0;margin:8px 0;display:grid;gap:6px}' +
      '.sg-l li{display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center;background:#2f2a4a;border:3px solid #000;padding:5px}' +
      '.sg-l canvas{width:44px;height:44px;image-rendering:pixelated;background:#0f0d1e}.sg-n{font-weight:700;overflow-wrap:anywhere}.sg-n .muted{font-weight:400;opacity:.7}' +
      '.sg-l i{font:normal 8px/1.3 "Press Start 2P",monospace;display:inline-block;border:2px solid #000;padding:2px 4px;margin:3px 4px 0 0;background:#ffc93c;color:#221400}' +
      '.sg-l i.god{background:#fff3b0}.sg-l i.mythic{background:#b07cff;color:#14052a}.sg-l i.wiz{background:#6ac8ff;color:#041826}.sg-l i.star{background:#ffe066}.sg-l i.fed{background:#7dff6a;color:#0b1a08}' +
      '.sg-b{display:flex;flex-direction:column;gap:8px;margin-top:10px}.sg-b button{font:700 16px "Comic Neue","Comic Sans MS",sans-serif;border:3px solid #000;box-shadow:3px 3px 0 #000;padding:10px 12px;cursor:pointer}' +
      '.sg-ok{background:#3ddc84;color:#06210f}.sg-no{background:#2f2a4a;color:#f3ecd8}.sg-yes{background:#ff4d4d;color:#fff}.sg-yes:disabled{opacity:.4;cursor:not-allowed}' +
      '.sg-tick{display:flex;gap:8px;align-items:center;font-size:14px;margin-top:4px}.sg-tick input{width:20px;height:20px}';
    document.head.appendChild(s); }
  function sprite(c, p, w) { try { if (window.V2Render && V2Render.lazy && V2Render.petFrames) V2Render.lazy(c, function () { return V2Render.petFrames(p, w); }, true); } catch (e) { } }
  function check(o) { var w = o.w, me = o.me, ids = (o.ids || []).map(Number), bad = [], ok = [];
    ids.forEach(function (id) { var p = w && w.byId ? w.byId[id] : null, f = flags(w, p, me); if (f.length) bad.push({ p: p, f: f }); else ok.push(id); });
    if (!bad.length) return o.onGo(ids);
    css(); var bg = document.createElement('div'); bg.className = 'sg-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-labelledby', 'sgT');
    var n = bad.length, verb = o.verb || 'sacrifice';
    bg.innerHTML = '<div class="sg"><h3 id="sgT">⚠ Wait! ' + (n === 1 ? 'A special pet is' : n + ' special pets are') + ' in this pick</h3>' +
      '<p>You\'re about to ' + esc(verb) + '. Once the burn confirms, every pet in it is <b>gone for good</b>. Check ' + (n === 1 ? 'this one' : 'these') + ':</p>' +
      '<ul class="sg-l">' + bad.map(function (x) { var p = x.p; return '<li><canvas width="32" height="32" data-sgp="' + p.id + '" aria-hidden="true"></canvas><div><div class="sg-n">' + esc(p.name || '#' + p.id) + ' <span class="muted">#' + p.id + '</span></div>' + x.f.map(function (f) { return '<i class="' + f.k + '">' + esc(f.t) + '</i>'; }).join('') + '</div></li>'; }).join('') + '</ul>' +
      '<div class="sg-b">' + (ok.length ? '<button type="button" class="sg-ok" data-sg="ok">✅ Leave ' + (n === 1 ? 'it' : 'them') + ' out · go on with ' + ok.length + ' pet' + (ok.length === 1 ? '' : 's') + '</button>' : '') +
      '<button type="button" class="sg-no" data-sg="no">' + (ok.length ? 'Cancel' : '✅ Cancel, keep ' + (n === 1 ? 'it' : 'them')) + '</button>' +
      '<label class="sg-tick"><input type="checkbox" id="sgSure"> I\'m sure. ' + (n === 1 ? 'This pet goes' : 'These ' + n + ' pets go') + ' too.</label>' +
      '<button type="button" class="sg-yes" data-sg="all" disabled>🔥 ' + (ok.length ? 'Include ' + (n === 1 ? 'it' : 'them') + ' too · ' + ids.length + ' pets in all' : 'Yes, go on with ' + (n === 1 ? 'it' : 'them')) + '</button></div></div>';
    document.body.appendChild(bg);
    bg.querySelectorAll('[data-sgp]').forEach(function (c) { var p = w.byId[+c.getAttribute('data-sgp')]; if (p) sprite(c, p, w); });
    var sure = bg.querySelector('#sgSure'), yes = bg.querySelector('[data-sg=all]'); sure.onchange = function () { yes.disabled = !sure.checked; };
    function done() { bg.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); done(); if (o.onCancel) o.onCancel(); } }
    document.addEventListener('keydown', key, true);
    bg.addEventListener('click', function (e) { var b = e.target.closest('[data-sg]'); if (!b && e.target !== bg) return; var k = b ? b.getAttribute('data-sg') : 'no';
      if (k === 'all' && !sure.checked) return; done();
      if (k === 'ok') o.onGo(ok); else if (k === 'all') o.onGo(ids); else if (o.onCancel) o.onCancel(); });
    var f = bg.querySelector('.sg-ok') || bg.querySelector('.sg-no'); try { f.focus(); } catch (e) { } }
  window.V2SacGuard = { check: check, flags: flags, FED_RECENT: FED_RECENT };
})();
