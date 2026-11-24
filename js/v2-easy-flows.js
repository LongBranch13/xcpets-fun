/* XCPETS easy flows (branch easy-flows, 2026-10-22; owner 12:23 AM CT: make battles and breeding 'easy' like the Rare Room). DISPLAY + PICKING ONLY.
 * Battle (X Circus Kekimus): 'Your fighter' portrait strip + search -> opponent portraits (Suggested / Challenging you / Any pet) -> one big button.
 *   The button uses the SAME paths as before: Challenge = UXB face-off state + #foGo (-> #fMine/#fTheirs -> #fGo -> pet:fight:A:B 690);
 *   Accept = confirmPlans('Accept fight N', [{ tag: 'pet:accept:N', amount: 690 }]) like the Incoming tab; Quick match = the existing #arQuick.
 * Breeding (Gooby's No-Tail Motel): 'Parent 1' strip -> mate portraits (My other pets / Asking you / Other wallets) -> one big button.
 *   Check in = the existing #bGo bell (#bA/#bB -> pet:breed:A:B 690); a request at the desk = the existing #motelReqs Accept button.
 *   Breeding v2 info (breeds left of 6, inbreeding guard) only from V2Rules.breedV2On; generation + breeder badges are display only.
 * No new tags, amounts, rules or gates. The site never signs; the confirm pop-up and the wallet are unchanged. No dropdown menus in these panels. */
