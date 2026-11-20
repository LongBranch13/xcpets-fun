/* Published split world (speed phase 2). The snapshot builder writes a summary, per-owner
 * pet lists and per-pet shards next to the world. This file paints from those and does not
 * read the saved full world or reindex it. The full checkpoint check runs when the player
 * presses Verify, or when a burn asks the check worker. It does not start by itself.
 * If the files are missing, the rules signature differs, or the snapshot is more than
 * STALE blocks behind, the page uses today's chain read. Doom Week is not involved.
 * STALE is 48 blocks (about eight hours). A view a few blocks behind the tip stays usable.
 * Farther than that, the published files are treated as unusable. */
(function () {
  'use strict';
  window.__xcpSplitHold = true;
  var STALE = 48;
  var SCREEN_PAGES = 7; /* first screen is 150 cards, and an owner page holds 24 pets */
  var AUTO_CAP = 5000; /* wallets at or under this many living pets load the rest in the background */
  function q(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
  function off() { return q('split') === '0' || q('split') === 'off'; }
  function base() {
    var B = window.V2BootSync;
    if (B && B.localOnly && B.localOnly()) return '';
    if (B && B.base) return B.base();
    return '';
  }
  function me() {
    var a = q('addr');
    if (a) return a;
    try { return localStorage.getItem('xcpets-v2-me') || ''; } catch (e) { return ''; }
  }
  function sha2(s) {
    var buf = new TextEncoder().encode(String(s || ''));
    return crypto.subtle.digest('SHA-256', buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    });
  }
  function getJson(url, ms, fresh) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, ms || 12000) : null;
    return fetch(url, { cache: fresh ? 'no-store' : 'default', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('split ' + r.status);
      return r.json();
    }, function (e) { if (t) clearTimeout(t); throw e; });
  }
  function dirOf(manifestUrl) { return String(manifestUrl || '').replace(/[^/]+$/, ''); }
  function assemble(summary, pack) {
    var pets = [], items = {}, n = 1, byId = {}, deeds = {}, mythicOwners = {};
    function addItem(g, on) {
      if (!g) return;
      var id = g.gid || ('v' + (n++));
      var copy = {};
      Object.keys(g).forEach(function (k) { copy[k] = g[k]; });
      copy.gid = id;
      if (on != null) copy.on = on;
      items[id] = copy;
    }
    function addPet(p) {
      if (!p || byId[p.id]) return;
      var copy = {};
      Object.keys(p).forEach(function (k) { if (k !== 'worn') copy[k] = p[k]; });
      if (!copy.art && addPet.prev && addPet.prev[copy.id] && addPet.prev[copy.id].art) copy.art = addPet.prev[copy.id].art;
      pets.push(copy);
      byId[copy.id] = copy;
      (p.worn || []).forEach(function (g) { addItem(g, copy.id); });
    }
    function takeDeeds(src) { if (!src) return; Object.keys(src).forEach(function (k) { deeds[k] = src[k]; }); }
    function takeMythic(src) { if (!src) return; Object.keys(src).forEach(function (k) { if (src[k] != null) mythicOwners[k] = src[k]; }); }
    addPet.prev = pack && pack.keepArt || null;
    if (pack) { takeDeeds(pack.deeds); takeMythic(pack.mythicOwners); }
    if (pack && pack.owners) Object.keys(pack.owners).forEach(function (addr) {
      var o = pack.owners[addr];
      if (Array.isArray(o)) o.forEach(addPet);
      else if (o && o.pets) {
        o.pets.forEach(addPet);
        takeDeeds(o.deeds);
        if (o.mythicAt != null) mythicOwners[o.owner || addr] = o.mythicAt;
      }
    });
    if (pack && pack.rise) pack.rise.forEach(addPet);
    var cold = summary.cold || {};
    var itemList = [];
    Object.keys(items).forEach(function (k) { itemList.push(items[k]); });
    var w = {
      tip: summary.tip, pets: pets, byId: byId, items: items, itemList: itemList, log: [], fights: [], breedReqs: [],
      community: summary.community || {},
      tokens: {}, deeds: deeds, mythicOwners: mythicOwners,
      wizardMythic: cold.wizard || null, kekMythic: cold.kek || null, homerMythic: cold.homer || null,
      rabbitMythic: cold.rabbit || null, funtrumpMythic: cold.funtrump || null, djpepeMythic: cold.djpepe || null,
      wagmi: summary.wagmi || {},
      _view: 1, _counts: { n: summary.n, alive: summary.alive, dead: summary.dead, burned: summary.burned, burns: summary.burns }
    };
    if (pack && pack.roster) w._roster = pack.roster;
    if (pack && pack.cem) w.cem = pack.cem;
    return w;
  }
  var last = null, lastSummary = null, healthTipN = 0;
  /* The published health tip. Unleash reads this so a stale replay tip cannot invent a dust deadline. */
  function noteHealth(n) {
    n = n | 0;
    if (!(n > 0)) return 0;
    if (n > healthTipN) healthTipN = n;
    try {
      var S = window.V2Mock && V2Mock.state && V2Mock.state();
      if (S && n > (S.healthTip || 0)) S.healthTip = n;
    } catch (e) {}
    return healthTipN;
  }
  function pingHealth() {
    var root = base();
    if (!root || typeof fetch !== 'function') return Promise.resolve(healthTipN);
    return getJson(root + '/xp/v1/health', 8000, true).then(function (h) { return noteHealth(h && h.tip); }, function () { return healthTipN; });
  }
  /* The published manifest embeds a pet sample for the largest wallets and is many megabytes.
   * A slow phone sat on that download and never reached the 18 KB summary. First paint uses
   * latest.json, summary.json and one owner page. The manifest is left for the check worker. */
  function pageRsig() {
    var files = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
    var all = document.scripts || [], urls = [], i, j;
    for (i = 0; i < files.length; i++) {
      var hit = null;
      for (j = 0; j < all.length; j++) {
        var u = (all[j].src || '').split('?')[0];
        if (u.slice(-files[i].length - 1) === '/' + files[i]) { hit = all[j].src; break; }
      }
      if (!hit) return Promise.resolve(null);
      urls.push(hit);
    }
    var chain = null;
    for (j = 0; j < all.length; j++) if ((all[j].src || '').indexOf('/js/v2-chain.js') >= 0) chain = all[j].src;
    var build = chain && /[?&]v=([0-9a-f]+)/.exec(chain);
    if (build) urls.push(new URL('js/v2-replay-worker.js?v=' + build[1], location.href).href);
    return Promise.all(urls.map(function (u) {
      return fetch(u, { cache: 'force-cache', credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('rules'); return r.arrayBuffer(); });
    })).then(function (bufs) {
      var n = 0, o = 0, allb, k;
      for (k = 0; k < bufs.length; k++) n += bufs[k].byteLength + 8;
      allb = new Uint8Array(n);
      for (k = 0; k < bufs.length; k++) {
        var L = bufs[k].byteLength;
        allb[o] = L >>> 24 & 255; allb[o + 1] = L >>> 16 & 255; allb[o + 2] = L >>> 8 & 255; allb[o + 3] = L & 255;
        allb.set(new Uint8Array(bufs[k]), o + 8); o += L + 8;
      }
      return crypto.subtle.digest('SHA-256', allb);
    }).then(function (d) {
      var h = Array.prototype.map.call(new Uint8Array(d), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
      return 'r' + h.slice(0, 32);
    }, function () { return null; });
  }
  function prepare(cb) {
    if (off() || !base()) { cb(null); return; }
    var root = base();
    var chainTip = 0, manUrl = '';
    var sigP = pageRsig();
    getJson(root + '/xp/v1/health', 8000, true).then(function (h) {
      chainTip = h && h.tip || 0;
      noteHealth(chainTip);
      return getJson(root + '/xp/v1/world/latest.json', 8000, true);
    }).then(function (latest) {
      var path = latest && (latest.manifest || latest.url);
      if (!path || !latest.rsig) throw new Error('latest');
      manUrl = /^https?:/.test(path) ? path : root + path;
      var snapTip = latest.tip || 0;
      if (chainTip && snapTip && chainTip - snapTip > STALE) throw new Error('stale');
      var folder = dirOf(manUrl);
      viewFolder = folder;
      var summaryP = getJson(folder + 'view/summary.json', 12000, false);
      var who = me();
      var pageP = who ? sha2(who).then(function (hex) {
        return getJson(folder + 'view/own/' + hex + '.json', 12000, false).then(function (page) {
          return { hex: hex, page: page };
        }, function () { return { hex: hex, page: null }; });
      }) : Promise.resolve(null);
      return Promise.all([sigP, summaryP, pageP]).then(function (got) {
        var rsig = got[0], summary = got[1], own = got[2];
        if (!rsig || rsig !== latest.rsig) throw new Error('rules');
        if (!summary || (summary.v !== 1 && summary.v !== 2 && summary.v !== 3) || summary.tip !== latest.tip || summary.rsig !== latest.rsig) throw new Error('summary');
        lastSummary = summary;
        last = { man: { tip: latest.tip, rsig: latest.rsig, view: true }, url: manUrl, tip: chainTip };
        if (!own || !own.page || !own.page.pets || !own.page.pets.length) {
          if (own && own.page && (own.page.deeds || own.page.roster || own.page.mythicAt != null)) {
            var mythic0 = {}; if (own.page.mythicAt != null) mythic0[own.page.owner || who] = own.page.mythicAt;
            var bare = assemble(summary, { deeds: own.page.deeds || null, mythicOwners: mythic0, roster: own.page.roster || null, rise: own.page.rise || null });
            viewHold = { deeds: bare.deeds, mythicOwners: bare.mythicOwners, roster: bare._roster || null, cem: bare.cem || null };
            return bare;
          }
          return assemble(summary, null);
        }
        var raw0 = own.page.pets, living0 = livingOf(raw0), separate = own.page.alive != null;
        var stop0 = !separate && endsDead(raw0);
        var livingPages = separate ? Math.max(1, Math.ceil((own.page.alive || 0) / (own.page.pageSize || 24)) || 1) : (stop0 ? 1 : own.page.pages);
        var one = {}; one[own.page.owner || who] = living0.concat(own.page.rise || []);
        var mythic = {}; if (own.page.mythicAt != null) mythic[own.page.owner || who] = own.page.mythicAt;
        var view = assemble(summary, { owners: one, deeds: own.page.deeds || null, mythicOwners: mythic, roster: own.page.roster || null, rise: own.page.rise || null });
        if (!view._roster) view._roster = savedRoster() || {};
        if (view._roster) {
          if (own.page.alive != null) view._roster.alive = own.page.alive;
          if (own.page.dead != null) view._roster.dead = own.page.dead;
        }
        viewHold = { deeds: view.deeds, mythicOwners: view.mythicOwners, roster: view._roster || null, cem: view.cem || null };
        viewFolder = folder;
        view._pages = { n: separate ? own.page.alive : living0.length, pages: livingPages, total: own.page.pages, page: 0, got: 1, key: own.hex, folder: folder, raw: living0 };
        if (separate) noteGraves(view._pages, 0, true);
        else if (stop0) noteGraves(view._pages, 1, false);
        if (!(view._pages.pages > 1)) { view._full = 1; viewHold.roster = null; view._roster = null; }
        return view;
      });
    }).then(function (view) { if (view && view._pages && view._pages.pages > 1) restView = view; cb(view); }, function () { cb(null); });
  }
  function recheck() {
    if (!last || !last.man) return Promise.resolve(false);
    return getJson(base() + '/xp/v1/health', 8000, true).then(function (h) {
      var tip = h && h.tip || 0;
      noteHealth(tip);
      return !(tip && last.man.tip != null && tip - last.man.tip > STALE);
    }, function () { return false; });
  }
  function progressText(m) {
    if (!m) return 'Checking every burn…';
    if (m.phase === 'files') return 'Checking the published world… ' + (m.got || 0) + ' / ' + (m.total || 0) + ' files';
    if (m.phase === 'rules') return 'Checking the rules…';
    if (m.phase === 'replay') return 'Applying the newest blocks…';
    return 'Checking every burn…';
  }
  var worker = null, seq = 0, pending = {}, readyP = null, ready = false;
  function scriptList() {
    var files = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
    var all = document.scripts || [], out = [], i, j;
    for (i = 0; i < files.length; i++) {
      var hit = null;
      for (j = 0; j < all.length; j++) {
        var u = (all[j].src || '').split('?')[0];
        if (u.slice(-files[i].length - 1) === '/' + files[i]) { hit = all[j].src; break; }
      }
      if (!hit) return null;
      out.push(hit);
    }
    return out;
  }
  var pageJob = null, verifiedTakeover = false, viewFolder = '', nextPage = 1, paging = null;
  var viewHold = { deeds: null, mythicOwners: null, roster: null, cem: null };
  function rosterKey() { return 'xcpets-v2-roster-' + (me() || '') + '-' + ((lastSummary && lastSummary.tip) || ''); }
  function hybPet(p) { return !!(p && (p.hybrid || (p.art && p.art.hybrid) || (typeof p.species === 'string' && (p.species.indexOf('hyb:') === 0 || p.species.indexOf('hyb3:') === 0)))); }
  function rememberRoster(w) {
    if (!w || !w.pets || typeof sessionStorage === 'undefined') return;
    try {
      var who = me(), species = {}, deadSpecies = {}, hybrid = 0, deadHybrid = 0, zombies = 0, feral = 0, tokenized = 0, away = 0, alive = 0, deadN = 0, i, p, d, V = window.V2Rules;
      for (i = 0; i < w.pets.length; i++) {
        p = w.pets[i]; if (!p || (who && p.owner !== who) || p.released) continue;
        if (p.zombie && !p.zombie.end) { zombies++; if (p.feral) feral++; }
        if (p.dead) { deadN++; if (hybPet(p)) deadHybrid++; else deadSpecies[p.species || ''] = (deadSpecies[p.species || ''] || 0) + 1; continue; }
        alive++; if (hybPet(p)) hybrid++; else species[p.species || ''] = (species[p.species || ''] || 0) + 1;
        d = V && V.deedOf && V.deedOf(w, p); if (d && d.ok) tokenized++; else if (d) away++;
      }
      sessionStorage.setItem(rosterKey(), JSON.stringify({ alive: alive, dead: deadN, species: species, hybrid: hybrid, deadSpecies: deadSpecies, deadHybrid: deadHybrid, tokenized: tokenized, away: away, zombies: zombies, feral: feral }));
    } catch (e) {}
  }
  function savedRoster() { try { return JSON.parse(sessionStorage.getItem(rosterKey()) || 'null'); } catch (e) { return null; } }
  function aliveFirst(list) {
    return list.sort(function (a, b) {
      var ad = (a.dead || a.released) ? 1 : 0, bd = (b.dead || b.released) ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return (a.id | 0) - (b.id | 0);
    });
  }
  function livingOf(list) {
    var out = [], i, p;
    for (i = 0; i < (list || []).length; i++) { p = list[i]; if (p && !p.dead && !p.released) out.push(p); }
    return out;
  }
  function endsDead(list) { if (!list || !list.length) return false; var p = list[list.length - 1]; return !!(p && (p.dead || p.released)); }
  var gravePlan = null;
  function noteGraves(pg, fromPage, separate) {
    gravePlan = { key: pg.key, folder: pg.folder, from: fromPage, pages: pg.total || pg.pages, separate: !!separate, done: false, pets: [] };
  }
  function keepArt() {
    var cur = window.V2Mock && V2Mock.world && V2Mock.world(), map = {}, i, p;
    if (!cur || !cur.pets) return null;
    for (i = 0; i < cur.pets.length; i++) { p = cur.pets[i]; if (p && p.art) map[p.id] = p; }
    return map;
  }
  function publishOwner(pets, pages, fights, done) {
    if (!lastSummary || !window.V2Mock || !V2Mock.setViewWorld) return;
    var who = me(), one = {};
    one[who] = aliveFirst(pets.slice());
    var v = assemble(lastSummary, { owners: one, deeds: viewHold.deeds, mythicOwners: viewHold.mythicOwners, roster: done ? null : viewHold.roster, cem: viewHold.cem, keepArt: keepArt() });
    v._pages = pages || null;
    v._full = done ? 1 : 0;
    if (done) viewHold.roster = null;
    v.fights = fights || [];
    V2Mock.setViewWorld(v);
    if (done) rememberRoster(v);
  }
  var restView = null;
  function adoptJob(view) {
    var pg = view._pages;
    if (!pg) return null;
    pageJob = { pets: (view.pets || pg.raw || []).slice(), fights: view.fights || [], pages: pg };
    nextPage = pg.got || 1;
    viewFolder = pg.folder || viewFolder;
    return pageJob;
  }
  function takeLiving(pg, page, n) {
    if (!page || !page.pets) return true;
    if (page.alive != null || !endsDead(page.pets)) {
      pageJob.pets = pageJob.pets.concat(livingOf(page.pets).length === page.pets.length ? page.pets : livingOf(page.pets));
      return true;
    }
    pageJob.pets = pageJob.pets.concat(livingOf(page.pets));
    noteGraves(pg, n + 1, false);
    return false;
  }
  function publishJob(done) {
    if (!pageJob) return;
    pageJob.pages.got = nextPage;
    publishOwner(pageJob.pets, pageJob.pages, pageJob.fights, !!done);
  }
  function more(n) {
    if (paging) return paging;
    if (!pageJob && restView) { adoptJob(restView); restView = null; }
    if (!pageJob || !pageJob.pages) return Promise.resolve(false);
    var pg = pageJob.pages, count = n || SCREEN_PAGES, last = Math.min(pg.pages, nextPage + count), nums = [], i;
    if (!(nextPage < last)) { if (nextPage >= pg.pages) publishJob(true); return Promise.resolve(false); }
    for (i = nextPage; i < last; i++) nums.push(i);
    var stop = false;
    paging = Promise.all(nums.map(function (ni) {
      return getJson(pg.folder + 'view/own/' + pg.key + '.' + ni + '.json').then(function (page) {
        return { n: ni, page: page };
      }, function () { return { n: ni, page: null }; });
    })).then(function (rows) {
      rows.sort(function (a, b) { return a.n - b.n; });
      for (i = 0; i < rows.length; i++) {
        if (verifiedTakeover || stop) break;
        if (!takeLiving(pg, rows[i].page, rows[i].n)) stop = true;
      }
      nextPage = stop ? pg.pages : last;
      paging = null;
      publishJob(nextPage >= pg.pages);
      return true;
    }, function () { paging = null; return false; });
    return paging;
  }
  function underCap(pg) { return !!pg && (pg.n || 0) > 0 && (pg.n || 0) <= AUTO_CAP; }
  function drain() {
    if (!pageJob && restView) { adoptJob(restView); restView = null; }
    if (!pageJob || !pageJob.pages || verifiedTakeover) return;
    if (!(nextPage < pageJob.pages.pages)) { publishJob(true); if (ready) requestSync(); return; }
    more(SCREEN_PAGES).then(function (ok) {
      if (!ok || verifiedTakeover || !pageJob) return;
      if (nextPage < pageJob.pages.pages) drain();
      else requestSync();
    });
  }
  function rest() {
    var v = restView;
    if (!v || !v._pages || !(v._pages.pages > 1)) { restView = null; return; }
    if (underCap(v._pages)) { drain(); return; }
    var need = Math.min(SCREEN_PAGES, v._pages.pages) - (v._pages.got || 1);
    if (need > 0) more(need);
  }
  var diffBuf = [];
  function takeMine(m) {
    if (!m || !m.total) return;
    if (m.mode === 'diff') {
      if (m.deeds) viewHold.deeds = m.deeds;
      if (m.mythicOwners) viewHold.mythicOwners = m.mythicOwners;
      if (m.pets && m.pets.length) diffBuf = diffBuf.concat(m.pets);
      if (!m.last) return;
      var shown = (window.V2Mock && V2Mock.world && V2Mock.world()) || {};
      var cur = (pageJob && pageJob.pets && pageJob.pets.length) ? pageJob.pets : (shown.pets || []);
      var map = {}, i, p, old;
      for (i = 0; i < cur.length; i++) if (cur[i]) map[cur[i].id] = cur[i];
      for (i = 0; i < diffBuf.length; i++) {
        p = diffBuf[i]; if (!p) continue;
        old = map[p.id];
        if (old && old.art && !p.art) p.art = old.art;
        if (old && old.worn && !(p.worn && p.worn.length)) p.worn = old.worn;
        map[p.id] = p;
      }
      diffBuf = [];
      var pets = [];
      Object.keys(map).forEach(function (id) { pets.push(map[id]); });
      if (pageJob) pageJob.pets = pets;
      var pg = pageJob && pageJob.pages;
      publishOwner(pets, pg, (m.fights || (pageJob && pageJob.fights) || []), !!(pg && nextPage >= pg.pages));
      return;
    }
    verifiedTakeover = true;
    var pages = pageJob && pageJob.pages;
    if (!pageJob || m.from === 0) pageJob = { pets: [], fights: [], pages: pages };
    if (m.pets && m.pets.length) pageJob.pets = pageJob.pets.concat(m.pets);
    if (m.fights) pageJob.fights = m.fights;
    if (m.deeds) viewHold.deeds = m.deeds;
    if (m.mythicOwners) viewHold.mythicOwners = m.mythicOwners;
    if (m.last) publishOwner(pageJob.pets, pageJob.pages, pageJob.fights, true);
  }
  function petSig(p) {
    var z = p && p.zombie;
    return [(p && p.care | 0), (p && p.owner) || '', p && p.dead ? 1 : 0, p && p.released ? 1 : 0, p && p.stage | 0, (p && p.deed) || '', (z && !z.end) ? (z.fedAt | 0) : 0, p && p.feral ? 1 : 0].join(':');
  }
  function requestSync() {
    if (!worker || !ready) return;
    var w = window.V2Mock && V2Mock.world && V2Mock.world(), sigs = {}, pets = (w && w.pets) || [], i, full;
    for (i = 0; i < pets.length; i++) if (pets[i] && pets[i].id != null) sigs[pets[i].id] = petSig(pets[i]);
    full = !!(w && (w._full || !w._pages || (w._pages.got || 1) >= (w._pages.pages || 1)));
    try { worker.postMessage({ cmd: 'sync', sigs: sigs, onlyChanged: !full }); } catch (e) {}
  }
  function unlock(m) {
    ready = true;
    var S = window.V2Mock && V2Mock.state && V2Mock.state();
    if (S) { S.viewChecked = true; S.provisional = false; S.verified = true; }
    var note = document.getElementById('splitViewBar');
    if (note) note.textContent = 'Checked at block ' + (m.tip || '') + '. ' + (m.n || 0) + ' pets. Burns are open.';
    try { window.dispatchEvent(new Event('xcpets-verified')); } catch (e) {}
  }
  function startVerify() {
    if (window.XCPETS_MAINTENANCE) return Promise.resolve(null);
    if (readyP) return readyP;
    if (off() || !base() || !last) return Promise.resolve(null);
    var scripts = scriptList();
    if (!scripts || typeof Worker === 'undefined') return Promise.resolve(null);
    readyP = new Promise(function (res) {
      try { worker = new Worker(new URL('js/v2-verify-worker.js?v=c4e1a7b618', location.href).href); }
      catch (e) { res(null); return; }
      worker.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.cmd === 'progress') { var note = document.getElementById('splitViewBar'); if (note) note.textContent = progressText(m); return; }
        if (m.cmd === 'check') { var fn = pending[m.id]; if (fn) { delete pending[m.id]; fn(m); } return; }
        if (m.cmd === 'mine') { takeMine(m); return; }
        if (m.cmd === 'ready') { if (m.ok) { unlock(m); requestSync(); } else { var b = document.getElementById('splitViewBar'); if (b) b.textContent = 'The check did not finish. The published world is still on screen.'; } res(m); }
      };
      worker.onerror = function () { var b = document.getElementById('splitViewBar'); if (b) b.textContent = 'The check did not finish. The published world is still on screen.'; res({ ok: false }); };
      worker.postMessage({ cmd: 'start', base: base(), scripts: scripts, me: me() });
    });
    return readyP;
  }
  function checkPlans(plans) {
    if (!worker) startVerify();
    if (!worker) return Promise.resolve({ ok: false, plans: plans || [], skip: ['Press Verify to check this world. Nothing was burned.'] });
    return (readyP || Promise.resolve(null)).then(function () {
      if (!ready) return { ok: false, plans: [], skip: ['The check did not finish. Nothing was burned.'] };
      return new Promise(function (res) {
        var id = ++seq;
        pending[id] = res;
        var S = window.V2Mock && V2Mock.state && V2Mock.state();
        worker.postMessage({ cmd: 'check', id: id, plans: plans || [], tip: S && S.tip, me: me(), pending: [] });
      });
    });
  }
  function install(view) {
    var bar = document.getElementById('splitViewBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'splitViewBar';
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'background:#1d1b2e;color:#d7ffe4;padding:6px 10px;font-size:12px;line-height:1.5;text-align:center';
      document.body.insertBefore(bar, document.body.firstChild);
    }
    var behind = last && last.tip && view && view.tip ? last.tip - view.tip : 0;
    var lag = behind > 0 ? ' <span class="muted">(' + behind + ' block' + (behind === 1 ? '' : 's') + ' behind the tip)</span>' : '';
    bar.innerHTML = 'Published world at block <b id="splitViewTip"></b>' + lag + '. <button type="button" class="q" id="splitVerify">Verify</button>';
    var t = document.getElementById('splitViewTip');
    if (t) t.textContent = String(view && view.tip || '');
    document.getElementById('splitVerify').onclick = function () { var b = document.getElementById('splitVerify'); if (b) b.disabled = true; startVerify(); };
    trimStore();
  }
  function trimStore() {
    var i, k, v;
    try { sessionStorage.removeItem('xcpets-v2-prod-rows'); } catch (e) {}
    var big = ['xcpets-v2-last-1', 'xcpets-v2-prod-hashes', 'xcpets-dex-last-1', 'xcpets-dex-cache'];
    for (i = 0; i < big.length; i++) {
      k = big[i];
      try { v = localStorage.getItem(k); if (v && v.length > 80000) localStorage.removeItem(k); } catch (e2) {}
    }
    if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
      try { indexedDB.deleteDatabase('xcpets-world'); } catch (e3) {}
    }
  }
  function mergePets(extra) {
    if (!extra || !extra.length || !window.V2Mock || !V2Mock.world || !V2Mock.setViewWorld) return;
    var cur = V2Mock.world(), have = {}, pets = (cur.pets || []).slice(), i, p;
    for (i = 0; i < pets.length; i++) have[pets[i].id] = 1;
    for (i = 0; i < extra.length; i++) { p = extra[i]; if (!p || have[p.id] || (p.id === 1765 && p.dead)) continue; pets.push(p); have[p.id] = 1; }
    var pg = cur._pages, done = !pg || !!cur._full || (pg.got || 1) >= (pg.pages || 1);
    publishOwner(pets, pg, cur.fights || [], done);
  }
  function ensureDead() {
    if (!gravePlan) return Promise.resolve(false);
    if (gravePlan.done) return Promise.resolve(true);
    function finish() { gravePlan.done = true; mergePets(gravePlan.pets); return true; }
    if (gravePlan.separate) {
      function pull(n) {
        var name = n === 0 ? gravePlan.key + '.d.json' : gravePlan.key + '.d.' + n + '.json';
        return getJson(gravePlan.folder + 'view/own/' + name).then(function (page) {
          if (page && page.pets) gravePlan.pets = gravePlan.pets.concat(page.pets);
          if (page && page.pages > n + 1) return pull(n + 1);
        }, function () {});
      }
      return pull(0).then(finish);
    }
    var nums = [], i;
    for (i = gravePlan.from; i < gravePlan.pages; i++) nums.push(i);
    function batch() {
      if (!nums.length) return Promise.resolve();
      var slice = nums.splice(0, 4);
      return Promise.all(slice.map(function (n) {
        return getJson(gravePlan.folder + 'view/own/' + gravePlan.key + '.' + n + '.json').then(function (page) {
          if (page && page.pets) gravePlan.pets = gravePlan.pets.concat(page.pets);
        }, function () {});
      })).then(batch);
    }
    return batch().then(finish);
  }
  /* Rankings and Proof Parade need every living pet, not just this wallet. The published
   * pet shards already hold them. This reads those shards (never the checkpoint, never every
   * owner page), keeps a small row per living pet, and the real art of each wallet's top pet. */
  var boardP = null, boardBytes = 0, boardFiles = 0;
  function slimPet(p) {
    var s = p.stats || {}, worn = p.worn || [], gn = 0, gt = 0, i, g;
    for (i = 0; i < worn.length; i++) { g = worn[i]; if (!g) continue; gn++; gt += g.legendary ? 3 : (g.tier | 0); }
    return {
      id: p.id | 0, owner: p.owner || '', name: p.name || '', species: p.species || '',
      tier: p.tier | 0, stage: p.stage | 0, stageName: p.stageName || '', care: p.care || 0,
      wins: p.wins || 0, losses: p.losses || 0, hatchBlock: p.hatchBlock, dead: false, released: false,
      community: p.community || null, resurrected: p.resurrected || null, hybrid: p.hybrid || null,
      parents: p.parents || null, mutation: p.mutation || null, shows: p.shows || null,
      blackEye: p.blackEye || null, crowned: p.crowned || null,
      stats: { vigor: s.vigor || 0, spark: s.spark || 0, grit: s.grit || 0, zoom: s.zoom || 0, luck: s.luck || 0 },
      _hof: { n: gn, t: gt }
    };
  }
  function hangGear(w, list) {
    var i, j, p, g, id, c, ks, k;
    w.items = w.items || {};
    for (i = 0; i < list.length; i++) {
      p = list[i]; if (!p || !p.worn) continue;
      for (j = 0; j < p.worn.length; j++) {
        g = p.worn[j]; if (!g) continue;
        id = g.gid || ('rk' + p.id + ':' + j);
        c = {}; ks = Object.keys(g);
        for (k = 0; k < ks.length; k++) c[ks[k]] = g[ks[k]];
        c.gid = id; c.on = p.id; w.items[id] = c;
      }
    }
  }
  function absorbShard(pack, pets, best) {
    var map = pack && pack.pets || {}, ks = Object.keys(map), i, p, row, prev;
    for (i = 0; i < ks.length; i++) {
      p = map[ks[i]];
      if (!p || p.dead || p.released || p.id === 1765) continue;
      row = slimPet(p);
      prev = best[row.owner];
      if (row.owner && (!prev || row.tier > prev.tier || (row.tier === prev.tier && row.stage > prev.stage) || (row.tier === prev.tier && row.stage === prev.stage && row.id < prev.id))) {
        if (prev) { delete prev.art; delete prev.worn; }
        row.art = p.art || null;
        row.worn = p.worn || null;
        best[row.owner] = row;
      }
      pets.push(row);
    }
  }
  function pullShard(url, attempt) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('shard');
      var n = Number(r.headers.get('Content-Length')) || 0;
      return r.arrayBuffer().then(function (buf) {
        boardBytes += n || buf.byteLength;
        boardFiles++;
        return JSON.parse(new TextDecoder().decode(buf));
      });
    }, function () { if (attempt) return null; return pullShard(url, 1); });
  }
  function publishBoard(pets, best) {
    var byId = {}, i, cur, w, list = [];
    for (i = 0; i < pets.length; i++) byId[pets[i].id] = pets[i];
    cur = window.V2Mock && V2Mock.world && V2Mock.world();
    if (cur && cur.pets) cur.pets.forEach(function (p) {
      if (!p || p.id == null) return;
      var prev = byId[p.id];
      if (prev) {
        if (!p.art && prev.art) p.art = prev.art;
        if (!p.worn && prev.worn) p.worn = prev.worn;
        if (!p._hof) p._hof = prev._hof;
      }
      byId[p.id] = p.art ? p : (prev || p);
    });
    Object.keys(byId).forEach(function (id) { list.push(byId[id]); });
    w = assemble(lastSummary, null);
    w.pets = list;
    w.byId = byId;
    w.wagmi = (cur && cur.wagmi) || w.wagmi;
    w.community = (cur && cur.community) || w.community;
    w.fights = (cur && cur.fights) || [];
    w.items = {};
    w._counts = (cur && cur._counts) || w._counts;
    w._view = 1;
    w._ranked = 1;
    w._pages = cur && cur._pages;
    hangGear(w, list);
    if (window.V2Mock && V2Mock.setViewWorld) V2Mock.setViewWorld(w);
    return w;
  }
  function loadBoard(onProg) {
    if (boardP) return boardP;
    var folder = viewFolder;
    if (!folder || !lastSummary) return Promise.resolve(null);
    boardP = new Promise(function (res) {
      var pets = [], best = {}, next = 0, inflight = 0, stop = false, finished = false, CONC = 4;
      function finish() {
        if (finished) return;
        finished = true;
        try { res(publishBoard(pets, best)); } catch (e) { res(null); }
      }
      function pump() {
        if (stop && !inflight) return finish();
        while (!stop && inflight < CONC && next < 160) {
          (function (i) {
            inflight++;
            pullShard(folder + 'view/p/' + ('00000' + i).slice(-5) + '.json').then(function (pack) {
              inflight--;
              if (!pack) { stop = true; if (onProg) onProg(i, pets.length); pump(); return; }
              absorbShard(pack, pets, best);
              if (onProg) onProg(i + 1, pets.length);
              pump();
            }, function () { inflight--; stop = true; pump(); });
          })(next++);
        }
        if (!inflight && (stop || next >= 160)) finish();
      }
      pump();
    });
    return boardP;
  }
  function dress(ids) {
    var w = window.V2Mock && V2Mock.world && V2Mock.world();
    var folder = viewFolder;
    if (!w || !w.byId || !folder || !ids || !ids.length) return Promise.resolve(0);
    var need = {}, i, id, p, name, names, n = 0;
    for (i = 0; i < ids.length; i++) {
      id = ids[i] | 0; p = w.byId[id];
      if (!p || p.art) continue;
      name = ('00000' + Math.floor(id / 2000)).slice(-5);
      (need[name] = need[name] || []).push(id);
    }
    names = Object.keys(need);
    if (!names.length) return Promise.resolve(0);
    return Promise.all(names.map(function (nm) {
      return pullShard(folder + 'view/p/' + nm + '.json').then(function (pack) {
        var map = pack && pack.pets || {}, j, src, dst;
        for (j = 0; j < need[nm].length; j++) {
          dst = w.byId[need[nm][j]]; src = map[String(need[nm][j])];
          if (!dst || !src) continue;
          if (src.art) dst.art = src.art;
          if (src.worn) dst.worn = src.worn;
          n++;
        }
        hangGear(w, need[nm].map(function (pid) { return w.byId[pid]; }));
      }, function () {});
    })).then(function () { return n; });
  }
  function ensurePet(id) {
    id = id | 0;
    var w = window.V2Mock && V2Mock.world && V2Mock.world();
    if (w && w.byId && w.byId[id]) return Promise.resolve(w.byId[id]);
    if (id === 1765) return Promise.resolve(null);
    var folder = viewFolder || (gravePlan && gravePlan.folder) || (pageJob && pageJob.pages && pageJob.pages.folder) || '';
    if (!folder) return Promise.resolve(null);
    var shard = ('00000' + Math.floor(id / 2000)).slice(-5);
    return getJson(folder + 'view/p/' + shard + '.json').then(function (pack) {
      var p = pack && pack.pets && pack.pets[String(id)];
      if (!p || (p.id === 1765 && p.dead)) return null;
      mergePets([p]);
      return p;
    }, function () { return null; });
  }
  var zombieP = null;
  function applyZombies(z) {
    if (!z || !z.pets) return 0;
    viewHold.cem = { huntedBy: z.huntedBy || {} };
    if (z.pets.length) mergePets(z.pets);
    else if (window.V2Mock && V2Mock.world && V2Mock.setViewWorld) {
      var cur = V2Mock.world();
      cur.cem = viewHold.cem;
      V2Mock.setViewWorld(cur);
    }
    return z.pets.length;
  }
  function scanZombies(folder, onProg) {
    var found = [], next = 0, inflight = 0, stop = false, done = false;
    return new Promise(function (res) {
      function finish() { if (done) return; done = true; applyZombies({ pets: found, huntedBy: {} }); res(found.length); }
      function pump() {
        if (stop && !inflight) return finish();
        while (!stop && inflight < 2 && next < 160) {
          (function (i) {
            inflight++;
            pullShard(folder + 'view/p/' + ('00000' + i).slice(-5) + '.json').then(function (pack) {
              inflight--;
              if (!pack) { stop = true; if (onProg) onProg(i, found.length); pump(); return; }
              var map = pack.pets || {}, ks = Object.keys(map), k, p;
              for (k = 0; k < ks.length; k++) { p = map[ks[k]]; if (p && p.zombie && !p.zombie.end) found.push(p); }
              if (onProg) onProg(i + 1, found.length);
              pump();
            }, function () { inflight--; stop = true; pump(); });
          })(next++);
        }
        if (!inflight && (stop || next >= 160)) finish();
      }
      pump();
    });
  }
  function loadZombies(onProg) {
    if (zombieP) return zombieP;
    var folder = viewFolder || (gravePlan && gravePlan.folder) || '';
    if (!folder) return Promise.resolve(0);
    zombieP = getJson(folder + 'view/zombies.json').then(function (z) { return applyZombies(z); }, function () { return scanZombies(folder, onProg); });
    return zombieP;
  }
  window.V2Split = { STALE: STALE, SCREEN_PAGES: SCREEN_PAGES, AUTO_CAP: AUTO_CAP, prepare: prepare, recheck: recheck, install: install, assemble: assemble, startVerify: startVerify, checkPlans: checkPlans, rest: rest, more: more, loadBoard: loadBoard, loadZombies: loadZombies, dress: dress, boardBytes: function () { return { bytes: boardBytes, files: boardFiles }; }, ensureDead: ensureDead, ensurePet: ensurePet, ownerShard: function (addr, cb) { sha2(addr).then(function (h) { cb(h.slice(0, 2)); }); }, petSig: petSig, healthTip: function () { return healthTipN; }, noteHealth: noteHealth, pingHealth: pingHealth };
})();
