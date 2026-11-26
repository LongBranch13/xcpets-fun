/* v2-dock.js (Nov 26 2026, Jake: the "gm! Say WAGMI" pop-up sat on top of the Select / Feed selected bar). Display only, every page.
 *
 * Why pop-ups kept covering action bars: every floating thing at the bottom of the screen (news toasts, the hatch tray, Coach Peepo,
 * the wallet pill, the phone hand-off pill...) picks its own spot and its own z-index, and none of them knew a bar was pinned there.
 * Each collision got its own one-off patch (PR 290, PR 297). Now there is one rule for all of them:
 *
 *   1. A pinned action bar (My Pets' selection bar #bulkRow, or anything marked data-dock) is measured here. Its height goes into the
 *      CSS variable --dock-h on <html>, with the class "docked" while it is up.
 *   2. css/screens.css (rule 7) lifts every bottom floater by --dock-h, so it sits just above the bar instead of on it.
 *   3. css/screens.css (rule 1) hides the bars and floaters while a sheet (Sign & burn, Grinder...) is open: nothing covers a burn sheet.
 *
 * A new bottom floater goes in the rule 7 list; tools/dock-test.js fails if one is missing. A new pinned bar gets data-dock (or BARS).
 *
 * XcpDock.busy() (Nov 26 2026, play-test robot: the "13 eggs hatched" box reveal opened a few seconds after load, right as the player
 * tapped "Open" on a pet, and swallowed the tap): true while the player is touching the page (a tap, key, wheel or touch in the last
 * 2.5 s; not 'scroll', which pages also fire on their own) or picking pets. Every pop-up that opens ON ITS OWN (box reveal, fight replay, community pet arrivals) waits until it is false;
 * pop-ups the player asked for (a tap on the pill, Last hatch, Replay) open at once. One answer, so a new pop-up does not need its own. */
(function (win) {
  'use strict';
  var d = win.document; if (!d || win.XcpDock) return;
  var BARS = '#bulkRow, [data-dock]', root = d.documentElement, last = -1, q = 0;
  var ro = win.ResizeObserver ? new win.ResizeObserver(sched) : null, lastIn = 0, QUIET = 2500;
  function touched() { lastIn = Date.now(); }
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'touchmove'].forEach(function (ev) { try { win.addEventListener(ev, touched, { capture: true, passive: true }); } catch (e) { } });
  /** the player is busy: touched the page in the last ms (default 2.5 s) or is picking pets (My Pets select mode) */
  function busy(ms) { var b = d.body; return Date.now() - lastIn < (ms || QUIET) || !!(b && b.classList && (b.classList.contains('selmode') || b.classList.contains('mpc-sel'))); }
  /** height (px) of the pinned bars covering the bottom of the screen; 0 when none */
  function dockHeight() {
    var vh = win.innerHeight || root.clientHeight || 0, h = 0;
    [].forEach.call(d.querySelectorAll(BARS), function (b) {
      if (ro && !b.__xcDock) { b.__xcDock = 1; ro.observe(b); }
      var cs = win.getComputedStyle(b); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
      var r = b.getBoundingClientRect(); if (!r.height || r.bottom < vh - 80) return; /* only a bar that sits at the bottom edge */
      h = Math.max(h, vh - r.top);
    });
    return Math.max(0, Math.ceil(h));
  }
  function measure() { q = 0; var h = dockHeight(); if (h === last) return; last = h;
    root.style.setProperty('--dock-h', h + 'px'); root.classList.toggle('docked', h > 0); }
  function sched() { if (q) return; q = 1; (win.requestAnimationFrame || win.setTimeout)(measure); }
  function boot() {
    measure();
    /* body only, never the whole subtree (a subtree observer once froze the cemetery): select mode is a class on <body>, and a new bar is
     * added to <body>. A bar that changes size or hides (display:none) is followed by the ResizeObserver. */
    if (win.MutationObserver && d.body) new win.MutationObserver(sched).observe(d.body, { attributes: true, attributeFilter: ['class', 'style'], childList: true });
    win.addEventListener('resize', sched);
  }
  win.XcpDock = { BARS: BARS, refresh: sched, height: dockHeight, busy: busy };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