(function () {
  'use strict';
  /* power-tooltip-values (Oct 25 2026, display only): hovers show the pet's real numbers (js/v2-power-tip.js) */
  function ptA(p) { return window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.power(p)) : ''; } 
  var $ = function (id) { return document.getElementById(id); }, U = function () { return window.V2UI; }, V = function () { return window.V2Rules; };
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'], MAX = 48;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pow(p) { return window.UXB && UXB.power ? UXB.power(p) : 0; }
  function score(w, p) { var s = window.PetScore && PetScore.of(w, p); return s ? s.score : 0; }
  function spL(s) { return V().speciesLabel ? V().speciesLabel(s) : s; }
  function short(a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 6) + '\u2026' + a.slice(-4) : a; }
  function tip(w) { return (U().S && U().S().tip) || w.tip || 0; }
  function match(p, q) { if (!q) return true; q = q.toLowerCase().replace(/^#/, ''); return String(p.id).indexOf(q) === 0 || String(p.name || '').toLowerCase().indexOf(q) >= 0 || (q.length >= 4 && String(p.owner || '').toLowerCase().indexOf(q) === 0) || spL(p.species).toLowerCase().indexOf(q) === 0; }
  var ST = { f: { qa: '', qb: '', tab: '', inc: null, msg: '' }, b: { qa: '', qb: '', tab: '', req: null, sa: 'pow', sb: 'mate', fsp: '', fst: '', frar: '', fall: false, fslot: false, ways: null } };
  /* hotel-mate-sort 2026-10-24: Sort dropdown on both breed lists, same options + logic as the egg review (js/pet-sort.js PetSort). Default stays
   * Power: high to low (= the old Pet Score order). Base order = hatch order (hatch block, then #id), so 'Hatch order' and every tie keep it. */
  function hatchOrd(arr, pet) { return arr.slice().sort(function (x, y) { var a = pet(x), b = pet(y); return (a.hatchBlock || 0) - (b.hatchBlock || 0) || a.id - b.id; }); }
  function psort(w, arr, k, pet, b) { var h = hatchOrd(arr, pet); return window.PetSort ? PetSort.sort(w, h, k, pet, b) : h; }
  function sortSel(id, k, title) { return window.PetSort ? '<label class="ez-so">Sort <xc-select id="' + id + '" aria-label="Sort ' + esc(title) + '">' + (PetSort.hotelOptions ? PetSort.hotelOptions(k) : PetSort.options(k)) + '</xc-select></label>' : ''; }
  /* hotel-breed-power 2026-10-24 (preview, display only): egg Power for Parent 1 + each mate from js/egg-power.js (the real breedChild math, no hash, so a spread not one egg) */
  var EGGK = [['mate', '🥚 Best mate for Power', 'best first'], ['egg', '🥚 Egg Power', 'high to low'], ['egg-', '🥚 Egg Power', 'low to high'], ['pass', '🧬 Traits passed', 'most first']];
  function eggOf(A, B, b) { try { return A && B && A.id !== B.id && window.EggPower ? EggPower.preview(A, B, b) : null; } catch (e) { return null; } }
  function eggSort(arr, k, A, pet, b) { var m = arr.map(function (x, i) { var e = eggOf(A, pet(x), b); return { x: x, i: i, v: !e ? [-1e9, -1e9] : k === 'mate' ? [e.exp, e.lo] : k === 'pass' ? [e.passes.length, e.exp] : [e.hi, e.exp] }; }), dir = k === 'egg-' ? -1 : 1;
    m.sort(function (p, q) { for (var j = 0; j < 2; j++) if (p.v[j] !== q.v[j]) return dir * (q.v[j] - p.v[j]); return p.i - q.i; }); return m.map(function (o) { return o.x; }); }
  function sortSelMate(id, k, A) { var base = sortSel(id, EGGK.some(function (e) { return e[0] === k; }) ? 'x' : k, 'Mate'); if (!base || !A || !window.EggPower) return base;
    var eg = '<optgroup label="For Parent 1 #' + A.id + '">' + EGGK.map(function (e) { return '<option value="' + e[0] + '"' + (k === e[0] ? ' selected' : '') + '>' + e[1] + ': ' + e[2] + '</option>'; }).join('') + '</optgroup>';
    return base.replace(/(<xc-select[^>]*>)/, '$1' + eg); }
  function eggLine(e) { if (!e) return null; return '🥚 egg ⚡ ~' + (e.expHi > e.exp ? Math.round(e.exp) + '-' + Math.round(e.expHi) : Math.round(e.exp)) + ' (' + e.lo + ' to ' + e.hi + ')'; }
  function eggTags(e) { if (!e) return null; var t = []; if (e.hybridPct) t.push('keeps best stats ' + Math.round(e.hybridPct) + '%'); if (e.bredTrue) t.push('bred true +3'); if (e.passes.some(function (x) { return /^Carried/.test(x); })) t.push('carried floor'); if (e.passes.some(function (x) { return /^Hidden/.test(x); })) t.push('hidden trait'); return t.length ? '🧬 ' + t.join(' · ') : null; }
  /* breed-roles (Nov 22 2026, players: "which pet is the egg and which is the carrier?"). Display only. Who gets what, in one look, before the burn.
   * Mirrors js/v2-rules.js breed(): in a TWO-OWNER breed the wallet that asked first gets the egg; the other wallet's pet becomes a CARRIER of the
   * asker's pet's best stat (picked on shardView(A,1) with carry-pick + shards on, else A.stats; first max in key order; value from shardView when
   * shards are on) and every later egg of the carrier gets at least that value in that stat. Same owner: the egg is yours and nobody carries. */
  var STAT_NM = { vigor: 'Vigor', spark: 'Spark', grit: 'Grit', zoom: 'Zoom', luck: 'Luck' };
  function carryOf(A, b) { var V = window.V2Rules || {}; if (!A || !A.stats) return null;
    var sh = !!(V.shardsOn && V.shardsOn(b) && V.shardView), view = sh ? V.shardView(A, 1).stats : A.stats, CS = V.carryPickOn && V.carryPickOn(b) && sh ? view : A.stats, ks = Object.keys(CS);
    if (!ks.length) return null; var bk = ks.reduce(function (m, k) { return CS[k] > CS[m] ? k : m; }, ks[0]); return { stat: bk, value: view[bk] }; }
  function rolesBox(mine, theirs, mode, b) { if (!mine || !theirs) return '';
    var nm = function (p) { return '<b>' + esc(p.name || 'Pet') + '</b> <span class="ez-id">#' + p.id + '</span>'; }, sp = function (p) { return '<span class="ez-rsp" data-ezsp="' + p.id + '"></span>'; };
    if (mode === 'same') return '<div class="ez-roles same" role="note"><div class="ez-rh">WHO GETS WHAT</div><div class="ez-rr"><div class="ez-rc egg">' + sp(mine) + sp(theirs) + '<div class="ez-rt"><span class="ez-rb">🥚 THE EGG IS YOURS</span><small>Both pets are yours, so nobody becomes a carrier.</small></div></div></div></div>';
    var asker = mode === 'ask' ? mine : theirs, carrier = mode === 'ask' ? theirs : mine, c = carryOf(asker, b), st = c ? STAT_NM[c.stat] || c.stat : 'its best stat', v = c ? ' ' + c.value : '';
    return '<div class="ez-roles" role="note"><div class="ez-rh">WHO GETS WHAT</div><div class="ez-rr">' +
      '<div class="ez-rc egg">' + sp(asker) + '<div class="ez-rt"><span class="ez-rb">🥚 GETS THE EGG</span>' + nm(asker) + '<small>' + (mode === 'ask' ? 'You asked first, so the egg lands in <b>your</b> wallet.' : 'They asked first, so the egg goes to <b>their</b> wallet.') + '</small></div></div>' +
      '<div class="ez-rc car">' + sp(carrier) + '<div class="ez-rt"><span class="ez-rb">🧬 BECOMES A CARRIER</span>' + nm(carrier) + '<small>' + (mode === 'ask' ? 'Their pet' : 'Your pet') + ' learns <b>' + esc(st + v) + '</b> from #' + asker.id + '. Every future egg of #' + carrier.id + ' gets at least ' + esc(st + v) + '.</small></div></div>' +
      '</div></div>'; }
  /* special-baby note (Nov 23 2026, a player bred Rarepigeon x Star-Lord Kek and got a Snibby: "is this a bug?"). Display only, before the burn.
   * Mirrors js/v2-rules.js contestParents(): a special 1 of 1 pet (V2Rules.isContestSp: Rarepigeon, Bo Jackson, Bo Pigeon, Star-Lord Kek ...) never passes on
   * its own species. With a normal partner the baby is the partner's species; two special parents roll ONE random normal species (never a hybrid, never Nakamoto).
   * Looks: V2Rules.crossOf (1 of 1 cross body) and, once that rules change is live, V2Rules.specialPairOf (special x special mix) say what the baby looks like. */
  function specialNote(A, B, b) { var V = window.V2Rules || {}; if (!A || !B || !V.isContestSp) return '';
    var sa = V.isContestSp(A.species), sb = V.isContestSp(B.species); if (!sa && !sb) return '';
    var lab = function (p) { return esc(V.speciesLabel ? V.speciesLabel(p.species) : p.species); }, look = null;
    try { if (V.specialPairOf && V.specialPairOn && V.specialPairOn(b)) look = V.specialPairOf(A, B); if (!look && V.crossOf && V.crossOn && V.crossOn(b)) { var x = V.crossOf(A, B); if (x && x.body) look = x; } } catch (e) { look = null; }
    var lk = look && V.crossLabel ? esc(V.crossLabel(look)) : '', head, body;
    if (sa && sb) {
      if (lk) { head = '✨ SPECIAL MIX: ' + lk.toUpperCase(); body = lab(A) + ' and ' + lab(B) + ' are both special one-of-a-kind pets, so the baby is a mix of the two: a <b>' + lk + '</b>. Underneath it is a random normal species (Pepe, Snibby, Dodo ...) and it breeds like one.'; }
      else if (A.species === B.species && V.isContestSp(A.species)) { head = '🎲 SURPRISE BABY'; body = 'Two ' + lab(A) + 's make a <b>random normal species</b> (Pepe, Snibby, Dodo ...), not another ' + lab(A) + '. Special pets never pass on their own species.'; }
      else { head = '🎲 SURPRISE BABY'; body = lab(A) + ' and ' + lab(B) + ' are both special one-of-a-kind pets, and special pets never pass on their own species. Together they make a <b>random normal species</b> (Pepe, Snibby, Dodo ...). It is <b>not</b> a hybrid.'; }
    } else { var S = sa ? A : B, O = sa ? B : A; head = '🧬 BABY SPECIES: ' + lab(O).toUpperCase();
      body = lab(S) + ' is a special one-of-a-kind pet and never passes on its own species, so the baby is a <b>' + lab(O) + '</b>' + (lk ? ' with the <b>' + lk + '</b> look.' : '.'); }
    return '<div class="ez-roles ez-spx" role="note"><div class="ez-rh">' + head + '</div><div class="ez-spt">' + body + '</div></div>'; }
  function pairCard(P1, P2, b) { var e = eggOf(P1, P2, b); if (!e) return ''; var SL = { vigor: 'Vigor', spark: 'Spark', grit: 'Grit', zoom: 'Zoom', luck: 'Luck' };
    var rows = EggPower.KEYS.map(function (k) { var x = e.stats[k], mk = (x.keep ? ' <i title="hybrid egg keeps this best stat">kept</i>' : '') + (x.floor != null ? ' <i title="carried stat floor">≥' + x.floor + '</i>' : '');
      return '<tr><th>' + SL[k] + '</th><td>' + x.a + '</td><td class="eg">' + x.lo + ' to ' + x.hi + ' <small>~' + (Math.round(x.exp * 10) / 10) + '</small>' + mk + '</td><td>' + x.b + '</td></tr>'; }).join('');
    return '<div class="ez-pair" aria-label="Pairing preview"><b>🥚 PAIRING PREVIEW</b> <small>likely egg, not a promise: the block hash picks the one egg</small>' +
      '<table><tr><th></th><th>#' + P1.id + '</th><th>Egg</th><th>#' + P2.id + '</th></tr>' + rows +
      '<tr class="tot"><th>⚡ Power</th><td>' + e.parentPower[0] + '</td><td class="eg">' + e.lo + ' to ' + e.hi + ' <small>~' + (e.expHi > e.exp ? e.exp + '-' + e.expHi : e.exp) + '</small></td><td>' + e.parentPower[1] + '</td></tr></table>' +
      (e.bredTrue ? '<div class="ez-hint">Per-stat ranges leave out the bred-true +3, which lands on one random stat.</div>' : '') +
      (e.passes.length ? '<ul class="ez-pass">' + e.passes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      e.notes.map(function (x) { return '<div class="ez-hint">' + esc(x) + '</div>'; }).join('') + '</div>'; }
  /* hotel quick filters (hotel-power-sort): species, stage, rarity, all hatched pets (not only the ones that can breed now), free gear slot */
  function fbar(w, s, pets) { var sps = {}, o = function (v, l, cur) { return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; };
    pets.forEach(function (p) { sps[p.species] = spL(p.species); }); var spk = Object.keys(sps).sort(function (a, b) { return sps[a] < sps[b] ? -1 : sps[a] > sps[b] ? 1 : 0; });
    var SN = (V().STAGE_NAMES || ['Egg', 'Baby', 'Kid', 'Adult', 'Elder', 'Mythic']), n = (s.fsp ? 1 : 0) + (s.fst !== '' ? 1 : 0) + (s.frar !== '' ? 1 : 0) + (s.fall ? 1 : 0) + (s.fslot ? 1 : 0);
    return '<div class="ez-fb" role="group" aria-label="Filters"><span class="ez-fbl">🔎 Filter</span>' +
      '<label class="ez-so"><xc-select id="ezFsp" aria-label="Species">' + o('', 'All species', s.fsp) + spk.map(function (k) { return o(k, sps[k], s.fsp); }).join('') + '</xc-select></label>' +
      '<label class="ez-so"><xc-select id="ezFst" aria-label="Stage">' + o('', 'All stages', s.fst) + SN.map(function (l, i) { return i ? o(i, l, s.fst) : ''; }).join('') + '</xc-select></label>' +
      '<label class="ez-so"><xc-select id="ezFrar" aria-label="Rarity">' + o('', 'All rarities', s.frar) + TL.map(function (l, i) { return o(i, l, s.frar); }).join('') + '</xc-select></label>' +
      '<button type="button" class="ez-tab ez-chip' + (s.fall ? ' on' : '') + '" id="ezFall" aria-pressed="' + !!s.fall + '" title="Show every hatched, living pet, not only the ones that can breed now">🐣 All hatched</button>' +
      '<button type="button" class="ez-tab ez-chip' + (s.fslot ? ' on' : '') + '" id="ezFslot" aria-pressed="' + !!s.fslot + '">🛡️ Free gear slot</button>' +
      (n ? '<button type="button" class="ez-tab ez-chip" id="ezFclr">✖ Clear ' + n + '</button>' : '') + '</div>'; }
  function fok(s, p) { return (!s.fsp || p.species === s.fsp) && (s.fst === '' || String(p.stage) === String(s.fst)) && (s.frar === '' || String(p.tier) === String(s.frar)) && (!s.fslot || (window.PetSort && PetSort.free ? PetSort.free(p) : 0) > 0); }
  /* Ways to more power: PetSort.ways (real rules only) for the picked pets */
  function waysBox(w, p, T) { if (!p || !window.PetSort || !PetSort.ways) return ''; var x = PetSort.ways(w, p, T + 1), st = p.stats || {};
    return '<div class="hs-ways"><div class="hs-wh"><b>⚡ ' + x.power + ' Power</b> · ' + esc(p.name || '') + ' #' + p.id + (x.gain ? ' · <span class="hs-up">up to +' + x.gain + ' to gain</span>' : '') + '</div>' +
      '<div class="hs-st">' + PetSort.STATS.map(function (k) { return '<span>' + k.slice(0, 1).toUpperCase() + k.slice(1) + ' <b>' + (st[k] || 0) + '</b></span>'; }).join('') + '</div>' +
      '<ul class="hs-pt">' + x.parts.map(function (r) { return '<li><span>' + esc(r[0]) + '</span><b>' + (r[1] >= 0 ? '+' : '') + r[1] + '</b></li>'; }).join('') + '</ul>' +
      (x.steps.length ? '<b class="hs-nx">Next steps</b><ul class="hs-sx">' + x.steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') + '<p class="hs-ed">ℹ️ ' + esc(x.edge) + '</p></div>'; }

  /* one portrait card: sprite + name + tier + a few key facts; .on = picked (gold outline + ▼), .no = can't (reason shown) */
  function card(w, p, o) { o = o || {};
    return '<button type="button" class="ez-c t' + p.tier + (o.on ? ' on' : '') + (o.why ? ' no' : '') + '" data-ez="' + esc(o.key || p.id) + '"' + (o.why ? ' aria-disabled="true"' : '') + ' aria-pressed="' + !!o.on + '" title="' + esc('#' + p.id + ' ' + (p.name || '') + (o.why ? ' · ' + o.why : '')) + '">' +
      (o.tag ? '<span class="ez-tag' + (o.tagMe ? ' me' : '') + '">' + o.tag + '</span>' : '') + '<span class="ez-sp" data-ezsp="' + p.id + '"></span>' +
      '<b class="ez-nm">' + esc(p.name || '') + '</b><span class="ez-id">#' + p.id + (p.blackEye ? ' 🤕' : '') + '</span><span class="pill tier tier-' + (p.resurrected ? 'god' : TID[p.tier]) + '">' + (p.resurrected ? 'God' : TL[p.tier]) + '</span>' +
      (o.lines || []).map(function (l) { return '<span class="ez-l">' + l + '</span>'; }).join('') + (o.why ? '<span class="ez-why">✋ ' + esc(o.why) + '</span>' : '') + '</button>'; }
  function sprites(root, w) { var R = window.V2Render; if (!R) return; root.querySelectorAll('[data-ezsp]').forEach(function (s) { if (s.firstChild) return; var p = w.byId[s.getAttribute('data-ezsp')]; if (!p) return; var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'sprite'; s.appendChild(c);
    if (R.lazy && R.petFrames) R.lazy(c, function () { return R.petFrames(p, w); }, true); }); }
  function strip(items, more, empty) { return '<div class="ez-strip" role="listbox">' + (items.join('') || '<p class="ez-empty">' + empty + '</p>') + (more > 0 ? '<span class="ez-more">+' + fmt(more) + ' more · search to find them</span>' : '') + '</div>'; }
  function lookRev() { return window.V2Lookup ? V2Lookup.rev() : 0; }
  /* The light view has only this wallet. Other wallets and opponents load when the player types an address or a pet number. */
  function placeLook(el, mode) { if (!window.V2Lookup || !el) return; var strips = el.querySelectorAll('.ez-strip'), strip = strips[strips.length - 1]; if (!strip || !strip.parentNode) return;
    V2Lookup.mount(strip.parentNode, { id: mode === 'breed' ? 'breedLook' : 'fightLook', mode: mode, before: strip, onReady: function () { var u = U(); if (u && u.render) u.render(); } }); }
  function head(n, title, qid, q, extra, sort) { return '<div class="ez-hd"><span class="ez-n">' + n + '</span><b>' + title + '</b><input type="search" class="ez-q" id="' + qid + '" value="' + esc(q) + '" placeholder="# name species" aria-label="Search ' + esc(title) + '">' + (sort || '') + (extra || '') + '</div>'; }
  function tabs(list, cur) { return '<div class="ez-tabs" role="tablist">' + list.map(function (t) { return '<button type="button" role="tab" class="ez-tab' + (t[0] === cur ? ' on' : '') + (t[2] ? ' hot' : '') + '" data-eztab="' + t[0] + '" aria-selected="' + (t[0] === cur) + '">' + t[1] + '</button>'; }).join('') + '</div>'; }
  /* keep the panel where it is: a repaint must never move the page (no scroll jumps) */
  function keep(el, fn) { var y = window.scrollY, top = el ? el.getBoundingClientRect().top : 0, sx = {}; if (el) el.querySelectorAll('.ez-strip').forEach(function (s, i) { sx[i] = [s.scrollLeft, s.scrollTop]; }); fn();
    if (el) { el.querySelectorAll('.ez-strip').forEach(function (s, i) { if (sx[i]) { s.scrollLeft = sx[i][0]; s.scrollTop = sx[i][1]; } }); /* hotel-mate-sort: also keeps the vertical list position */ var d = el.getBoundingClientRect().top - top; if (Math.abs(d) > 1) window.scrollTo(window.scrollX, y + d); } }
  function bindQ(el, id, set, redraw) { var i = $(id); if (!i) return; i.oninput = function () { set(i.value); var p = i.selectionStart; redraw(); var j = $(id); if (j) { j.focus(); try { j.setSelectionRange(p, p); } catch (e) { } } }; }

  // ================================================================ BATTLE
  function fight(w) { var bp = $('battlePanel'), UI = U(); if (!bp || !UI || !w || !window.UXB || !UXB.faceoff) return; var el = $('ezFight');
    if (!el) { el = document.createElement('div'); el.id = 'ezFight'; el.className = 'ez ez-fight'; var sg = $('arStage'); /* pet-picker: right under the arena scene */ if (sg && sg.parentNode) sg.parentNode.insertBefore(el, sg.nextSibling); else bp.insertBefore(el, bp.firstChild); bp.classList.add('ez-on'); }
    keep(el, function () { paintFight(el, w); }); }
  /* page-unresponsive-fix (2026-10-27): the fighter picker re-sorted all ~1,600 of your pets and every opponent on each tap. Lists are now sorted once
   * per world (and tip / address / sort) and reused; a new world (new block or burn) starts fresh. Display only, same lists in the same order. */
  var MEMO = typeof WeakMap === 'function' ? new WeakMap() : null;
  function memo(w, k, fn) { if (!MEMO || !w || typeof w !== 'object') return fn(); var m = MEMO.get(w); if (!m) MEMO.set(w, m = {}); if (!Object.prototype.hasOwnProperty.call(m, k)) { var ks = Object.keys(m); if (ks.length > 40) delete m[ks[0]]; m[k] = fn(); } return m[k]; }
  function paintFight(el, w) { var UI = U(), ME = UI.ME, FO = UXB.faceoff(), why = UXB.whyNot, T = tip(w), s = ST.f, view = UI.viewOnly && UI.viewOnly(), PK = window.V2Pick;
    var A = FO.a && w.byId[FO.a], B = FO.b && w.byId[FO.b], IGN = UXB.fightIgnored ? UXB.fightIgnored() : [];
    var inc = (w.fights || []).filter(function (f) { var q = w.byId[f.b]; return f.status === 'open' && T + 1 - f.block <= V().FIGHT_WINDOW && q && q.owner === ME && IGN.indexOf(f.id) < 0; });
    if (s.inc && !inc.some(function (f) { return f.id === s.inc; })) s.inc = null;
    var rec = function (p) { return '🏆 ' + (p.wins || 0) + '-' + (p.losses || 0); };
    if (!ME) { el.innerHTML = '<div class="ez-box"><p class="ez-lead">⚔️ Pick your fighter, pick an opponent, burn. Connect your ' + (window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet') + ' to start.</p><button type="button" class="btn ico-flame ez-go" id="ezFGo">🔌 Connect ' + (window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet') + '</button></div>';
      $('ezFGo').onclick = function () { UI.confirmPlans('Challenge', [{}]); }; return; }
    /* pet-picker (Nov 22 2026): ONE picker. Side A = your fighter, side B = the opponent (or a challenger). */
    var F = s.inc ? w.fights[s.inc - 1] : null, CA = F ? w.byId[F.b] : A, CB = F ? w.byId[F.a] : B;
    var side = s.side || (A || s.inc ? 'B' : 'A'); if (!A && !s.inc) side = 'A'; s.side = side;
    var mine = memo(w, 'mine|' + ME + '|' + T, function () { return UI.mine(w).filter(function (p) { return !p.dead && !p.released; }).map(function (p) { return { p: p, why: why(p, w), k: pow(p) }; })
      .sort(function (a, b) { return (!!a.why - !!b.why) || b.k - a.k || a.p.id - b.p.id; }); });
    var ready = mine.filter(function (x) { return !x.why; });
    var opp = memo(w, 'opp|' + ME + '|' + T + '|' + lookRev(), function () { return UI.fighters(w, ME, true).map(function (p) { return { p: p, k: pow(p) }; }); });
    var ap = A ? pow(A) : 0;
    var oppBest = memo(w, 'oppB|' + ME + '|' + T + '|' + lookRev() + '|' + ap, function () { return opp.slice().sort(function (x, y) { var ux = x.k <= ap ? 0 : 1, uy = y.k <= ap ? 0 : 1; return ux - uy || (ux ? x.k - y.k : y.k - x.k) || x.p.id - y.p.id; }); }); /* likely wins first (closest first), then the tougher ones */
    var oppStrong = memo(w, 'oppS|' + ME + '|' + T + '|' + lookRev(), function () { return opp.slice().sort(function (x, y) { return y.k - x.k || x.p.id - y.p.id; }); });
    var oppAny = memo(w, 'oppI|' + ME + '|' + T + '|' + lookRev(), function () { return opp.slice().sort(function (x, y) { return x.p.id - y.p.id; }); });
    var statA = function (c) { c.stat = '<span' + ptA(c.p) + '>⚡ ' + pow(c.p) + '</span>'; c.line = rec(c.p) + ' · ' + esc(spL(c.p.species)); return c; };
    var statB = function (c) { if (!('why' in c)) c.why = why(c.p, w); var wc = A && !c.why ? PK.winChance(w, A, c.p, 60) : null; c.stat = wc != null ? 'WIN ~' + wc + '%' : '<span' + ptA(c.p) + '>⚡ ' + pow(c.p) + '</span>';
      c.line = (wc != null ? '⚡ ' + pow(c.p) + ' · ' : '') + rec(c.p) + ' · 👤 ' + esc(short(c.p.owner)); return c; };
    var st = side === 'A' ? (s.pa = s.pa || {}) : (s.pb = s.pb || {}), nShow = st.n || 24;
    var dec = function (list, f) { return list.slice(0, nShow).map(function (c) { return f(Object.assign({}, c)); }).concat(list.slice(nShow)); };
    var shelves, shelf, all;
    if (side === 'A') {
      all = mine;
      shelves = [{ id: 'best', label: '⭐ Best', list: ready, why: 'Your strongest pets that can fight today (' + fmt(ready.length) + ' of ' + fmt(mine.length) + ').', empty: mine.length ? 'None of your pets can fight today (Juvenile+, one fight per pet per day). Try 📋 All my pets to see why.' : 'No living pets at this address yet. Hatch one first.' },
        { id: 'fav', label: '★ Favorites', list: PK.favOf(mine), why: 'Tap the ☆ on any pet to keep it here.', empty: 'No favorites yet. Tap the ☆ on a pet.' },
        { id: 'recent', label: '🕘 Recent', list: PK.recentOf(mine), why: 'Pets you picked lately, here and in other places.', empty: 'Nothing picked yet.' },
        { id: 'all', label: '📋 All my pets', list: mine, why: 'Every living pet. The ones that can’t fight today say why.', empty: 'No living pets at this address yet.' }];
      shelf = s.shA || 'best'; }
    else {
      all = opp;
      var incL = inc.map(function (f) { var Y = w.byId[f.a], X = w.byId[f.b]; return { p: Y, key: 'f' + f.id, why: null, tag: 'vs your ' + esc(X.name) + ' #' + X.id, tagMe: true, stat: (function () { var wc = PK.winChance(w, X, Y, 60); return wc != null ? 'YOU WIN ~' + wc + '%' : '⚡ ' + pow(Y); })(), line: '⚡ ' + pow(Y) + ' vs your ⚡ ' + pow(X) + ' · ⏳ ' + fmt(f.expires) }; });
      shelves = (incL.length ? [{ id: 'inc', label: '📥 Challenging you (' + incL.length + ')', hot: true, list: incL, why: 'These pets challenged one of yours. Pick one, then accept.' }] : [])
        .concat([{ id: 'best', label: '🎯 Best match', list: oppBest, why: A ? 'Fights ' + esc(A.name) + ' is likely to win come first, closest ones first.' : 'Pick your fighter first to see win chances.', empty: 'No opponent is loaded yet. Type a pet number or a wallet address in the search box.' },
          { id: 'strong', label: '💪 Strongest', list: oppStrong, why: 'Most power first. Big risk, big glory.', empty: 'No opponent is loaded yet.' },
          { id: 'any', label: '🔎 Any pet', list: oppAny, why: 'Every opponent loaded so far, by number. Type a pet number or a wallet address in the search box to find anyone.', empty: 'No opponent is loaded yet. Type a pet number or a wallet address in the search box.' },
          { id: 'fav', label: '★ Favorites', list: PK.favOf(opp), why: 'Tap the ☆ on any pet to keep it here.', empty: 'No favorite opponents yet. Tap the ☆ on a pet.' },
          { id: 'recent', label: '🕘 Recent', list: PK.recentOf(opp), why: 'Pets you picked lately.', empty: 'Nothing picked yet.' }]);
      shelf = s.shB || (incL.length && !A ? 'inc' : 'best'); }
    if (!shelves.some(function (x) { return x.id === shelf; })) shelf = shelves[0].id;
    var deco = side === 'A' ? statA : statB; shelves.forEach(function (x) { if (x.id !== 'inc') x.list = dec(x.list, deco); });
    var searchList = st.q ? dec(all.filter(function (c) { return PK.match(c.p, st.q, spL); }), deco) : null;
    /* verdict */
    var verdict, wc0 = CA && CB ? PK.winChance(w, CA, CB, 200) : null;
    if (CA && CB) { var wa = why(CA, w), wb = F ? null : why(CB, w);
      verdict = wa || wb ? { tone: 'bad', big: '✋ ' + esc(wa ? 'Your pet: ' + wa : 'Opponent: ' + wb), small: 'Pick another pet.' }
        : { tone: wc0 == null ? 'meh' : wc0 >= 60 ? 'good' : wc0 >= 40 ? 'meh' : 'bad', big: wc0 == null ? 'READY TO FIGHT' : 'YOU WIN ABOUT ' + wc0 + '% OF THE TIME',
          small: (wc0 == null ? '' : wc0 >= 60 ? 'Good odds. ' : wc0 >= 40 ? 'Coin flip. ' : 'Risky: try 🎯 Best match. ') + 'Loser gives 1 random worn piece (★ safe) and gets a black eye.' + (F ? '' : ' Their owner has ' + V().FIGHT_WINDOW + ' blocks to accept.') }; }
    else verdict = { tone: 'wait', big: !A && !s.inc ? 'PICK YOUR FIGHTER' : 'NOW PICK WHO TO FIGHT', small: !A ? 'Tap one of your pets below.' : '🎯 Best match shows the fights you are likely to win.' };
    var bud = PK.buddy();
    var slotA = { key: 'A', label: 'YOU', pet: CA, empty: 'Pick your fighter', buddy: CA && CA.id === bud, clear: !F, locked: !!F, sub: CA ? '⚡ ' + pow(CA) + ' · ' + rec(CA) : '' };
    var slotB = { key: 'B', label: F ? 'CHALLENGER' : 'THEM', pet: CB, empty: A ? 'Pick an opponent' : 'Then an opponent', clear: true, sub: CB ? '⚡ ' + pow(CB) + ' · 👤 ' + esc(short(CB.owner)) : '' };
    /* one button: the face-off burn, or accept */
    var label, ok = false, hint = '';
    if (F) { var sw = UI.sendWhy ? UI.sendWhy({ tag: 'pet:accept:' + s.inc }) : null; ok = !sw; label = sw ? 'Can’t accept: ' + sw : '🔥 Accept fight ' + s.inc + ' · burn ' + fmt(V().COSTS.accept * V().acceptCost(w, +s.inc) / V().acceptCost(null, 0)) + ' XCPETS'; }
    else if (!A) label = 'Pick your fighter';
    else if (!B) label = 'Pick an opponent';
    else { var wa2 = why(A, w), wb2 = why(B, w), sw2 = !wa2 && !wb2 && UI.sendWhy ? UI.sendWhy({ tag: 'pet:fight:' + A.id + ':' + B.id }) : null; ok = !wa2 && !wb2 && !sw2;
      label = ok ? '⚔️ FIGHT! Challenge #' + B.id + ' · burn ' + fmt(V().COSTS.fight) + ' XCPETS' : '✋ ' + (sw2 || (wa2 ? 'Your pet: ' + wa2 : 'Opponent: ' + wb2)); }
    var cmp = ''; if (CA && CB) { var K = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
      cmp = '<details class="pk2-dt"><summary>📊 Stats side by side</summary><div class="ez-cmp"><b>' + esc(CA.name) + ' <span' + ptA(CA) + '>⚡' + pow(CA) + '</span></b><span class="ez-vs">VS</span><b>' + esc(CB.name) + ' <span' + ptA(CB) + '>⚡' + pow(CB) + '</span></b><span class="ez-st">' + K.map(function (k) { var a = (CA.stats || {})[k] || 0, b = (CB.stats || {})[k] || 0; return '<i class="' + (a > b ? 'up' : a < b ? 'dn' : '') + '" title="' + k + '">' + k.slice(0, 3).toUpperCase() + ' ' + a + '/' + b + '</i>'; }).join('') + '</span></div></details>'; }
    el.innerHTML = '<div id="ezFPick"></div><div class="ez-checkin ez-ffoot">' + cmp + '<div class="ez-acts"><button type="button" class="btn ico-flame ez-go" id="ezFGo"' + (ok ? '' : ' disabled') + '>' + esc(label) + '</button>' +
      (F ? '<button type="button" class="q" id="ezFIgn">Ignore</button>' : '<button type="button" class="q ez-qm" id="ezFQm">🎲 Quick match</button>') + '</div>' +
      '<div class="ez-hint">' + esc(s.msg || hint) + (view ? ' 👀 View only: connect the wallet that owns these pets to burn.' : '') + '</div></div>';
    var redraw = function () { fight(U().world()); };
    PK.render($('ezFPick'), { id: 'circus', w: w, mid: 'VS', active: side, slots: [slotA, slotB], verdict: verdict, prompt: side === 'A' ? 'Pick your fighter' : (shelf === 'inc' ? 'Pick a challenger' : 'Pick who to fight'),
      shelves: shelves, shelf: shelf, searchList: searchList, searchPh: side === 'A' ? 'Search ' + fmt(mine.length) + ' pets: name, #number, species' : 'Find an opponent: name, #number, species or wallet', look: side === 'B' ? 'fight' : '',
      missWhy: side === 'B' ? function (p) { return p.dead || p.released ? 'Not a living pet' : p.owner === ME ? 'It’s yours: pick another player’s pet' : !(p.stage >= 2) ? 'Too young: Juvenile+ only' : p.neglected ? 'Neglected: it can’t fight' : 'It already has an open challenge'; } : null, selected: side === 'A' ? (A ? A.id : '') : (s.inc ? 'f' + s.inc : B ? B.id : ''),
      drop: [$('arStage')], onRedraw: redraw,
      onSlot: function (k) { if (k === 'B' && !A && !s.inc) UI.toast('Pick your fighter first.'); s.side = k === 'B' && !A && !s.inc ? 'A' : k; redraw(); },
      onClear: function (k) { s.msg = ''; if (F) { s.inc = null; s.side = 'A'; UXB.setFace(null, null); return; } s.side = k; if (k === 'A') UXB.setFace(null, undefined); else UXB.setFace(undefined, null); },
      onShelf: function (id) { if (side === 'A') s.shA = id; else s.shB = id; if (id !== 'inc' && s.inc) { s.inc = null; UXB.setFace(null, null); return; } redraw(); },
      onPick: function (c, slotKey) { var k = String(c.key || c.p.id); s.msg = '';
        if (k[0] === 'f') { var f = w.fights[+k.slice(1) - 1]; if (s.inc === f.id) { s.inc = null; s.side = 'A'; UXB.setFace(null, null); return; } s.inc = f.id; PK.used(f.a, false); UXB.setFace(f.b, f.a); return; }
        if (s.inc) { s.inc = null; }
        var sd = slotKey === 'A' || slotKey === 'B' ? slotKey : side; if (sd === 'B' && !FO.a) sd = 'A';
        if (sd === 'A' && c.p.owner !== ME) { UI.toast('#' + c.p.id + ' is not yours: it can only be the opponent.'); return; }
        if (sd === 'B' && c.p.owner === ME) { UI.toast('#' + c.p.id + ' is yours: pick another player’s pet to fight.'); return; }
        PK.used(c.p.id, c.p.owner === ME); (s.pa || {}).q = ''; (s.pb || {}).q = '';
        s.side = sd === 'A' && !FO.b ? 'B' : sd; if (sd === 'A') UXB.setFace(c.p.id, undefined); else UXB.setFace(undefined, c.p.id); } }, st);
    if (side === 'B' && window.V2Lookup && V2Lookup.warm) V2Lookup.warm(function () { var u = U(); if (u && u.render) u.render(); }); /* one-search: the search box does the lookup */
    if (window.V2Lookup && V2Lookup.quiet) V2Lookup.quiet('fightLook'); /* the old arena lookup box would be a second search here */
    var go = $('ezFGo'); if (go) go.onclick = function () {
      if (F) { var id = String(s.inc); return UI.confirmPlans('Accept fight ' + id, [{ tag: 'pet:accept:' + id, amount: (V2Rules.acceptCost ? V2Rules.acceptCost(V2Mock.world(), +(id)) : 690) }], function () { UI.afterAccept(id); }); }
      var g = $('foGo'); if (g && !g.disabled) g.click(); };
    var qm = $('ezFQm'); if (qm) qm.onclick = function () { var q = $('arQuick'); if (!q) return; q.click(); var m = $('arQmsg'); s.msg = m ? m.textContent : ''; s.side = 'B'; fight(U().world()); };
    var ig = $('ezFIgn'); if (ig) ig.onclick = function () { var id = s.inc; s.inc = null; s.side = 'A'; UXB.ignoreFight(id); UI.toast('Ignored here. It expires on its own if nobody accepts.'); }; }

  // ================================================================ BREED
  /* pet-picker (Nov 22 2026): the order under the motel scene is picker (#ezBreed) -> check-in button (#ezCheck). The old pet dock (#lfDock) is hidden. */
  function placeCheck(html) { var sc = $('motelScene'), ez = $('ezBreed'), bar = $('ezCheck'); if (!bar) { bar = document.createElement('div'); bar.id = 'ezCheck'; bar.className = 'ez-check'; }
    var at = ez && ez.parentNode ? ez : sc; if (at && at.parentNode) { if (at.nextSibling !== bar) at.parentNode.insertBefore(bar, at.nextSibling); } else { var bp = $('breedPanel'); if (bp) bp.insertBefore(bar, bp.firstChild); } bar.innerHTML = html; return bar; }
  function breed(w) { var bp = $('breedPanel'), UI = U(); if (!bp || !UI || !w) return; if (window.V2Motel && V2Motel.placeOn && !V2Motel.placeOn()) return; var el = $('ezBreed');
    if (!el) { el = document.createElement('div'); el.id = 'ezBreed'; el.className = 'ez ez-breed'; var sc = $('motelScene'), at = $('motelReqs') || $('motelDesk'); if (sc && sc.parentNode) sc.parentNode.insertBefore(el, sc.nextSibling); else bp.insertBefore(el, at); bp.classList.add('ez-on'); document.body.classList.add('pk2-motel'); }
    keep(el, function () { paintBreed(el, w); }); }
  function incoming(w, ME, T) { var win = V().BREED_WINDOW || 144; return (w.breedReqs || []).filter(function (r) { var X = w.byId[r.b]; return !r.used && !(T && T - r.block > win) && X && X.owner === ME && r.owner !== ME; }).sort(function (a, b) { return b.block - a.block; }); }
  function paintBreed(el, w) { var UI = U(), Vr = V(), ME = UI.ME, T = tip(w), s = ST.b, view = UI.viewOnly && UI.viewOnly(), M = window.V2Motel, PK = window.V2Pick;
    var a = $('bA').value, b = $('bB').value, pick = M && M.picker ? M.picker : Vr.breedPicker.bind(Vr), L = pick(w, ME, T, a, UI.pendingBreedIds ? UI.pendingBreedIds() : null), v2 = !!(Vr.breedV2On && Vr.breedV2On(T + 1));
    if (!ME) { el.innerHTML = '<div class="ez-box"><p class="ez-lead">💞 Pick your pet, pick a date. The check-in button is next to the motel.</p></div>';
      placeCheck('<div class="ez-checkin"><p class="ez-lead">💞 Connect your ' + (window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet') + ' to check in. This is the motel breed, not the daily WAGMI check-in.</p><button type="button" class="btn ico-egg ez-go" id="ezBGo">🔌 Connect ' + (window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet') + '</button></div>');
      $('ezBGo').onclick = function () { $('bGo').click(); }; return; }
    var A = a && w.byId[a], Bp = b && w.byId[b];
    var kin = function (p) { return v2 && A && Vr.kinWhy ? Vr.kinWhy(A, p) : null; };
    var resX = function (p) { return !!(A && Vr.resPairWhy && Vr.resPairWhy(A, p, T + 1)); }; /* gods-breed-gods-1102: a God sees only Gods as mates and a non-God never sees a God */
    var px = function (x) { return x.p; }, reqs = incoming(w, ME, T);
    if (s.req && !reqs.some(function (r) { return r.b + ':' + r.a === s.req; })) s.req = null;
    /* pet-picker (Nov 22 2026): ONE picker. Side A = your pet, side B = the date. Tap a slot to choose the side; shelves fill it.
     * goobys-lost (Nov 23 2026, players: "much more functional before" / "no indicator to the person receiving the request"):
     * - breed requests for you: a big pink bar on top, and Gooby's opens straight on 💌 Asking you (no need to pick your own pet first);
     * - info back on every card (Detailed view, default): Pet Score, generation, badges, breeds left; for a date also the egg's power range and gene notes;
     * - sort chips in view; Detailed / Simple / List switch (List = compact rows, 48 a page); both sides side by side on wide screens. Display only. */
    var dual = !!(window.matchMedia && matchMedia('(min-width: 900px)').matches);
    if (!s.opened) { s.opened = true; if (reqs.length && !A && !s.req && !s.side) { s.side = 'B'; s.shB = 'asks'; } }
    var side = s.side || (A || s.req ? 'B' : 'A'); if (!A && !s.req && !(side === 'B' && reqs.length && s.shB === 'asks')) side = 'A'; s.side = side;
    var notReady = function (x) { return x.why || (x.p.stage >= 3 ? null : 'Too young: Adult+ only'); };
    var pw = function (p) { return pow(p); };
    var gen = function (p) { var R2 = window.V2Render; try { return R2 && R2.genOf ? R2.genOf(w, p) : Vr.genOf ? Vr.genOf(w, p) : 0; } catch (e) { return 0; } }; /* glitch-display-1102: a quest jackpot egg is one generation after its one parent */
    var badges = function (p) { var R2 = window.V2Render, x = []; try { x = R2 && R2.badgesOf ? R2.badgesOf(w, p) : Vr.breederBadges ? Vr.breederBadges(w, p) : []; } catch (e) { x = []; } return x.length ? x.map(function (q) { return '<span title="' + esc(q.name + ': ' + q.tip) + '">' + q.icon + '</span>'; }).join('') : ''; };
    var scoreOf = function (p) { var r = window.PetScore && PetScore.peek ? PetScore.peek(w, p) : null; return r ? r.score : null; }; /* peek: never scores a big world inside a paint */
    var NOLINE = { '': 1, pow: 1, sc: 1, bl: 1, gen: 1, mate: 1, egg: 1, 'egg-': 1, pass: 1 };
    var info = function (p) { var sc = scoreOf(p), bl = v2 && Vr.breedsLeft ? Vr.breedsLeft(p, T + 1) : null, g = gen(p), bd = badges(p), PS = window.PetSort, gn = PS && PS.gain ? PS.gain(p) : 0;
      return [(sc != null ? '⭐ ' + sc + ' · ' : '') + 'Gen ' + g + (bd ? ' ' + bd : '') + (gn ? ' · <small class="hs-g">+' + gn + ' to gain</small>' : ''),
        bl ? '💞 ' + bl.left + ' of ' + bl.cap + ' breeds left' : '💞 bred ' + (p.breeds || 0) + ' times']; };
    /* stat-sort-search: the value the list is sorted by (📊 Grit 30, 🌱 Adult, 🏆 12 wins...) leads the card's line in every view. It used to sit
     * in the Detailed lines only, so in Simple view a Grit sort showed nothing but ⚡ total numbers and looked like a Power sort. */
    var sline = function (p, k) { var PS = window.PetSort, sl = null; if (k && !NOLINE[String(k).replace(/-$/, '')] && PS && PS.line) try { sl = PS.line(w, p, k, T + 1); } catch (e) { sl = null; } return sl ? '<b class="pk2-sv">' + esc(sl) + '</b> · ' : ''; };
    var tierL = function (p) { return p.resurrected ? 'God' : TL[p.tier] || ''; };
    /* stat-sort-search (Nov 24 2026, Evan: "Grit high to low sorts by total first"): the search results, 📋 All my pets and the Favorites / Recent
     * picks are built from allA / allB. Those were always in Power order, so typing in the search box (or opening All) dropped the sort the player
     * picked and showed the pets by total stats. They now follow the chosen sort too (ready pets first, then the rest, each in sort order). */
    var cpx = function (c) { return c.p; };
    var bySort = function (list, k) { if (k == null || k === 'pow') return list.sort(function (x, y) { return (!!x.why - !!y.why) || y.k - x.k || x.p.id - y.p.id; }); /* Power: the old cheap order (no Pet Score on every pet) */
      var o = psort(w, list, k, cpx, T + 1); return o.filter(function (x) { return !x.why; }).concat(o.filter(function (x) { return x.why; })); };
    var allA = memo(w, ['pkA', ME, T, L.mine.length, s.sa].join('|'), function () { return bySort(L.mine.filter(function (x) { return x.p.stage >= 1 && !x.p.dead; }).map(function (x) { return { p: x.p, why: notReady(x), k: pw(x.p) }; }), s.sa); }); /* power worked out once per pet (big wallets) */
    var bestA = memo(w, ['pkAb', s.sa, s.fsp, s.fst, s.frar, s.fslot ? 1 : 0, T, ME].join('|'), function () { return psort(w, L.mine.filter(function (x) { return !x.why && x.p.stage >= 3 && fok(s, x.p); }), s.sa, px, T + 1).map(function (x) { return { p: x.p }; }); });
    var statA = function (c) { c.stat = '<span' + ptA(c.p) + '>⚡ ' + pw(c.p) + '</span>'; c.line = sline(c.p, s.sa) + esc(spL(c.p.species)) + ' · ' + esc(tierL(c.p)); c.lines = info(c.p); return c; };
    var egK = EGGK.some(function (e) { return e[0] === s.sb; });
    var allB = memo(w, ['pkB', A ? A.id : 0, T, lookRev(), ME, egK ? '~egg' : s.sb].join('|'), function () {
      var raw = L.partners.filter(function (x) { return x.p.stage >= 1 && !x.p.dead && !resX(x.p) && (!A || x.p.id !== A.id); });
      return bySort(raw.map(function (x) { var k = kin(x.p); return { p: x.p, why: k ? k + ' (no inbreeding)' : notReady(x), k: pw(x.p) }; }), egK ? null : s.sb); }); /* egg sorts: Power order here (the egg math runs on the ready dates only) */
    var bestB = memo(w, ['pkBb', A ? A.id : 0, s.sb, s.fsp, s.fst, s.frar, s.fslot ? 1 : 0, T, lookRev(), ME].join('|'), function () {
      var raw = L.partners.filter(function (x) { return !x.why && x.p.stage >= 3 && !resX(x.p) && !kin(x.p) && (!A || x.p.id !== A.id) && fok(s, x.p); });
      raw = A && window.EggPower && (!s.sb || egK) ? eggSort(raw, egK ? s.sb : 'mate', A, px, T + 1) : psort(w, raw, egK ? '' : s.sb, px, T + 1);
      return raw.map(function (x) { return { p: x.p }; }); });
    var statB = function (c) { var e = A && c.p.id !== A.id ? eggOf(A, c.p, T + 1) : null; c.stat = e ? '🥚 ⚡' + Math.round(e.exp) : '<span' + ptA(c.p) + '>⚡ ' + pw(c.p) + '</span>';
      c.line = sline(c.p, egK ? '' : s.sb) + esc(spL(c.p.species)) + ' · ' + esc(tierL(c.p)) + (c.p.owner !== ME ? ' · 👤 ' + esc(short(c.p.owner)) : ' · yours');
      c.lines = (e ? [eggLine(e), eggTags(e), 'its own ⚡ ' + pw(c.p)] : []).filter(Boolean).concat(info(c.p)); return c; };
    var per = PK.perOf ? PK.perOf(PK.viewMode()) : 24;
    /* one-search: why a pet typed by number is not on the date side (it still shows on top, greyed) */
    var missB = function (p) { if (p.dead || p.released) return 'Not a living pet'; if (A && p.id === A.id) return 'That’s your pet 1. Pick a different date'; var rw = A && Vr.resPairWhy ? Vr.resPairWhy(A, p, T + 1) : null; if (rw) return rw; if (!(p.stage >= 1)) return 'Still an egg'; if (p.stage < 3) return 'Too young: Adult+ only'; return 'Can’t breed with ' + (A ? (A.name || '#' + A.id) : 'your pet') + ' right now'; };
    var dec = function (list, f, n) { return list.slice(0, n).map(function (c) { return f(Object.assign({}, c)); }).concat(list.slice(n)); };
    var SORT_A = [['pow', '⚡ Power'], ['sc', '⭐ Score'], ['rar', '💎 Rarity'], ['bl', '💞 Breeds left'], ['gen', '🌳 Gen'], ['', '🐣 Oldest']];
    var SORT_B = (A && window.EggPower ? [['mate', '🥚 Best egg'], ['egg', '🥚 Egg power'], ['pass', '🧬 Traits']] : []).concat([['pow', '⚡ Power'], ['sc', '⭐ Score'], ['rar', '💎 Rarity']]);
    var asks = reqs.map(function (r) { var Y = w.byId[r.a], X = w.byId[r.b], k = r.b + ':' + r.a, kw = v2 && Vr.kinWhy ? Vr.kinWhy(X, Y) : null, rw = Vr.resPairWhy ? Vr.resPairWhy(X, Y, T + 1) : null, e = eggOf(Y, X, T + 1);
      return { p: Y, key: 'r' + k, why: kw ? kw + ' (no inbreeding)' : rw || null, tag: 'asks your ' + esc(X.name) + ' #' + X.id, tagMe: true, stat: '<span' + ptA(Y) + '>⚡ ' + pw(Y) + '</span>',
        line: esc(spL(Y.species)) + ' · ' + esc(tierL(Y)) + ' · 👤 ' + esc(short(Y.owner)), lines: ['⏳ until block ' + fmt(r.block + (Vr.BREED_WINDOW || 144)) + (T ? ' (~' + Math.max(1, Math.round(Math.max(0, r.block + (Vr.BREED_WINDOW || 144) - T) / 6)) + ' h left)' : '')].concat(e ? [eggLine(e)] : []).concat(info(Y)), noStar: false }; });
    var sideCfg = function (sd) { var st = sd === 'A' ? (s.pa = s.pa || {}) : (s.pb = s.pb || {}), nShow = Math.max(st.n || 0, per), shelves, shelf, cfgList;
      if (sd === 'A') {
        shelves = [{ id: 'best', label: '⭐ Best', list: bestA, why: 'Your pets that can breed right now.', empty: L.mine.length ? 'None of your pets can breed right now (Adult+, fed, off cooldown). Try 📋 All my pets to see why.' : 'No living pets at this address yet.' },
          { id: 'fav', label: '★ Favorites', list: PK.favOf(allA), sort: false, why: 'Tap the ☆ on any pet to keep it here.', empty: 'No favorites yet. Tap the ☆ on a pet.' },
          { id: 'recent', label: '🕘 Recent', list: PK.recentOf(allA), sort: false, why: 'Pets you picked lately, here and in other places.', empty: 'Nothing picked yet.' },
          { id: 'all', label: '📋 All my pets', list: allA, why: fmt(bestA.length) + ' of ' + fmt(allA.length) + ' can breed now. The rest say why.', empty: 'No living pets at this address yet.' }];
        shelf = s.shA || 'best'; cfgList = allA; }
      else {
        var mineB = bestB.filter(function (c) { return c.p.owner === ME; }), otherB = bestB.filter(function (c) { return c.p.owner !== ME; });
        shelves = (asks.length ? [{ id: 'asks', label: '💌 Asking you (' + asks.length + ')', hot: true, sort: false, list: asks, why: 'Other players asked one of your pets out. Pick one, then accept: the egg goes to them, your pet gets the stat carry.' }] : [])
          .concat([{ id: 'best', label: '⭐ Best match', list: bestB, why: A ? 'Dates with the strongest eggs for ' + esc(A.name) + ' (🥚 ⚡ = egg power, about).' : 'Pick your pet first for egg power.', empty: 'No date can breed right now. Try 🌍 Other players.' },
            { id: 'mine', label: '🏠 My pets', list: mineB, why: 'Both pets yours: one burn, the egg is yours.', empty: 'No other pet of yours can breed right now.' },
            { id: 'other', label: '🌍 Other players', list: otherB, why: 'Their owner gets ' + (Vr.BREED_WINDOW || 144) + ' blocks to accept.', empty: 'No other player’s pet is loaded yet. Type a pet number or a wallet address in the search box.' },
            { id: 'fav', label: '★ Favorites', list: PK.favOf(allB), sort: false, why: 'Tap the ☆ on any pet to keep it here.', empty: 'No favorite dates yet. Tap the ☆ on a pet.' },
            { id: 'recent', label: '🕘 Recent', list: PK.recentOf(allB), sort: false, why: 'Pets you picked lately.', empty: 'Nothing picked yet.' }]);
        shelf = s.shB || (asks.length && !A ? 'asks' : 'best'); cfgList = allB; }
      if (!shelves.some(function (x) { return x.id === shelf; })) shelf = shelves[0].id;
      var deco = sd === 'A' ? statA : statB;
      shelves.forEach(function (x) { if (x.id !== 'asks') x.list = dec(x.list, deco, nShow); });
      var hits = st.q ? cfgList.filter(function (c) { return PK.match(c.p, st.q, spL); }) : null;
      if (hits && sd === 'B' && egK && A && window.EggPower) hits = eggSort(hits.filter(function (c) { return !c.why; }), s.sb, A, function (c) { return c.p; }, T + 1).concat(hits.filter(function (c) { return c.why; })); /* stat-sort-search: egg sorts too */
      var searchList = hits ? dec(hits, deco, nShow) : null;
      return { st: st, shelves: shelves, shelf: shelf, searchList: searchList, sorts: sd === 'A' ? SORT_A : SORT_B, sortOn: sd === 'A' ? s.sa : s.sb,
        searchPh: sd === 'A' ? 'Search ' + fmt(allA.length) + ' pets: name, #number, species' : 'Find a date: name, #number, species or wallet', look: sd === 'B' ? 'breed' : '', missWhy: sd === 'B' ? missB : null, selected: sd === 'A' ? (A ? A.id : '') : (s.req ? 'r' + s.req : Bp ? Bp.id : ''),
        prompt: sd === 'A' ? (dual ? '1 · Your pet' : 'Pick your pet') : (shelf === 'asks' ? (dual ? '2 · ' : '') + 'Pick a request' : (dual ? '2 · The date' : 'Pick a date') + (A ? ' for ' + (A.name || '#' + A.id) : '')) }; };
    var cur = sideCfg(side), cA = dual ? (side === 'A' ? cur : sideCfg('A')) : null, cB = dual ? (side === 'B' ? cur : sideCfg('B')) : null;
    var shelfB = dual ? cB.shelf : side === 'B' ? cur.shelf : '';
    /* verdict + slots */
    var P1 = A, P2 = Bp, flip = null, verdict = null, rmode = '';
    if (s.req) { var q0 = s.req.split(':'); P1 = w.byId[q0[0]]; P2 = w.byId[q0[1]]; }
    if (P1 && P2) { flip = UI.breedFlip ? UI.breedFlip(w, P1.id, P2.id) : null; rmode = P1.owner === P2.owner ? 'same' : s.req || flip ? 'accept' : 'ask'; var o = null; try { o = M && M.odds ? M.odds(Vr, P1, P2) : null; } catch (e) { o = null; }
      var kw2 = kin(P2); verdict = { tone: kw2 ? 'bad' : 'good', big: kw2 ? '🚫 ' + esc(kw2) : o ? 'EGG: ' + o.tier.hi.toFixed(0) + '% ' + TL[o.hiT].toUpperCase() + (o.tier.up ? ' · ' + o.tier.up.toFixed(0) + '% ' + TL[Math.min(3, o.hiT + 1)].toUpperCase() + '!' : '') : 'READY TO CHECK IN',
        small: rmode === 'same' ? 'Both pets are yours: one burn, the egg is yours.' : rmode === 'accept' ? (flip ? 'You are accepting their request: the egg goes to them, your pet gets the stat carry.' : 'The egg goes to the pet that asked. Your pet gets the stat carry.') : 'The egg is yours. Their owner has ' + (Vr.BREED_WINDOW || 144) + ' blocks to say yes at Gooby’s desk.' };
      if (v2 && P1.species !== P2.species && !kw2) verdict.small += ' 🧬 Different species: a hybrid egg can happen.'; }
    else if (!A && reqs.length && shelfB === 'asks') verdict = { tone: 'wait', big: '💌 PICK A REQUEST', small: 'Tap a pet that asked yours out, then accept. Or pick your own pet to start a new date.' };
    else verdict = { tone: 'wait', big: !A ? 'PICK YOUR PET' : 'NOW PICK A DATE FOR ' + esc(String(A.name || '#' + A.id).toUpperCase()), small: !A ? 'Tap a pet below, or drag it onto the motel.' : '⭐ Best match shows the dates with the strongest eggs.' };
    var bud = PK.buddy(), subA = function (p) { var bl = v2 && Vr.breedsLeft ? Vr.breedsLeft(p, T + 1) : null, sc = scoreOf(p); return '⚡ ' + pw(p) + (sc != null ? ' · ⭐ ' + sc : '') + (bl ? ' · 💞 ' + bl.left + ' of ' + bl.cap + ' left' : '') + ' · Gen ' + gen(p); };
    var slotA = { key: 'A', label: 'YOUR PET', pet: P1, empty: 'Pick your pet', buddy: P1 && P1.id === bud && P1.owner === ME, clear: !s.req, sub: P1 ? subA(P1) : '', locked: !!s.req };
    var slotB = { key: 'B', label: s.req ? 'ASKED BY' : 'THE DATE', pet: P2, empty: !A && reqs.length ? '💌 ' + reqs.length + ' asking you' : A ? 'Pick a date' : 'Then a date', clear: true, sub: P2 ? (P2.owner === ME ? '⚡ ' + pw(P2) + ' · yours' : '⚡ ' + pw(P2) + ' · 👤 ' + esc(short(P2.owner))) : '' };
    var extra = '<details class="pk2-fx"' + (s.fx ? ' open' : '') + ' id="pkFx"><summary>⚙️ Filters and more sorts</summary>' + fbar(w, s, (side === 'A' ? L.mine : L.partners).map(px)) +
      (side === 'A' ? sortSel('ezBsA', s.sa, 'Your pet') : sortSelMate('ezBsB', s.sb, A)) + '</details>';
    if (A || Bp) extra += '<details class="hs-wb"' + ((s.ways == null ? dual : s.ways) ? ' open' : '') + ' id="ezWays"><summary>⚡ Ways to more power</summary><div class="hs-wg">' + waysBox(w, A, T) + (Bp && (!A || Bp.id !== A.id) ? waysBox(w, Bp, T) : '') + '</div>' + '<div class="hs-bfp"><b>💞 Breeding for Power</b><p>An egg’s stats start at its parents’ average, give or take 2 each. Pair your strongest pets, then breed the best egg with another strong pet: each generation starts from a higher average. Same-species eggs can come out bred true (+3 on one stat), a hybrid egg keeps each parent’s best stat at full value, and a carried stat sets a floor. Quest Hauls (up to +3) also pass down through the average. The block hash picks each egg, so no climb is certain.</p></div></details>';
    /* the pink bar: shown while requests wait and the Asking you shelf is not the one on screen */
    var alert = null; if (reqs.length && !s.req && shelfB !== 'asks') { var r0 = reqs[0], Y0 = w.byId[r0.a], X0 = w.byId[r0.b];
      alert = { html: '<b>💌 ' + reqs.length + ' breed request' + (reqs.length === 1 ? '' : 's') + ' for your pets!</b><span class="pk2-ago">' + (Y0 && X0 ? esc(Y0.name || 'Pet') + ' #' + Y0.id + ' asked your ' + esc(X0.name || 'pet') + ' #' + X0.id + (reqs.length > 1 ? ' and ' + (reqs.length - 1) + ' more' : '') + '.' : '') + ' They expire after ' + (Vr.BREED_WINDOW || 144) + ' blocks (about a day).</span><span class="pk2-go">SEE WHO ▸</span>' }; }
    var redraw = function () { breed(U().world()); };
    var setPet = function (sd, id) { $(sd === 'A' ? 'bA' : 'bB').value = id; if (sd === 'A' && $('bB').value === id) $('bB').value = ''; var S = M && M._state ? M._state() : null; if (S) { S.fresh = null; S.pickSide = null; if (id) { S.bubble = 'Room #' + id + '? Gooby pls.'; S.lt = performance.now(); } } UI.render(); };
    var cfg = { id: 'motel', w: w, mid: '+', active: side, slots: [slotA, slotB], verdict: verdict, views: true, alert: alert,
      extra: extra, drop: [$('motelScene')], onRedraw: redraw,
      onAlert: function () { s.side = 'B'; s.shB = 'asks'; (s.pb || {}).q = ''; redraw(); var pk = el.querySelector('.pk2-pick[data-pk2side="' + (dual ? 'B' : '') + '"]') || el; try { pk.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { } },
      onSort: function (k, sd) { sd = sd || side; if (sd === 'A') { s.sa = k; s.shA = 'best'; } else { s.sb = k; if (!/^(best|mine|other)$/.test(s.shB || '')) s.shB = 'best'; } s.side = sd === 'B' && !A ? s.side : sd; redraw(); },
      onSlot: function (k) { if (k === 'B' && !A && !s.req) { if (reqs.length) { s.side = 'B'; s.shB = 'asks'; redraw(); return; } UI.toast('Pick your pet first.'); } s.side = k === 'B' && !A && !s.req ? 'A' : k; redraw(); },
      onClear: function (k) { if (s.req) { s.req = null; $('bA').value = ''; $('bB').value = ''; s.side = 'A'; setPet('B', ''); return; } s.side = k; setPet(k, ''); },
      onShelf: function (id, sd) { sd = sd || side; if (sd === 'A') s.shA = id; else s.shB = id;
        if (sd === 'B' && s.req && id !== 'asks') { s.req = null; $('bA').value = ''; $('bB').value = ''; }
        if (!dual && sd === 'B' && !$('bA').value && id !== 'asks') UI.toast('Pick your pet first. Then this shelf shows dates for it.'); s.side = sd; redraw(); },
      onPick: function (c, slotKey) { var k = String(c.key || c.p.id);
        if (k[0] === 'r') { k = k.slice(1); if (s.req === k) { s.req = null; s.side = 'A'; $('bA').value = ''; setPet('B', ''); return; } s.req = k; var q2 = k.split(':'); $('bA').value = q2[0]; PK.used(c.p.id, false); setPet('B', q2[1]); return; }
        if (s.req) { s.req = null; $('bA').value = ''; $('bB').value = ''; }
        var sd = slotKey === 'A' || slotKey === 'B' ? slotKey : side; if (sd === 'B' && !$('bA').value) sd = 'A';
        if (sd === 'A' && c.p.owner !== ME) { UI.toast('#' + c.p.id + ' is not yours: it can only be the date.'); return; }
        PK.used(c.p.id, c.p.owner === ME); (s.pa || {}).q = ''; (s.pb || {}).q = '';
        if (sd === 'A' && s.shB === 'asks') s.shB = 'best'; /* your own pet picked: show dates for it (the pink bar keeps the requests one tap away) */
        s.side = sd === 'A' && !$('bB').value ? 'B' : sd; setPet(sd, k); } };
    if (dual) cfg.dual = { A: cA, B: cB }; else { cfg.prompt = cur.prompt; cfg.shelves = cur.shelves; cfg.shelf = cur.shelf; cfg.searchList = cur.searchList; cfg.searchPh = cur.searchPh; cfg.look = cur.look; cfg.missWhy = cur.missWhy; cfg.selected = cur.selected; cfg.sorts = cur.sorts; cfg.sortOn = cur.sortOn; }
    PK.render(el, cfg, cur.st);
    if (window.matchMedia && !ST.mqOn) { ST.mqOn = true; var mq = matchMedia('(min-width: 900px)'), re = function () { var u = U(); if (u && u.world) breed(u.world()); }; if (mq.addEventListener) mq.addEventListener('change', re); else if (mq.addListener) mq.addListener(re); }
    /* one-search (Nov 24 2026): no second "Look up a mate" box. The date side's search box looks up a typed pet number or wallet itself (V2Pick look).
     * Other players still get a first screen from the top players when the date side opens. */
    if (window.V2Lookup && V2Lookup.warm && (side === 'B' || dual)) V2Lookup.warm(function () { var u = U(); if (u && u.render) u.render(); });
    /* 3 · one button (the motel bell / the desk Accept, unchanged) */
    var label, ok = false, hint = '';
    if (s.req) { var acc = document.querySelector('#motelReqs [data-bracc="' + s.req + '"]'), no = document.querySelector('#motelReqs [data-mrk="' + s.req + '"] .mr-no');
      ok = !!acc; label = acc ? '💞 Accept request · burn ' + (window.V2Rules && V2Rules.uiBreedFeeStr ? V2Rules.uiBreedFeeStr() : '690') + ' XCPETS' : '🚫 ' + (no ? no.textContent.replace(/^🚫\s*/, '') : 'Can’t accept this request right now'); hint = 'The egg goes to the requester. Your pet gets the stat carry, not the egg.'; }
    else if (!A) label = 'Pick your pet';
    else if (!Bp) label = 'Pick a date';
    else { var bell = $('bGo'); ok = bell && !bell.disabled; label = '🛎️ ' + (bell ? bell.textContent.replace(/^🛎️\s*/, '') : 'Check in · 690') + ' XCPETS';
      hint = Bp.owner === ME ? 'Both yours: one burn, the egg appears when it confirms.' : 'Another wallet’s pet: their owner has ' + (Vr.BREED_WINDOW || 144) + ' blocks to accept at Gooby’s desk.'; }
    if (flip) hint = UI.breedFlipText(flip);
    var od = '';
    if (P1 && P2 && M && M.odds) { try { var o2 = M.odds(Vr, P1, P2); od = '<div class="ez-odds"><b>ODDS</b> ' + o2.sp.map(function (x) { return esc(x[0]) + ' ' + x[1].toFixed(x[1] === 100 ? 0 : 1) + '%'; }).join(' · ') + ' · ' + TL[o2.hiT] + ' ' + o2.tier.hi.toFixed(1) + '%' + (o2.tier.up ? ' · ⬆ ' + TL[Math.min(3, o2.hiT + 1)] + ' ' + o2.tier.up.toFixed(1) + '%' : '') + (o2.tier.lo ? ' · ' + TL[o2.loT] + ' ' + o2.tier.lo.toFixed(1) + '%' : '') + '</div>'; } catch (e) { od = ''; }
      od += pairCard(P1, P2, T + 1); od = '<details class="pk2-dt"><summary>🔬 Egg details: odds and stats</summary>' + od + '</details>'; }
    if (P1 && P2) { try { od = rolesBox(P1, P2, rmode, T + 1) + od; } catch (e) { } try { od = specialNote(P1, P2, T + 1) + od; } catch (e) { } }
    placeCheck('<div class="ez-checkin" role="region" aria-label="Check in">' + od + (flip ? UI.breedFlipNote(flip) : '') + '<div class="ez-acts"><button type="button" class="btn ico-egg ez-go" id="ezBGo"' + (ok ? '' : ' disabled') + '>' + esc(label) + '</button></div><div class="ez-hint">' + (flip ? '' : esc(hint)) + (view ? ' 👀 View only: connect the wallet that owns these pets to burn. Nothing is signed from this page until you confirm.' : (flip ? '' : ' Motel check-in (pet:breed), not the daily WAGMI check-in.')) + '</div></div>');
    if ($('ezCheck')) sprites($('ezCheck'), w);
    ['A', 'B'].forEach(function (k) { var so = $('ezBs' + k); if (so) so.onchange = function () { s['s' + k.toLowerCase()] = this.value; if (k === 'A') s.shA = 'best'; else s.shB = 'best'; redraw(); }; });
    [['ezFsp', 'fsp'], ['ezFst', 'fst'], ['ezFrar', 'frar']].forEach(function (f) { var se = $(f[0]); if (se) se.onchange = function () { s[f[1]] = this.value; redraw(); }; });
    [['ezFall', 'fall'], ['ezFslot', 'fslot']].forEach(function (f) { var bt = $(f[0]); if (bt) bt.onclick = function () { s[f[1]] = !s[f[1]]; redraw(); }; });
    if ($('ezFclr')) $('ezFclr').onclick = function () { s.fsp = ''; s.fst = ''; s.frar = ''; s.fall = false; s.fslot = false; redraw(); };
    if ($('pkFx')) $('pkFx').ontoggle = function () { s.fx = this.open; };
    if ($('ezWays')) $('ezWays').ontoggle = function () { s.ways = this.open; };
    $('ezBGo').onclick = function () { if (s.req) { var acc = document.querySelector('#motelReqs [data-bracc="' + s.req + '"]'); if (acc) acc.click(); return; } var bell = $('bGo'); if (bell && !bell.disabled) bell.click(); }; }

  /* hooks: repaint after the existing face-off / motel renders (their state stays the single source of truth) */
  window.V2Easy = { rolesBox: rolesBox, specialNote: specialNote, carryOf: carryOf, fight: function (w) { try { fight(w); } catch (e) { console.warn('easy fight', e); } }, breed: function (w) { try { breed(w); } catch (e) { console.warn('easy breed', e); } } };
  if (window.V2Motel && V2Motel.render) { var mr = V2Motel.render; V2Motel.render = function (w) { var r = mr.apply(this, arguments); V2Easy.breed(w); return r; }; }
  if (!document.getElementById('ezCss')) { var cs = document.createElement('style'); cs.id = 'ezCss';
    cs.textContent = 'body.pk2-motel #lfDock{display:none}.ez-ffoot{margin-top:10px}.ez-ffoot .pk2-dt{margin:0 0 8px}.pk2-fx,.pk2-dt{margin:8px 0 0;border:2px solid #4b3f7a;background:#120e22}.pk2-fx>summary,.pk2-dt>summary{cursor:pointer;padding:8px;font-weight:bold;color:#ffd84d;min-height:28px}.pk2-fx>*:not(summary){margin:4px 8px 8px}.pk2-dt>*:not(summary){margin:4px 6px 6px}.pk2-look{margin:0 0 8px}' +
      '.ez-on>#faceoff,.ez-on>.ar-h{display:none}#breedPanel.ez-on .motel-bell,#breedPanel.ez-on #motelDesk .mt-guests,#breedPanel.ez-on #motelDesk .mt-browse,#breedPanel.ez-on #motelDesk #motelPick,#breedPanel.ez-on #motelDesk .mt-odds,#breedPanel.ez-on #motelDesk .mt-hint,#breedPanel.ez-on #motelDesk .brv-flip{display:none}' +
      '.ez-roles.ez-spx{background:#3a1d12}.ez-roles.ez-spx .ez-rh{color:#ffb84d}.ez-spt{font-size:13px;line-height:1.4;color:#fff3e6}' +
      '.ez-roles{margin:6px 0 8px;border:3px solid #000;background:#2b1946;box-shadow:3px 3px 0 #000;padding:6px 8px;color:#fff}.ez-rh{font-family:"Press Start 2P",monospace;font-size:10px;color:#ffd166;margin:0 0 6px;letter-spacing:1px}' +
      '.ez-rr{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ez-roles.same .ez-rr{grid-template-columns:1fr}.ez-rc{display:flex;gap:8px;align-items:flex-start;border:2px solid #000;padding:6px;min-width:0}.ez-rc.egg{background:#1e3a2a}.ez-rc.car{background:#22284a}' +
      '.ez-rsp canvas{width:48px;height:48px;image-rendering:pixelated;display:block}.ez-rt{min-width:0;font-size:13px;line-height:1.35}.ez-rt small{display:block;color:#e6e0ff;font-size:12px;margin-top:2px}.ez-rb{display:block;font-family:Bangers,Impact,sans-serif;font-size:17px;letter-spacing:.5px;color:#3ddc84}.ez-rc.car .ez-rb{color:#7ad7ff}' +
      '@media (max-width:520px){.ez-rr{grid-template-columns:1fr}}' +
      '.ez-pair{margin:6px 0;border:3px solid #000;background:#1b1530;box-shadow:3px 3px 0 #000;padding:6px;color:#fff}.ez-pair table{border-collapse:collapse;width:100%;margin-top:4px}.ez-pair th,.ez-pair td{padding:2px 4px;text-align:center;border-bottom:1px solid #3a2d55}.ez-pair th:first-child{text-align:left}.ez-pair td.eg{color:#ffe066}.ez-pair i{font-style:normal;font-size:.8em;background:#3c9a2e;color:#fff;padding:0 3px;margin-left:2px}.ez-pair tr.tot th,.ez-pair tr.tot td{border-top:2px solid #000;font-weight:bold}.ez-pass{margin:4px 0 0;padding-left:16px;font-size:.85em}.hs-bfp{margin-top:6px;border-top:2px dashed #3a2d55;padding-top:4px}.hs-bfp p{margin:2px 0;font-size:.9em}' +
      '.ez{margin:8px 0}.ez-box{border:3px solid #000;background:#1b1530;box-shadow:4px 4px 0 #000;padding:8px;min-width:0}.ez-breed .ez-box{background:#2a1530}.ez-lead{margin:4px 0 8px;color:#fff}' +
      '.ez-hd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:4px 0}.ez-hd b{color:#ffd166;font-size:15px}.ez-n{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;background:#ffd166;color:#140f24;font-weight:700;border:2px solid #000}' +
      '.ez-q{flex:1 1 140px;min-width:0;max-width:260px;min-height:36px;padding:4px 8px;border:2px solid #000;background:#fff8e1;color:#1b1b1b;font:inherit;font-size:14px}.ez-cnt{font-size:12px;color:#9fe8ff}' +
      '.ez-strip{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;padding:4px 2px 8px;min-width:0;-webkit-overflow-scrolling:touch}' +
      '.ez-c{flex:0 0 112px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 4px;border:2px solid #4b3f7a;background:#120e22;color:#fff;font:inherit;font-size:12px;line-height:1.25;cursor:pointer;position:relative;text-align:center;min-width:0}' +
      '.ez-c:hover{border-color:#9fe8ff}.ez-c.on{border:3px solid #ffd166;background:#3a2a10;box-shadow:0 0 0 2px #000}.ez-c.on::before{content:"▼";position:absolute;top:-4px;left:50%;transform:translateX(-50%);color:#ffd166;font-size:12px}.ez-c.no{opacity:.55}' +
      '.ez-sp canvas{width:56px;height:56px;image-rendering:pixelated;display:block}.ez-nm{font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ez-id{color:#b9b0d6}.ez-c .pill.tier{font-size:11px;white-space:nowrap}' +
      '.ez-l{color:#d9d2f0;max-width:100%;overflow-wrap:anywhere}.ez-why{color:#ff9a9a;font-weight:700}.ez-tag{font-size:10px;font-weight:700;background:#4b3f7a;padding:1px 3px;max-width:100%;overflow-wrap:anywhere}.ez-tag.me{background:#4fd18b;color:#0d1a12}' +
      '.ez-more,.ez-empty{flex:0 0 auto;align-self:center;color:#9fe8ff;font-size:13px;padding:6px;margin:0}' +
      '.ez-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 4px}.ez-tab{min-height:36px;padding:4px 10px;border:2px solid #000;background:#f5efe0;color:#2a1530;font:inherit;font-size:13px;box-shadow:2px 2px 0 #000;cursor:pointer}.ez-tab.on{background:#4fd18b;color:#0d1a12}.ez-tab.hot:not(.on){background:#ff9ad5}' +
      '.ez-check{position:sticky;top:calc(var(--navh, 48px) + 4px);z-index:6;margin:8px 0}.ez-checkin{border:3px solid #000;background:#2a1530;box-shadow:4px 4px 0 #000;padding:8px}.ez-foot{border-top:2px dashed #4b3f7a;margin-top:4px;padding-top:6px}.ez-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ez-go{flex:1 1 260px;min-height:52px;font-size:17px}.ez-go[disabled]{opacity:.6;cursor:default}' +
      '.ez-hint{font-size:12px;color:#c9c0e6;margin-top:4px;overflow-wrap:anywhere}.ez-hint.ez-res{color:#ffe58a;margin:4px 0 6px;padding:4px 6px;border:1px dashed #c9b24a;background:#1d1830}.ez-odds{font-size:13px;background:#ffd166;color:#1b1b1b;border:2px solid #000;padding:4px 6px;margin-bottom:6px;overflow-wrap:anywhere}' +
      '.ez-cmp{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:13px;margin-bottom:6px;color:#fff}.ez-vs{color:#ff5a7a;font-weight:700}.ez-st{display:flex;flex-wrap:wrap;gap:4px;flex-basis:100%}.ez-st i{font-style:normal;font-size:11px;padding:1px 4px;background:#2a2342}.ez-st i.up{color:#4fd18b}.ez-st i.dn{color:#ff8080}' +
      '.ez-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:start}.ez-col{min-width:0;border:2px solid #4b3f7a;background:#1b1530;padding:4px 6px}.ez-col .ez-q{max-width:none}' +
      /* owner 4:26 AM CT: each slot list scrolls up and down (fixed-height column, touch scroll) instead of sideways */
      '.ez-col .ez-strip{display:flex;flex-direction:column;flex-wrap:nowrap;align-items:stretch;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;scroll-snap-type:none;height:440px;padding:6px 4px 6px 2px;border-top:2px dashed #4b3f7a}.ez-col .ez-c{min-width:0;width:100%;height:auto;flex:0 0 auto;max-width:none}.ez-col .ez-more,.ez-col .ez-empty{flex:1 1 100%;text-align:center}' +
      '.ez-so{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#9fe8ff;white-space:nowrap;min-width:0}.ez-so select{font:inherit;font-size:12px;min-height:36px;max-width:100%;min-width:0;background:#14122b;color:#fff;border:2px solid #000;padding:2px 4px}' +
      /* hotel-mate-sort: side by side down to phones; at <=520 the cards and controls go compact; only under 340px (a column would drop under one readable 72px card + controls) they stack */
      '@media (max-width:520px){.ez-cols{gap:4px}.ez-col{padding:3px}.ez-col .ez-hd{gap:4px}.ez-col .ez-hd b{font-size:12px;flex:1 1 auto;min-width:0}.ez-col .ez-q,.ez-col .ez-so{flex:1 1 100%}.ez-col .ez-so select{flex:1}.ez-col .ez-cnt{font-size:11px}.ez-col .ez-strip{gap:4px;height:400px}.ez-col .ez-c{flex:0 0 auto;width:100%;max-width:none;font-size:11px;padding:4px 2px}.ez-col .ez-l{font-size:10px}.ez-col .ez-sp canvas{width:40px;height:40px}.ez-col .ez-nm{font-size:12px}.ez-col .ez-c .pill.tier{font-size:10px}.ez-col .ez-tab{font-size:11px;padding:3px 6px}}' +
      '@media (max-width:339px){.ez-cols{grid-template-columns:minmax(0,1fr)}}' +
      '@media (max-width:520px){.ez-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.ez-tab{flex:0 0 auto;white-space:nowrap;font-size:12px;padding:4px 8px}.ez-c{flex-basis:100px}.ez-sp canvas{width:48px;height:48px}.ez-go{font-size:15px;flex-basis:100%}.ez-q{max-width:none}}' +
      '.ez-fb{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:0 0 6px}.ez-fbl{font-size:12px;opacity:.85}.ez-fb .ez-so select{max-width:150px}.ez-chip{font-size:12px;padding:3px 8px}' +
      '.hs-g{color:#7dffb0;font-size:10px}.hs-wb{margin:6px 0;border:2px solid #4b3f7a;background:#120e22}.hs-wb>summary{cursor:pointer;padding:6px 8px;font-weight:bold;color:#ffd84d;list-style-position:inside}' +
      '.hs-wg{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:6px;padding:0 6px 6px}.hs-ways{border:2px dashed #4b3f7a;padding:6px 8px;font-size:12px;line-height:1.35}' +
      '.hs-wh{margin-bottom:4px}.hs-up{color:#7dffb0}.hs-st{display:flex;flex-wrap:wrap;gap:4px 10px;margin-bottom:4px;opacity:.9}.hs-pt,.hs-sx{margin:2px 0 4px;padding-left:16px}' +
      '.hs-pt li span{margin-right:6px}.hs-pt li b{color:#ffd84d}.hs-sx li{margin:2px 0}.hs-nx{display:block;margin-top:4px}.hs-ed{margin:4px 0 0;opacity:.75;font-size:11px}' +
      '@media (max-width:520px){.ez-fb{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:3px}.ez-fb>*{flex:0 0 auto}.ez-fb .ez-so select{max-width:120px}.hs-wg{grid-template-columns:1fr}.hs-ways{font-size:11.5px}}';
    (document.head || document.documentElement).appendChild(cs); }
  var w0 = window.V2UI && V2UI.world && V2UI.world(); if (w0) { if (window.UXB && UXB.setFace) { V2Easy.fight(w0); } V2Easy.breed(w0); }
})();
