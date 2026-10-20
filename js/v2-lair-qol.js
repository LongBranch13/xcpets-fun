/* XCPETS Lair quality-of-life (tonight bundle 2026-10-19, front-page-entries; NOT LIVE). Display + the SAME free local equip op only; no burns, no rule change.
 * 1) Chip strip: slot chips (Locks/Leverage/Layers/Luster/Looks/Leathers) + Rarity up/down + Newest narrow/sort the shelves. Saved per wallet in localStorage.
 * 2) Recently viewed: the last 6 pieces tapped on the shelves (localStorage, per wallet, clearable). Tap one to select it again.
 * 3) ⚡ Equip Best: fills every open slot of the chosen pet with its strongest owned free piece (same metric as the per-slot 'Wear best':
 *    gear damage 1 + 2 x tier; OWNER DECISION: stats vs Pet Score impact), one undo tap restores the previous outfit. */
(function () {
  'use strict';
  var SLOTS = [['head', 'Locks'], ['hand', 'Leverage'], ['body', 'Layers'], ['back', 'Luster'], ['face', 'Looks'], ['feet', 'Leathers']];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function me() { return (window.V2UI && V2UI.ME) || 'anon'; }
  function get(k, d) { try { var v = JSON.parse(localStorage.getItem('xcpets-lair-' + k + '-' + me())); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem('xcpets-lair-' + k + '-' + me(), JSON.stringify(v)); } catch (e) { } }
  function slotOf(g) { var V = window.V2Rules, it = V && (V.GEAR_BY_ID || {})[g.item]; return g.slot || (it && it.slot) || null; }
  function tierOf(g) { var V = window.V2Rules, it = V && (V.GEAR_BY_ID || {})[g.item]; return g.tier != null ? g.tier : it ? it.tier || 0 : 0; }
  function gnum(g) { var m = /(\d+)/.exec(String(g.gid)); return m ? +m[1] : 0; }
  /** apply(items) -> the filtered/sorted shelf list (free pieces first, as before) */
  function apply(items) { var f = get('filter', { slot: null, sort: null }), L = items.filter(function (g) { return !f.slot || slotOf(g) === f.slot; });
    if (f.sort === 'up') L.sort(function (a, b) { return tierOf(a) - tierOf(b) || gnum(a) - gnum(b); }); else if (f.sort === 'down') L.sort(function (a, b) { return tierOf(b) - tierOf(a) || gnum(a) - gnum(b); }); else if (f.sort === 'new') L.sort(function (a, b) { return gnum(b) - gnum(a); });
    return L.filter(function (g) { return g.on == null; }).concat(L.filter(function (g) { return g.on != null; })); }
  function viewed(g) { if (!g || g.gid == null) return; var R = get('recent', []).filter(function (x) { return x !== String(g.gid); }); R.unshift(String(g.gid)); set('recent', R.slice(0, 6)); var w = window.V2UI && V2UI.world(); if (w) mount(w); }
  var UNDO = null;
  function bestPlan(w, P) { var V = window.V2Rules, ME = V2UI.ME, D = V2Shop.dmg, free = (w.itemList || []).filter(function (x) { return x.owner === ME && x.on == null; }), worn = V.wornOf(w, P.id), out = [];
    (P.openSlots || []).forEach(function (sl) { var cur = worn.filter(function (x) { return x.slot === sl; })[0], c0 = cur ? D(cur.item) : 0;
      var best = free.filter(function (x) { var it = (V.GEAR_BY_ID || {})[x.item]; return it && it.slot === sl && V.equipCheck(w, ME, P.id, x.item).ok; }).sort(function (a, b) { return D(b.item) - D(a.item); })[0];
      if (best && D(best.item) > c0) out.push({ sl: sl, gid: V.equipCheck(w, ME, P.id, best.item).gid, prev: cur ? cur.gid : null, d: D(best.item) - c0 }); });
    return out; }
  function push(pid, list, key) { var U = window.V2UI, St = U.S(); list.forEach(function (o) { St.ops.push({ kind: 'equip', owner: U.ME, petId: pid, slot: o.sl, gid: o[key], block_index: St.tip }); }); U.save(); U.render(); }
  function equipBest() { var U = window.V2UI, w = U.world(); if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); var st = V2Shop._state(), P = w.byId[st.pet != null ? st.pet : st.rollPet] || U.mine(w).filter(function (p) { return !p.dead; })[0];
    if (!P) return U.toast('No pet to dress'); var plan = bestPlan(w, P); if (!plan.length) return U.toast('#' + P.id + ' already wears its best');
    var before = V2Shop.dmg ? window.V2Rules.wornOf(w, P.id).reduce(function (s, x) { return s + V2Shop.dmg(x.item); }, 0) : 0, gain = plan.reduce(function (s, o) { return s + o.d; }, 0);
    UNDO = { pid: P.id, plan: plan }; push(P.id, plan, 'gid'); st.say = '\ud83d\udc4d Best kit on!'; st.lt = performance.now(); st.mood = 'up'; st.moodUntil = performance.now() + 2500;
    U.toast('\u26a1 Equip Best on #' + P.id + ': \u2694 ' + before + ' \u2192 ' + (before + gain) + ' (+' + gain + ', ' + plan.length + ' slot' + (plan.length > 1 ? 's' : '') + ', free)'); mount(U.world()); }
  function undo() { if (!UNDO) return; var u = UNDO; UNDO = null; push(u.pid, u.plan, 'prev'); window.V2UI.toast('\u21a9 Outfit restored on #' + u.pid + ' (free)'); mount(window.V2UI.world()); }
  function mount(w) { var el = document.getElementById('lairQol'); if (!el || !w) return; var f = get('filter', { slot: null, sort: null }), R = get('recent', []), byG = {};
    (w.itemList || []).forEach(function (g) { if (g.owner === V2UI.ME) byG[String(g.gid)] = g; }); R = R.filter(function (k) { return byG[k]; });
    var chip = function (k, v, lbl, on) { return '<button type="button" class="lq-chip' + (on ? ' on' : '') + '" data-lq="' + k + ':' + v + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + lbl + '</button>'; };
    var h = '<div class="lq-strip" role="toolbar" aria-label="Filter and sort the shelves">' + chip('slot', '', 'All', !f.slot) + SLOTS.map(function (s) { return chip('slot', s[0], s[1], f.slot === s[0]); }).join('') +
      chip('sort', 'down', 'Rarest first', f.sort === 'down') + chip('sort', 'up', 'Common first', f.sort === 'up') + chip('sort', 'new', 'Newest', f.sort === 'new') + '</div>';
    h += '<div class="lq-row"><button type="button" class="btn ico-flame lq-best" id="lqBest">\u26a1 Equip Best</button>' + (UNDO ? '<button type="button" class="q" id="lqUndo">\u21a9 Undo</button>' : '') +
      (R.length ? '<span class="lq-rv"><span class="lq-rvh">Recent</span>' + R.map(function (k) { var src = ''; try { src = V2Render.iconCanvas(byG[k].item).toDataURL(); } catch (e) { } return '<button type="button" class="lq-rvi" data-lqr="' + esc(k) + '" title="' + esc(byG[k].label || byG[k].item) + '">' + (src ? '<img src="' + src + '" alt="" width="24" height="24">' : '?') + '</button>'; }).join('') + '<button type="button" class="q lq-clr" id="lqClr" title="Clear recently viewed">\u2715</button></span>' : '') + '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-lq]').forEach(function (b) { b.onclick = function () { var q = b.dataset.lq.split(':'), F = get('filter', { slot: null, sort: null }); if (q[0] === 'slot') F.slot = q[1] || null; else F.sort = F.sort === q[1] ? null : q[1]; set('filter', F); V2Shop.render(V2UI.world()); }; });
    el.querySelectorAll('[data-lqr]').forEach(function (b) { b.onclick = function () { var g = byG[b.dataset.lqr]; if (g) V2Shop.select(g); }; });
    var x = document.getElementById('lqBest'); if (x) x.onclick = equipBest; x = document.getElementById('lqUndo'); if (x) x.onclick = undo; x = document.getElementById('lqClr'); if (x) x.onclick = function () { set('recent', []); mount(V2UI.world()); }; }
  var CSS = '.lq-strip{display:flex;gap:6px;overflow-x:auto;padding:4px 0 6px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}.lq-chip{flex:0 0 auto;font-family:"Press Start 2P",monospace;font-size:9px;padding:8px 9px;min-height:34px;background:#2a1530;color:#ffd166;border:2px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer}.lq-chip.on{background:#ffd166;color:#140f24}' +
    '.lq-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:2px 0 6px}.lq-rv{display:inline-flex;align-items:center;gap:4px}.lq-rvh{font-family:"Press Start 2P",monospace;font-size:8px;color:#9fe8ff}.lq-rvi{width:34px;height:34px;padding:3px;background:#140f24;border:2px solid #000;cursor:pointer}.lq-rvi img{image-rendering:pixelated;display:block}' +
    'html.viewonly #lqBest,html.viewonly #lqUndo{display:none!important}@media (max-width:520px){.lq-strip{flex-wrap:nowrap}.lq-chip{font-size:9px}}';
  if (typeof document !== 'undefined' && !document.getElementById('lqCss')) { var s = document.createElement('style'); s.id = 'lqCss'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  window.V2LairQoL = { apply: apply, viewed: viewed, mount: mount, bestPlan: bestPlan, equipBest: equipBest, undo: undo };
})();
