/* Burn lines for the player's own page. Rankings and the light board do not load this file,
 * so they never request the chain window. The published view stores an empty log. After the
 * first paint this reads that window once and hands the lines to the view. It does not retry. */
(function () {
  'use strict';
  var started = false;
  function base() {
    var B = window.V2BootSync;
    if (B && B.localOnly && B.localOnly()) return '';
    if (B && B.base) return B.base();
    return '';
  }
  function world() {
    try { return window.V2Mock && V2Mock.world && V2Mock.world(); } catch (e) { return null; }
  }
  function fill() {
    var S = window.V2Split, w = world(), root, tip, since, ctl, timer;
    if (started || !S || !S.rowsToLog) return;
    if (!w || !w._view) return;
    if (w.log && w.log.length) { started = true; return; }
    root = base();
    if (!root) return;
    started = true;
    tip = w.tip | 0;
    since = tip > 288 ? tip - 288 : 0;
    ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    timer = setTimeout(function () { try { if (ctl) ctl.abort(); } catch (e) {} }, 12000);
    fetch(root + '/xp/v1/sync?since=' + since, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) return null;
      return r.json();
    }).then(function (ans) {
      var cur = world(), lines;
      if (!ans || !cur || !cur._view || (cur.log && cur.log.length)) return;
      lines = S.rowsToLog((ans.rows && ans.rows.list) || []);
      cur.log = lines;
      try { if (window.V2UI && V2UI.render) V2UI.render(); } catch (e) {}
    }, function () { clearTimeout(timer); });
  }
  function later() { setTimeout(fill, 0); }
  window.addEventListener('xcpets-world-fresh', later);
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later);
})();
