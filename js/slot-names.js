/* slot-names (owner Nov 22 2026). Display only, main page only (workers never load this file).
 * Players mixed up the body slot "Outfits" with the back slot "Drip". The owner wanted to keep "Drip", so the body slot is shown as
 * "Armor" (it holds breastplates, vests, robes and suits). The rules keep their own names: V2Rules' internal SLOT_LABELS and slotLabel
 * are untouched, so replay, logs, rsig and the pet:c:roll:SLOT tag codes (OUTFITS still works on chain) do not change. This file only
 * swaps what the page shows:
 *  - V2Rules.slotLabel / V2Rules.SLOT_LABELS on the exported object (UI callers) say Armor for 'body';
 *  - V2Rules.newWins results carry slotName 'Armor';
 *  - XcpSlots.text(s) rewrites a rules-built line ("... (Outfits)") for display. Only the capitalised word is rewritten, never the
 *    upper-case OUTFITS tag code, so a tag shown to a player stays valid. Loaded right after js/v2-rules.js. */
(function () {
  'use strict';
  var SLOT = 'body', NEW = 'Armor', OLD_RX = /\bOutfits\b/g;
  function text(s) { return s == null ? s : String(s).replace(OLD_RX, NEW); }
  function label(sl, orig) { return sl === SLOT ? NEW : orig ? orig(sl) : String(sl); }
  window.XcpSlots = { NEW: NEW, SLOT: SLOT, text: text, label: function (sl) { var V = window.V2Rules; return label(sl, V && V.__slotLabel0); } };
  function patch() { var V = window.V2Rules; if (!V || V.__slotNames) return !!V; V.__slotNames = 1;
    try {
      if (typeof V.slotLabel === 'function') { var o = V.slotLabel; V.__slotLabel0 = o; V.slotLabel = function (sl) { return label(sl, o); }; }
      if (V.SLOT_LABELS) { var c = {}; Object.keys(V.SLOT_LABELS).forEach(function (k) { c[k] = V.SLOT_LABELS[k]; }); c[SLOT] = NEW; V.SLOT_LABELS = c; }
      if (typeof V.newWins === 'function') { var nw = V.newWins; V.newWins = function () { var r = nw.apply(this, arguments); try { (r && r.wins || []).forEach(function (x) { if (x && x.slot === SLOT) x.slotName = NEW; }); } catch (e) { } return r; }; }
    } catch (e) { }
    return true; }
  if (!patch()) { var n = 0, t = setInterval(function () { if (patch() || ++n > 200) clearInterval(t); }, 50); }
})();
