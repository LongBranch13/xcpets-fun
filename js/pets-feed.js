/* XCPETS public pet feed codec (pages-feed, Nov 9 2026).
 * api/pets.json v2 stores one pet per line as a column array, with dictionaries for the repeated owner, species and label strings.
 * The expanded object (expand) is the same shape tools/api-feed.js used to write, and the same shape verify-pet.html compares.
 * Game pages do not load this file. They replay api/boot.json. Node: require('../js/pets-feed.js'). Browser: window.XCPETSPetsFeed.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.XCPETSPetsFeed = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var VERSION = 2;
  var SITE = 'https://xcpets.fun/pet.html?id=';
  var COLS = ['id', 'name', 'species', 'tier', 'rarityScore', 'rarityRank', 'stage', 'care', 'status', 'usedUp', 'community', 'owner', 'generation', 'parents', 'gear', 'stats', 'wins', 'losses', 'bornBlock', 'lastFedBlock', 'deathBlock', 'rareHatch'];
  var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  var STATUS = ['alive', 'dead', 'released'];
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var SLOTS = ['head', 'face', 'body', 'back', 'hand', 'feet', 'weapon'];
  var STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
  function intern(list, map, value) {
    var i = map.get(value);
    if (i == null) { i = list.length; list.push(value); map.set(value, i); }
    return i;
  }
  function seeded(list) { var map = new Map(); list.forEach(function (v, i) { map.set(v, i); }); return map; }
  function idx(list, value, what) {
    var i = list.indexOf(value);
    if (i < 0) throw new Error('pets feed: unknown ' + what + ' ' + value);
    return i;
  }
  /** pack(pets, blockHeight) -> {v, blockHeight, count, urlBase, dict, cols, rows}. pets are the object rows build() already returns. */
  function pack(pets, blockHeight) {
    var list = pets.slice().sort(function (a, b) { return a.id - b.id; });
    var owners = [], species = [], labels = [];
    var oMap = new Map(), sMap = new Map();
    var tMap = seeded(TIERS.slice()), stMap = seeded(STATUS.slice());
    var tiers = TIERS.slice(), statuses = STATUS.slice();
    var rows = list.map(function (p) {
      var sp = String(p.species), lab = p.speciesLabel == null ? '' : String(p.speciesLabel);
      var si = sMap.get(sp);
      if (si == null) { si = species.length; species.push(sp); labels.push(lab); sMap.set(sp, si); }
      else if (labels[si] !== lab) throw new Error('pets feed: species ' + sp + ' has two labels');
      var gear = p.gear && p.gear.length ? p.gear.map(function (g) {
        return [idx(SLOTS, g.slot, 'slot'), g.item, g.name, g.tier == null ? null : intern(tiers, tMap, g.tier)];
      }) : null;
      var st = p.stats || {};
      return [
        p.id, p.name, si, intern(tiers, tMap, p.tier), p.rarityScore == null ? null : p.rarityScore, p.rarityRank == null ? null : p.rarityRank,
        p.stage, p.care, intern(statuses, stMap, p.status), p.usedUp == null ? null : p.usedUp, p.community ? 1 : 0, intern(owners, oMap, p.owner),
        p.generation || 0, p.parents ? p.parents.slice() : null, gear, STATS.map(function (k) { return st[k]; }), p.wins || 0, p.losses || 0,
        p.bornBlock, p.lastFedBlock == null ? null : p.lastFedBlock, p.deathBlock == null ? null : p.deathBlock, p.rareHatch || null
      ];
    });
    return {
      v: VERSION, blockHeight: blockHeight, count: rows.length, urlBase: SITE, cols: COLS.slice(),
      dict: { owner: owners, species: species, speciesLabel: labels, tier: tiers, status: statuses, stageName: STAGES.slice(), slot: SLOTS.slice(), stat: STATS.slice() },
      rows: rows
    };
  }
  /** stringify(pets, blockHeight) -> the file text. One pet per line so a feed commit only diffs the pets that changed. */
  function stringify(pets, blockHeight) {
    var doc = pack(pets, blockHeight);
    var head = JSON.stringify({ v: doc.v, blockHeight: doc.blockHeight, count: doc.count, urlBase: doc.urlBase, dict: doc.dict, cols: doc.cols });
    return head.slice(0, -1) + ',"pets":[\n' + doc.rows.map(function (r) { return JSON.stringify(r); }).join(',\n') + '\n]}\n';
  }
  function objectShaped(doc) { var p = doc && doc.pets && doc.pets[0]; return !doc || !doc.v || doc.v === 1 || (p && !Array.isArray(p)); }
  /** expand(doc) -> {blockHeight, count, pets} in the historical object shape. A v1 file is returned as-is. */
  function expand(doc) {
    if (!doc || !doc.pets) throw new Error('pets feed: no pets');
    if (objectShaped(doc)) return { blockHeight: +doc.blockHeight, count: doc.count == null ? doc.pets.length : doc.count, pets: doc.pets, v: doc.v || 1 };
    if (doc.v !== VERSION) throw new Error('pets feed: unknown version ' + doc.v);
    if (!doc.cols || doc.cols.join() !== COLS.join()) throw new Error('pets feed: unexpected columns');
    var d = doc.dict || {}, base = doc.urlBase || SITE;
    var pets = doc.pets.map(function (r) {
      var sp = d.species[r[2]], tier = d.tier[r[3]], status = d.status[r[8]], stage = r[6];
      var gear = r[14] ? r[14].map(function (g) { return { slot: d.slot[g[0]], item: g[1], name: g[2], tier: g[3] == null ? null : d.tier[g[3]] }; }) : [];
      var st = r[15] || [], stats = {}; d.stat.forEach(function (k, i) { stats[k] = st[i]; });
      return {
        id: r[0], name: r[1], species: sp, speciesLabel: d.speciesLabel[r[2]], hybrid: String(sp).indexOf('hyb') === 0, tier: tier,
        rarityScore: r[4], rarityRank: r[5], stage: stage, stageName: d.stageName[stage], care: r[7], status: status, usedUp: r[9],
        community: !!r[10], owner: d.owner[r[11]], generation: r[12], parents: r[13], gear: gear, stats: stats, wins: r[16], losses: r[17],
        bornBlock: r[18], lastFedBlock: r[19], deathBlock: r[20], rareHatch: r[21], url: base + r[0]
      };
    });
    return { blockHeight: +doc.blockHeight, count: doc.count, pets: pets, v: VERSION };
  }
  return { VERSION: VERSION, COLS: COLS, pack: pack, stringify: stringify, expand: expand };
});
