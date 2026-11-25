/* Published pets omit the art object. It is rebuilt from the hatch seed with PetCore.generate,
 * then the same species / tier / name / shades overlay the rules already applied, then a small
 * patch for anything that overlay does not cover. Game rules are not in this file. */
(function (exp) {
  'use strict';
  function seedParts(art) {
    var seed = art && art.seed || '', i = seed.indexOf(':');
    if (i < 1) return { bh: '', id: '' };
    return { bh: seed.slice(0, i), id: seed.slice(i + 1) };
  }
  function copyStats(stats) {
    var o = {}, k;
    for (k in stats) if (Object.prototype.hasOwnProperty.call(stats, k)) o[k] = stats[k];
    return o;
  }
  function same(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (!a || !b || typeof a !== 'object') return false;
    var aa = Array.isArray(a), bb = Array.isArray(b);
    if (aa || bb) {
      if (!aa || !bb || a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
      return true;
    }
    var ka = Object.keys(a), i2;
    if (ka.length !== Object.keys(b).length) return false;
    for (i2 = 0; i2 < ka.length; i2++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i2])) return false;
      if (!same(a[ka[i2]], b[ka[i2]])) return false;
    }
    return true;
  }
  function diffArt(stored, built) {
    var keys = {}, k, p = null, d = null;
    if (stored) for (k in stored) if (Object.prototype.hasOwnProperty.call(stored, k)) keys[k] = 1;
    if (built) for (k in built) if (Object.prototype.hasOwnProperty.call(built, k)) keys[k] = 1;
    for (k in keys) if (Object.prototype.hasOwnProperty.call(keys, k)) {
      var sv = stored && Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : undefined;
      var bv = built && Object.prototype.hasOwnProperty.call(built, k) ? built[k] : undefined;
      if (same(sv, bv)) continue;
      if (sv === undefined) { d = d || []; d.push(k); }
      else { p = p || {}; p[k] = sv; }
    }
    if (!p && !d) return null;
    return d ? { p: p || {}, d: d } : { p: p };
  }
  function applyArt(g, ax) {
    var i, p, d;
    if (!ax) return g;
    p = ax.p || null; d = ax.d || null;
    if (p) for (i in p) if (Object.prototype.hasOwnProperty.call(p, i)) g[i] = p[i];
    if (d) for (i = 0; i < d.length; i++) delete g[d[i]];
    return g;
  }
  /* The part of every pet's art that is fixed by fields the pet already stores. */
  function overlay(g, p, tiers, opt) {
    var hy = p.hybrid, k;
    opt = opt || {};
    if (hy && hy.shape) { g.species = hy.shape; g.hybrid = hy; }
    else if (p.species) g.species = p.species;
    if (p.tier != null && tiers && tiers[p.tier | 0]) { g.tierIndex = p.tier | 0; g.tier = tiers[g.tierIndex].id; }
    if (p.stats && !p.shards) g.baseStats = copyStats(p.stats);
    g.shades = false;
    if (g.eyes === 'beady') g.eyes = 'classic';
    if (g.hybrid && g.hybrid.eyes === 'beady') {
      var h2 = {}; for (k in g.hybrid) if (Object.prototype.hasOwnProperty.call(g.hybrid, k)) h2[k] = g.hybrid[k];
      h2.eyes = 'classic'; g.hybrid = h2;
    }
    if (p.electric) g.electric = 1;
    if (p.name) g.defaultName = p.name;
    if (p.rareHatch) g.rareHatch = p.rareHatch;
    if ((p._ac || (p.art && p.art.community)) && !g.community) g.community = true;
    if (!hy && p.species === 'funtrump' && opt.ftLook) g.ftLook = opt.ftLook(p.tier | 0);
    return g;
  }
  function petIdOf(p) {
    if (p.sid) return String(p.sid);
    return String(p.hatchTx || '') + (p.as || '');
  }
  function buildArt(p, hashes, PetCore, opt) {
    var bh = p._h != null && hashes ? hashes[p._h] : (p._bh || '');
    var g = PetCore.generate({ blockHash: bh, petId: petIdOf(p), blockHeight: p.hatchBlock, community: !!(p._ac || (p.art && p.art.community)) });
    overlay(g, p, PetCore.TIERS, opt);
    return applyArt(g, p.ax);
  }
  /* What to store instead of p.art. p.art must still be present. */
  function artNote(p, PetCore, opt) {
    var art = p.art;
    if (!art || !art.seed || !PetCore || !PetCore.generate) return null;
    var sp = seedParts(art);
    var probe = {
      hatchTx: p.hatchTx, hatchBlock: p.hatchBlock, species: p.species, tier: p.tier, stats: p.stats,
      shards: p.shards, name: p.name, hybrid: p.hybrid, electric: p.electric, rareHatch: p.rareHatch,
      art: art, _ac: art.community ? 1 : 0, _h: 0, _bh: sp.bh
    };
    var g = PetCore.generate({ blockHash: sp.bh, petId: sp.id, blockHeight: p.hatchBlock, community: !!art.community });
    overlay(g, probe, PetCore.TIERS, opt);
    var ax = diffArt(art, g);
    var as = '', sid = '';
    if (sp.id && sp.id !== String(p.hatchTx || '')) {
      if (p.hatchTx && sp.id.indexOf(String(p.hatchTx)) === 0) as = sp.id.slice(String(p.hatchTx).length);
      else sid = sp.id;
    }
    var back = buildArt({ hatchTx: p.hatchTx, hatchBlock: p.hatchBlock, species: p.species, tier: p.tier, stats: p.stats, shards: p.shards, name: p.name, hybrid: p.hybrid, electric: p.electric, rareHatch: p.rareHatch, _ac: art.community ? 1 : 0, _h: 0, _bh: sp.bh, as: as, sid: sid, ax: ax }, [sp.bh], PetCore, opt);
    if (!same(back, art)) return { bh: sp.bh, as: as, sid: sid, ax: null, ac: art.community ? 1 : 0, keep: art };
    return { bh: sp.bh, as: as, sid: sid, ax: ax, ac: art.community ? 1 : 0, keep: null };
  }
  /* freeze-hunt (Nov 22 2026): test the one field first. The old version built a key list for every nested object of every pet,
   * the top cost of opening a 10,000-pet wallet. Same answer: exactly one own key, '__s', holding a number. */
  function isMarker(v) {
    if (!v || typeof v !== 'object' || typeof v.__s !== 'number' || Array.isArray(v) || !Object.prototype.hasOwnProperty.call(v, '__s')) return false;
    for (var k in v) if (k !== '__s') return false;
    return true;
  }
  /* A marker stays a marker until the owner table has a real address at that index.
   * owners[undefined] used to wipe the index, and the pet could never be filled later. */
  function ownerAt(owners, ix) {
    var s = owners && owners[ix];
    return typeof s === 'string' && s ? s : '';
  }
  function expandOwners(o, owners, seen) {
    if (!o || typeof o !== 'object') return;
    if (seen.has(o)) return;
    if (isMarker(o)) return;
    seen.add(o);
    var i, n, ks = Array.isArray(o) ? null : Object.keys(o);
    n = ks ? ks.length : o.length;
    for (i = 0; i < n; i++) {
      var v = ks ? o[ks[i]] : o[i];
      if (isMarker(v)) {
        var s = ownerAt(owners, v.__s);
        if (s) { if (ks) o[ks[i]] = s; else o[i] = s; }
      } else expandOwners(v, owners, seen);
    }
  }
  /* Slim rows store the owner as o (an index) and nested addresses as {__s:N}.
   * pageOwner is the wallet this page was published for, used when the table is not here yet. */
  /* done (optional, Nov 24 2026): a WeakSet the caller keeps for one owner table. Nested objects it already expanded with that
   * table are skipped, so filling a 30,000-pet world again after each page batch costs a walk over the new copies only
   * (expandOwners was 1.5 s of a 6 s load). Same result: expanding an object twice with the same table changes nothing. */
  function fillOwners(p, owners, pageOwner, done) {
    if (!p || typeof p !== 'object') return p;
    /* Checkpoint pets keep {__s:N} until restore(), which expands them with the checkpoint table.
     * This function is given the view table. Those two lists do not share indexes, so a checkpoint
     * owner marker is left alone here. A view row has o instead, and is filled below. */
    if (isMarker(p.owner) && p.o == null) return p;
    if (!p.owner && p.o != null) {
      var from = ownerAt(owners, p.o);
      if (from) p.owner = from;
      else if (pageOwner) p.owner = pageOwner;
    }
    if (owners) expandOwners(p, owners, done || new Set());
    if (p.owner && p.worn) {
      var i, g;
      for (i = 0; i < p.worn.length; i++) { g = p.worn[i]; if (g && (g.gid || g.label) && !g.owner) g.owner = p.owner; }
    }
    return p;
  }
  /* The published pet shards store the owner as o (view/owners.json). The checkpoint stores it as {__s:N}
   * into a different table on the world. Those two tables do not share indexes. A send check that reads
   * byId must fill from the table that wrote the field, and must not treat one table as the other. */
  function resolvePetOwner(p, opt) {
    opt = opt || {};
    if (!p || typeof p !== 'object') return p;
    if (typeof p.owner === 'string' && p.owner) return p;
    var ix = markerIndex(p.owner);
    if (ix != null) {
      var s = ownerAt(opt.checkpoint, ix);
      if (s) p.owner = s;
      return p;
    }
    if ((p.owner == null || p.owner === '') && p.o != null) {
      var v = ownerAt(opt.view, p.o);
      if (v) p.owner = v;
    }
    return p;
  }
  function markerIndex(v) {
    if (!isMarker(v)) return null;
    return v.__s;
  }
  /* Every id a parsed burn tag can name. Team fights store a and b as arrays. Cemetery runs store the
   * zombie or grave on target. Feed lists, gifts and Rug Me store ids. */
  function tagPetIds(t) {
    var ids = [], i, k, v, keys = ['zombie', 'petId', 'a', 'b', 'a2', 'b2', 'mine', 'theirs', 'grave', 'target'];
    if (!t) return ids;
    for (i = 0; i < keys.length; i++) {
      v = t[keys[i]];
      if (typeof v === 'number') ids.push(v);
      else if (v && v.length) for (k = 0; k < v.length; k++) if (typeof v[k] === 'number') ids.push(v[k]);
    }
    if (t.ids) for (i = 0; i < t.ids.length; i++) if (typeof t.ids[i] === 'number') ids.push(t.ids[i]);
    return ids;
  }
  function restoreArts(o, hashes, PetCore, opt, seen) {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (!Array.isArray(o) && (o._h != null || o.as || o.sid || o.ax || o._ac) && !(o.art && o.art.dna)) {
      try { o.art = buildArt(o, hashes, PetCore, opt); } catch (e) { o.art = o.art || null; }
      delete o._h; delete o.as; delete o.sid; delete o.ax; delete o._ac; delete o._bh;
    }
    var ks = Array.isArray(o) ? null : Object.keys(o), i, n = ks ? ks.length : o.length;
    for (i = 0; i < n; i++) {
      var v = ks ? o[ks[i]] : o[i];
      if (v && typeof v === 'object') restoreArts(v, hashes, PetCore, opt, seen);
    }
  }
  /* After wsDecode. Old worlds (no _owners / _hashes) are left alone. */
  function restore(w, PetCore, opt) {
    if (!w || (!w._owners && !w._hashes)) return w;
    var owners = w._owners || [], hashes = w._hashes || [];
    expandOwners(w, owners, new Set());
    if (PetCore) restoreArts(w, hashes, PetCore, opt || {}, new Set());
    delete w._owners; delete w._hashes;
    return w;
  }
  function addr(s) {
    if (typeof s !== 'string' || s.length < 26 || s.length > 92) return false;
    if (/^bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,}$/i.test(s)) return true;
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(s)) return true;
    return false;
  }
  var OWNER_KEYS = { owner: 1, holder: 1, seller: 1, buyer: 1, issuer: 1 };
  /* Mutates the encoded root and parts. Shared owner markers so repeated addresses are one object. */
  function slimEncoded(root, parts, PetCore, opt) {
    var owners = [], omap = new Map(), markers = [], hashes = [], hmap = new Map(), seen = new Set();
    var artN = 0, artKept = 0, axN = 0;
    function marker(addr) {
      var i = omap.get(addr);
      if (i == null) { i = owners.length; owners.push(addr); omap.set(addr, i); markers.push({ __s: i }); }
      return markers[i];
    }
    function hashIx(h) {
      var i = hmap.get(h);
      if (i == null) { i = hashes.length; hashes.push(h); hmap.set(h, i); }
      return i;
    }
    function walk(o) {
      if (!o || typeof o !== 'object' || seen.has(o) || isMarker(o)) return;
      seen.add(o);
      if (Array.isArray(o)) { for (var a = 0; a < o.length; a++) walk(o[a]); return; }
      if (o.art && o.art.seed && o.art.dna && PetCore) {
        var note = artNote(o, PetCore, opt);
        artN++;
        if (note && !note.keep) {
          o._h = hashIx(note.bh);
          if (note.as) o.as = note.as;
          if (note.sid) o.sid = note.sid;
          if (note.ax) { o.ax = note.ax; axN++; }
          if (note.ac) o._ac = 1;
          delete o.art;
        } else artKept++;
      }
      var ks = Object.keys(o), i, k, v;
      for (i = 0; i < ks.length; i++) {
        k = ks[i]; v = o[k];
        if (k === 'lookOwners' && v && typeof v === 'object' && !Array.isArray(v)) {
          var ids = Object.keys(v), j;
          for (j = 0; j < ids.length; j++) if (typeof v[ids[j]] === 'string' && addr(v[ids[j]])) v[ids[j]] = marker(v[ids[j]]);
          walk(v); continue;
        }
        if (typeof v === 'string' && OWNER_KEYS[k] && addr(v)) { o[k] = marker(v); continue; }
        if (v && typeof v === 'object') walk(v);
      }
    }
    walk(root);
    if (parts) for (var p = 0; p < parts.length; p++) walk(parts[p]);
    if (root && !root._owners && (owners.length || hashes.length)) { root._owners = owners; root._hashes = hashes; }
    return { owners: owners.length, hashes: hashes.length, art: artN, artKept: artKept, ax: axN };
  }
  /* A published view row. hashes is the shard or rank table. _bh is a raw hash on a self-contained row. */
  function openPet(rec, opt) {
    opt = opt || {};
    var p = {}, ks = Object.keys(rec || {}), i;
    for (i = 0; i < ks.length; i++) p[ks[i]] = rec[ks[i]];
    fillOwners(p, opt.owners, opt.pageOwner || '');
    if (p.worn) {
      var worn = [], j;
      for (j = 0; j < p.worn.length; j++) worn.push(openGear(p.worn[j], p.owner, p.id, opt));
      p.worn = worn;
    }
    if ((!p.art || !p.art.dna) && opt.PetCore && (p._h != null || p._bh)) {
      var hashes = opt.hashes, bh = p._bh;
      if (bh) { hashes = [bh]; p._h = 0; }
      try { p.art = buildArt(p, hashes, opt.PetCore, opt); } catch (e) { p.art = null; }
      delete p._h; delete p._bh; delete p.as; delete p.sid; delete p.ax; delete p._ac;
    }
    return p;
  }
  var SABO = 1765;
  /* Sabo is left off every rank board. The old shard walk skipped this id. */
  function onRankBoard(p) { return !!(p && (p.id | 0) !== SABO); }
  /* A wallet pet replaces its rank row. Keep the builder's trait score and hall gear. */
  function carryRank(p, prev) {
    if (!p || !prev) return p;
    if (!p.art && prev.art) p.art = prev.art;
    if (!p.worn && prev.worn) p.worn = prev.worn;
    if (p._hof == null && prev._hof != null) p._hof = prev._hof;
    if (p._bits == null && prev._bits != null) p._bits = prev._bits;
    return p;
  }
  function slimGear(g) {
    if (!g) return null;
    var o = { g: g.gid, i: g.item, t: g.tier | 0 };
    if (g.legendary) o.L = 1;
    if (g.sig) o.s = g.sig;
    if (g.slot) o.slot = g.slot;
    /* Nov 25 2026 (fast-world audit): where the piece came from (pet score credits gear to the pet that rolled or won it) */
    if (g.src) o.sr = g.src;
    if (g.rolledOn != null) o.r = g.rolledOn;
    if (g.wonBy != null) o.w = g.wonBy;
    if (g.wheel) o.wh = 1;
    return o;
  }
  function openGear(g, owner, on, opt) {
    if (!g) return null;
    if (g.gid || g.label) {
      var copy = {}; var ks = Object.keys(g), i;
      for (i = 0; i < ks.length; i++) copy[ks[i]] = g[ks[i]];
      if (on != null) copy.on = on;
      if (owner && !copy.owner) copy.owner = owner;
      return copy;
    }
    var cat = opt && opt.itemOf ? opt.itemOf(g.i) : null;
    var out = { gid: g.g, item: g.i, tier: g.t | 0, legendary: g.L ? 1 : 0, sig: g.s || undefined, owner: owner || '', on: on == null ? null : on, label: (cat && cat.label) || g.i || '', slot: g.slot || (cat && cat.slot) || '' };
    if (g.bag != null) out.bag = g.bag;
    if (g.sr) out.src = g.sr;
    if (g.r != null) out.rolledOn = g.r;
    if (g.w != null) out.wonBy = g.w;
    if (g.wh) out.wheel = true;
    return out;
  }
  exp.seedParts = seedParts;
  exp.overlay = overlay;
  exp.diffArt = diffArt;
  exp.applyArt = applyArt;
  exp.artNote = artNote;
  exp.buildArt = buildArt;
  exp.restore = restore;
  exp.slimEncoded = slimEncoded;
  exp.SABO = SABO;
  exp.onRankBoard = onRankBoard;
  exp.carryRank = carryRank;
  exp.openPet = openPet;
  exp.fillOwners = fillOwners;
  exp.resolvePetOwner = resolvePetOwner;
  exp.tagPetIds = tagPetIds;
  exp.slimGear = slimGear;
  exp.openGear = openGear;
  exp.addr = addr;
})(typeof module !== 'undefined' && module.exports ? module.exports : (typeof window !== 'undefined' ? (window.XcpArt = {}) : (typeof self !== 'undefined' ? (self.XcpArt = self.XcpArt || {}) : this)));
/* Workers (verify, catch-up) load this with importScripts before any window shim. They read self.XcpArt. Before Nov 22 2026 the
 * exports landed on the worker global instead, so XcpArt.restore never ran there: checkpoint owners stayed {__s:N} markers and every
 * owner check before signing failed ("zombie owner only", "first pet must be yours"). */
