/* slot-names (owner Nov 22 2026: "combine them or rename the confusing one"). Display only, main page only (workers never load this file).
 * Players mixed up the back slot "Drip" with the body slot "Outfits", so the back slot is shown as "Cape" (it holds capes, cloaks, banners,
 * flags and wings). The rules keep their own names: V2Rules' internal SLOT_LABELS and slotLabel are untouched, so replay, logs, rsig and the
 * pet:c:roll:SLOT tag codes (DRIP still works on chain) do not change. This file only swaps what the page shows:
 *  - V2Rules.slotLabel / V2Rules.SLOT_LABELS on the exported object (UI callers) say Cape for 'back';
 *  - V2Rules.newWins results carry slotName 'Cape';
 *  - XcpSlots.text(s) rewrites a rules-built line ("... (Drip)") for display. Loaded right after js/v2-rules.js. */
(function () {
  'use strict';
  var NEW = 'Cape', OLD_RX = /\bDrip\b/g, OLD_UP = /\bDRIP\b/g;
  function text(s) { return s == null ? s : String(s).replace(OLD_RX, NEW).replace(OLD_UP, NEW.toUpperCase()); }
  function label(sl, orig) { return sl === 'back' ? NEW : orig ? orig(sl) : String(sl); }
  window.XcpSlots = { NEW: NEW, text: text, label: function (sl) { var V = window.V2Rules; return label(sl, V && V.__slotLabel0); } };
  function patch() { var V = window.V2Rules; if (!V || V.__slotNames) return !!V; V.__slotNames = 1;
    try {
      if (typeof V.slotLabel === 'function') { var o = V.slotLabel; V.__slotLabel0 = o; V.slotLabel = function (sl) { return label(sl, o); }; }
      if (V.SLOT_LABELS) { var c = {}; Object.keys(V.SLOT_LABELS).forEach(function (k) { c[k] = V.SLOT_LABELS[k]; }); c.back = NEW; V.SLOT_LABELS = c; }
      if (typeof V.newWins === 'function') { var nw = V.newWins; V.newWins = function () { var r = nw.apply(this, arguments); try { (r && r.wins || []).forEach(function (x) { if (x && x.slot === 'back') x.slotName = NEW; }); } catch (e) { } return r; }; }
    } catch (e) { }
    return true; }
  if (!patch()) { var n = 0, t = setInterval(function () { if (patch() || ++n > 200) clearInterval(t); }, 50); }
})();
