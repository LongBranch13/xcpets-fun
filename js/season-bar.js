/* XCPETS Seasons bar (DISPLAY ONLY). Reads data/seasons.json and the chain tip, and shows a countdown bar under the nav:
 * "Season N starts in X blocks" during the teaser (seasons.json "tease" blocks before the start) and "ends in X blocks" while it runs.
 * Nothing here touches rules, replay, wallets or burns. "announce": false in seasons.json shows nothing to players.
 * Preview: ?season=1 shows the teaser as if announced, ?season=live pretends Season 1 is running. The x hides it for this browser tab. */
(function () {
  'use strict';
  if (window.__seasonBar) return; window.__seasonBar = 1;
  var me = document.currentScript, ver = (me && /[?&]v=([\w.-]+)/.exec(me.src) || [])[1] || '';
  var pv = (/[?&]season=(1|live)\b/.exec(location.search) || [])[1] || null, HIDE = 'xcpets-season-hide', el = null, cfg = null, metaTip = null, metaAt = 0;
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function about(blocks) { var m = blocks * 10; if (m < 90) return m + ' min'; var h = Math.round(m / 60); if (h < 48) return h + ' h'; var d = Math.floor(h / 24), r = h % 24; return d + 'd' + (r ? ' ' + r + 'h' : ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function v2Tip() { try { var M = window.V2Mock, s = M && M.state && M.state(); return s && s.tip ? s.tip : null; } catch (e) { return null; } }
  function loadMeta() { if (Date.now() - metaAt < 120000) return; metaAt = Date.now();
    fetch('api/meta.json?cb=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.blockHeight > 0) { metaTip = j.blockHeight; tick(); } }).catch(function () { }); }
  function tip() { var t = v2Tip(); if (t) return t; loadMeta(); return metaTip; }
  /* which season to show at tip t: the running one, else the next one inside its teaser window */
  function pick(t) { var L = cfg.length || 4032, T = cfg.tease || 1008, S = cfg.seasons || [];
    for (var i = 0; i < S.length; i++) { var s = S[i]; if (t >= s.start && t < s.start + L) return { s: s, live: true, left: s.start + L - t }; }
    for (i = 0; i < S.length; i++) { s = S[i]; if (t < s.start && t >= s.start - T) return { s: s, live: false, left: s.start - t }; }
    return null; }
  function hidden(k) { try { return sessionStorage.getItem(HIDE) === k; } catch (e) { return false; } }
  function css() { if (document.getElementById('seasonBarCss')) return; var st = document.createElement('style'); st.id = 'seasonBarCss';
    st.textContent = '.sbar{position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;margin:6px auto;max-width:980px;padding:8px 36px 8px 12px;' +
      'background:#0e1a3a;color:#fff;border:3px solid #000;box-shadow:4px 4px 0 #000;border-radius:6px;font-family:"Comic Neue","Comic Sans MS",cursive;font-size:14px;text-align:center}' +
      '.sbar[data-theme=kekmas]{background:linear-gradient(180deg,#123a6b,#0b1f3f)}.sbar[data-theme=rug]{background:linear-gradient(180deg,#6b1239,#3f0b24)}' +
      '.sbar[data-theme=laser]{background:linear-gradient(180deg,#5a0a0a,#250404)}.sbar[data-theme=spam]{background:linear-gradient(180deg,#2c4c8c,#132a57)}' +
      '.sbar-t{font-family:"Press Start 2P",monospace;font-size:10px;line-height:1.5;color:#ffe14d;text-shadow:2px 2px 0 #000;letter-spacing:0}' +
      '.sbar-n{font-family:"Bangers","Impact",sans-serif;font-size:20px;letter-spacing:1px;text-shadow:2px 2px 0 #000}' +
      '.sbar-c{font-family:"Press Start 2P",monospace;font-size:10px;background:#000;color:#7CFC00;padding:5px 7px;border-radius:3px}' +
      '.sbar-c.hot{color:#ff3b3b;animation:sbarBlink 1s steps(2) infinite}@keyframes sbarBlink{50%{opacity:.35}}' +
      '.sbar-i{flex-basis:100%;font-size:13px}.sbar-buy{margin-left:6px;font-family:"Press Start 2P",monospace;font-size:9px;padding:6px 8px;background:#ffe14d;color:#000;border:2px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer}' +
      '.sbar-x{position:absolute;top:4px;right:6px;background:none;border:0;color:#fff;font-size:18px;cursor:pointer;line-height:1}' +
      '.sbar-snow{position:absolute;inset:0;pointer-events:none}.sbar-snow i{position:absolute;top:-6px;width:3px;height:3px;background:#fff;opacity:.8;animation:sbarFall 6s linear infinite}' +
      '@keyframes sbarFall{to{transform:translateY(90px)}}@media (prefers-reduced-motion:reduce){.sbar-snow,.sbar-c.hot{animation:none}.sbar-snow i{display:none}}';
    document.head.appendChild(st); }
  function snow() { var h = ''; for (var i = 0; i < 18; i++) h += '<i style="left:' + ((i * 53) % 100) + '%;animation-delay:-' + ((i * 7) % 60) / 10 + 's"></i>'; return '<div class="sbar-snow" aria-hidden="true">' + h + '</div>'; }
  function render(P) { var key = P ? P.s.id + (P.live ? ':L' : ':T') : '';
    if (!P || hidden(key)) { if (el) { el.remove(); el = null; } return; }
    if (!el || el.dataset.key !== key) { css(); if (!el) { el = document.createElement('div'); el.id = 'seasonBar'; el.setAttribute('role', 'status');
        var nav = document.querySelector('nav, .nav, header'); if (window.XcpTopStrip && XcpTopStrip.mount(el)) { } /* smooth load: the reserved strip */ else if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling); else document.body.insertBefore(el, document.body.firstChild);
        el.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.sbar-x')) return; try { sessionStorage.setItem(HIDE, el.dataset.key); } catch (er) { } el.remove(); el = null; }); }
      var s = P.s; el.className = 'sbar'; el.dataset.key = key; el.dataset.theme = s.id;
      el.innerHTML = (s.id === 'kekmas' ? snow() : '') + '<span class="sbar-t">' + (P.live ? 'SEASON ' + s.n + ' IS LIVE' : 'SEASON ' + s.n + ' INCOMING') + '</span>' +
        '<span class="sbar-n">' + esc(s.emoji || '') + ' ' + esc(s.name) + '</span>' +
        '<span>' + esc(P.live ? 'Limited ' + s.egg + 's are out. Finale boss: ' + s.boss + '.' : s.tagline + ' Limited ' + s.egg + 's drop at block ' + fmt(s.start) + '.') + '</span>' +
        '<span class="sbar-c" id="sbarLeft"></span><button type="button" class="sbar-x" aria-label="Hide the season bar">&times;</button>'; }
    var info = document.getElementById('sbarInfo'), RI = rulesInfo(P);
    if (P.live && RI && RI.season) { if (!info) { info = document.createElement('span'); info.id = 'sbarInfo'; info.className = 'sbar-i'; el.insertBefore(info, el.querySelector('.sbar-x')); }
      var m = RI.me, h = '<b>' + fmt(RI.eggsLeft) + '</b> of ' + fmt(RI.supply) + ' eggs left' + (m ? ' · You: <b>' + fmt(m.pts) + '</b> pts' + (m.tierName ? ' (' + esc(m.tierName) + ')' : '') + (m.next ? ', next tier at ' + fmt(m.next) : '') + ' · today ' + m.today + '/' + RI.dayCap : '');
      if (m && RI.eggsLeft > 0 && m && RI.mineBought < RI.walletCap) h += ' <button type="button" class="sbar-buy" id="sbarBuy">Hatch a ' + esc(P.s.egg) + '</button>';
      if (info.dataset.h !== h) { info.dataset.h = h; info.innerHTML = h; } } else if (info) info.remove();
    var c = document.getElementById('sbarLeft'); if (c) { c.textContent = (P.live ? 'Ends in ' : 'Starts in ') + fmt(P.left) + ' block' + (P.left === 1 ? '' : 's') + ' (~' + about(P.left) + ')'; c.className = 'sbar-c' + (P.left <= 12 ? ' hot' : ''); } }
  /* rules side (only once js/v2-rules.js has a season gate set): supply, my points, buy button. Burns go through the normal confirm flow; the site never signs. */
  function rulesInfo(P) { try { var V = window.V2Rules, M = window.V2Mock; if (!V || !V.seasonInfo || !V.seasonsGate || V.seasonsGate() == null || !M || !M.world) return null;
      var w = M.world(), t = v2Tip(); if (!w || !t) return null; var me = (M.ME) || (window.V2UI && V2UI.ME) || null, I = V.seasonInfo(w, t + 1, me); return I && I.season && I.season.n === P.s.n ? I : null; } catch (e) { return null; } }
  function buy() { try { var V = window.V2Rules, M = window.V2Mock; if (!V || !V.seasonPlan || !window.V2UI || !V2UI.confirmPlans) return; var w = M.world(), t = v2Tip(); V2UI.confirmPlans('Season egg', [V.seasonPlan(w, t + 1, 1)]); } catch (e) { } }
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'sbarBuy') buy(); });
  function tick() { if (!cfg) return; if (!cfg.announce && !pv) return render(null); var t = tip();
    if (pv === 'live' && cfg.seasons && cfg.seasons[0]) t = cfg.seasons[0].start + 500; else if (pv === '1' && cfg.seasons && cfg.seasons[0] && (t == null || pick(t) == null)) t = cfg.seasons[0].start - 700;
    if (t == null) return; try { render(pick(t)); } catch (e) { } }
  function start() { fetch('data/seasons.json?v=' + ver, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (!j) return; cfg = j; tick(); setInterval(tick, 15000); }).catch(function () { }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
