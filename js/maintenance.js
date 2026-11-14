/* One switch. Set MAINTENANCE to false and the site plays again. */
var MAINTENANCE = true;
(function () {
  'use strict';
  var MSG = "XCPETS is down for maintenance. Your pets are safe on chain. Please don't burn anything right now; we'll be back soon.";
  window.XCPETS_MAINTENANCE = !!MAINTENANCE;
  function err() {
    var e = new Error(MSG);
    e.maintenance = true;
    e.retry = false;
    show();
    return e;
  }
  function show() {
    if (!window.XCPETS_MAINTENANCE || document.getElementById('xcpMaint')) return;
    var css = document.createElement('style');
    css.textContent = '#xcpMaint{position:fixed;inset:0;z-index:2147483647;background:#070b09;color:#e8f5ec;display:flex;align-items:center;justify-content:center;text-align:center;padding:28px;font-family:"Press Start 2P",ui-monospace,monospace;font-size:13px;line-height:2.1;image-rendering:pixelated}#xcpMaint .box{max-width:34em;border:4px solid #ff2d2d;background:#101610;box-shadow:8px 8px 0 #000;padding:22px 18px}#xcpMaint b{color:#ff2d2d}#xcpMaint p{margin:0 0 16px}';
    var d = document.createElement('div');
    d.id = 'xcpMaint';
    d.setAttribute('role', 'alert');
    d.innerHTML = '<div class="box"><p><b>XCPETS</b> is down for maintenance.</p><p>Your pets are safe on chain.</p><p>Please don\'t burn anything right now; we\'ll be back soon.</p></div>';
    function mount() {
      (document.head || document.documentElement).appendChild(css);
      (document.body || document.documentElement).appendChild(d);
    }
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  }
  window.XcpMaint = { on: function () { return !!window.XCPETS_MAINTENANCE; }, message: MSG, err: err, show: show, stop: function () { show(); return false; } };
  if (window.XCPETS_MAINTENANCE) show();
})();
