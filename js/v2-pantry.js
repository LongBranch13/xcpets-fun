/* XCPETS Pantry (prepaid meals; owner Jake Nov 22 2026: "prepay is cool", picked "Only pets the player picks").
 * UI only. The rule lives in js/v2-rules.js (ACTIVATE_PANTRY_BLOCK, pet:pantry / pet:pp / pet:px). While the gate is null this panel stays hidden
 * (?pantry=preview shows it read-only for screenshots). The site never signs: Save opens the usual sign sheet (V2UI.confirmPlans).
 * On Play, under the Today card:
 *   - one line: balance, pets on the list, how long it lasts, when the next serving is;
 *   - Open: put XCPETS in (quick chips or any amount) and pick pets with the shared big picker (js/v2-pick.js):
 *     shelves "On the list", "Hungry now", "All my pets". Tapping a card marks it to go on (➕) or come off (➖); one Save burn does it all.
 * At the first block of every game day the pantry feeds the listed pets that are hungry, hungriest first, while the balance pays. */
(function () {
  'use strict';
  var d = document, $ = function (id) { return d.getElementById(id); }, U = function () { return window.V2UI; }, V = function () { return window.V2Rules; };
  var PREVIEW = /[?&]pantry=preview/.test(location.search), CHIPS = [500, 2000, 10000];
  var st = { open: false, shelf: 'list', add: new Set(), del: new Set(), amount: '', pk: {}, seen: '' };
  function fmt(n) { n = Number(n) || 0; return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 8 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function css() { if ($('ppCss')) return; var s = d.createElement('style'); s.id = 'ppCss'; s.textContent =
    '#pantryCard{margin:10px auto;max-width:980px;border:3px solid #2b2b2b;box-shadow:4px 4px 0 #2b2b2b;border-radius:10px;padding:12px;background:#fff7e0;color:#2b2b2b}' +
    '#pantryCard h3{margin:0 0 6px;font:13px/1.5 "Press Start 2P",monospace}#pantryCard .pp-line{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:14px}' +
    '#pantryCard .pp-line b{font-weight:800}#pantryCard .pp-open{margin-left:auto;font:11px "Press Start 2P",monospace;padding:10px 12px;border:3px solid #2b2b2b;border-radius:10px;background:#ffe27a;color:#2b2b2b;box-shadow:0 3px 0 #2b2b2b;cursor:pointer;min-height:44px}' +
    '#pantryCard .pp-warn{color:#a3261b;font-weight:700}#pantryCard .pp-help{font-size:13px;margin:8px 0;opacity:.85}' +
    '#pantryCard .pp-fill{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}#pantryCard .pp-fill input{width:130px;min-height:44px;font:inherit;font-weight:700;padding:0 8px;border:2px solid #2b2b2b;border-radius:8px}' +
    '#pantryCard .pp-chip{min-height:44px;padding:0 12px;font:inherit;font-weight:700;border:2px solid #2b2b2b;border-radius:22px;background:#fff;cursor:pointer}#pantryCard .pp-chip.on{background:#3ddc84}' +
    '#pantryCard .pp-save{display:block;width:100%;margin-top:10px;min-height:48px;font:12px/1.5 "Press Start 2P",monospace;border:3px solid #2b2b2b;border-radius:10px;background:#3ddc84;color:#04130a;box-shadow:0 4px 0 #2b2b2b;cursor:pointer}' +
    '#pantryCard .pp-save[disabled]{opacity:.5;cursor:default}#pantryCard .pp-sum{font-size:13px;margin-top:6px;text-align:center}' +
    '@media (max-width:520px){#pantryCard .pp-open{margin-left:0;width:100%}}';
    d.head.appendChild(s); }
  function ctx() { var u = U(), v = V(); if (!u || !v || !v.pantryGate || !u.world) return null; var w = u.world(); if (!w || !u.ME) return null;
    var tip = (u.S && u.S().tip) || w.tip || 0, nb = tip + 1, gate = v.pantryGate(); return { u: u, v: v, w: w, me: u.ME, nb: nb, gate: gate, live: gate != null && nb >= gate }; }
  function blocksTo(b, nb) { var n = Math.max(0, b - nb + 1), h = Math.round(n * 10 / 60); return n + ' block' + (n === 1 ? '' : 's') + (h >= 1 ? ' (~' + h + 'h)' : ''); }
  function info(c) { var I = c.v.pantryInfo(c.w, c.me, c.nb); return I || { on: false, bal: 0, ids: [], eat: [], daily: 0, days: null, nextFeed: c.v.dayStart ? c.v.dayStart(Math.floor(c.nb / 144) + 1) : null, meals: 0, spent: 0, last: null }; }
  function line(c, I) { var n = I.ids.length;
    if (!c.live) return c.gate == null ? 'Preview: the Pantry opens when the rule goes live.' : 'The Pantry opens at block ' + fmt(c.gate) + ' (' + blocksTo(c.gate, c.nb) + ').';
    if (!n && !(I.bal > 0)) return 'Prepay meals and the pantry feeds the pets you pick at the start of every game day. No more daily feeding burns.';
    return '<span>💰 <b>' + fmt(I.bal) + '</b> XCPETS</span><span>🐾 <b>' + fmt(n) + '</b> pet' + (n === 1 ? '' : 's') + ' on the list</span>' +
      (I.daily > 0 ? '<span>🍽️ ~' + fmt(I.daily) + ' a day · ' + (I.days >= 1 ? 'lasts ~<b>' + I.days + '</b> day' + (I.days === 1 ? '' : 's') : '<span class="pp-warn">not enough for the next serving</span>') + '</span>' : '<span>🍽️ nobody on the list is hungry</span>') +
      (I.nextFeed ? '<span>⏰ next serving in ' + blocksTo(I.nextFeed, c.nb) + '</span>' : '') +
      (I.last && I.last.short ? '<span class="pp-warn">' + I.last.short + ' pet' + (I.last.short === 1 ? '' : 's') + ' went without last time: top up</span>' : ''); }
  /* the picker's lists: my pets the pantry can feed (the eater list the tags count over), newest-hungry first */
  /* canEat(v, w, p, me, b): will the Pantry ever feed this pet? The SAME test as the rules' pantryEats/pantryInfo (js/v2-rules.js): not a zombie,
   * not dead or discarded on chain, not a Mythic (Mythics don't take normal meals), not away on a quest, and still mine. Nov 24 2026: the picker
   * used to offer every pet of the tag list, zombies and Mythics too, which then never ate. tools/pantry-interactions-test.js checks the two agree. */
  function canEat(v, w, p, me, b) { if (!p || p.community || p.released || p.owner !== me || p.dead || p.ascended || p.mythicCare || p.stage === 5) return false;
    if (v.isZ && v.isZ(p)) return false; if (V2Own.onChain(p, me) && (!v.hdOn || v.hdOn(b))) return false;
    if (v.questOn && v.questAway && v.questOn(b) && v.questAway(p, b)) return false; return true; }
  function lists(c, I) { var ref = (c.v.refList ? c.v.refList(c.w, c.me, c.w.tip, c.nb) : []).filter(function (p) { return canEat(c.v, c.w, p, c.me, c.nb) || I.ids.indexOf(p.id) >= 0; }), on = new Set(I.ids), eat = new Set(I.eat);
    var item = function (p) { var listed = on.has(p.id), add = st.add.has(p.id), del = st.del.has(p.id), will = (listed && !del) || add;
      return { p: p, key: p.id, tag: add ? '➕ goes on' : del ? '➖ comes off' : listed ? '🥫 on the list' : '', tagMe: will, line: !canEat(c.v, c.w, p, c.me, c.nb) ? 'can\'t eat from the pantry: take it off' : eat.has(p.id) ? 'eats next serving' : p.hungry ? 'hungry' : '' }; };
    var L = { list: [], hungry: [], all: [] }; ref.forEach(function (p) { var x = item(p); L.all.push(x); if (on.has(p.id) || st.add.has(p.id)) L.list.push(x); else if (p.hungry) L.hungry.push(x); });
    return L; }
  function full(c) { return !c.w._view || c.w._full; } /* pet:pp counts places in the full list of your pets: wait until every page is in */
  function paint() { var c = ctx(), box = $('pantryCard'); var sp = d.querySelector('[data-split]'); if (!c || (c.gate == null && !PREVIEW) || window.XcpPractice || (sp && sp.getAttribute('data-split') !== 'play')) { /* Play page only: the place pages share the template */ if (box) box.style.display = 'none'; return; }
    var host = $('todayCard') || d.querySelector('main'); if (!host) return; css();
    if (!box) { box = d.createElement('section'); box.id = 'pantryCard'; box.setAttribute('aria-label', 'Pantry'); if (host.id === 'todayCard') host.parentNode.insertBefore(box, host.nextSibling); else host.insertBefore(box, host.firstChild); }
    box.style.display = ''; var I = info(c), key = [c.nb, c.me, I.bal, I.ids.length, I.daily, st.open, st.shelf, st.add.size, st.del.size, st.amount, full(c)].join('|');
    if (key === st.seen && box.firstChild) return; st.seen = key;
    var h = '<h3>🥫 Pantry: prepaid meals</h3><div class="pp-line">' + line(c, I) + (c.live || PREVIEW ? '<button type="button" class="pp-open" data-pp="open">' + (st.open ? 'Close' : 'Open the pantry') + '</button>' : '') + '</div>';
    if (st.open) {
      h += '<p class="pp-help">Put XCPETS in, then pick which pets eat from it. At the start of every game day the pantry feeds your listed pets that are hungry, hungriest first, at that day\'s meal price. ' +
        'XCPETS in the pantry stay there until pets eat them (they can\'t be taken back out). Mythics, zombies, pets on a quest and discarded pets never eat from it.</p>' +
        '<div class="pp-fill"><b>Add XCPETS:</b>' + CHIPS.map(function (a) { return '<button type="button" class="pp-chip' + (String(st.amount) === String(a) ? ' on' : '') + '" data-ppamt="' + a + '">' + fmt(a) + '</button>'; }).join('') +
        '<input type="number" min="0" step="any" inputmode="decimal" placeholder="other amount" aria-label="XCPETS to add" data-ppin value="' + esc(st.amount) + '">' +
        (I.daily > 0 && Number(st.amount) > 0 ? '<span>≈ ' + Math.floor((I.bal + Number(st.amount)) / I.daily) + ' days for the list</span>' : '') + '</div><div id="ppPick"></div>';
    }
    box.innerHTML = h; bind(box, c);
    if (st.open) pick(c, I); }
  function pick(c, I) { var el = $('ppPick'), P = window.V2Pick; if (!el) return;
    if (!full(c)) { el.innerHTML = '<p class="pp-help">Loading all your pets… (picking needs the whole list so the tag points at the right pets)</p>' + saveHtml(c); bindSave(c); return; }
    if (!P) { el.innerHTML = '<p class="pp-help">The pet picker is still loading.</p>'; return; }
    var L = lists(c, I), sum = changes();
    P.render(el, { id: 'pantry', w: c.w, slots: [], prompt: 'Tap pets to put them on or take them off the list', shelf: st.shelf,
      shelves: [{ id: 'list', label: '🥫 On the list (' + fmt(L.list.length) + ')', list: L.list, why: 'Tap a pet to take it off.', empty: 'Nobody yet. Pick from Hungry now or All my pets.' },
        { id: 'hungry', label: '😋 Hungry now (' + fmt(L.hungry.length) + ')', hot: L.hungry.length > 0, list: L.hungry, why: 'Hungry pets not on the list yet. Tap to add.', empty: 'No hungry pet outside the list.' },
        { id: 'all', label: '🐾 All my pets (' + fmt(L.all.length) + ')', list: L.all, why: 'Every pet the pantry can feed.' }],
      searchList: L.all, onShelf: function (id) { st.shelf = id; st.seen = ''; paint(); }, onRedraw: function () { st.seen = ''; paint(); },
      onPick: function (x) { var id = x.p.id, listed = I.ids.indexOf(id) >= 0;
        if (listed) { if (st.del.has(id)) st.del.delete(id); else st.del.add(id); } else { if (st.add.has(id)) st.add.delete(id); else st.add.add(id); }
        st.seen = ''; paint(); },
      extra: '<p class="pp-sum">' + sum + '</p>' + saveHtml(c) }, st.pk);
    bindSave(c); }
  function changes() { var a = st.add.size, r = st.del.size, amt = Number(st.amount) || 0, bits = [];
    if (amt > 0) bits.push('add ' + fmt(amt) + ' XCPETS'); if (a) bits.push('put ' + a + ' pet' + (a === 1 ? '' : 's') + ' on'); if (r) bits.push('take ' + r + ' off');
    return bits.length ? 'Save will ' + bits.join(', ') + '.' : 'Pick an amount or some pets, then Save.'; }
  function saveHtml(c) { var any = (Number(st.amount) || 0) > 0 || st.add.size || st.del.size; return '<button type="button" class="pp-save" data-pp="save"' + (any && c.live ? '' : ' disabled') + '>🥫 Save to the pantry</button>'; }
  function bind(box, c) { box.querySelectorAll('[data-pp="open"]').forEach(function (b) { b.onclick = function () { st.open = !st.open; st.seen = ''; paint(); }; });
    box.querySelectorAll('[data-ppamt]').forEach(function (b) { b.onclick = function () { st.amount = String(st.amount) === b.dataset.ppamt ? '' : b.dataset.ppamt; st.seen = ''; paint(); }; });
    var inp = box.querySelector('[data-ppin]'); if (inp) inp.onchange = function () { st.amount = inp.value; st.seen = ''; paint(); }; }
  function bindSave(c) { var b = d.querySelector('#pantryCard [data-pp="save"]'); if (b) b.onclick = function () { save(); }; }
  function save() { var c = ctx(); if (!c || !c.live) return; var u = c.u;
    if (u.viewBlock && u.viewBlock()) return; if (!full(c)) return u.toast('Still loading all your pets. Try again in a moment.');
    var P = c.v.pantryPlan(c.w, c.me, { amount: Number(st.amount) || 0, add: Array.from(st.add), del: Array.from(st.del) });
    if (!P || !P.plans.length) return u.toast(P && P.skipped.length ? 'Those pets can\'t eat from the pantry (Mythic, zombie, dead or not yours).' : 'Nothing to save.');
    var why = u.sendWhy(P.plans[0]); if (why) return u.toast('⚠️ ' + why);
    u.confirmPlans('🥫 Pantry', P.plans, function () { u.toast('🥫 Sent. The pantry changes when the burn confirms.'); st.add.clear(); st.del.clear(); st.amount = ''; st.seen = ''; paint(); });
    if (P.skipped.length) u.toast(P.skipped.length + ' pet' + (P.skipped.length === 1 ? '' : 's') + ' left out: they can\'t eat from the pantry.'); }
  setInterval(paint, 2000); setTimeout(paint, 300);
  window.V2Pantry = { paint: paint, state: function () { return st; }, canEat: canEat };
})();
