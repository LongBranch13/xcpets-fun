/* UX polish (2026-10-16, owner approved items 1-12; UI only, no rules or burn parsing). Loaded last on every page. */
(function () {
  'use strict';
  var d = document, page = (location.pathname.split('/').pop() || 'index.html').replace(/\?.*$/, '') || 'index.html', phone = function () { return innerWidth <= 600; };
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var isMobile = function () { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || (matchMedia && matchMedia('(pointer:coarse)').matches && phone()); };
  function toast(html, ms) { var t = d.getElementById('toasts'); if (!t) { t = d.createElement('div'); t.id = 'toasts'; d.body.appendChild(t); } var x = d.createElement('div'); x.className = 'toast uxp-toast'; x.setAttribute('role', 'status'); x.innerHTML = html; t.appendChild(x); setTimeout(function () { x.remove(); }, ms || 12000); }
  // 4. How to start card (Home + Play), dismissible
  /* first-time-path (Nov 1 2026, owner-approved critique plan item 3): "Start here", 3 steps for a wallet with no pets yet (was "How to start").
   * Hidden once the connected wallet owns a living pet (#nAlive > 0 on Play) or when dismissed (same key as before). Links only: it never signs. */
  function startCard(anchor, before) { if (!anchor || ls.get('xcpets-uxp-start') === 'x') return; var c = d.createElement('section'); c.className = 'panel uxp-card uxp-start'; c.id = 'uxpStart'; c.setAttribute('aria-label', 'Start here');
    var onPlay = page === 'play.html', feedHref = onPlay ? '#petsPanel' : 'play.html#petsPanel', hatchHref = onPlay ? '#hatchPanel' : 'play.html#hatchPanel';
    c.innerHTML = '<b>👋 Start here</b><ol class="uxp-steps">' +
      '<li><b>Get a wallet.</b> ' + (window.casaTookan || window.webXCP || window.web3xcp ? 'You are in Casa Tookan: tap <b>Connect Casa Tookan</b> at the top and pick your Legacy (1…) address.' : 'On desktop: the <a href="https://chromewebstore.google.com/search/XCP%20Wallet" target="_blank" rel="noopener">XCP Wallet</a> Chrome extension. On your phone: the <b>Casa Tookan</b> app (open xcpets.fun inside it).') + ' Put some XCPETS (from <a href="https://xcp.fun" target="_blank" rel="noopener">xcp.fun</a>) and a little BTC for fees in it.</li>' +
      '<li><b>Hatch one egg</b> for <b><span data-cost="69" data-ck="hatch">17.25</span> XCPETS</b> plus the Bitcoin network fee. <a class="btn uxp-go" href="' + hatchHref + '">🥚 Hatch</a></li>' +
      '<li><b>Feed it once a day</b> with one button: <b>Feed all hungry</b> on My Pets feeds every hungry pet you own. A pet unfed for 7 days dies. <a class="q uxp-go" href="' + feedHref + '">🍽️ Feed all</a></li></ol>' +
      '<p class="small muted" style="margin:6px 0 0">Before every burn you see the amount, the tag and the fee, and nothing is sent until you approve it in your wallet.</p>' +
      '<button type="button" class="q uxp-x" aria-label="Hide Start here">✕</button>';
    c.querySelector('.uxp-x').onclick = function () { ls.set('xcpets-uxp-start', 'x'); c.remove(); };
    if (onPlay) c.querySelectorAll('.uxp-go').forEach(function (a) { a.addEventListener('click', function () { setTimeout(function () { var b = d.getElementById(/feed/i.test(a.textContent) ? 'bFeedHungry' : 'hatchBtn'); if (b && b.focus) try { b.focus({ preventScroll: true }); } catch (e) {} }, 400); }); });
    anchor.parentNode.insertBefore(c, before ? anchor : anchor.nextSibling);
    var t = setInterval(function () { if (!c.isConnected) return clearInterval(t); var n = d.getElementById('nAlive'), v = n ? parseInt(String(n.textContent).replace(/[^0-9]/g, ''), 10) : NaN; if (v > 0) { c.remove(); clearInterval(t); } }, 1500); }
  // 6. phone notice next to Connect
  function phoneNote(btn) { if (!btn || !isMobile() || btn._uxp) return; btn._uxp = 1; var n = d.createElement('div'); n.className = 'small uxp-note'; n.textContent = '📱 Play on your phone: open xcpets.fun inside the Casa Tookan app, then tap Connect.'; if (window.V2Wallet && V2Wallet.label && V2Wallet.label() === 'Casa Tookan') return; btn.parentNode.insertBefore(n, btn.nextSibling); }
  // 9. alt text for every image (static + ones added later)
  function altFix(root) { (root.querySelectorAll ? root.querySelectorAll('img:not([alt])') : []).forEach(function (im) { var t = im.getAttribute('title') || im.getAttribute('aria-label') || ''; if (!t) { var f = (im.getAttribute('src') || '').split('/').pop().split('?')[0].replace(/\.\w+$/, ''); t = f.replace(/^sp-/, '').replace(/[-_]+/g, ' ').trim(); t = /logo/.test(f) ? 'XCPETS logo' : t ? 'XCPETS ' + t : 'XCPETS image'; } im.setAttribute('alt', t); }); }
  // 12. plain-words wallet errors (raw text kept in a details line)
  function plain(raw, code) { var r = String(raw || ''); if (code === 4001 || /reject|denied|cancel/i.test(r)) return 'You cancelled the request in XCP Wallet. Nothing was burned.';
    if (code === -32005 || /-32005|busy|pending request/i.test(r)) return 'XCP Wallet is busy with another request. Wait a few seconds and try again.';
    if (/fee.*(low|small)|min relay|insufficient fee|mempool min/i.test(r)) return 'The network fee was too low for Bitcoin right now. Try again (the fee is re-estimated).';
    if (/utxo|missing ?inputs|already spent|double.?spend|txn-mempool-conflict|bad-txns-inputs/i.test(r)) return 'A coin this burn wanted to spend is already used by one of your unconfirmed burns. Wait for the next block, then try again.';
    if (/insufficient|not enough|balance/i.test(r)) return /btc|fee/i.test(r) ? 'Not enough BTC in the wallet to pay the network fee.' : 'Not enough XCPETS in the wallet for this burn.';
    return null; }
  function hookWallet() { var W = window.V2Wallet; if (!W || W._uxp) return; W._uxp = 1;
    var eh = W.errHtml; if (eh) W.errHtml = function (e) { var h = eh(e), p = plain((e && (e.message || '')) + ' ' + h, e && e.code); return p ? '<span class="uxp-err">' + esc(p) + '<details class="small"><summary>Details</summary>' + h + '</details></span>' : h; };
    var send = W.send; if (send) W.send = function () { return send.apply(W, arguments).then(function (r) { if (r && r.txid) toast('Signed ✓, waiting for the next block (~10 min). <a href="https://mempool.space/tx/' + encodeURIComponent(r.txid) + '" target="_blank" rel="noopener">View tx</a>', 20000); return r; }); }; }
  // 3. Play on phones: compact community section, Connect / Hatch / My Pets near the top
  function playPhone() { var cp = d.getElementById('communityPanel'), main = d.querySelector('main'); if (!cp || !main) return;
    var q = d.createElement('div'); q.className = 'uxp-quick'; q.innerHTML = '<a class="btn" href="#topBar">Connect</a><a class="btn" href="#hatchPanel">Hatch</a><a class="btn" href="#petsPanel">My Pets</a>'; main.insertBefore(q, main.firstChild);
    if (!phone()) return; var tb = d.getElementById('topBar'); if (tb) main.insertBefore(tb, cp);
    var wrap = function () { var cs = d.querySelector('#community .cstats'); if (!cs || (cs.parentNode && cs.parentNode.classList.contains('uxp-cdet'))) return; d.querySelectorAll('#community .uxp-cdet').forEach(function (x) { if (!x.querySelector('.cstats')) x.remove(); });
      var det = d.createElement('details'); det.className = 'uxp-cdet small'; det.innerHTML = '<summary>Community pet stats</summary>'; cs.parentNode.insertBefore(det, cs); det.appendChild(cs); };
    var com = d.getElementById('community'); if (com) new MutationObserver(wrap).observe(com, { childList: true, subtree: true }); wrap(); }
  // 10. Ranking: find my pet + fewer rows on phones
  function rankingFind() { var b = d.getElementById('board'); if (!b) return; var f = d.createElement('div'); f.className = 'uxp-find';
    f.innerHTML = '<label class="small" for="uxpFind">Find my pet</label><input id="uxpFind" type="search" placeholder="Pet # or name" autocomplete="off"><button type="button" class="btn" id="uxpFindGo">Find</button>' + (ls.get('xcpets-v2-me') ? '<button type="button" class="btn ghost" id="uxpMine">My pets</button>' : '') + '<span class="small muted" id="uxpFindMsg" aria-live="polite"></span>';
    b.parentNode.insertBefore(f, b); var msg = f.querySelector('#uxpFindMsg');
    function rows() { return Array.prototype.slice.call(d.querySelectorAll('#board tr, #board li, #board .row, #boardAll tr, #boardAll li')); }
    /* content-fixes 2026-10-19: with V2Ranking (js/v2-pages.js) the search covers every row of the board, not only the loaded ones */
    function go(test, label, q) { if (window.V2Ranking && q) { d.querySelectorAll('.uxp-hit').forEach(function (x) { x.classList.remove('uxp-hit'); }); var nh = V2Ranking.find(q);
        msg.textContent = nh ? nh + ' match' + (nh > 1 ? 'es' : '') + (label ? ' for ' + label : '') : 'No pet found on this board' + (label ? ' for ' + label : '') + '.'; return; }
      var all = d.getElementById('boardAll'); if (all && all.tagName === 'BUTTON' && !all._uxpOpen) { all._uxpOpen = 1; all.click(); } else if (all && all.querySelector && all.querySelector('button')) all.querySelector('button').click();
      showAll(); setTimeout(function () { d.querySelectorAll('.uxp-hit').forEach(function (x) { x.classList.remove('uxp-hit'); }); var hits = rows().filter(test); hits.forEach(function (x) { x.classList.add('uxp-hit'); });
        msg.textContent = hits.length ? hits.length + ' match' + (hits.length > 1 ? 'es' : '') + (label ? ' for ' + label : '') : 'No pet found on this board' + (label ? ' for ' + label : '') + '.'; if (hits[0]) hits[0].scrollIntoView({ block: 'center' }); }, 300); }
    f.querySelector('#uxpFindGo').onclick = function () { var v = f.querySelector('#uxpFind').value.trim().replace(/^#/, ''); if (!v) return; var n = /^\d+$/.test(v); go(function (x) { var t = x.textContent; return n ? new RegExp('#' + v + '(?!\\d)').test(t) : t.toLowerCase().indexOf(v.toLowerCase()) >= 0; }, (n ? '#' : '') + v, n ? { id: +v } : { text: v }); };
    f.querySelector('#uxpFind').onkeydown = function (e) { if (e.key === 'Enter') f.querySelector('#uxpFindGo').click(); };
    var mine = f.querySelector('#uxpMine'); if (mine) mine.onclick = function () { var a = ls.get('xcpets-v2-me') || '', s = a.slice(0, 6), e2 = a.slice(-4); go(function (x) { var t = x.textContent; return t.indexOf(s) >= 0 && t.indexOf(e2) >= 0 || (x.innerHTML.indexOf(a) >= 0); }, 'your address', a ? { owner: a } : null); };
    var limited = false, more = null; function showAll() { limited = false; rows().forEach(function (x) { x.style.display = ''; }); if (more) more.remove(); more = null; }
    function limit() { if (window.V2Ranking || !phone() || limited === null) return; /* V2Ranking pages 25 rows on phones itself: one Show more button */ var R = rows().filter(function (x) { return x.closest('#board'); }); if (R.length <= 25 || more) return; limited = true; R.slice(25).forEach(function (x) { x.style.display = 'none'; });
      more = d.createElement('button'); more.type = 'button'; more.className = 'btn ghost uxp-more'; more.textContent = 'Show more (' + (R.length - 25) + ')'; more.onclick = function () { limited = null; showAll(); }; b.parentNode.insertBefore(more, b.nextSibling); }
    new MutationObserver(function () { if (more && !more.isConnected) more = null; if (limited !== null) { more && more.remove(); more = null; limit(); } }).observe(b, { childList: true, subtree: true }); setTimeout(limit, 1500); }
  // 11. empty cemetery -> closest to dying
  function cemetery() { var t = d.getElementById('tombs'), s = d.getElementById('status'); var tick = setInterval(function () { if (!s || !/\b0 pets\b/.test(s.textContent) || d.getElementById('uxpCem')) return; if (t && /No pets? ha(s|ve) died yet/.test(t.textContent)) { clearInterval(tick); return; } /* intuitive-pass item 17: the page already says it */ clearInterval(tick);
    var p = d.createElement('p'); p.id = 'uxpCem'; p.className = 'small'; p.innerHTML = 'No pet has died yet. Pets starve after 7 full days with no meal: feed yours on <a href="play.html">Play</a>.'; (t || s).parentNode.insertBefore(p, (t || s).nextSibling); }, 700); setTimeout(function () { clearInterval(tick); }, 60000); }
  function init() {
    altFix(d); new MutationObserver(function (m) { m.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.tagName === 'IMG' && !n.hasAttribute('alt')) altFix(n.parentNode); else altFix(n); } }); }); }).observe(d.body, { childList: true, subtree: true });
    hookWallet(); var hw = setInterval(hookWallet, 1000); setTimeout(function () { clearInterval(hw); }, 30000);
    if (page === 'index.html') { var hero = d.querySelector('section.hero'); startCard(hero, false); phoneNote(d.getElementById('xcpConnect')); }
    if (page === 'play.html') { playPhone(); var tb = d.getElementById('topBar'); startCard(tb, true); phoneNote(d.getElementById('wconnect')); }
    if (page === 'ranking.html') rankingFind();
    if (page === 'cemetery.html') cemetery();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
