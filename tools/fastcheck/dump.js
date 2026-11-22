/* Fast-vs-full checker, part 1 (Nov 22 2026). dump(w, V, me, tip, ids) describes one wallet's game state in plain JSON:
 * every pet it owns, every gear piece it owns, and the answer to the "can I do this?" checks that run before signing.
 * The SAME function runs in the browser on the fast (published snapshot) world and in Node on a full replay, so any
 * difference between the two is a fast-load bug. Read-only. Kept as one self-contained function: run.js sends its source
 * text to the page. */
function fastcheckDump(w, V, me, tip, ids) {
  var b = tip + 1, out = { tip: tip, me: me, pets: {}, items: {}, checks: {}, world: {}, ids: [] };
  var r2 = function (x) { return typeof x === 'number' ? Math.round(x * 100) / 100 : x; };
  var safe = function (f) { try { var v = f(); return v === undefined ? null : v; } catch (e) { return 'THROWS: ' + String(e && e.message || e).slice(0, 120); } };
  var mine = (w.pets || []).filter(function (p) { return p && p.owner === me; });
  var F = ['owner', 'dead', 'released', 'stage', 'tier', 'species', 'name', 'deathBlock', 'lastFed', 'fedToday', 'hungry', 'mythicCare', 'hd', 'deed', 'neglected', 'feral', 'breeds', 'zRaises', 'cold', 'community', 'resurrected', 'graveState'];
  mine.forEach(function (p) { var o = {}; F.forEach(function (k) { var v = p[k]; o[k] = v === undefined || v === false || v === 0 ? null : r2(v); });
    o.care = r2(p.care); o.nextMeal = r2(p.nextMeal);
    if (p.zombie) o.zombie = { gen: p.zombie.gen || null, fedAt: p.zombie.fedAt == null ? null : p.zombie.fedAt, feralAt: p.zombie.feralAt == null ? null : p.zombie.feralAt, crumbleAt: p.zombie.crumbleAt == null ? null : p.zombie.crumbleAt, meals: p.zombie.meals || null };
    if (p.quest) o.quest = { code: p.quest.code || null, end: p.quest.end || null };
    out.pets[p.id] = o; });
  var items = w.itemList || Object.keys(w.items || {}).map(function (k) { return w.items[k]; });
  items.forEach(function (g) { if (!g || g.owner !== me) return; out.items[g.gid] = { item: g.item, tier: g.tier == null ? null : g.tier, legendary: g.legendary ? 1 : null, on: g.on == null ? null : g.on, bag: g.bag ? 1 : null }; });
  /* checks: a sample of pets (same ids on both sides) */
  var pick = ids && ids.length ? ids : mine.filter(function (p) { return !p.released; }).map(function (p) { return p.id; }).sort(function (a, c) { return a - c; });
  if (!ids && pick.length > 300) { var step = pick.length / 300, s = []; for (var i = 0; i < 300; i++) s.push(pick[Math.floor(i * step)]); pick = s; }
  out.ids = pick;
  var send = function (plan) { if (!plan) return 'no plan'; return V.sendBlock(w, plan, tip, { me: me, pending: [] }); };
  pick.forEach(function (id, ix) { var p = w.byId[id], c = {}; if (!p) { out.checks[id] = { missing: 1 }; return; }
    c.feed = safe(function () { var pl = V.feedPlan([{ id: id, nextMeal: p.nextMeal || 0.5 }]); return send(pl && pl[0]); });
    c.offer = safe(function () { return V.cemOfferWhy(w, p, me, b); });
    var mate = pick[(ix + 1) % pick.length];
    if (mate !== id) c.breed = safe(function () { return send({ tag: 'pet:breed:' + id + ':' + mate }); });
    if (V.isZ && V.isZ(p)) { c.unleash = safe(function () { return V.mgUnleashWhy(w, p, me, b); }); c.unleashSend = safe(function () { return send(V.mgPlan(w, id, b)); }); }
    if (p.dead) c.grave = safe(function () { return V.cemGraveWhy(w, p, me, b); });
    c.discard = safe(function () { var pl = V.hdPlan ? V.hdPlan(w, me, [id], b) : null; return pl && pl.plans && pl.plans.length ? send(pl.plans[0]) : (pl && pl.why) || 'no plan'; });
    out.checks[id] = c; });
  out.world.ownPets = mine.length; out.world.ownAlive = mine.filter(function (p) { return !p.dead && !p.released; }).length;
  out.world.communityFed = safe(function () { return w.community ? Math.floor(w.community.fed || 0) : null; });
  out.world.halving = safe(function () { return V.halvingBlocks ? V.halvingBlocks(w) : null; });
  out.world.mythicOwner = safe(function () { return w.mythicOwners ? (w.mythicOwners[me] == null ? null : w.mythicOwners[me]) : null; });
  return out;
}
if (typeof module !== 'undefined') module.exports = fastcheckDump;
