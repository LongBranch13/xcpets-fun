/* Status line (Nov 22 2026, plan item "a status line"). Display only, one tiny extra read (status.json, every 5 minutes).
 * One slim line under the header on every game page: which block the page shows, whether that is current, and any known issue
 * the team posted in /status.json, so players don't hard-reset again and again when something is already known (Jacob did).
 *   🟢 Live · block 977,075          checked against the chain and at most 3 blocks behind the newest tip the page knows
 *   🟢 Up to date · block N          the server's published world (rebuilt every 6 blocks), at most 8 behind; past 3 it names the blocks still to come
 *   📦 Saved copy · block N          the page still shows its saved or published copy while it reads the chain
 *   🟡 Catching up · block N         the data-lag bar (js/v2-datalag.js) or the chain line (#v2stale) already explains; this line stays short
 *   ⚠️ <known issue>                 from status.json { "issue": "text", "level": "warn" | "info" }; empty issue = nothing shown
 * Edit status.json in the repo (merge to main) to post or clear a notice. Practice pages are skipped (pretend chain). */
(function () {
  'use strict';
  if (/practice/.test(location.pathname)) return;
  var d = document, issue = null;
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() {
    if (d.getElementById('stCss')) return; var s = d.createElement('style'); s.id = 'stCss';
    s.textContent = '#statusLine{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;font-size:12px;line-height:1.3;padding:4px 10px;margin:0 auto;opacity:.9}' +
      '#statusLine .st-dot{font:10px "Press Start 2P",monospace;letter-spacing:.5px}#statusLine .st-issue{padding:2px 8px;border-radius:6px;border:1px solid #e0a800;background:rgba(255,200,60,.14)}' +
      '#statusLine .st-issue.info{border-color:#3fa7ff;background:rgba(63,167,255,.12)}';
    d.head.appendChild(s);
  }
  function line() {
    var el = d.getElementById('statusLine'); if (el) return el;
    css(); el = d.createElement('div'); el.id = 'statusLine'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    var nav = d.querySelector('header.nav, header, nav'); if (window.XcpTopStrip && XcpTopStrip.mount(el)) { } /* smooth load: the reserved strip under the header */ else if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling); else d.body.insertBefore(el, d.body.firstChild);
    return el;
  }
  function loadIssue() {
    try {
      fetch('/status.json?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        issue = j && j.issue ? { text: String(j.issue).slice(0, 240), level: j.level === 'info' ? 'info' : 'warn' } : null; paint();
      }, function () { });
    } catch (e) { }
  }
  var last = '';
  function paint() {
    var M = window.V2Mock, S = null; try { S = M && M.state ? M.state() : null; } catch (e) { S = null; }
    var tip = S && S.tip, F = (window.V2Sales && V2Sales.feed) || {}, ref = Math.max((S && S.chainTip) || 0, (S && S.feedTip) || 0, F.tip || 0);
    /* the published world (S.view) is rebuilt every 6 blocks, so up to 8 behind the node's tip is its normal state, not 'catching up' */
    var view = !!(S && S.view && !S.verified), hTip = 0; try { hTip = view && window.V2Split && V2Split.healthTip ? +V2Split.healthTip() || 0 : 0; } catch (e) { hTip = 0; }
    if (hTip > ref) ref = hTip;
    var behind = tip && ref ? ref - tip : 0;
    var lag = !!(d.getElementById('dataLagBar') || d.getElementById('v2stale') || behind > (view ? 8 : 3));
    /* Nov 23 2026: a page painted from the server's published world (S.view) is current once it is within 3 blocks of the newest tip the
     * page knows. It used to say 'Saved copy · checking the chain' until a burn or Verify ran the full check, which read as stuck. Burns still
     * get that full check before anything is signed (js/v2-split.js checkPlans); this line is display only. */
    var fresh = view && ref > 0 && !lag;
    var head = !(M && M.state) ? '' : !tip ? '<span class="st-dot">⏳ Loading</span>' : lag ? '<span class="st-dot">🟡 Catching up</span> · block ' + fmt(tip) : fresh ? '<span class="st-dot" title="Built by the game server from the chain. Burns get one more check before you sign.">🟢 Up to date</span> · block ' + fmt(tip) + (behind > 3 ? ' · ' + behind + ' newer blocks in the next update' : '') : !S.verified ? '<span class="st-dot">📦 Saved copy</span> · block ' + fmt(tip) + ' · checking the chain' : '<span class="st-dot">🟢 Live</span> · block ' + fmt(tip);
    var html = head + (issue ? ' <span class="st-issue ' + issue.level + '">' + (issue.level === 'info' ? 'ℹ️ ' : '⚠️ ') + esc(issue.text) + '</span>' : '');
    if (html === last) return; last = html; var el = line(); el.innerHTML = html; el.hidden = !html;
  }
  function start() { paint(); setInterval(paint, 3000); loadIssue(); setInterval(loadIssue, 5 * 60 * 1000); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
  window.V2Status = { paint: paint };
})();
