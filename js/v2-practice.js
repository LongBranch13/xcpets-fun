/* PRACTICE MODE (guest play, owner approved Nov 1 2026 9:28 PM CT, preview branch practice-mode-1101).
 * No wallet. Guests hatch, feed and raise PRETEND pets that live only in this browser (localStorage key 'xcpets-practice-v1').
 * Practice pets never touch the chain: no burns, no signing, no wallet calls, no network reads. The real game, rankings, feeds and replay
 * never read the practice key, so practice pets can never show up there.
 * Reused, read only: PetCore + V2Rules.hatchArt (the real egg roll: tiers, species, looks), V2Rules.thresholdsFor / mealFor / stageFor
 * (the real stage lines and meal sizes), V2Render.framesWith / animate (the real pixel pets) and V2LifeAnim.play (the real hatch, feed,
 * grow and Mythic scenes). Rule files are not changed. Practice amounts are the base game sizes (halvings make the real ones smaller). */
(function () {
  'use strict';
  var KEY = 'xcpets-practice-v1', START_BAL = 100000, MAX_PETS = 300, SHOW = 48;
  var REF_BLOCK = 974204; /* which rule set the practice egg roll uses (a recent block); never a chain read */
  var HATCH = [{ n: 1, cost: 69, label: '1 egg' }, { n: 12, cost: 690, label: 'Dozen (12 eggs)' }, { n: 144, cost: 6900, label: 'Case (144 eggs)' }];
  var NAMES = ['Pip', 'Bean', 'Mochi', 'Nugget', 'Pixel', 'Biscuit', 'Sprout', 'Tofu', 'Pebble', 'Waffle', 'Noodle', 'Button', 'Clover', 'Dumpling', 'Taco', 'Peanut'];
  var R = window.V2Rules, PC = window.PetCore, VR = window.V2Render, LA = window.V2LifeAnim;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var S = null, artCache = {}, showAll = false;

  function fresh() { return { v: 1, practice: true, bal: START_BAL, day: 1, nextId: 1, pets: [], log: [], nudged: 0 }; }
  function load() { try { var o = JSON.parse(localStorage.getItem(KEY)); if (o && o.v === 1 && o.practice === true && Array.isArray(o.pets)) return o; } catch (e) { } return fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function hex64() { var a = new Uint8Array(32), s = ''; (window.crypto || window.msCrypto).getRandomValues(a); for (var i = 0; i < 32; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16); return s; }
  function note(t) { S.log.unshift('Day ' + S.day + ': ' + t); S.log = S.log.slice(0, 40); }

  /* ---- the real egg roll, kept to normal pets: never an edition / 1 of 1 / special egg, never a flame crown */
  var NORMAL = {}; (R && R.SPECIES12 || []).forEach(function (s) { NORMAL[s.id] = 1; });
  function okArt(a) { return a && NORMAL[a.species] && !a.rareTier && !a.boMark && !a.rpMark && !a.boLook && !a.rpLook && !a.supreme && !a.contest && !a.community && !a.edition && !a.burnLord; }
  function rollArt(bh, pid) { for (var k = 0; k < 8; k++) { var a = R.hatchArt(bh, pid + (k ? ':' + k : ''), REF_BLOCK); if (okArt(a)) return { a: a, k: k }; } return { a: PC.generate({ blockHash: bh, petId: pid, blockHeight: REF_BLOCK }), k: -1 }; }
  function tidy(a) { a = Object.assign({}, a); if (a.crown === 'flame-crown') a.crown = 'jeweled-crown'; delete a.auraFire; delete a.edition; delete a.goldFrame; return a; }
  function artOf(p) { if (artCache[p.id]) return artCache[p.id]; var a = p.k === -1 ? PC.generate({ blockHash: p.bh, petId: p.pid, blockHeight: REF_BLOCK }) : R.hatchArt(p.bh, p.pid + (p.k ? ':' + p.k : ''), REF_BLOCK); return (artCache[p.id] = tidy(a)); }
  function th(p) { return R.thresholdsFor(artOf(p).species, REF_BLOCK); }
  function stageOf(p) { return R.stageFor(p.care, th(p)); }
  function meal(p) { return R.mealFor(p.care, artOf(p).species, REF_BLOCK); }
  function tierName(p) { var t = PC.TIERS[artOf(p).tierIndex | 0]; return t ? t.label : 'Common'; }
  function spName(p) { var sp = artOf(p).species, L = PC.SPECIES.filter(function (s) { return s.id === sp; })[0]; return L ? L.label : sp; }
  function hungry(p) { return stageOf(p) < 5 && p.fedDay !== S.day; }
  function world() { var by = {}, pets = S.pets.map(function (p) { var q = { id: p.id, name: p.name + ' · PRACTICE', stage: stageOf(p), art: artOf(p), practice: true }; by[p.id] = q; return q; }); return { pets: pets, byId: by, log: [], items: {}, practice: true }; }

  /* ---- practice burns: only the practice balance in this browser goes down */
  function spend(n) { if (S.bal < n) { msg('Not enough practice coins. Tap “Refill practice coins” (they are pretend).'); return false; } S.bal = Math.round((S.bal - n) * 1e8) / 1e8; return true; }
  function hatch(i) { var h = HATCH[i]; if (!h) return; if (S.pets.length + h.n > MAX_PETS) { msg('Practice holds up to ' + MAX_PETS + ' pets. Tap “Start over” to clear the nest.'); return; } if (!spend(h.cost)) return;
    var bh = hex64(), ids = [];
    for (var j = 0; j < h.n; j++) { var id = S.nextId++, pid = 'practice:' + id, r = rollArt(bh, pid), p = { id: id, bh: bh, pid: pid, k: r.k, name: NAMES[parseInt(bh.slice(j % 60, j % 60 + 2), 16) % NAMES.length], care: 0, fedDay: 0, born: S.day };
      p.care = R.thresholdsFor(r.a.species, REF_BLOCK)[1]; /* a hatched egg starts as a Hatchling, as in the real game */ S.pets.push(p); ids.push(id); }
    note('practice hatch: ' + h.label + ' for ' + fmt(h.cost) + ' practice coins'); save(); render();
    var w = world(); scene(function (done) { LA.hatch(w, ids, done); }, function () { msg('🥚 ' + (h.n > 1 ? h.n + ' practice eggs hatched!' : 'Your practice egg hatched!') + ' Feed them once a day to help them grow.'); nudge(); }); }
  function feed(ids) { var fed = [], cost = 0, grew = [], myth = [], first = null;
    ids.forEach(function (id) { var p = byId(id); if (!p || !hungry(p)) return; var m = meal(p); if (m <= 0) return; if (S.bal < cost + m) return; var s0 = stageOf(p), a = p.care / th(p)[5]; cost += m; p.care += m; p.fedDay = S.day; fed.push(id);
      var s1 = stageOf(p); if (!first) first = { a: a, b: Math.min(1, p.care / th(p)[5]) }; if (s1 === 5 && s0 < 5) myth.push(id); else if (s1 > s0) grew.push({ id: id, to: s1 }); });
    if (!fed.length) { msg(S.bal < 1 ? 'Not enough practice coins.' : 'Everyone has eaten today. Tap “Next practice day”.'); return; }
    spend(cost); note('practice feed: ' + fed.length + ' pet' + (fed.length > 1 ? 's' : '') + ' for ' + fmt(cost) + ' practice coins'); save(); render();
    var w = world(), q = [{ kind: 'feed', ids: fed.slice(0, 5), n: fed.length, care: first }];
    if (myth.length) q.push({ kind: 'mythic', ids: [myth[0]], n: myth.length }); else if (grew.length) q.push({ kind: 'stage', ids: [grew[0].id], to: grew[0].to, n: grew.length });
    (function next() { var ev = q.shift(); if (!ev) { msg('🍖 Fed ' + fed.length + ' practice pet' + (fed.length > 1 ? 's' : '') + '. ' + (myth.length ? '🌈 Mythic!' : grew.length ? '✨ Grew a stage!' : 'Come back next practice day.')); nudge(); return; } scene(function (done) { LA.play(ev, { w: w, done: done, noQueue: true }); }, next); })(); }
  function nextDay() { S.day++; note('a new practice day'); save(); render(); msg('☀️ Practice day ' + S.day + '. Your pets are hungry again.'); }
  function refill() { S.bal = START_BAL; note('practice coins refilled'); save(); render(); msg('Practice coins refilled to ' + fmt(START_BAL) + ' (pretend, free).'); }
  function reset() { if (!window.confirm('Start over? This clears your practice pets in this browser. Real pets are not affected.')) return; S = fresh(); artCache = {}; save(); render(); msg('Practice nest cleared.'); }
  function byId(id) { for (var i = 0; i < S.pets.length; i++) if (S.pets[i].id === id) return S.pets[i]; return null; }

  /* ---- scenes: the real pixel scenes, with a PRACTICE watermark (css) on the overlay */
  function scene(run, then) { document.body.classList.add('pr-scene'); var ended = false, fin = function () { if (ended) return; ended = true; document.body.classList.remove('pr-scene'); then && then(); }; try { if (LA) return run(fin); } catch (e) { } fin(); }
  function msg(t) { var m = $('prMsg'); if (m) m.textContent = t; }
  function nudge() { var big = S.pets.some(function (p) { return stageOf(p) >= 2; }); if (S.nudged >= 2 || (S.nudged === 1 && !big)) return; S.nudged++; save(); var n = $('prNudge'); if (n) { n.hidden = false; n.classList.remove('pr-pop'); void n.offsetWidth; n.classList.add('pr-pop'); } }

  /* ---- page */
  function card(p) { var s = stageOf(p), t = th(p), m = meal(p), pct = Math.min(100, Math.round(p.care / t[5] * 100)), hu = hungry(p);
    return '<div class="pr-card t' + (artOf(p).tierIndex | 0) + '" data-id="' + p.id + '"><span class="pr-badge">PRACTICE</span><canvas width="32" height="32" class="pr-pix" aria-label="Practice pet ' + p.id + '"></canvas>' +
      '<div class="pr-name">' + esc(p.name) + ' <span class="muted">P' + p.id + '</span></div><div class="small">' + esc(tierName(p)) + ' ' + esc(spName(p)) + ' · ' + PC.STAGES[s] + '</div>' +
      '<div class="pr-bar" title="Care ' + fmt(p.care) + ' of ' + fmt(t[5]) + ' (Mythic)"><i style="width:' + pct + '%"></i></div><div class="small muted">Care ' + fmt(p.care) + (s < 5 ? ' · next stage at ' + fmt(t[s + 1]) : ' · Mythic, never hungry') + '</div>' +
      (s >= 5 ? '<div class="small pr-done">🌈 Mythic</div>' : hu ? '<button class="btn pr-feed" type="button" data-feed="' + p.id + '">Feed (' + fmt(m) + ')</button>' : '<div class="small muted pr-done">😋 Fed today</div>') + '</div>'; }
  function render() { $('prBal').textContent = fmt(S.bal); $('prDay').textContent = S.day; $('prCount').textContent = S.pets.length;
    var hu = S.pets.filter(hungry), cost = hu.reduce(function (a, p) { return a + meal(p); }, 0);
    $('prFeedAll').disabled = !hu.length; $('prFeedAll').textContent = hu.length ? 'Feed all hungry (' + hu.length + ' pets, ' + fmt(cost) + ')' : 'Everyone ate today';
    HATCH.forEach(function (h, i) { var b = $('prHatch' + i); if (b) b.disabled = S.bal < h.cost; });
    var list = S.pets.slice().reverse(), shown = showAll ? list : list.slice(0, SHOW), g = $('prPets');
    g.innerHTML = list.length ? shown.map(card).join('') : '<p class="pr-empty">No practice pets yet. Hatch an egg above: it costs practice coins only.</p>';
    $('prMore').hidden = showAll || list.length <= SHOW; $('prMore').textContent = 'Show all ' + list.length + ' practice pets';
    Array.prototype.forEach.call(g.querySelectorAll('.pr-card'), function (el) { var p = byId(+el.dataset.id), c = el.querySelector('canvas'); try { VR.animate(c, VR.framesWith(artOf(p), stageOf(p), [])); } catch (e) { try { VR.paint(c, PC.renderFrames(artOf(p), { stage: stageOf(p), frames: 1 })[0]); } catch (e2) { } } });
    $('prLog').innerHTML = S.log.slice(0, 8).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join(''); }
  function boot() { if (!R || !PC || !VR || !$('practice')) return; S = load();
    HATCH.forEach(function (h, i) { var b = $('prHatch' + i); if (b) b.onclick = function () { hatch(i); }; });
    $('prFeedAll').onclick = function () { feed(S.pets.filter(hungry).map(function (p) { return p.id; })); };
    $('prNext').onclick = nextDay; $('prRefill').onclick = refill; $('prReset').onclick = reset; $('prMore').onclick = function () { showAll = true; render(); };
    $('prPets').addEventListener('click', function (e) { var b = e.target.closest('[data-feed]'); if (b) feed([+b.dataset.feed]); });
    render(); }
  window.V2Practice = { KEY: KEY, REF_BLOCK: REF_BLOCK, HATCH: HATCH, state: function () { return S; }, hatch: hatch, feed: feed, nextDay: nextDay, refill: refill, world: world, okArt: okArt, tidy: tidy };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
