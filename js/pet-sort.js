/* XCPETS shared pet sort (pet-sort 2026-10-24, hotel-power-sort 2026-10-24). Used by the egg review (js/v2.js drawReveal) and Gooby's Hotel
 * (js/v2-easy-flows.js, Parent 1 and Mate lists).
 * Power = ⚡ the stat total (vigor + spark + grit + zoom + luck, same as V2Rules.petPower / My Pets / fight picker). It used to read the
 * Pet Score (⭐, js/pet-score.js), so "Power: high to low" at the hotel listed pets in Pet Score order. Pet Score is now its own sort.
 * Every key sorts both ways: k = high to low (A to Z for species, oldest first for age), k + '-' = the other way. '' = the list's own order.
 * Ties always keep the incoming order. Display only: reads pets, changes nothing.
 * PetSort.ways(w, p, b): what makes up a pet's Power and the next steps that raise it, from the rules in js/v2-rules.js only. */
(function () {
  'use strict';
  var window = typeof globalThis !== 'undefined' ? globalThis : this; /* browser: the page window; node: the test global */
  var V = function () { return window.V2Rules || {}; };
  var STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'], SL = { vigor: 'Vigor', spark: 'Spark', grit: 'Grit', zoom: 'Zoom', luck: 'Luck' };
  function power(p) { var s = (p && p.stats) || {}; return Object.keys(s).reduce(function (a, k) { return a + (Number(s[k]) || 0); }, 0); }
  function score(w, p) { var s = window.PetScore && PetScore.of ? PetScore.of(w, p) : null; return s ? s.score : -1; }
  function tier(p) { return p.art && p.art.tierIndex != null ? p.art.tierIndex : (p.tier || 0); }
  function sp(p) { var R = V(), s = String(p.species), h = R.isHybrid ? R.isHybrid(s) : /^hyb3?:/.test(s), lab = function (x) { return String(R.speciesLabel ? R.speciesLabel(x) : x).toLowerCase(); };
    return h ? [lab(s.split(':')[1]), 1, lab(s)] : [lab(s), 0, '']; }
  var QCAP = 3; /* QUEST_STAT_CAP in js/v2-rules.js: a Legendary Haul adds +1 to a favoured stat, up to 3 times per pet */
  function gain(p) { return !p || p.dead || p.released ? 0 : Math.max(0, QCAP - (p.questBoost || 0)); }
  function worn(w, p) { var R = V(); try { return R.wornOf ? R.wornOf(w, p.id).length : 0; } catch (e) { return 0; } }
  function looks(w, p) { var R = V(), n = 0; try { n += R.shownLooks ? R.shownLooks(w, p).length : 0; } catch (e) { } try { if (!R.shownLooks && R.earnedLooks) n += R.earnedLooks(p).length; } catch (e) { } return n; }
  function bleft(p, b) { var R = V(); try { var x = R.breedsLeft ? R.breedsLeft(p, b) : null; return x ? x.left : -(p.breeds || 0); } catch (e) { return 0; } }
  function free(p) { var o = p.openSlots; return Array.isArray(o) ? o.length : Number(o) || 0; } /* openSlots is the list of free slot names */
  function wr(p) { var n = (p.wins || 0) + (p.losses || 0); return n ? (p.wins || 0) / n : -1; }
  /* KEYS: [key, menu label, high-first words, low-first words, value(w, p, b), card line(w, p, b) or null] */
  var KEYS = [
    ['pow', '⚡ Power', 'high to low', 'low to high', function (w, p) { return [power(p), score(w, p)]; }],
    ['gain', '⚡ Power to gain', 'most first', 'least first', function (w, p) { return [gain(p), power(p)]; }, function (w, p) { return '⚡ +' + gain(p) + ' to gain'; }],
    ['vigor'], ['spark'], ['grit'], ['zoom'], ['luck'],
    ['sc', '⭐ Pet Score', 'high to low', 'low to high', function (w, p) { return [score(w, p)]; }],
    ['rar', '💎 Rarity', 'high to low', 'low to high', function (w, p) { return [tier(p), power(p)]; }],
    ['stage', '🌱 Stage', 'Mythic first', 'youngest stage first', function (w, p) { return [p.stage || 0, p.care || 0]; }, function (w, p) { return '🌱 ' + (p.stageName || ''); }],
    ['sp', '🧬 Species', 'A to Z', 'Z to A', null],
    ['age', '🎂 Age', 'oldest first', 'youngest first', function (w, p) { return [-(p.hatchBlock || 0), -p.id]; }, function (w, p) { return '🎂 ' + (p.ageDays || 0) + ' days'; }],
    ['gen', '🌳 Generation', 'high to low', 'low to high', function (w, p) { var R = V(); return [R.genOf ? R.genOf(w, p) : 0]; }],
    ['bl', '💞 Breeds left', 'most first', 'least first', function (w, p, b) { return [bleft(p, b)]; }],
    ['wins', '🏆 Fight wins', 'most first', 'least first', function (w, p) { return [p.wins || 0, wr(p)]; }, function (w, p) { return '🏆 ' + (p.wins || 0) + ' wins · ' + (p.losses || 0) + ' losses'; }],
    ['wr', '🏆 Win rate', 'high to low', 'low to high', function (w, p) { return [wr(p), p.wins || 0]; }, function (w, p) { var r = wr(p); return '🏆 ' + (r < 0 ? 'no fights' : Math.round(r * 100) + '% of ' + ((p.wins || 0) + (p.losses || 0))); }],
    ['care', '🔥 XCPETS fed', 'most first', 'least first', function (w, p) { return [p.care || 0]; }, function (w, p) { return '🔥 ' + Math.round(p.care || 0).toLocaleString('en-US') + ' fed'; }],
    ['gear', '🛡️ Gear worn', 'most first', 'least first', function (w, p) { return [worn(w, p)]; }, function (w, p) { return '🛡️ ' + worn(w, p) + ' worn · ' + free(p) + ' free'; }],
    ['slots', '🛡️ Free gear slots', 'most first', 'least first', function (w, p) { return [free(p), p.capacity || 0]; }, function (w, p) { return '🛡️ ' + free(p) + ' free slots'; }],
    ['looks', '✨ Looks', 'most first', 'least first', function (w, p) { return [looks(w, p)]; }, function (w, p) { return '✨ ' + looks(w, p) + ' looks'; }]];
  KEYS.forEach(function (K) { if (!K[1]) { var s = K[0]; K[1] = '📊 ' + SL[s]; K[2] = 'high to low'; K[3] = 'low to high'; K[4] = function (w, p) { return [((p.stats || {})[s]) || 0, power(p)]; }; K[5] = function (w, p) { return '📊 ' + SL[s] + ' ' + (((p.stats || {})[s]) || 0); }; } });
  var BY = {}; KEYS.forEach(function (K) { BY[K[0]] = K; });
  /* the egg review keeps its short menu (now with the real Power) */
  var OPTS = [['', 'Hatch order'], ['rar', 'Rarity: high to low'], ['rar-', 'Rarity: low to high'], ['pow', 'Power: high to low'], ['pow-', 'Power: low to high'], ['sc', 'Pet Score: high to low'], ['sp', 'Species: A to Z']];
  function cmp(A, B) { for (var i = 0; i < A.length; i++) { var a = A[i], b = B[i]; if (a !== b) return typeof a === 'string' ? (a < b ? -1 : 1) : (b - a); } return 0; }
  /* sort(w, list, k, pet?, b?) -> new array; pet(x) maps an item to its pet (default: the item is the pet) */
  function sort(w, list, k, pet, b) { if (!k) return list; pet = pet || function (x) { return x; }; var rev = k.slice(-1) === '-', key = rev ? k.slice(0, -1) : k, K = BY[key]; if (!K) return list;
    var rows = list.map(function (x, i) { var p = pet(x); return { x: x, i: i, k: key === 'sp' ? sp(p) : K[4](w, p, b) }; });
    rows.sort(function (a, c) { if (key === 'sp') { var A = a.k, B = c.k, d = (A[0] < B[0] ? -1 : A[0] > B[0] ? 1 : 0) || A[1] - B[1] || (A[2] < B[2] ? -1 : A[2] > B[2] ? 1 : 0); return (rev ? -d : d) || a.i - c.i; }
      var e = cmp(a.k, c.k); return (rev ? -e : e) || a.i - c.i; });
    return rows.map(function (r) { return r.x; }); }
  function options(cur) { return OPTS.map(function (o) { return '<option value="' + o[0] + '"' + ((cur || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); }
  /* hotel menu: every key both ways, grouped */
  function hotelOptions(cur) { cur = cur || ''; var o = '<option value=""' + (cur ? '' : ' selected') + '>Hatch order</option>';
    KEYS.forEach(function (K) { [[K[0], K[2]], [K[0] + '-', K[3]]].forEach(function (v) { o += '<option value="' + v[0] + '"' + (cur === v[0] ? ' selected' : '') + '>' + K[1] + ': ' + v[1] + '</option>'; }); }); return o; }
  function line(w, p, k, b) { var K = BY[String(k || '').replace(/-$/, '')]; return K && K[5] ? K[5](w, p, b) : null; }
  /* ways(w, p, b) -> { power, parts: [[label, points, note]], steps: [text], gain, edge }. Real rules only (js/v2-rules.js). */
  function ways(w, p, b) { var R = V(), P = window.PetCore, tot = power(p), qb = p.questBoost || 0, T = P && P.TIERS && P.TIERS[tier(p)], bred = !!(p.parents && p.parents.length), tb = bred ? 0 : (T && T.statBonus) || 0; /* hatch rolls get the rarity bonus on each stat; eggs from breeding take the parents' average instead */
    var bb = p.breedBonus && p.breedBonus.kind === 'stat' ? (p.breedBonus.value || 0) : 0, parts = [];
    var rest = tot - tb * STATS.length - qb - bb;
    parts.push([bred ? '🥚 From its parents (average ±2)' : '🥚 Hatch roll', rest]);
    if (tb) parts.push(['💎 ' + ((T && T.label) || 'Rarity') + ' bonus (+' + tb + ' on each stat)', tb * STATS.length]);
    if (bb) parts.push(['🧬 Bred-true bonus', bb]);
    if (qb) parts.push(['🗺️ Quest Legendary Hauls', qb]);
    var steps = [], g = gain(p), Q = R.QUESTS || {}, live = !p.dead && !p.released;
    if (live && g > 0) { var my = R.isMythic ? R.isMythic(p) : p.stage === 5, qs = Object.keys(Q).map(function (c) { var q = Q[c], od = null; try { od = my && R.questOdds ? R.questOdds(w, p, c, b) : null; } catch (e) { }
        return (q.name || c) + ' (' + (q.fav || []).map(function (s) { return SL[s] || s; }).join(' or ') + (od ? ', Haul ' + (od.haul / 100).toFixed(od.haul % 100 ? 2 : 0) + '%' : '') + ')'; });
      if (!my) steps.push('🌱 Keep feeding until Mythic: only Mythics can go on quests.');
      steps.push('🗺️ Quests: a Legendary Haul adds +1 to one of the quest\'s stats, up to ' + QCAP + ' times per pet (' + g + ' left). ' + qs.join(' · '));
      if (my) steps.push('🛡️ Gear in the quest\'s slot raises the Haul chance (+1%, ★ +2%, up to +4%), and favoured stats above the Mythic average add a little more.'); }
    else if (live) steps.push('🗺️ All ' + QCAP + ' quest stat boosts are used. This pet\'s Power is set.');
    if (live && (p.stage || 0) >= 3) steps.push('💞 Breeding makes a stronger egg, not a stronger parent: each egg stat is the parents\' average ±2, a hybrid egg keeps each parent\'s best stat, and same-species eggs can roll a bred-true +' + (R.BRED_TRUE_STAT || 3) + ' on one stat.');
    return { power: tot, parts: parts, steps: steps, gain: g, edge: 'Gear, looks and stage do not change Power. In fights, worn gear adds hit damage and each stage adds HP.' }; }
  var API = window.PetSort = { OPTS: OPTS, KEYS: KEYS, STATS: STATS, sort: sort, options: options, hotelOptions: hotelOptions, line: line, power: power, gain: gain, free: free, ways: ways };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
