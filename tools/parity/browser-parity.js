/* Fast-vs-full parity check (Nov 22 2026). Paste into a loaded xcpets.fun page (play.html) whose wallet is set (view-only is fine).
 * It builds the FULL world the same way the background check does (published checkpoint + catch-up replay with the page's own rule files),
 * then compares it with the FAST world the page shows (V2Mock.world()) for that wallet: every owned pet field by field, owned gear,
 * and the game's own send check (V2Rules.sendBlock) for feed / breed / offer / unleash style actions. Read-only: nothing is signed or sent.
 *   await XcpParity.run()            -> report (also kept on window.__parity) */
(function () {
  'use strict';
  var FIELDS = ['owner', 'dead', 'released', 'stage', 'tier', 'name', 'species', 'hungry', 'fedToday', 'nextMeal', 'care', 'deathBlock', 'feral', 'hd', 'cold', 'pledge', 'deed', 'community', 'resurrected', 'graveState', 'mythicCare', 'breeds', 'lastFed'];
  function base() { return 'https://node.xcpets.fun'; }
  function j(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
  function unmark(v) { if (!v || typeof v !== 'object') return v; if (Array.isArray(v)) { var a = new Array(v.length); for (var i = 0; i < v.length; i++) if (i in v) a[i] = unmark(v[i]); return a; }
    var ks = Object.keys(v); if (ks.length === 1 && ks[0] === '__u' && v.__u === 1) return undefined; var o = {}; for (var k = 0; k < ks.length; k++) o[ks[k]] = unmark(v[ks[k]]); return o; }
  /* full world: the verify worker's pipeline, run in a same-origin iframe so the patched rules do not touch the page */
  async function fullWorld() {
    var files = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
    var all = Array.prototype.map.call(document.scripts, function (s) { return s.src; });
    var urls = files.map(function (f) { return all.filter(function (u) { return u.split('?')[0].slice(-f.length - 1) === '/' + f; })[0]; });
    if (urls.some(function (u) { return !u; })) throw new Error('rule scripts not on this page');
    var fr = document.createElement('iframe'); fr.style.display = 'none'; document.body.appendChild(fr); var W = fr.contentWindow;
    function load(u) { return new Promise(function (res, rej) { var s = W.document.createElement('script'); s.src = u; s.onload = res; s.onerror = function () { rej(new Error(u)); }; W.document.head.appendChild(s); }); }
    for (var i = 0; i < urls.length - 1; i++) await load(urls[i]);
    W.eval(XcpResume.patchRules(await fetch(urls[urls.length - 1]).then(function (r) { return r.text(); })));
    W.LiveEngine = { RealCore: W.RealCore, Chain: W.Chain && W.Chain.Chain, CFG: W.XCPETS_CONFIG };
    var latest = await j(base() + '/xp/v1/world/latest.json'), sync = await j(base() + '/xp/v1/sync'), man = await j(base() + latest.manifest), cp = man.checkpoint, dir = latest.manifest.replace(/manifest\.json$/, '');
    var root = unmark(await j(base() + dir + cp.root.url)), meta = unmark(await j(base() + dir + cp.meta.url)), parts = [];
    for (var k = 0; k < cp.files.length; k++) parts[cp.files[k].i] = unmark(await j(base() + dir + cp.files[k].url));
    var w0 = XcpResume.wsDecode(root, parts); XcpArt.restore(w0, window.PetCore, {});
    var seen = {}; (meta.seen || []).forEach(function (x) { seen[x] = 1; });
    var tip = sync.tip || man.tip, w = W.V2Rules.replay((sync.rows && sync.rows.list) || [], sync.hashes || {}, [], { tip: tip, live: W.LiveEngine.RealCore, dex: sync.dex && sync.dex.body || undefined,
      _resume: { w: w0, seen: seen, dexPos: meta.dexPos || 0, grand: meta.grand ? 1 : 0, tip: meta.tip } });
    return { w: w, V: W.V2Rules, tip: tip, frame: fr };
  }
  function same(a, b) { if (a === b) return true; if ((a == null || a === false || a === 0 || a === '') && (b == null || b === false || b === 0 || b === '')) return a === b || (a == null && b == null) || (!a && !b);
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9; return JSON.stringify(a) === JSON.stringify(b); }
  function gearOf(w, id) { return Object.keys(w.items || {}).map(function (g) { return w.items[g]; }).filter(function (g) { return g && g.on === id; }).map(function (g) { return g.item + '/' + g.slot; }).sort().join(','); }
  function plans(V, w, me, p, b) { var L = [];
    try { L.push(['feed', 'pet:feed:' + p.id]); } catch (e) {}
    try { if (V.cemPlan && V.cemOn && V.cemOn(b)) { var g = w.pets.filter(function (x) { return x && x.dead && !x.released; })[0]; if (g) L.push(['offer', V.cemPlan(w, 'seance', g.id, [p.id], b).tag]); } } catch (e) {}
    try { if (V.isZ && V.isZ(p) && V.mgPlan) L.push(['unleash', V.mgPlan(w, p.id, b).tag]); } catch (e) {}
    try { var mate = w.pets.filter(function (x) { return x && x.owner === me && x.id !== p.id && !x.dead && x.stage >= 3; })[0]; if (mate && p.stage >= 3) L.push(['breed', 'pet:breed:' + p.id + ':' + mate.id]); } catch (e) {}
    return L; }
  async function run(opt) { opt = opt || {}; var t0 = Date.now(), me = (window.V2Split && V2Split.pageWallet && V2Split.pageWallet()) || '';
    if (!me) throw new Error('no wallet on this page');
    var fast = V2Mock.world(), Vf = window.V2Rules, F = await fullWorld(), full = F.w, Vw = F.V;
    var fullMine = full.pets.filter(function (p) { return p && p.owner === me && !p.community; }), fastMine = fast.pets.filter(function (p) { return p && p.owner === me && !p.community; });
    var fastById = {}; fastMine.forEach(function (p) { fastById[p.id] = p; }); fast.pets.forEach(function (p) { if (p && !fastById[p.id]) fastById[p.id] = p; });
    var rep = { wallet: me, fastTip: fast.tip, fullTip: full.tip, fullOwned: fullMine.length, fastOwned: fastMine.length, missing: [], extra: [], fieldDiffs: {}, gearDiffs: [], actionDiffs: [], samples: [] };
    var fullIds = {}; fullMine.forEach(function (p) { fullIds[p.id] = 1; });
    fastMine.forEach(function (p) { if (!fullIds[p.id]) rep.extra.push(p.id); });
    var b = Math.min(fast.tip || 0, full.tip || 0) + 1, checked = 0, cap = opt.cap || 400;
    for (var i = 0; i < fullMine.length; i++) { var P = fullMine[i], Q = fastById[P.id];
      if (!Q || Q.owner !== me) { rep.missing.push(P.id); continue; }
      FIELDS.forEach(function (f) { if (!same(P[f], Q[f])) { var d = rep.fieldDiffs[f] = rep.fieldDiffs[f] || { n: 0, eg: [] }; d.n++; if (d.eg.length < 4) d.eg.push({ id: P.id, full: P[f], fast: Q[f] }); } });
      var zf = Vw.isZ ? !!Vw.isZ(P) : false, zq = Vf.isZ ? !!Vf.isZ(Q) : false; if (zf !== zq) { var dz = rep.fieldDiffs.zombie = rep.fieldDiffs.zombie || { n: 0, eg: [] }; dz.n++; if (dz.eg.length < 4) dz.eg.push({ id: P.id, full: zf, fast: zq }); }
      var gf = gearOf(full, P.id), gq = gearOf(fast, P.id); if (gf !== gq && rep.gearDiffs.length < 20) rep.gearDiffs.push({ id: P.id, full: gf, fast: gq });
      if (checked < cap) { checked++; plans(Vw, full, me, P, b).forEach(function (pl) { var a = null, c = null; try { a = Vw.sendBlock(full, pl[1], b - 1, { me: me, pending: [] }); } catch (e) { a = 'throws ' + e.message; } try { c = Vf.sendBlock(fast, pl[1], b - 1, { me: me, pending: [] }); } catch (e) { c = 'throws ' + e.message; }
        if (String(a) !== String(c) && rep.actionDiffs.length < 40) rep.actionDiffs.push({ id: P.id, action: pl[0], tag: pl[1], full: a, fast: c }); }); }
    }
    rep.missingN = rep.missing.length; rep.missing = rep.missing.slice(0, 30); rep.extra = rep.extra.slice(0, 30); rep.actionsChecked = checked; rep.secs = Math.round((Date.now() - t0) / 1000);
    try { F.frame.remove(); } catch (e) {}
    window.__parity = rep; return rep; }
  window.XcpParity = { run: run };
})();
