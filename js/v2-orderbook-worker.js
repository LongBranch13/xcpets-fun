/* Shop order book replay. Same rules and same inputs as the page (burns, block hashes, dex).
 * Posts back only the listings and the pets they name. The full world stays here. */
'use strict';
function shim() {
  var mem = {}, st = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
  self.window = self; self.localStorage = st; self.sessionStorage = st;
  self.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    createElement: function () { return { getContext: function () { return null; }, style: {} }; }, addEventListener: function () {}, body: null, documentElement: { style: {} }, readyState: 'complete' };
  if (!self.addEventListener) self.addEventListener = function () {};
}
function plainPet(p) {
  var o = {}, k, v, kk, vv, c, ok;
  for (k in p) {
    if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
    v = p[k];
    if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') { o[k] = v; continue; }
    if (k === 'gear') { o.gear = new Array((v && v.length) || 0); continue; }
    if (Array.isArray(v)) {
      ok = true;
      for (kk = 0; kk < v.length; kk++) if (v[kk] && typeof v[kk] === 'object') ok = false;
      if (ok) o[k] = v.slice();
      continue;
    }
    if (typeof v === 'object') {
      c = {}; ok = true;
      for (kk in v) { if (!Object.prototype.hasOwnProperty.call(v, kk)) continue; vv = v[kk]; if (vv && typeof vv === 'object') { ok = false; break; } c[kk] = vv; }
      if (ok) o[k] = c;
    }
  }
  return o;
}
self.onmessage = function (ev) {
  var m = ev.data || {};
  try {
    shim();
    importScripts.apply(self, m.scripts || []);
    self.LiveEngine = { RealCore: self.RealCore, Chain: self.Chain && self.Chain.Chain, CFG: self.XCPETS_CONFIG };
    var w = self.V2Rules.replay(m.rows, m.hashes, [], { tip: m.tip, live: self.LiveEngine.RealCore, dex: m.dex });
    var ids = {}, pets = [], deeds = {}, i, S, p;
    var listings = w.listings || [];
    for (i = 0; i < listings.length; i++) { S = listings[i]; if (S && S.petId != null) ids[S.petId] = 1; }
    Object.keys(ids).forEach(function (id) { p = w.byId[id]; if (p) pets.push(plainPet(p)); });
    pets.forEach(function (pet) { if (pet.deed && w.deeds && w.deeds[pet.deed]) deeds[pet.deed] = w.deeds[pet.deed]; });
    for (i = 0; i < listings.length; i++) { S = listings[i]; if (S && S.give && w.deeds && w.deeds[S.give]) deeds[S.give] = w.deeds[S.give]; }
    var openN = 0, bi;
    for (bi = 0; bi < listings.length; bi++) if (self.V2Rules.saleState(w, listings[bi], (w.tip || 0) + 1) === 'open') openN++;
    self.postMessage({ ok: true, tip: w.tip, listings: listings, pets: pets, deeds: deeds, orders: (m.dex && m.dex.orders) || [], n: (w.pets || []).length, open: openN });
  } catch (e) { self.postMessage({ ok: false, error: String(e && e.message || e) }); }
};
