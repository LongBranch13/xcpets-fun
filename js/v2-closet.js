/* XCPETS Closet (gear-closet, Jake Nov 28 2026: "I love all your suggestions" on the Make Gear Fun Again plan). DISPLAY ONLY, this device:
 * nothing is signed, no burn, no rule change; fights keep reading the gear saved on Bitcoin.
 *  - 🪞 Wardrobe (transmog, like World of Warcraft): a pet keeps the piece it really wears (its power) and shows another piece's LOOK.
 *    Any piece the wallet owns can be a look, on any number of its pets (a look is not a piece). Or hide a slot.
 *  - 👗 Outfits (a Fortnite-style locker): save a pet's look by name ("Boss fight", "Drip", "Naked chad") and put it on the pets you pick:
 *    one pet from its Dress drawer, many from My Pets (☑️ Select, then 👗 Outfit in the bar).
 *  - 📸 Fit check: one tap makes a "rate my fit" card of the pet's look for Telegram or X (the Share sheet's buttons).
 * The looks live in localStorage 'xcpets-wardrobe-v1', drawn by js/v2-render.js (V2Render.wardrobe), so every page that draws your pets
 * shows them. The Dress drawer (js/v2-dress.js) hosts the Looks and Outfits tabs; the Gear Collection book is js/v2-gearbook.js.
 * Pure helpers (fits, outfit apply plans, set progress) take plain objects and are node-testable: tools/closet-test.js. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.V2Closet = api;
  if (root && root.document) api.start();
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  var d = root && root.document;
  function RL() { return root && root.V2Rules; }
  function RD() { return root && root.V2Render; }
  function WD() { var R = RD(); return R && R.wardrobe; }
  function $(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'], TCOL = ['#a7adb5', '#55c35a', '#3d8bff', '#ffb300'];
  var MAX_FITS = 24, NAME_MAX = 24;
  /* draft sets from the rules thread (Nov 28 2026, not yet approved by Jake): used only until V2Rules.GEAR_SETS exists */
  var DRAFT_SETS = [
    ['noob', 'Noob Knight', ['wooden-sword', 'leather', 'red-headband']], ['gm', 'GM Crew', ['v2-gm-flag', 'v2-red-shades', 'blue-headband']],
    ['gamer', 'Gamer Mode', ['headset', 'energy-can', 'v2-chud-bluelight']], ['over', "It's Over", ['its-over', 'paper-cape', 'v2-wojak-face']],
    ['bull', 'Bull Run', ['v2-mumu-held', 'v2-mumu-band', 'v2-mumu-body']], ['ninja', 'Ninja Way', ['ninja-band', 'v2-sarutobi-face', 'v2-sarutobi-weapon']],
    ['rabbit', 'Down the Rabbit Hole', ['wr-shades', 'wr-drink-me', 'wr-waistcoat']], ['melt', 'Meltdown', ['hp-rad-suit', 'hp-fuel-rod', 'hp-slippers']],
    ['diamond', 'Diamond Hands', ['diamond-hands', 'hodl-banner', 'v2-diamond-stud']], ['satoshi', "Satoshi's Kit", ['v2-nakamoto-weapon', 'v2-nakamoto-body', 'v2-nakamoto-cape']],
    ['burn', 'Burn It All', ['torch', 'v2-burn-banner', 'flame-crown']], ['moon', 'To the Moon', ['moon-rocket', 'v2-moon-banner', 'beam-eyes']]
  ].map(function (s) { return { key: s[0], name: s[1], items: s[2], need: 3, draft: true }; });
  /** sets(): the gear sets. V2Rules.GEAR_SETS once the rules ship them; until then the draft list (draft: true, shown as "coming soon"). Pieces
   * missing from the catalog are dropped so a renamed id never shows a blank square. */
  function sets() { var V = RL(), by = (V && V.GEAR_BY_ID) || null, L = V && Array.isArray(V.GEAR_SETS) && V.GEAR_SETS.length ? V.GEAR_SETS : DRAFT_SETS;
    return L.map(function (s) { var it = (s.items || []).filter(function (id) { return !by || by[id]; }); return { key: s.key, name: s.name, items: it, need: Math.min(s.need || it.length, it.length), bonus: s.bonus, glow: s.glow, draft: !!s.draft || L === DRAFT_SETS }; })
      .filter(function (s) { return s.items.length >= 2; }); }
  function setOf(id) { var S = sets(); for (var i = 0; i < S.length; i++) if (S[i].items.indexOf(id) >= 0) return S[i]; return null; }
  /** setProgress(have, S): for each set, how many of its pieces are in `have` (an object of item ids). */
  function setProgress(have, S) { return (S || sets()).map(function (s) { var n = s.items.filter(function (id) { return have[id]; }).length; return { set: s, n: n, done: n >= s.need }; }); }

  /* ---- the store (V2Render.wardrobe): { v:1, w: { addr: { pets: { pid: { slot: id|'-' } }, fits: [{ n, s: { slot: id|'-' } }] } } } */
  function store() { var W = WD(); return W ? W.get() : { v: 1, w: {} }; }
  function mineOf(P, addr) { var W = P.w[addr]; if (!W || typeof W !== 'object') W = P.w[addr] = {}; if (!W.pets || typeof W.pets !== 'object') W.pets = {}; if (!Array.isArray(W.fits)) W.fits = []; return W; }
  function save(P) { var W = WD(); if (W) W.save(P); }
  function lookOf(addr, pid) { var W = store().w[addr]; return (W && W.pets && W.pets[pid]) || null; }
  function outfits(addr) { var W = store().w[addr]; return W && Array.isArray(W.fits) ? W.fits : []; }
  function setLook(addr, pid, slot, id) { var P = store(), W = mineOf(P, addr), m = W.pets[pid] || {};
    if (id == null) delete m[slot]; else m[slot] = id; if (Object.keys(m).length) W.pets[pid] = m; else delete W.pets[pid]; save(P); }
  function clearLooks(addr, pids) { var P = store(), W = mineOf(P, addr), n = 0; pids.forEach(function (id) { if (W.pets[id]) { delete W.pets[id]; n++; } }); save(P); return n; }

  /* ---- what a pet can wear as a look: an unlocked slot and a piece its species may wear (the rules' equipCheck, cached per kind of pet) */
  var FIT = { w: null, me: null, c: {} };
  function slotsOf(p) { var V = RL(), s = (V.V2_SLOTS || ['head', 'hand', 'body', 'back', 'face', 'feet']).slice(); if (p && p.species === 'wizard' && V.slotOpen && V.slotOpen(p, 'weapon')) s.push('weapon'); return s; }
  function fits(w, me, p, id) { var V = RL(), it = V && V.GEAR_BY_ID && V.GEAR_BY_ID[id]; if (!it || !p || !V.slotOpen || !V.slotOpen(p, it.slot)) return false;
    if (FIT.w !== w || FIT.me !== me) FIT = { w: w, me: me, c: {} };
    var one = V.isOneOfOne && V.isOneOfOne(p) ? 1 : 0, body = V.bodyOf ? V.bodyOf(p) : p.species, k = p.species + '\0' + p.tier + '\0' + body + '\0' + one + '\0' + id, hit = FIT.c[k];
    if (hit != null) return hit; var c = null; try { c = V.equipCheck(w, me, p.id, id); } catch (e) { c = null; }
    hit = !!(c && (c.ok || c.worn || /no free copy/.test(c.why || ''))); FIT.c[k] = hit; return hit; }
  /** owned(w, addr): { itemId: copies } for every piece the wallet holds, worn or spare (one pass, cached per world) */
  var OWN = { w: null, n: -1, me: null, o: null };
  function owned(w, addr) { var L = (w && w.itemList) || []; if (OWN.w === w && OWN.n === L.length && OWN.me === addr) return OWN.o; var o = {};
    for (var i = 0; i < L.length; i++) { var g = L[i]; if (g && g.owner === addr) o[g.item] = (o[g.item] || 0) + 1; } OWN = { w: w, n: L.length, me: addr, o: o }; return o; }
  /** looksFor(w, me, p, slot): every piece of that slot the wallet owns and the pet can show, rarest first */
  function looksFor(w, me, p, slot) { var V = RL(), o = owned(w, me), by = V.GEAR_BY_ID || {}, out = [];
    Object.keys(o).forEach(function (id) { var it = by[id]; if (it && it.slot === slot && fits(w, me, p, id)) out.push({ id: id, n: o[id], tier: it.tier || 0 }); });
    return out.sort(function (a, b) { return b.tier - a.tier || (label(a.id) < label(b.id) ? -1 : 1); }); }
  function label(id) { var V = RL(), it = V && V.GEAR_BY_ID && V.GEAR_BY_ID[id], s = it ? it.label || id : id; return root.XcpSlots ? root.XcpSlots.text(s) : s; }
  function slotName(sl) { try { if (root.XcpSlots) return root.XcpSlots.label(sl); return RL().slotLabel(sl); } catch (e) { return sl; } }
  function tierOf(id) { var V = RL(), it = V && V.GEAR_BY_ID && V.GEAR_BY_ID[id]; return it ? it.tier || 0 : 0; }
  function stars(id) { var t = tierOf(id); return t ? new Array(t + 1).join('★') : '☆'; }
  /* worn (power) pieces by slot, and what shows now (looks applied) */
  function wornBySlot(w, p) { var o = {}, V = RL(); (V.wornOf(w, p.id) || []).forEach(function (g) { var s = g.slot || ((V.GEAR_BY_ID || {})[g.item] || {}).slot; if (s) o[s] = g; }); return o; }
  function shownBySlot(w, p) { var W = WD(), L = (RL().wornOf(w, p.id) || []).map(function (g) { return { item: g.item, slot: g.slot || ((RL().GEAR_BY_ID || {})[g.item] || {}).slot, gid: g.gid }; });
    if (W) L = W.apply(w, p, L); var o = {}; L.forEach(function (g) { if (g.slot) o[g.slot] = g; }); return o; }

  /** planOutfit(w, me, fit, pets): per pet, the look map an outfit gives it. Pieces the pet can't show (locked slot, species-only) are skipped
   * and counted; '-' (hide) always applies. An outfit was saved from pieces the wallet owned, so ownership is not checked again here (the pet
   * page loads only part of a big wallet's gear). Pure: reads only the world, never writes. { maps: { pid: map }, pets, set, skipped } */
  function planOutfit(w, me, fit, pets) { var out = { maps: {}, pets: 0, set: 0, skipped: 0 };
    pets.forEach(function (p) { if (!p || p.owner !== me || p.dead || p.released) return; var m = {}, k = 0;
      Object.keys(fit.s || {}).forEach(function (sl) { var id = fit.s[sl]; if (id === '-') { m[sl] = '-'; k++; return; } if (fits(w, me, p, id)) { m[sl] = id; k++; } else out.skipped++; });
      out.maps[p.id] = m; out.pets++; out.set += k; });
    return out; }
  function applyPlan(me, plan) { var P = store(), W = mineOf(P, me); Object.keys(plan.maps).forEach(function (pid) { var m = plan.maps[pid]; if (Object.keys(m).length) W.pets[pid] = m; else delete W.pets[pid]; }); save(P); }
  /** snapshot(w, p): the pet's look as an outfit map: every slot, the piece it shows or '-' */
  function snapshot(w, p) { var sh = shownBySlot(w, p), m = {}; slotsOf(p).forEach(function (sl) { m[sl] = sh[sl] ? sh[sl].item : '-'; }); return m; }
  function saveOutfit(me, name, map) { var P = store(), W = mineOf(P, me), n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'Outfit ' + (W.fits.length + 1);
    var i = -1; W.fits.forEach(function (f, j) { if (f.n.toLowerCase() === n.toLowerCase()) i = j; });
    var f = { n: n, s: map }; if (i >= 0) W.fits[i] = f; else { if (W.fits.length >= MAX_FITS) return null; W.fits.push(f); } save(P); return f; }
  function delOutfit(me, i) { var P = store(), W = mineOf(P, me); W.fits.splice(i, 1); save(P); }
  var PRESETS = [{ n: 'Naked chad', s: { head: '-', hand: '-', body: '-', back: '-', face: '-', feet: '-', weapon: '-' }, preset: true }];
  function allFits(me) { return outfits(me).concat(PRESETS); }

  /* ---- drawing helpers */
  function icon(id, n, sil) { var R = RD(); n = n || 28; if (!id || !R || !R.iconCanvas) return '<span class="cl-ic cl-ic0" style="width:' + n + 'px;height:' + n + 'px" aria-hidden="true"></span>';
    var c = icon.c || (icon.c = {}), k = id + (sil ? '|s' : ''); if (c[k] == null) { try { var cv = R.iconCanvas(id); if (sil) silhouette(cv); c[k] = cv.toDataURL(); } catch (e) { c[k] = ''; } }
    return c[k] ? '<img class="cl-ic" src="' + c[k] + '" alt="" width="' + n + '" height="' + n + '">' : '<span class="cl-ic cl-ic0" aria-hidden="true"></span>'; }
  function silhouette(cv) { var g = cv.getContext('2d'), im = g.getImageData(0, 0, 32, 32), a = im.data, b0 = a[0], b1 = a[1], b2 = a[2];
    for (var i = 0; i < a.length; i += 4) if (a[i] !== b0 || a[i + 1] !== b1 || a[i + 2] !== b2) { a[i] = 6; a[i + 1] = 6; a[i + 2] = 12; } g.putImageData(im, 0, 0); return cv; }
  function framesFor(w, p, map) { var R = RD(), sh = shownBySlot(w, p), ids = [], sl; if (map) { var V = RL(), wo = wornBySlot(w, p); sh = {}; for (sl in wo) sh[sl] = wo[sl]; for (sl in map) { if (map[sl] === '-') delete sh[sl]; else sh[sl] = { item: map[sl] }; } void V; }
    for (sl in sh) ids.push(sh[sl].item); try { return R.framesWith(p.art, p.stage, ids, []); } catch (e) { return null; } }
  function paintPet(cv, w, p, map, still) { var R = RD(), fr = framesFor(w, p, map); if (!fr || !fr.length || !cv) return; try { if (still) R.paint(cv, fr[0]); else R.animate(cv, fr); } catch (e) { } }

  /* ---- the Dress drawer tabs (js/v2-dress.js calls body / foot / act / paint) */
  var ST = { exp: null };
  function lookRow(w, me, p, sl, worn, look) { var nm = esc(slotName(sl)), open = RL().slotOpen(p, sl), cur = worn[sl], lk = look && look[sl], shown = lk === '-' ? null : lk || (cur && cur.item);
    if (!open) return '<div class="dz-row lock"><span class="dz-sl">' + nm + '</span><span class="dz-ic dz-ic0" aria-hidden="true"></span><div class="dz-txt"><b>Locked</b><small>Opens as #' + p.id + ' grows and gets care</small></div></div>';
    var L = looksFor(w, me, p, sl), ex = ST.exp === sl, tag = lk === '-' ? '<b>Hidden</b>' : lk ? '<b>🪞 ' + esc(label(lk)) + ' <i>' + stars(lk) + '</i></b>' : shown ? '<b>' + esc(label(shown)) + ' <i>' + stars(shown) + '</i></b>' : '<b>Empty</b>';
    var sub = cur ? (lk ? 'power: ' + esc(label(cur.item)) + ' (still counts)' : 'its real piece · tap to change the look') : (lk && lk !== '-' ? 'looks only: nothing worn here' : 'nothing worn here');
    var h = '<button type="button" class="dz-row cl-lrow' + (lk ? ' on' : '') + '" data-cl="exp|' + sl + '" aria-expanded="' + ex + '"><span class="dz-sl">' + nm + '</span>' + (shown ? icon(shown) : '<span class="dz-ic dz-ic0" aria-hidden="true"></span>') +
      '<span class="dz-txt">' + tag + '<small>' + sub + '</small></span><span class="cl-n">' + (ex ? '▴' : '▾') + ' ' + L.length + '</span></button>';
    if (ex) { h += '<div class="cl-grid" role="group" aria-label="' + nm + ' looks for #' + p.id + '">' +
      (lk ? '<button type="button" class="cl-tile cl-real" data-cl="look|' + sl + '|">⟲<span>' + (cur ? 'Real piece' : 'Empty') + '</span></button>' : '') +
      (lk !== '-' && (cur || lk) ? '<button type="button" class="cl-tile cl-hide" data-cl="look|' + sl + '|-">🚫<span>Hide it</span></button>' : '') +
      L.slice(0, 120).map(function (x) { var on = shown === x.id && lk !== '-'; return '<button type="button" class="cl-tile' + (on ? ' on' : '') + '" style="--rc:' + TCOL[x.tier] + '" data-cl="look|' + sl + '|' + esc(x.id) + '" aria-pressed="' + on + '" title="' + esc(label(x.id) + ' · ' + TIERS[x.tier]) + '">' + icon(x.id, 40) + '<span>' + esc(label(x.id)) + '</span></button>'; }).join('') +
      (L.length ? '' : '<p class="small cl-none">' + (partial(w) ? 'Your gear is still loading. Open 👕 Dress from My Pets to see every piece.' : 'You own no ' + nm + ' piece #' + p.id + ' can show. Spin the Pepe Wheel for one.') + '</p>') +
      (L.length && partial(w) ? '<p class="small cl-none">Only part of your gear is loaded on this page. My Pets › 👕 Dress shows every piece.</p>' : '') + '</div>'; }
    return h; }
  function partial(w) { return !!(w && w._pages && w._pages.got < w._pages.total); }
  function body(tab, w, me, p) { var worn = wornBySlot(w, p), look = lookOf(me, p.id);
    if (tab === 'looks') { return '<p class="cl-note">🪞 <b>Wardrobe</b>: keep the power, change the look. Pick any piece you own (one copy works on every pet). Looks only, on this device: fights still count the real gear.</p>' +
      slotsOf(p).map(function (sl) { return lookRow(w, me, p, sl, worn, look); }).join(''); }
    var F = allFits(me);
    return '<p class="cl-note">👗 <b>Outfits</b>: save this look, then put it on any pet in one tap. Many at once: My Pets › ☑️ Select › 👗 Outfit.</p>' +
      '<div class="cl-fits">' + F.map(function (f, i) { var pl = planOutfit(w, me, f, [p]), m = pl.maps[p.id] || {}, n = Object.keys(m).length;
        return '<div class="cl-fit' + (f.preset ? ' preset' : '') + '"><canvas width="32" height="32" data-clfit="' + i + '" aria-hidden="true"></canvas><div class="cl-ftxt"><b>' + esc(f.n) + '</b><small>' + (f.preset ? 'every slot hidden' : pieceCount(f) + (pl.skipped ? ' · ' + pl.skipped + ' won’t fit #' + p.id : '')) + '</small></div>' +
          '<button type="button" class="btn cl-put" data-cl="put|' + i + '"' + (n ? '' : ' disabled') + '>Put on</button>' + (f.preset ? '' : '<button type="button" class="q cl-del" data-cl="del|' + i + '" aria-label="Delete outfit ' + esc(f.n) + '">🗑</button>') + '</div>'; }).join('') + '</div>'; }
  function pieceCount(f) { var n = 0, h = 0; Object.keys(f.s || {}).forEach(function (sl) { if (f.s[sl] === '-') h++; else n++; }); return n + ' piece' + (n === 1 ? '' : 's') + (h ? ' · ' + h + ' hidden' : ''); }
  function foot(tab, w, me, p) { var look = lookOf(me, p.id), n = look ? Object.keys(look).length : 0;
    return (tab === 'fits' ? '<button type="button" class="btn cl-save" data-cl="save">💾 Save this look</button>' : '<button type="button" class="q" data-cl="clear"' + (n ? '' : ' disabled') + '>⟲ Real gear look</button>') +
      '<button type="button" class="q cl-fc" data-cl="fit">📸 Fit check</button>'; }
  function paint(host, w, me, p) { host.querySelectorAll('canvas[data-clfit]').forEach(function (cv) { var f = allFits(me)[+cv.getAttribute('data-clfit')]; if (!f) return; var pl = planOutfit(w, me, f, [p]); paintPet(cv, w, p, pl.maps[p.id] || {}, true); }); }
  function toast(t) { var U = ui(); try { if (U && U.toast) return U.toast(t); } catch (e) { } }
  function ui() { return root.V2Dress && root.V2Dress.ui ? root.V2Dress.ui() : root.V2UI; }
  function act(b, w, me, p) { var a = String(b.getAttribute('data-cl') || '').split('|'), k = a[0];
    if (k === 'exp') { ST.exp = ST.exp === a[1] ? null : a[1]; return true; }
    if (k === 'look') { var id = a.slice(2).join('|'); setLook(me, p.id, a[1], id === '' ? null : id); if (root.V2Sfx && root.V2Sfx.blip) try { root.V2Sfx.blip(); } catch (e) { }
      toast(id === '' ? '⟲ #' + p.id + ' shows its real ' + esc(slotName(a[1])) : id === '-' ? '🚫 ' + esc(slotName(a[1])) + ' hidden on #' + p.id : '🪞 #' + p.id + ' now looks like ' + esc(label(id)) + ' (power unchanged)'); refresh(p.id); return true; }
    if (k === 'clear') { clearLooks(me, [p.id]); toast('⟲ #' + p.id + ' shows its real gear again'); refresh(p.id); return true; }
    if (k === 'put') { var f = allFits(me)[+a[1]]; if (!f) return true; var pl = planOutfit(w, me, f, [p]); applyPlan(me, pl); toast('👗 #' + p.id + ' wears "' + esc(f.n) + '"' + (pl.skipped ? ' (' + pl.skipped + ' piece' + (pl.skipped === 1 ? '' : 's') + ' didn’t fit)' : '')); refresh(p.id); return true; }
    if (k === 'del') { var f2 = outfits(me)[+a[1]]; if (!f2) return true; var ok = true; try { ok = root.confirm('Delete the outfit "' + f2.n + '"? Pets wearing it keep their look.'); } catch (e) { } if (ok) delOutfit(me, +a[1]); return true; }
    if (k === 'save') { var sug = ['Boss fight', 'Drip', 'Date night', 'Sunday best', 'Full degen', 'Moon mission'], used = {}; outfits(me).forEach(function (o) { used[o.n.toLowerCase()] = 1; });
      var def = sug.filter(function (s) { return !used[s.toLowerCase()]; })[0] || 'Outfit ' + (outfits(me).length + 1), nm = null;
      try { nm = root.prompt('Name this outfit (#' + p.id + '’s look right now):', def); } catch (e) { nm = def; } if (nm == null) return true;
      if (outfits(me).length >= MAX_FITS && !outfits(me).some(function (o) { return o.n.toLowerCase() === String(nm).trim().toLowerCase(); })) { toast('You can keep ' + MAX_FITS + ' outfits. Delete one first.'); return true; }
      var f3 = saveOutfit(me, nm, snapshot(w, p)); if (f3) toast('💾 Saved "' + esc(f3.n) + '". Put it on any pet from here or My Pets › Select.'); return true; }
    if (k === 'fit') { fitCheck(w, p, b); return true; }
    return false; }
  function refresh(pid) { var U = ui(); try { if (U && U.refreshGear) U.refreshGear(pid); else if (U && U.render) U.render(); } catch (e) { } }

  /* ---- My Pets: 👗 Outfit for the pets you ticked */
  function selIds() { var U = root.V2UI; try { return (U && U.S && U.S().sel || []).slice(); } catch (e) { return []; } }
  function viewOnly() { try { return !!(root.V2View && root.V2View.viewOnly && root.V2View.viewOnly()); } catch (e) { return false; } }
  function hookBar() { var bar = $('bulkRow'); if (!bar || $('clSelBtn') || !root.V2UI || !RL() || !WD()) return; var b = d.createElement('button'); b.type = 'button'; b.id = 'clSelBtn'; b.className = 'q';
    b.textContent = '👗 Outfit'; b.title = 'Put a saved outfit on the pets you ticked (looks only, free)'; b.onclick = function () { pickSheet(); }; var lair = $('selLair'); if (lair && lair.parentNode === bar) bar.insertBefore(b, lair); else bar.appendChild(b); }
  function pickSheet() { var U = root.V2UI, w = U && U.world && U.world(), me = U && U.ME; if (!w || !me) return; if (viewOnly()) { toast('View only: connect your wallet to dress your pets.'); return; }
    var ids = selIds(), pets = ids.map(function (id) { return w.byId[id]; }).filter(function (p) { return p && p.owner === me && !p.dead && !p.released; });
    if (!pets.length) { toast('Tick some living pets first.'); return; }
    var F = allFits(me), first = pets[0], ov = d.createElement('div'); ov.className = 'dz-modal'; ov.id = 'clSheet';
    ov.innerHTML = '<div class="dz-box" role="dialog" aria-modal="true" aria-labelledby="clSheetT"><div class="dz-grab" aria-hidden="true"></div><div class="dz-head"><h3 id="clSheetT">👗 Outfit for ' + fmt(pets.length) + ' pet' + (pets.length === 1 ? '' : 's') + '</h3><button type="button" class="q dz-x" data-x="1" aria-label="Close">✕</button></div>' +
      '<div class="dz-body"><p class="cl-note">Looks only, on this device, free. Each pet keeps its real gear (and its power). Pieces a pet can’t show are skipped.' + (outfits(me).length ? '' : ' <b>Tip:</b> save an outfit from any pet’s 👕 Dress › 👗 Outfits.') + '</p><div class="cl-fits">' +
      F.map(function (f, i) { return '<div class="cl-fit' + (f.preset ? ' preset' : '') + '"><canvas width="32" height="32" data-clfit="' + i + '" aria-hidden="true"></canvas><div class="cl-ftxt"><b>' + esc(f.n) + '</b><small>' + (f.preset ? 'every slot hidden' : pieceCount(f)) + '</small></div><button type="button" class="btn cl-put" data-put="' + i + '">Put on ' + fmt(pets.length) + '</button></div>'; }).join('') +
      '</div></div><div class="dz-foot"><button type="button" class="q" data-clear="1">⟲ Real gear look on ' + fmt(pets.length) + '</button></div></div>';
    d.body.appendChild(ov); d.documentElement.classList.add('dz-open'); css();
    ov.querySelectorAll('canvas[data-clfit]').forEach(function (cv) { var f = F[+cv.getAttribute('data-clfit')], pl = planOutfit(w, me, f, [first]); paintPet(cv, w, first, pl.maps[first.id] || {}, true); });
    function close() { ov.remove(); d.documentElement.classList.remove('dz-open'); }
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) return close(); var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.clear) { var n = clearLooks(me, pets.map(function (p) { return p.id; })); close(); toast('⟲ ' + fmt(n) + ' pets show their real gear again'); try { U.render(); } catch (er) { } return; }
      if (b.dataset.put != null) { var f = F[+b.dataset.put], pl = planOutfit(w, me, f, pets); applyPlan(me, pl); close();
        toast('👗 ' + fmt(pl.pets) + ' pets wear "' + esc(f.n) + '"' + (pl.skipped ? ' · ' + fmt(pl.skipped) + ' piece' + (pl.skipped === 1 ? '' : 's') + ' skipped (locked slot or species-only)' : '') + ' (free, looks only)'); try { U.render(); } catch (er) { } } });
    try { ov.querySelector('.dz-x').focus({ preventScroll: true }); } catch (e) { } }

  /* ---- 📸 Fit check: a square "rate my fit" card (1080 x 1080) drawn here, shared through the normal Share sheet (js/v2-share.js) */
  function fonts() { try { if (d.fonts && d.fonts.load) return Promise.all(['40px Bangers', '16px "Press Start 2P"', 'bold 30px "Comic Neue"'].map(function (f) { return d.fonts.load(f).catch(function () { }); })).then(function () { }, function () { }); } catch (e) { } return Promise.resolve(); }
  function frameCanvas(f) { var c = d.createElement('canvas'); c.width = c.height = 32; RD().paint(c, f); return c; }
  function fitCard(w, p) { return fonts().then(function () { return new Promise(function (res) {
    var S = 1080, c = d.createElement('canvas'); c.width = c.height = S; var g = c.getContext('2d'), sh = shownBySlot(w, p), worn = wornBySlot(w, p), slots = slotsOf(p).filter(function (sl) { return RL().slotOpen(p, sl); });
    g.imageSmoothingEnabled = false; g.fillStyle = '#140c22'; g.fillRect(0, 0, S, S);
    for (var y = 0; y < S; y += 40) for (var x = (y / 40) % 2 ? 40 : 0; x < S; x += 80) { g.fillStyle = '#1b1030'; g.fillRect(x, y, 40, 40); }
    var fr = framesFor(w, p, null); g.fillStyle = '#000'; g.fillRect(72, 252, 520, 520); g.fillStyle = '#ffd166'; g.fillRect(60, 240, 520, 520); g.fillStyle = '#221238'; g.fillRect(72, 252, 496, 496);
    if (fr && fr[0]) g.drawImage(frameCanvas(fr[0]), 80, 260, 480, 480);
    function txt(s, x, y, font, col, al, sh2) { g.font = font; g.textAlign = al || 'left'; g.textBaseline = 'alphabetic'; if (sh2) { g.fillStyle = '#000'; g.fillText(s, x + sh2, y + sh2); } g.fillStyle = col; g.fillText(s, x, y); }
    var tf = 140; g.font = tf + 'px Bangers, Impact, sans-serif'; while (g.measureText('FIT CHECK').width > S - 120 && tf > 60) { tf -= 6; g.font = tf + 'px Bangers, Impact, sans-serif'; }
    txt('FIT CHECK', 60, 150, tf + 'px Bangers, Impact, sans-serif', '#ffd166', 'left', 8);
    txt('rate my fit 1-10 👇', S - 60, 200, 'bold 36px "Comic Neue", sans-serif', '#f3eaff', 'right');
    var nm = (p.name || 'Pet') + ' #' + p.id; g.font = '64px Bangers, Impact, sans-serif'; while (g.measureText(nm).width > 500 && nm.length > 6) nm = nm.slice(0, -4) + '…';
    txt(nm, 60, 845, '64px Bangers, Impact, sans-serif', '#f3eaff', 'left', 4);
    var tier = p.resurrected ? 'God' : (p.stage | 0) >= 5 ? 'Mythic' : TIERS[p.tier | 0] || '', spc = String(p.speciesLabel || p.species || '').replace(/^hyb3?:/, 'hybrid ');
    txt((tier + ' ' + spc).trim().toUpperCase(), 60, 892, '22px "Press Start 2P", monospace', '#c3b4e0');
    var x0 = 620, y0 = 250, row = Math.min(84, Math.floor(500 / Math.max(1, slots.length)));
    slots.forEach(function (sl, i) { var y1 = y0 + i * row, it = sh[sl], id = it && it.item, look = id && worn[sl] && worn[sl].item !== id || (id && !worn[sl]);
      g.fillStyle = '#221238'; g.fillRect(x0, y1, 400, row - 10); g.fillStyle = id ? TCOL[tierOf(id)] : '#3a2560'; g.fillRect(x0, y1, 8, row - 10);
      if (id) { try { var ic = RD().iconCanvas(id); g.drawImage(ic, x0 + 18, y1 + (row - 10 - 64) / 2, 64, 64); } catch (e) { } }
      txt(String(slotName(sl)).toUpperCase(), x0 + 96, y1 + 26, '15px "Press Start 2P", monospace', '#ffd166');
      var t = id ? label(id) : (lookOf(p.owner, p.id) || {})[sl] === '-' ? 'hidden' : '—'; g.font = 'bold 28px "Comic Neue", sans-serif'; while (g.measureText(t).width > 290 && t.length > 6) t = t.slice(0, -3) + '…';
      txt(t, x0 + 96, y1 + 60, 'bold 28px "Comic Neue", sans-serif', id ? '#f3eaff' : '#6b5590');
      if (id) txt(stars(id) + (look ? ' 🪞' : ''), x0 + 390, y1 + 26, '20px "Comic Neue", sans-serif', TCOL[tierOf(id)], 'right'); });
    var have = {}; Object.keys(sh).forEach(function (sl) { have[sh[sl].item] = 1; }); var done = setProgress(have).filter(function (s) { return s.done; });
    if (done.length) { var s0 = done[0].set; g.fillStyle = '#000'; g.fillRect(66, 916, 960, 70); g.fillStyle = '#3ddc84'; g.fillRect(60, 910, 960, 70); txt('✨ FULL SET: ' + s0.name.toUpperCase() + (done.length > 1 ? ' +' + (done.length - 1) : ''), 540, 958, '44px Bangers, Impact, sans-serif', '#0d0718', 'center'); }
    else { var pw = 0; Object.keys(worn).forEach(function (sl) { pw += 1 + 2 * tierOf(worn[sl].item); }); txt('⚔ GEAR POWER ' + pw, 60, 960, '26px "Press Start 2P", monospace', '#3ddc84'); }
    txt('xcpets.fun', S - 60, 1040, '40px Bangers, Impact, sans-serif', '#ffd166', 'right'); txt('on-chain pets on Bitcoin', 60, 1040, 'bold 26px "Comic Neue", sans-serif', '#c3b4e0');
    try { c.toBlob(function (b) { res(b || null); }, 'image/png'); } catch (e) { res(null); } }); }); }
  function fitCheck(w, p, btn) { var Sh = root.V2Share; if (!w || !p) return; var card = fitCard(w, p);
    if (Sh && Sh.open) { setTimeout(function () { var o = d.querySelector('.sh-ov'); if (o) o.style.zIndex = '2147483002'; }, 0); /* above the Dress drawer */
      Sh.open(p.id, btn, { card: card, title: '📸 Fit check #' + p.id, text: 'Rate my fit 🔥 ' + (p.name || 'Pet') + ' #' + p.id + ' on XCPETS @XCPets', name: 'xcpets-fit-' + p.id + '.png', noGif: true }); return; }
    card.then(function (b) { if (!b) return; var u = URL.createObjectURL(b), a = d.createElement('a'); a.href = u; a.download = 'xcpets-fit-' + p.id + '.png'; d.body.appendChild(a); a.click(); a.remove(); }); }

  /* ---- pet page: 📸 Fit check under the Dress button, for any living pet that shows gear */
  function petPage() { return !!(d.body && d.body.getAttribute('data-v2page') === 'pet'); }
  function petIdNow() { var q = +(new URLSearchParams(location.search).get('id') || 0); if (q >= 1) return q; var m = String(location.pathname || '').match(/\/pet\/(\d+)\/?$/); return m ? +m[1] : (root.__XCPETS_PET_ID >= 1 ? +root.__XCPETS_PET_ID : 0); }
  function pageWorld() { try { var M = root.V2Mock, w = M && M.world && M.world(); return w && !w.pending ? w : null; } catch (e) { return null; } }
  function petFitBtn() { if (!petPage() || !RL() || !WD()) return; var anchor = $('pcDress') || $('pcActs'); if (!anchor) return; var b = $('clFitBtn'), w = pageWorld(), p = w && w.byId && w.byId[petIdNow()];
    if (!b) { b = d.createElement('button'); b.type = 'button'; b.id = 'clFitBtn'; b.className = 'q clfitbtn'; b.hidden = true; b.innerHTML = '📸 Fit check <small>rate-my-fit card for Telegram</small>'; b.onclick = function () { var w2 = pageWorld(), p2 = w2 && w2.byId[petIdNow()]; if (p2) fitCheck(w2, p2, b); }; }
    if (b.previousSibling !== anchor) anchor.parentNode.insertBefore(b, anchor.nextSibling);
    b.hidden = !(p && !p.dead && !p.released && p.art && Object.keys(shownBySlot(w, p)).length); }

  var CSS = '.cl-note{margin:2px 0 8px;font-size:13px;color:#c3b4e0;line-height:1.4}.cl-note b{color:#ffd166}' +
    '.cl-lrow{width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer}.cl-lrow.on{border-color:#7fd8ff}.cl-n{font-family:"Press Start 2P",monospace;font-size:9px;color:#c3b4e0;white-space:nowrap}' +
    '.cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;padding:4px 2px 8px 14px}.cl-tile{display:flex;flex-direction:column;align-items:center;gap:3px;min-height:72px;padding:6px 4px;background:#160c28;color:#f3eaff;border:2px solid #3a2560;border-bottom:4px solid var(--rc,#3a2560);border-radius:8px;cursor:pointer;font:inherit;font-size:11px;line-height:1.15;text-align:center}' +
    '.cl-tile span{overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}.cl-tile.on{border-color:#7fd8ff;box-shadow:0 0 0 2px #7fd8ff inset}.cl-real,.cl-hide{font-size:22px;justify-content:center}.cl-real span,.cl-hide span{font-size:11px}' +
    '.cl-ic{image-rendering:pixelated;background:#140a22;border-radius:4px}.cl-ic0{display:inline-block}.cl-none{grid-column:1/-1;margin:4px 0}' +
    '.cl-fits{display:flex;flex-direction:column;gap:6px}.cl-fit{display:flex;align-items:center;gap:10px;padding:6px 8px;background:#2a1748;border:2px solid #3a2560;border-radius:8px}.cl-fit.preset{border-style:dashed}' +
    '.cl-fit canvas{width:56px;height:56px;image-rendering:pixelated;border-radius:6px;background:#160c28;flex:0 0 auto}.cl-ftxt{flex:1;min-width:0;display:flex;flex-direction:column}.cl-ftxt b{font-family:Bangers,cursive;font-weight:400;font-size:20px;letter-spacing:1px;color:#ffd166;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cl-ftxt small{font-size:12px;color:#c3b4e0}' +
    '.cl-put{min-height:40px;padding:6px 12px!important;font-size:12px!important}.cl-put:disabled{opacity:.5}.cl-del{min-width:40px;min-height:40px}' +
    '.dz-tabs{display:flex;gap:6px;padding:2px 14px 8px}.dz-tab{flex:1;min-height:40px;font-family:"Press Start 2P",monospace;font-size:9px;background:#160c28;color:#c3b4e0;border:2px solid #3a2560;border-radius:8px;cursor:pointer}.dz-tab[aria-pressed=true]{background:#ffd166;color:#2a1530;border-color:#000;box-shadow:2px 2px 0 #000}' +
    '#clFitBtn{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;gap:2px 8px;width:100%;margin:4px 0;min-height:44px}#clFitBtn small{font-size:12px;opacity:.8}#clFitBtn[hidden]{display:none}html.viewonly #clSelBtn{display:none!important}';
  function css() { if (!d || $('clCss')) return; var s = d.createElement('style'); s.id = 'clCss'; s.textContent = CSS; (d.head || d.documentElement).appendChild(s); }
  function tick() { try { css(); hookBar(); petFitBtn(); } catch (e) { } }
  function start() { if (!d) return; var go = function () { tick(); setInterval(tick, 1500); }; if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go(); }
  return { start: start, sets: sets, setOf: setOf, setProgress: setProgress, DRAFT_SETS: DRAFT_SETS, owned: owned, fits: fits, looksFor: looksFor, lookOf: lookOf, setLook: setLook, clearLooks: clearLooks,
    outfits: outfits, allFits: allFits, saveOutfit: saveOutfit, delOutfit: delOutfit, planOutfit: planOutfit, applyPlan: applyPlan, snapshot: snapshot, shownBySlot: shownBySlot,
    body: body, foot: foot, act: act, paint: paint, fitCard: fitCard, fitCheck: fitCheck, pickSheet: pickSheet, icon: icon, silhouette: silhouette, label: label, stars: stars, css: css, TCOL: TCOL, TIERS: TIERS };
});
