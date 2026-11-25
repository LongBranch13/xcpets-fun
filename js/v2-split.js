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
  var AUTO_CAP = 60000; /* Nov 23 2026: 12,000 left a 29,000-pet wallet showing ~200 pets for good ('missing pets', and feeds planned on the short list failed) */ var AUTO_CAP_OLD = 12000; /* wallets at or under this many living pets load the rest in the background (5,000 until Nov 22 2026;
                          * the background batches now grow, see drain(), so a 10,000-pet wallet no longer rebuilds its world 60 times) */
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
  /* The unleash button compares the pet to the page wallet (V2UI.ME). The background check used to send only
   * ?addr= or localStorage, which is empty when the connected wallet is the page wallet and that key is not.
   * An empty check wallet makes every owned zombie fail with "zombie owner only". */
  function pageWallet() {
    var ui = '';
    try { ui = (window.V2UI && V2UI.ME) || (window.V2Mock && V2Mock.ME) || ''; } catch (e) {}
    if (ui) return ui;
    try { var c = window.V2Wallet && V2Wallet.current && V2Wallet.current(); if (c) return c; } catch (e2) {}
    return me();
  }
  function resolveWorld(w, only) {
    if (!w || !w.byId) return w;
    var opt = { view: viewOwners, checkpoint: w._owners || w.__owners || null };
    function one(p) { if (window.XcpArt && XcpArt.resolvePetOwner) XcpArt.resolvePetOwner(p, opt); }
    var want = null, i, id, b, p;
    if (only && only.length) { want = {}; for (i = 0; i < only.length; i++) want[only[i]] = 1; }
    var ids = want ? Object.keys(want) : Object.keys(w.byId);
    for (i = 0; i < ids.length; i++) one(w.byId[ids[i]]);
    var pets = w.pets || [];
    for (i = 0; i < pets.length; i++) {
      p = pets[i];
      if (!p || p.id == null || (want && !want[p.id])) continue;
      b = w.byId[p.id];
      if (!b) { w.byId[p.id] = p; b = p; }
      if (b !== p) {
        if (typeof p.owner === 'string' && p.owner && !(typeof b.owner === 'string' && b.owner)) b.owner = p.owner;
        else if (typeof b.owner === 'string' && b.owner && !(typeof p.owner === 'string' && p.owner)) p.owner = b.owner;
      }
      one(b);
      one(p);
    }
    return w;
  }
  /* Page 0 of an owner file is the oldest living pets. Yesterday's hatches sit on the last pages.
   * The first paint must ask for those pages, or a fast load looks finished while they are still absent. */
  function newestPages(pageCount, got) {
    var last = (pageCount | 0) - 1, from, i, out = [];
    if (!(last > 0)) return out;
    from = Math.max(got || 1, last - 1);
    for (i = from; i <= last; i++) out.push(i);
    return out;
  }
  function tagText(h) {
    h = String(h || '');
    if (!/^[0-9a-f]+$/i.test(h) || h.length % 2) return h;
    var o = '', i;
    for (i = 0; i < h.length; i += 2) o += String.fromCharCode(parseInt(h.substr(i, 2), 16));
    return o;
  }
  /* Display lines for a published view, whose world is built with an empty log. Not a replay input. */
  function rowsToLog(list) {
    var out = [], i, r, text;
    for (i = 0; i < (list || []).length; i++) {
      r = list[i]; if (!r) continue;
      text = tagText(r.tag);
      out.push({ block: r.block_index | 0, tx: r.tx_hash || '', kind: (text.split(':')[1] || 'burn'), msg: text, src: r.source || '' });
    }
    out.sort(function (a, b) { return a.block - b.block || (a.tx < b.tx ? -1 : a.tx > b.tx ? 1 : 0); });
    return out;
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
    function addItem(g, on, owner) {
      if (!g) return;
      /* Nov 22 2026: owner page 0 arrives with slim gear {g, i, t, slot} (Art.slimGear). Later pages go through openList; this path did not,
       * so the first 24 pets' worn gear got ids v1, v2... and no item (fastcheck: 34 pieces on Evan's page 0). Open it the same way. */
      if (!g.gid && !g.label && g.i && window.XcpArt && XcpArt.openGear) g = XcpArt.openGear(g, owner || '', on, artOpt());
      var id = g.gid || ('v' + (n++));
      var copy = {};
      Object.keys(g).forEach(function (k) { copy[k] = g[k]; });
      copy.gid = id;
      if (on != null) copy.on = on;
      items[id] = copy;
      return copy;
    }
    function addPet(p) {
      if (!p || byId[p.id]) return;
      var copy = {};
      Object.keys(p).forEach(function (k) { if (k !== 'worn') copy[k] = p[k]; });
      if (!copy.art && addPet.prev && addPet.prev[copy.id] && addPet.prev[copy.id].art) copy.art = addPet.prev[copy.id].art;
      pets.push(copy);
      byId[copy.id] = copy;
      /* keep the opened worn list on the copy: publishOwner re-assembles from these copies as more owner pages arrive, and a copy
       * without worn dropped page 0's gear again on the next rebuild (fastcheck, Nov 22 2026). */
      copy.worn = []; (p.worn || []).forEach(function (g) { var it = addItem(g, copy.id, (typeof copy.owner === 'string' && copy.owner) || addPet.owner || ''); if (it) copy.worn.push(it); });
    }
    function takeDeeds(src) { if (!src) return; Object.keys(src).forEach(function (k) { deeds[k] = src[k]; }); }
    function takeMythic(src) { if (!src) return; Object.keys(src).forEach(function (k) { if (src[k] != null) mythicOwners[k] = src[k]; }); }
    addPet.prev = pack && pack.keepArt || null;
    if (pack) { takeDeeds(pack.deeds); takeMythic(pack.mythicOwners); }
    if (pack && pack.owners) Object.keys(pack.owners).forEach(function (addr) {
      var o = pack.owners[addr];
      addPet.owner = (o && o.owner) || addr;
      if (Array.isArray(o)) o.forEach(addPet);
      else if (o && o.pets) {
        o.pets.forEach(addPet);
        takeDeeds(o.deeds);
        if (o.mythicAt != null) mythicOwners[o.owner || addr] = o.mythicAt;
      }
    });
    if (pack && pack.rise) pack.rise.forEach(addPet);
    if (pack && pack.stash) {
      var opt = artOpt(), si, sg;
      for (si = 0; si < pack.stash.length; si++) {
        sg = pack.stash[si];
        if (!sg) continue;
        if (window.XcpArt && XcpArt.openGear && !sg.gid && !sg.label) sg = XcpArt.openGear(sg, sg.owner || pack.owner || '', null, opt);
        addItem(sg, null);
      }
    }
    var cold = summary.cold || {};
    var itemList = [];
    Object.keys(items).forEach(function (k) { itemList.push(items[k]); });
    var w = {
      tip: summary.tip, pets: pets, byId: byId, items: items, itemList: itemList, log: [], fights: [], breedReqs: ((pack && pack.breedReqs) || summary.breedReqs || []).map(function (r) { return { a: r.a, b: r.b, block: r.block, tx: r.tx, owner: r.owner }; }), /* open Gooby's requests (Nov 23 2026); older summaries have none */
      community: summary.community || {},
      tokens: {}, deeds: deeds, mythicOwners: mythicOwners,
      wizardMythic: cold.wizard || null, kekMythic: cold.kek || null, homerMythic: cold.homer || null,
      rabbitMythic: cold.rabbit || null, groyperMythic: cold.groyper || null, funtrumpMythic: cold.funtrump || null, djpepeMythic: cold.djpepe || null, /* groyper: Groyper's Cold Storage (community pet #7, Nov 24 2026); older summaries have none */
      wagmi: summary.wagmi || {},
      raids: summary.raids || [], /* raids ride in the summary (Nov 22 2026); older summaries have none */
      seasons: summary.seasons || {}, /* season eggs sold, points and tiers ride in the summary too; older summaries have none */
      pantry: summary.pantry || undefined, pantryDay: summary.pantryDay != null ? summary.pantryDay : undefined, /* Pantry (gated): balances and lists */
      fire: summary.fire || undefined, /* Fire Sales (Nov 25 2026): armed sales, so the banner and every burn price follow a live sale; older summaries have none */
      grind: summary.grind || undefined, /* Meat Grinder (gated): meat meters; older summaries have none */
      _gods: summary.gods || null, /* every living God (Nov 24 2026): the cemetery's Gods door; older summaries have none */
      _burnBy: summary.burnBy || null, _winsWk: summary.winsWk || null, /* Rankings (Nov 24 2026): XCPETS burned per wallet [all, week] and this week's wins per pet; a view has no burn or fight list. Older summaries have none */
      _view: 1, _counts: { n: summary.n, alive: summary.alive, dead: summary.dead, burned: summary.burned, burns: summary.burns }
    };
    if (pack && pack.roster) w._roster = pack.roster;
    /* FAST WORLD STATE (Nov 25 2026, root fix; see STATE_OWN/STATE_SKIP/STATE_SLIM in tools/sync-server/split.js): every other rules
     * table rides in summary.state (saved spins, player numbers, gift inbox, burn totals, Mythic discount marks, swaps, listings, Rug Me
     * ads, re-wear grants, the cemetery's seats and grudges...). Each world gets its own copy, since the rules write to some of them. */
    var st = stateCopy(summary);
    if (st) {
      Object.keys(st).forEach(function (k) { if (STATE_MERGE[k]) return; if (w[k] === undefined || STATE_OVER[k]) w[k] = st[k]; });
      w.mythicOwners = Object.assign(st.mythicOwners || {}, mythicOwners); /* every wallet's Mythic discount; the owner page's own mark wins */
      w.lookCopies = Object.assign(st.lookCopies || {}, pageLooks); /* copies worn by another pet + every copy of the owner pages read */
      if (st.cem) w.cem = cemFill(st.cem, true);
    }
    if (!w.cem && pack && pack.cem) w.cem = cemFill(pack.cem);
    poolSwitches(w);
    return w;
  }
  /* summary.state tables assemble() merges itself, and the ones the summary carries but the slim world fills with an empty stand-in */
  var STATE_MERGE = { mythicOwners: 1, lookCopies: 1, cem: 1 }, STATE_OVER = { tokens: 1 };
  var stCache = { s: null, t: null };
  function stateCopy(summary) {
    if (!summary || !summary.state) return null;
    if (stCache.s !== summary) { stCache.s = summary; stCache.t = JSON.stringify(summary.state); }
    return JSON.parse(stCache.t);
  }
  /* look copies a wallet holds, from every owner page 0 this page read (page.looks) */
  var pageLooks = {};
  /* Nov 22 2026: the rules keep 'has this community Mythic reached Cold Storage' switches in memory (FUNTRUMP, DJ Pepe, White Rabbit,
   * Homer, Kek, Wizard pools and breeding). A replay or V2Rules.reindex sets them; the fast world never ran either, so FUNTRUMP-line
   * pets showed 'FUNTRUMP can breed once he reaches Cold Storage' here while the game allowed the breed. Set only the switches: a stub
   * with __ix skips the gear index, which would go stale while more owner pages arrive. */
  function poolSwitches(w) { try { if (w && window.V2Rules && V2Rules.reindex) V2Rules.reindex({ items: {}, __ix: 1, djpepeMythic: w.djpepeMythic, rabbitMythic: w.rabbitMythic, groyperMythic: w.groyperMythic,
    homerMythic: w.homerMythic, funtrumpMythic: w.funtrumpMythic, kekMythic: w.kekMythic, wizardMythic: w.wizardMythic }); } catch (e) {} }
  var last = null, lastSummary = null, viewOwners = null, rankHashes = null, healthTipN = 0;
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
  /* the server's burn check is up and current: the device check need not warm up in the background (it still runs if a burn needs it) */
  var serverReady = false;
  function noteCheck(h) { serverReady = !!(h && h.check && h.check.state === 'ready' && h.check.tip >= (h.tip || 0)); }
  function pingHealth() {
    var root = base();
    if (!root || typeof fetch !== 'function') return Promise.resolve(healthTipN);
    return getJson(root + '/xp/v1/health', 8000, true).then(function (h) { noteCheck(h); return noteHealth(h && h.tip); }, function () { return healthTipN; });
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
  /* Nov 24 2026 (instant load): ask for latest.json, health, the summary and this wallet's first page while the ~50 rule and
   * engine scripts after this one are still downloading (on a phone's first visit those take ~2 s, and the asks used to wait
   * for them). prepare() takes these answers once when the server address and wallet are the same, else asks again itself.
   * Same files, same checks: nothing is trusted that prepare() would not check. */
  var early = null;
  function earlyBase() {
    try { if (/\/verify-pet\.html$/.test(location.pathname || '')) return ''; } catch (e) {}
    var s = q('sync');
    if (s === '0' || s === 'off') return '';
    if (s) return String(s).replace(/\/+$/, '');
    try { var f = localStorage.getItem('xcpets-sync'); if (f) return String(f).replace(/\/+$/, ''); } catch (e2) {}
    try { var h = String(location.hostname || '').toLowerCase(); if (h === 'xcpets.fun' || h === 'www.xcpets.fun') return 'https://node.xcpets.fun'; } catch (e3) {}
    return '';
  }
  function quiet(p) { if (p && p.then) p.then(null, function () {}); return p; }
  (function startEarly() {
    try {
      if (off() || typeof fetch !== 'function' || q('early') === '0') return;
      var root = earlyBase(); if (!root) return;
      var who = me();
      var latestP = quiet(getJson(root + '/xp/v1/world/latest.json', 8000, true));
      var healthP = quiet(getJson(root + '/xp/v1/health', 8000, true));
      var viewP = quiet(latestP.then(function (latest) {
        var path = latest && (latest.manifest || latest.url);
        if (!path) return null;
        var folder = dirOf(/^https?:/.test(path) ? path : root + path);
        return { folder: folder, summaryP: quiet(getJson(folder + 'view/summary.json', 12000, false)),
          pageP: who ? quiet(sha2(who).then(function (hex) { return getJson(folder + 'view/own/' + hex + '.json', 12000, false).then(function (page) { return { hex: hex, page: page }; }, function () { return { hex: hex, page: null }; }); })) : null };
      }));
      early = { root: root, who: who, latestP: latestP, healthP: healthP, viewP: viewP };
    } catch (e) { early = null; }
  })();
  /* first (an answer already asked for, or null), else ask(); one more ask after 1.2 s when that fails */
  function again(first, ask) {
    return (first || ask()).then(null, function () { return new Promise(function (r) { setTimeout(r, 1200); }).then(ask); });
  }
  function takeEarly(root) { var e = early; early = null; return e && e.root === root && e.who === me() ? e : null; }
  function prepare(cb) {
    if (off() || !base()) { cb(null); return; }
    var root = base();
    var pre = takeEarly(root);
    var chainTip = 0, manUrl = '';
    var sigP = pageRsig();
    /* Nov 24 2026: health and latest.json are asked together (they were one after the other: one more round trip before
     * any pet, ~0.3 s on a phone network). health only feeds the staleness check below; a failed health read failed the
     * whole fast path before and still does. */
    /* Never wait on a busy server (Nov 24 2026): the live probe saw pages give up the published world after one missed
     * answer and rebuild the game in the browser instead (40-53 s, ~55 MB, 350 MB of memory). latest.json is asked once
     * more after a short pause. health only feeds the staleness check: without it the page still paints the published
     * world, and the next refresh (recheck) runs the staleness check and the full check when it is too old. */
    var latestP = again(pre ? pre.latestP : null, function () { return getJson(root + '/xp/v1/world/latest.json', 8000, true); });
    latestP.then(null, function () {});
    again(pre ? pre.healthP : null, function () { return getJson(root + '/xp/v1/health', 8000, true); }).then(null, function () { return null; }).then(function (h) {
      chainTip = h && h.tip || 0;
      if (h) { noteHealth(chainTip); noteCheck(h); }
      return latestP;
    }).then(function (latest) {
      /* Never go dark (Nov 22 2026): latest.json built with other rules than this page's? The server keeps the newest
       * world for each rules signature at world/<rsig>/latest.json; use this page's own before falling back to a replay. */
      return sigP.then(function (rsig) {
        if (!latest || !rsig || latest.rsig === rsig) return latest;
        return getJson(root + '/xp/v1/world/' + rsig + '/latest.json', 8000, true).then(function (own) {
          return own && own.rsig === rsig && (own.manifest || own.url) ? own : latest;
        }, function () { return latest; });
      });
    }).then(function (latest) {
      var path = latest && (latest.manifest || latest.url);
      if (!path || !latest.rsig) throw new Error('latest');
      manUrl = /^https?:/.test(path) ? path : root + path;
      var snapTip = latest.tip || 0;
      if (chainTip && snapTip && chainTip - snapTip > STALE) throw new Error('stale');
      var folder = dirOf(manUrl);
      viewFolder = folder;
      var who = me();
      var preView = pre ? pre.viewP.then(function (v) { return v && v.folder === folder ? v : null; }, function () { return null; }) : Promise.resolve(null);
      return preView.then(function (v) {
      var summaryP = again(v ? v.summaryP : null, function () { return getJson(folder + 'view/summary.json', 12000, false); });
      var pageP = v && v.pageP ? v.pageP : who ? sha2(who).then(function (hex) {
        return getJson(folder + 'view/own/' + hex + '.json', 12000, false).then(function (page) {
          return { hex: hex, page: page };
        }, function () { return { hex: hex, page: null }; });
      }) : Promise.resolve(null);
      return Promise.all([sigP, summaryP, pageP]).then(function (got) {
        var rsig = got[0], summary = got[1], own = got[2];
        /* never-slow (Nov 22 2026): a rules update can go live before the server has built a world for it (Seasons, PR 129: the
         * server was out of memory). A full replay in the browser then took 1-2 minutes on every page. New rules only start at a
         * future ACTIVATE_*_BLOCK (old eras are frozen), so the newest world built with the previous rules shows the same pets.
         * Paint from it. The check worker still resumes it with this page's rules before any burn opens, and the bar says so. */
        if (!rsig) throw new Error('rules');
        var otherRules = rsig !== latest.rsig;
        if (!summary || (summary.v !== 1 && summary.v !== 2 && summary.v !== 3) || summary.tip !== latest.tip || summary.rsig !== latest.rsig) throw new Error('summary');
        lastSummary = summary;
        keepStart(summary.rsig);
        last = { man: { tip: latest.tip, rsig: latest.rsig, view: true, other: otherRules }, url: manUrl, tip: chainTip };
        function paint(owners) {
          if (owners) viewOwners = owners;
          if (own && own.page) openOwnerPets(own.page, who);
          if (!own || !own.page || !own.page.pets || !own.page.pets.length) {
            if (own && own.page && (own.page.deeds || own.page.roster || own.page.mythicAt != null || (own.page.rise && own.page.rise.length))) {
              var mythic0 = {}; if (own.page.mythicAt != null) mythic0[own.page.owner || who] = own.page.mythicAt;
              var bare = assemble(summary, { deeds: own.page.deeds || null, mythicOwners: mythic0, roster: own.page.roster || null, rise: own.page.rise || null, stash: own.page.stash || null, owner: own.page.owner || who });
              viewHold = { deeds: bare.deeds, mythicOwners: bare.mythicOwners, roster: bare._roster || null, cem: bare.cem || null, stash: own.page.stash || null, owner: own.page.owner || who };
              return bare;
            }
            return assemble(summary, null);
          }
          return painted();
        }
        function painted() {
        var raw0 = own.page.pets, living0 = livingOf(raw0), separate = own.page.alive != null;
        var stop0 = !separate && endsDead(raw0);
        var livingPages = separate ? Math.max(1, Math.ceil((own.page.alive || 0) / (own.page.pageSize || 24)) || 1) : (stop0 ? 1 : own.page.pages);
        var one = {}; one[own.page.owner || who] = living0.concat(own.page.rise || []);
        var mythic = {}; if (own.page.mythicAt != null) mythic[own.page.owner || who] = own.page.mythicAt;
        var view = assemble(summary, { owners: one, deeds: own.page.deeds || null, mythicOwners: mythic, roster: own.page.roster || null, rise: own.page.rise || null, stash: own.page.stash || null, owner: own.page.owner || who });
        if (!view._roster) view._roster = savedRoster() || {};
        if (view._roster) {
          if (own.page.alive != null) view._roster.alive = own.page.alive;
          if (own.page.dead != null) view._roster.dead = own.page.dead;
        }
        viewHold = { deeds: view.deeds, mythicOwners: view.mythicOwners, roster: view._roster || null, cem: view.cem || null, stash: own.page.stash || null, owner: own.page.owner || who };
        viewFolder = folder;
        view._pages = { n: separate ? own.page.alive : living0.length, pages: livingPages, total: own.page.pages, page: 0, got: 1, key: own.hex, folder: folder, raw: living0, rev: separate ? 1 : 0, ord: idOrder(own.page) };
        if (separate) noteGraves(view._pages, 0, true);
        else if (stop0) noteGraves(view._pages, 1, false);
        if (!(view._pages.pages > 1)) { view._full = 1; viewHold.roster = null; view._roster = null; }
        return view;
        }
        var view = paint(null);
        ownersReady();
        return view;
      });
      });
    }).then(function (view) { if (view && view._pages && view._pages.pages > 1) restView = view; cb(view); if (view && view.breedReqs && view.breedReqs.length) reqPetsSoon(); }, function () { cb(null); });
  }
  function recheck() {
    if (!last || !last.man) return Promise.resolve(false);
    /* one missed health answer is asked again before the page drops to the full check (Nov 24 2026) */
    return again(null, function () { return getJson(base() + '/xp/v1/health', 8000, true); }).then(function (h) {
      var tip = h && h.tip || 0;
      noteHealth(tip); noteCheck(h);
      return !(tip && last.man.tip != null && tip - last.man.tip > STALE);
    }, function () { return false; });
  }
  function progressText(m) {
    if (!m) return 'Getting burns ready…';
    if (m.phase === 'files') return 'Getting burns ready… ' + Math.round(100 * (m.got || 0) / Math.max(1, m.total || 1) * 0.6) + '%';
    if (m.phase === 'rules') return 'Getting burns ready… 60%';
    if (m.phase === 'replay') return 'Getting burns ready… 75%';
    return 'Getting burns ready…';
  }
  /* Nov 23 2026 (faster burns): the full check used to start only when a burn or Verify asked for it, so the first burn waited for the whole
   * world to download and decode ('Applying the newest blocks…'). With a wallet connected it now starts by itself a few seconds after the page
   * is idle, without touching the bar; the bar only shows progress when someone is waiting on it (a burn, Verify, or a stale view). Skipped on
   * small-memory devices and with Data Saver. Nothing is signed here: burns still go through checkPlans exactly as before. */
  var wantBar = false, lastProg = null, warmT = 0;
  function showProgress() {
    wantBar = true;
    if (ready) return;
    var note = document.getElementById('splitViewBar');
    if (note) note.textContent = progressText(lastProg);
  }
  function warmOk() {
    try {
      if (navigator.connection && navigator.connection.saveData) return false;
      if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    } catch (e) {}
    return true;
  }
  function connected() { try { return !!(window.V2Wallet && V2Wallet.current && V2Wallet.current()); } catch (e) { return false; } }
  function warm() {
    if (readyP || warmT || serverReady || !last || !last.man || !warmOk() || !connected()) return;
    warmT = setTimeout(function () {
      var go = function () { warmT = 0; if (!readyP && connected()) startVerify(true); };
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 5000 }); else go();
    }, 3000);
  }
  if (window.addEventListener) {
    window.addEventListener('xcpets:connected', function () { warm(); });
    window.addEventListener('xcpets:wallet', function (e) { var d = e && e.detail; if (d && d.status === 'on') warm(); });
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
  var viewHold = { deeds: null, mythicOwners: null, roster: null, cem: null, stash: null, owner: '' };
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
  function artOpt() {
    var V = window.V2Rules;
    return { PetCore: window.PetCore, owners: viewOwners, hashes: null, ftLook: V && V.ftLookOfTier ? function (t) { return V.ftLookOfTier(t); } : null, itemOf: V && V.itemOf ? function (id) { return V.itemOf(id); } : null };
  }
  var noted = typeof WeakSet === 'function' ? new WeakSet() : null, notedList = [];
  function notePet(p) {
    if (!p || typeof p !== 'object') return;
    if (noted) { if (noted.has(p)) return; noted.add(p); }
    notedList.push(p);
  }
  function notePets(list) { var i; for (i = 0; i < (list || []).length; i++) notePet(list[i]); }
  function stampOwner(p, owners, pageOwner) {
    if (!p || p.owner) return p;
    var from = p.o != null && owners && typeof owners[p.o] === 'string' ? owners[p.o] : '';
    if (from) p.owner = from;
    else if (pageOwner) p.owner = pageOwner;
    return p;
  }
  function openList(list, hashes, pageOwner) {
    if (!list) return [];
    var opt = artOpt(); opt.hashes = hashes || null; opt.pageOwner = pageOwner || '';
    var out = [], i, p;
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (window.XcpArt && XcpArt.openPet) p = XcpArt.openPet(p, opt);
      stampOwner(p, opt.owners, opt.pageOwner);
      notePet(p);
      out.push(p);
    }
    return out;
  }
  /* Own-page pets belong to the page wallet even before owners.json arrives. */
  function openOwnerPets(page, who) {
    if (!page || page.v !== 3) return page;
    var known = page.owner || who || '';
    if (page.looks) Object.keys(page.looks).forEach(function (k) { pageLooks[k] = page.looks[k]; });
    if (page.pets) page.pets = openList(page.pets, page.hashes, known);
    if (page.rise) page.rise = openList(page.rise, page.hashes, known);
    return page;
  }
  function eachOpen(fn) {
    var i, p, w, seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    function one(p) {
      if (!p || typeof p !== 'object') return;
      if (seen) { if (seen.has(p)) return; seen.add(p); }
      fn(p);
    }
    for (i = 0; i < notedList.length; i++) one(notedList[i]);
    w = window.V2Mock && V2Mock.world && V2Mock.world();
    if (w && w.pets) for (i = 0; i < w.pets.length; i++) one(w.pets[i]);
    if (w && w.byId) Object.keys(w.byId).forEach(function (id) { one(w.byId[id]); });
    if (w) one(w);
    if (pageJob && pageJob.pets) for (i = 0; i < pageJob.pets.length; i++) one(pageJob.pets[i]);
    if (gravePlan && gravePlan.pets) for (i = 0; i < gravePlan.pets.length; i++) one(gravePlan.pets[i]);
    if (diffBuf && diffBuf.length) for (i = 0; i < diffBuf.length; i++) one(diffBuf[i]);
    return w;
  }
  var filledFor = null, filledSet = null;
  function fillWorld() {
    if (!viewOwners) return;
    if (filledFor !== viewOwners || !filledSet) { filledFor = viewOwners; filledSet = typeof WeakSet === 'function' ? new WeakSet() : null; }
    var w = eachOpen(function (p) {
      if (window.XcpArt && XcpArt.fillOwners) XcpArt.fillOwners(p, viewOwners, '', filledSet || undefined);
      else stampOwner(p, viewOwners, '');
    });
    if (w && window.V2Mock && V2Mock.setViewWorld) { try { V2Mock.setViewWorld(w); } catch (e) {} }
  }
  var ownersP = null;
  function ownersKnown() { return viewOwners != null || !viewFolder; }
  function ownerTable() { return viewOwners; }
  function adoptOwners(rows) {
    viewOwners = rows || [];
    try { fillWorld(); } catch (e) {}
    return viewOwners;
  }
  function ownersReady() {
    if (viewOwners) return Promise.resolve(viewOwners);
    if (ownersP) return ownersP;
    if (!viewFolder) return Promise.resolve(null);
    ownersP = getJson(viewFolder + 'view/owners.json', 12000, false).then(function (rows) { return adoptOwners(rows || []); }, function () { return adoptOwners([]); });
    return ownersP;
  }
  function resolveIds(ids, keep) {
    var folder = viewFolder, need = {}, i, id, name, names;
    if (!ids || !ids.length || !folder) return Promise.resolve([]);
    return ownersReady().then(function () { return resolveIdsNow(ids, keep); });
  }
  /* Nov 23 2026 (players: 'missing about 100 pets', 'discards take forever'): every later owner page (24 ids) fetched and parsed its
   * ~1 MB pet shard again, one page after another on the main thread, and a shard that timed out (12 s) or failed dropped that page's
   * pets for good. A big Electric Egg Box puts ~1,000 of one wallet's pets in one or two shards, so that was ~40 parses of the same
   * file. Keep the last few parsed shards per world folder, wait longer, and try a failed shard again before giving up. Display only. */
  var shardMemo = {}, shardOrder = [], SHARD_KEEP = 6;
  function idShard(url) {
    if (shardMemo[url]) return shardMemo[url];
    var p = getJson(url, 30000).then(null, function () { return getJson(url, 45000); });
    p.then(null, function () { if (shardMemo[url] === p) { delete shardMemo[url]; shardOrder = shardOrder.filter(function (u) { return u !== url; }); } });
    shardMemo[url] = p; shardOrder.push(url);
    while (shardOrder.length > SHARD_KEEP) delete shardMemo[shardOrder.shift()];
    return p;
  }
  /* Device copy of my pets (Nov 24 2026, Jake: 'let players download the pets'; 'we can't lose anything'). The records of the
   * player's own pets are kept in IndexedDB, one entry per 2,000-id shard, under the shard's content digest (summary.shardSig,
   * written by tools/sync-server/split.js; the digest covers every field the page reads from the shard). On a later visit,
   * even after the server published newer worlds, a shard whose digest is unchanged is read from the device instead of
   * downloaded (about 100 of 103 shards are unchanged between worlds 6 blocks apart). A changed or missing digest, another
   * rules signature, a missing id or any storage error falls back to the download, so the page shows exactly what the
   * published files say. Display only: burns are still checked against the full world. */
  var keepDb = null, keepRsig = '', keepFail = false, keepQ = {}, keepT = 0;
  function keepOn() { return !keepFail && typeof indexedDB !== 'undefined' && !!me() && q('keep') !== '0'; }
  function keepOpen() {
    if (keepDb) return keepDb;
    keepDb = new Promise(function (res) {
      var r;
      try { r = indexedDB.open('xcpets-mine', 1); } catch (e) { keepFail = true; res(null); return; }
      r.onupgradeneeded = function () { try { r.result.createObjectStore('s'); } catch (e) {} };
      r.onsuccess = function () { res(r.result); };
      r.onerror = r.onblocked = function () { keepFail = true; res(null); };
    });
    return keepDb;
  }
  function keepKey(nm) { return me() + '|' + keepRsig + '|' + nm; }
  var keepMemo = {};
  /* one read per shard and digest for this page (a 30,000-pet wallet asks for the same shard from ~1,300 pages) */
  function keepGet(nm, sig) {
    if (!sig || !keepOn() || !keepRsig) return Promise.resolve(null);
    var mk = keepKey(nm) + '|' + sig;
    if (!keepMemo[mk]) keepMemo[mk] = keepRead(nm, sig);
    return keepMemo[mk];
  }
  function keepRead(nm, sig) {
    return keepOpen().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        try {
          var g = db.transaction('s', 'readonly').objectStore('s').get(keepKey(nm));
          g.onsuccess = function () { var v = g.result; res(v && v.sig === sig && v.pets ? v : null); };
          g.onerror = function () { res(null); };
        } catch (e) { res(null); }
      });
    }, function () { return null; });
  }
  /* Remember the records of these ids from a downloaded shard (only the block hashes they use). Written a moment later, a
   * shard per transaction, so a 30,000-pet wallet never stores one huge value in one go. */
  function keepPut(nm, sig, pack, ids) {
    if (!sig || !keepOn() || !keepRsig || !pack || !pack.pets) return;
    var e = keepQ[nm];
    if (!e || e.sig !== sig) e = keepQ[nm] = { sig: sig, hashes: [], at: {}, pets: {}, base: null };
    var src = pack.pets, hs = pack.hashes || [], i, k, rec, copy, f, hx;
    for (i = 0; i < ids.length; i++) {
      k = String(ids[i]); rec = src[k];
      if (!rec || e.pets[k]) continue;
      copy = {}; for (f in rec) if (Object.prototype.hasOwnProperty.call(rec, f)) copy[f] = rec[f];
      if (rec._h != null && pack.v === 3) {
        hx = hs[rec._h];
        if (e.at[hx] == null) { e.at[hx] = e.hashes.length; e.hashes.push(hx); }
        copy._h = e.at[hx];
      }
      e.pets[k] = copy;
    }
    clearTimeout(keepT); keepT = setTimeout(keepFlush, 1500);
  }
  /* layout-check Nov 25 2026 ("Cannot read properties of undefined (reading 'sig')" on play.html, about one load in five):
   * a flush waits on IndexedDB for each shard, and a pet page downloaded meanwhile re-armed the 1.5 s timer. The second flush
   * had the same shard name in its list, the first had already taken it out of keepQ, and keepQ[nm].sig threw. Now one flush
   * runs at a time (a flush asked for while one is running starts again after it) and a name that is gone is skipped. */
  var keepBusy = false;
  function keepFlush() {
    var names = Object.keys(keepQ); if (!names.length) return;
    if (keepBusy) { clearTimeout(keepT); keepT = setTimeout(keepFlush, 300); return; }
    keepBusy = true;
    keepOpen().then(function (db) {
      if (!db) { keepBusy = false; return; }
      (function next() {
        var nm = names.shift(); if (nm == null) { keepBusy = false; return; }
        var e = keepQ[nm]; if (!e) return next(); delete keepQ[nm];
        /* add to the saved entry of the same digest (a wallet's pets in one shard can arrive over several pages) */
        keepGet(nm, e.sig).then(function (old) {
          var k;
          if (old) {
            var at = {}, i; for (i = 0; i < old.hashes.length; i++) at[old.hashes[i]] = i;
            for (k in e.pets) if (!old.pets[k]) {
              var c = e.pets[k];
              if (c._h != null) { var hx = e.hashes[c._h]; if (at[hx] == null) { at[hx] = old.hashes.length; old.hashes.push(hx); } c._h = at[hx]; }
              old.pets[k] = c;
            }
            e = { sig: old.sig, hashes: old.hashes, pets: old.pets };
          }
          try {
            var tx = db.transaction('s', 'readwrite');
            tx.objectStore('s').put({ v: 1, sig: e.sig, hashes: e.hashes, pets: e.pets, at: Date.now() }, keepKey(nm));
            tx.oncomplete = tx.onerror = tx.onabort = function () { delete keepMemo[keepKey(nm) + '|' + e.sig]; setTimeout(next, 30); };
          } catch (x) { setTimeout(next, 30); }
        }, function () { setTimeout(next, 30); });
      })();
    });
  }
  /* A new rules signature: this wallet's copies made under other rules are dropped once. */
  function keepStart(rsig) {
    keepRsig = rsig || '';
    if (!keepOn() || !keepRsig) return;
    keepOpen().then(function (db) {
      if (!db) return;
      try {
        var who = me(), tx = db.transaction('s', 'readwrite'), st = tx.objectStore('s');
        var c = st.openKeyCursor ? st.openKeyCursor(IDBKeyRange.bound(who + '|', who + '|\uffff')) : null;
        if (!c) return;
        c.onsuccess = function () { var cur = c.result; if (!cur) return; if (String(cur.key).split('|')[1] !== keepRsig) st.delete(cur.key); cur.continue(); };
      } catch (e) {}
    });
  }
  function keepSig(nm) { var m = lastSummary && lastSummary.shardSig; return m && typeof m[nm] === 'string' ? m[nm] : ''; }
  var keepStat = { device: 0, net: 0 };
  /* One shard for these ids: the saved copy when its digest matches and it holds every id, else the download (then saved). */
  function shardFor(folder, nm, ids, keep) {
    var sig = keep ? keepSig(nm) : '';
    var net = function () {
      keepStat.net++;
      return idShard(folder + 'view/p/' + nm + '.json').then(function (pack) { if (sig && keep) keepPut(nm, sig, pack, ids); return pack; });
    };
    if (!sig) return net();
    return keepGet(nm, sig).then(function (v) {
      var i;
      if (!v) return net();
      for (i = 0; i < ids.length; i++) if (!v.pets[String(ids[i])]) return net();
      keepStat.device++;
      return { v: 3, hashes: v.hashes, pets: v.pets };
    });
  }
  function resolveIdsNow(ids, keep) {
    var folder = viewFolder, need = {}, i, id, name, names;
    for (i = 0; i < ids.length; i++) {
      id = ids[i] | 0;
      name = ('00000' + Math.floor(id / 2000)).slice(-5);
      (need[name] = need[name] || []).push(id);
    }
    names = Object.keys(need);
    return Promise.all(names.map(function (nm) {
      return shardFor(folder, nm, need[nm], keep).then(function (pack) {
        var map = pack && pack.pets || {}, hashes = pack && pack.hashes || [], j, src, out = [];
        for (j = 0; j < need[nm].length; j++) {
          src = map[String(need[nm][j])];
          if (!src) continue;
          if (pack && pack.v === 3) out.push(openList([src], hashes)[0]);
          else out.push(src);
        }
        return out;
      }, function () { return []; });
    })).then(function (groups) {
      var all = [], g, k;
      for (g = 0; g < groups.length; g++) for (k = 0; k < groups[g].length; k++) all.push(groups[g][k]);
      return all;
    });
  }
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
  /* Nov 23 2026 (Gooby's 'no such pet' on a breed request, pets that showed and then vanished): pets added from outside the owner list
   * (the asker's pet in a breed request, a pet page's parents, graves, zombies, the Rankings lead file) went in through mergePets, but the
   * next owner-page batch republished from the owner list alone and dropped them. Nov 24 2026: this is now the one shared merge step in
   * js/v2-merge.js (V2Merge.pin here, V2Merge.carry in V2Mock.setViewWorld), the same for every source; a fresher copy still wins. */
  function keepExtra(list) { if (window.V2Merge) V2Merge.pin(list, me()); }
  function publishOwner(pets, pages, fights, done) {
    if (!lastSummary || !window.V2Mock || !V2Mock.setViewWorld) return;
    var who = me(), one = {};
    one[who] = aliveFirst(pets); /* pets from other sources are added back by V2Merge.carry in setViewWorld */
    var v = assemble(lastSummary, { owners: one, deeds: viewHold.deeds, mythicOwners: viewHold.mythicOwners, roster: done ? null : viewHold.roster, cem: viewHold.cem, keepArt: keepArt(), stash: viewHold.stash, owner: viewHold.owner, breedReqs: viewHold.breedReqs || null });
    v._pages = pages || null;
    v._full = done ? 1 : 0;
    if (done) viewHold.roster = null;
    v.fights = fights || [];
    V2Mock.setViewWorld(v);
    if (viewOwners) fillWorld();
    if (done) rememberRoster(v);
    if (v.breedReqs && v.breedReqs.length) reqPetsSoon();
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
    if (page.v === 3) page.pets = openList(page.pets, page.hashes, page.owner || '');
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
    paging = ownPages(pg, nums).then(function (rows) {
      rows.sort(function (a, b) { return a.n - b.n; });
      var chain = Promise.resolve();
      rows.forEach(function (row) {
        chain = chain.then(function () {
          var page = row.page;
          if (!page || page.pets || !page.ids) return null;
          return resolveIds(page.ids, true).then(function (pets) { page.pets = pets; });
        });
      });
      return chain.then(function () {
      for (i = 0; i < rows.length; i++) {
        if (verifiedTakeover || stop) break;
        if (!takeLiving(pg, rows[i].page, rows[i].n)) stop = true;
      }
      nextPage = stop ? pg.pages : last;
      paging = null;
      publishJob(nextPage >= pg.pages);
      return true;
      });
    }, function () { paging = null; return false; });
    return paging;
  }
  /* Nov 23 2026 (GMONEY, 31,000 pets: 'unable to see most pets hatched from #180,000 on'): owner pages run oldest to newest, so a big
   * wallet's newest pets (Electric Egg Box hatches, fresh breeds) sat on the last of ~1,300 pages and showed last, or never if the phone
   * gave up first. Pages with a separate living count (every current owner file) now load newest first: step n reads page pages - n.
   * The fetches also went out up to 256 at once with a 12 s limit that counted the time spent waiting in the browser's queue, and a page
   * that missed it dropped its 24 pets for good. Now 24 at a time, and a failed page is asked once more with a longer limit. Display only. */
  /* Device copy (Nov 24 2026): page 0 of a big wallet carries every living id in page order (delta-coded 'ord'). The
   * server's page k is exactly ord.slice(k*size, (k+1)*size) under page 0's header (tools/split-order-test.js checks this
   * against the written files), so those 1,000+ tiny requests are made here instead. Older worlds have no 'ord'. */
  function idOrder(page0) {
    var d = page0 && page0.ord, out, i, id = 0;
    if (!Array.isArray(d) || !(page0.pages > 1) || page0.alive == null || d.length !== page0.alive) return null;
    out = new Array(d.length);
    for (i = 0; i < d.length; i++) { id += d[i]; out[i] = id; }
    return { ids: out, head: { v: page0.v, tip: page0.tip, rsig: page0.rsig, owner: page0.owner, n: page0.n, alive: page0.alive, dead: page0.dead, pages: page0.pages, pageSize: page0.pageSize } };
  }
  function pageFromOrder(pg, n) {
    var o = pg && pg.ord, size, h, page, k;
    if (!o || !(n > 0) || n >= o.head.pages) return null;
    size = o.head.pageSize || 24; h = o.head; page = {};
    for (k in h) if (Object.prototype.hasOwnProperty.call(h, k)) page[k] = h[k];
    page.page = n; page.ids = o.ids.slice(n * size, (n + 1) * size);
    return page;
  }
  function pageNo(pg, ni) { return pg && pg.rev ? pg.pages - ni : ni; }
  function ownPages(pg, nums) {
    var out = new Array(nums.length), next = 0, LANES = 24;
    function one(k) {
      var url = pg.folder + 'view/own/' + pg.key + '.' + pageNo(pg, nums[k]) + '.json';
      var made = pageFromOrder(pg, pageNo(pg, nums[k]));
      if (made) { out[k] = { n: nums[k], page: made }; return Promise.resolve(); }
      return getJson(url, 20000).then(null, function () { return getJson(url, 45000); }).then(function (page) { out[k] = { n: nums[k], page: page }; }, function () { out[k] = { n: nums[k], page: null }; });
    }
    function lane() { if (next >= nums.length) return Promise.resolve(); var k = next++; return one(k).then(lane); }
    var lanes = [], i; for (i = 0; i < Math.min(LANES, nums.length); i++) lanes.push(lane());
    return Promise.all(lanes).then(function () { return out; });
  }
  function underCap(pg) { return !!pg && (pg.n || 0) > 0 && (pg.n || 0) <= AUTO_CAP; }
  /* Every background batch ends in publishJob, which re-assembles the whole owner world and repaints My Pets. With a fixed
   * 7-page batch that is pages/7 full rebuilds, so a big wallet's cost grew with the square of its size. Each batch is now
   * twice the last (7, 14, 28, 56, then 64 pages at most), so a 10,000-pet wallet (417 pages) rebuilds about 10 times. */
  var drainBatch = 0, DRAIN_MAX = 256; /* 64 until Nov 23 2026; a 1,200-page wallet now repaints about 10 times, not 25 */
  function drain() {
    if (!pageJob && restView) { adoptJob(restView); restView = null; }
    if (!pageJob || !pageJob.pages || verifiedTakeover) return;
    if (!(nextPage < pageJob.pages.pages)) { publishJob(true); if (ready) requestSync(); return; }
    drainBatch = drainBatch ? Math.min(DRAIN_MAX, drainBatch * 2) : SCREEN_PAGES;
    more(drainBatch).then(function (ok) {
      if (!ok || verifiedTakeover || !pageJob) return;
      if (nextPage < pageJob.pages.pages) drain();
      else requestSync();
    });
  }
  function loadNewest(pg) {
    var nums, i;
    if (!pg || !(pg.pages > 1) || !pg.folder || !pg.key || pg.rev) return Promise.resolve(0); /* newest-first paging reads these pages first anyway */
    nums = newestPages(pg.pages, pg.got);
    if (!nums.length) return Promise.resolve(0);
    return Promise.all(nums.map(function (ni) {
      return getJson(pg.folder + 'view/own/' + pg.key + '.' + ni + '.json').then(function (page) {
        return { n: ni, page: page };
      }, function () { return { n: ni, page: null }; });
    })).then(function (rows) {
      var chain = Promise.resolve();
      rows.forEach(function (row) {
        chain = chain.then(function () {
          var page = row.page;
          if (!page || page.pets || !page.ids) return null;
          return resolveIds(page.ids, true).then(function (pets) { page.pets = pets; });
        });
      });
      return chain.then(function () {
        var extra = [], r, p, list, j;
        for (r = 0; r < rows.length; r++) {
          p = rows[r].page;
          if (!p) continue;
          list = p.pets || [];
          if (p.v === 3 && list.length && !(list[0] && list[0].id != null)) list = openList(list, p.hashes, p.owner || '');
          for (j = 0; j < list.length; j++) if (list[j] && list[j].id != null && !list[j].dead && !list[j].released) extra.push(list[j]);
        }
        if (extra.length) {
          if (pageJob && pageJob.pets) {
            var have = {}, n;
            for (n = 0; n < pageJob.pets.length; n++) if (pageJob.pets[n]) have[pageJob.pets[n].id] = 1;
            for (n = 0; n < extra.length; n++) if (!have[extra[n].id]) pageJob.pets.push(extra[n]);
          }
          mergePets(extra);
        }
        return extra.length;
      });
    });
  }
  function rest() {
    var v = restView, pg;
    if (!v || !v._pages || !(v._pages.pages > 1)) { restView = null; return; }
    if (!pageJob) adoptJob(v);
    restView = null;
    pg = v._pages;
    loadNewest(pg).then(function () {
      if (underCap(pg)) drain();
      else { var need = Math.min(SCREEN_PAGES, pg.pages) - (pg.got || 1); if (need > 0) more(need); }
    }, function () { if (underCap(pg)) drain(); });
  }
  var diffBuf = [];
  function takeMine(m) {
    if (!m || !m.total) return;
    if (m.mode === 'diff') {
      if (m.deeds) viewHold.deeds = m.deeds;
      if (m.mythicOwners) viewHold.mythicOwners = m.mythicOwners;
      if (m.breedReqs) viewHold.breedReqs = m.breedReqs;
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
    if (m.breedReqs) viewHold.breedReqs = m.breedReqs;
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
  /* follow (Nov 25 2026, found by the play-test robot, tools/playtest): a fast page read the chain once, so a burn that confirmed while the
   * page was open (a hatch, a breed egg, a feed) never showed until a reload: the page's 60 s poll only asked /health and kept the published
   * world while it was fewer than STALE (48) blocks old. Now each poll that sees a newer block asks the check worker to catch up from the same
   * published checkpoint (in the worker, off the main thread) and the changed pets of this wallet are merged in as before (takeMine).
   * One follow at a time; display only, nothing is signed. */
  var checkedTip = 0, followAt = 0;
  function follow() {
    if (!worker || !ready || off()) return false;
    var S = window.V2Mock && V2Mock.state && V2Mock.state(), tip = Math.max(healthTipN || 0, (S && S.chainTip) || 0);
    if (!(tip > checkedTip) || (followAt && Date.now() - followAt < 120000)) return false;
    followAt = Date.now();
    try { worker.postMessage({ cmd: 'follow' }); } catch (e) { followAt = 0; return false; }
    return true;
  }
  function startVerify(quiet) {
    if (window.XCPETS_MAINTENANCE) return Promise.resolve(null);
    if (quiet !== true) showProgress();
    if (readyP) return readyP;
    if (off() || !base() || !last) return Promise.resolve(null);
    var scripts = scriptList();
    if (!scripts || typeof Worker === 'undefined') return Promise.resolve(null);
    readyP = new Promise(function (res) {
      try { worker = new Worker(new URL('js/v2-verify-worker.js?v=follow1125a', location.href).href); }
      catch (e) { res(null); return; }
      worker.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.cmd === 'progress') { lastProg = m; var note = wantBar && document.getElementById('splitViewBar'); if (note) note.textContent = progressText(m); return; }
        if (m.cmd === 'check') { var fn = pending[m.id]; if (fn) { delete pending[m.id]; fn(m); } return; }
        if (m.cmd === 'mine') { takeMine(m); return; }
        if (m.cmd === 'followed') { followAt = 0; return; } /* a follow that failed: keep the world we have */
        if (m.cmd === 'ready') { if (m.t) window.__xcpVerifyT = m.t; if (m.ok) { checkedTip = m.tip | 0; followAt = 0; unlock(m); requestSync(); } else { window.__xcpVerifyErr = String(m.error || ''); failed(); } res(m); }
      };
      /* raid-wallet-slow: a worker error also answers every burn still waiting for its check (it used to wait forever) */
      worker.onerror = function (ev) { window.__xcpVerifyErr = 'worker: ' + String(ev && ev.message || ''); var w0 = pending; pending = {}; Object.keys(w0).forEach(function (k) { try { w0[k]({ ok: false, skip: ['The check stopped with an error. Nothing was burned. Press Retry.'] }); } catch (e) {} }); failed(); res({ ok: false }); };
      /* a failed check (network, bad hash) must not stick: the next burn or Verify starts a fresh one */
      function failed() {
        var b = wantBar && document.getElementById('splitViewBar'); if (b) b.textContent = 'The check did not finish. The published world is still on screen.';
        var w0 = worker; setTimeout(function () { if (worker === w0 && !ready) { try { w0.terminate(); } catch (e) {} worker = null; readyP = null; lastProg = null; } }, 0);
      }
      /* the same world the page painted from (it may be this page's rules' world rather than latest.json) */
      worker.postMessage({ cmd: 'start', base: base(), manifest: last && last.url || '', scripts: scripts, me: pageWallet() });
    });
    return readyP;
  }
  /* Server burn check (Nov 23 2026, Jake approved). The game server keeps the newest world in memory and answers the same question the
   * check worker answers (V2Rules.sendBlock on every plan), in about a second instead of 13 s or more. Its answer is used only when it
   * comes within 3 s and is at least as new as every tip this page knows; anything else (no answer, an error, an older world, ?servercheck=0)
   * falls back to this device's own check, exactly as before. A finished device check is used directly. Nothing is signed here. */
  var SERVER_MS = 3000, serverStat = { asked: 0, used: 0, last: '' };
  /* The server's answers count only when its world was built from this page's exact rule files (same rsig). */
  var RSIG_P = null;
  function myRsig() { if (!RSIG_P) RSIG_P = pageRsig().then(function (r) { return r || null; }, function () { return null; }); return RSIG_P; }
  function serverCheck(plans) {
    if (ready || off() || !base() || q('servercheck') === '0' || typeof fetch !== 'function') return Promise.resolve(null);
    return myRsig().then(function (rsig) { if (!rsig) { serverStat.last = 'no rules'; return null; } return serverCheck0(plans, rsig); });
  }
  function serverCheck0(plans, rsig) {
    var S = window.V2Mock && V2Mock.state && V2Mock.state(), need = Math.max(healthTipN || 0, (S && S.tip) || 0, (S && S.chainTip) || 0);
    var plain = [], i, k, p, o;
    for (i = 0; i < (plans || []).length; i++) {
      p = plans[i]; if (!p || typeof p.tag !== 'string') return Promise.resolve(null);
      o = {}; for (k in p) if (Object.prototype.hasOwnProperty.call(p, k) && (typeof p[k] === 'string' || typeof p[k] === 'number' || typeof p[k] === 'boolean')) o[k] = p[k];
      plain.push(o);
    }
    if (!plain.length || plain.length > 100) return Promise.resolve(null);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, SERVER_MS) : null;
    serverStat.asked++;
    return fetch(base() + '/xp/v1/check', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ plans: plain, me: pageWallet(), pending: [] }), cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (t) clearTimeout(t);
        if (!j || j.ok !== true || j.rsig !== rsig || !Array.isArray(j.plans) || !Array.isArray(j.skip) || !(j.tip >= need)) { serverStat.last = (j && j.error) || 'not used'; return null; }
        /* hand back this page's own plan objects, in order, for the plans the server kept */
        var kept = [], n = 0;
        for (i = 0; i < plans.length && n < j.plans.length; i++) if (j.plans[n] && j.plans[n].tag === plans[i].tag) { kept.push(plans[i]); n++; }
        if (n !== j.plans.length) { serverStat.last = 'mismatch'; return null; }
        serverStat.used++; serverStat.last = 'ok';
        return { ok: true, plans: kept, skip: j.skip, server: j.tip };
      }, function () { if (t) clearTimeout(t); serverStat.last = 'failed'; return null; });
  }
  /* Spam City (Nov 23 2026): the order book (listings, listed pets, pet tokens, dex orders) from the server's checked world, instead of
   * a full replay in the browser. Used only when it is from this page's rules and at least as new as every tip the page knows. */
  function serverShop() {
    if (off() || !base() || q('servershop') === '0' || typeof fetch !== 'function') return Promise.resolve(null);
    var S = window.V2Mock && V2Mock.state && V2Mock.state(), need = Math.max(healthTipN || 0, (S && S.tip) || 0, (S && S.chainTip) || 0);
    return myRsig().then(function (rsig) {
      if (!rsig) return null;
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 8000) : null;
      return fetch(base() + '/xp/v1/shop', { signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (t) clearTimeout(t);
        if (!j || j.ok !== true || j.rsig !== rsig || !(j.tip >= need) || !Array.isArray(j.listings) || !Array.isArray(j.pets) || !Array.isArray(j.orders)) return null;
        return { ok: true, tip: j.tip, listings: j.listings, pets: j.pets, deeds: j.deeds || {}, orders: j.orders, n: j.n, open: j.open, server: true };
      }, function () { if (t) clearTimeout(t); return null; });
    });
  }
  /* Spam City shelves (Nov 24 2026, Jake: 'spam city games takes a long time reading the chain'): the live /xp/v1/shop answers only
   * while the server's check service sits at the newest block, and that service is stopped for every world build and reloads after
   * every block, so many visits fell back to a full replay in the browser (a minute or more). Every published world now carries the
   * same order book pack (view/p/99901.json). It is used only when it is from this page's rules and not older than STALE blocks;
   * js/v2-sales.js shows it at once and reads the newest blocks before any wallet window. */
  function publishedShop() {
    var folder = viewFolder;
    if (off() || !folder || q('servershop') === '0' || typeof fetch !== 'function') return Promise.resolve(null);
    var S = window.V2Mock && V2Mock.state && V2Mock.state(), need = Math.max(healthTipN || 0, (S && S.tip) || 0, (S && S.chainTip) || 0);
    return myRsig().then(function (rsig) {
      if (!rsig) return null;
      return getJson(folder + 'view/p/99901.json', 10000, false).then(function (j) {
        if (!j || j.ok !== true || j.rsig !== rsig || !(j.tip > 0) || (need && need - j.tip > STALE) || !Array.isArray(j.listings) || !Array.isArray(j.pets) || !Array.isArray(j.orders)) return null;
        return { ok: true, tip: j.tip, listings: j.listings, pets: j.pets, deeds: j.deeds || {}, orders: j.orders, n: j.n, open: j.open, published: true };
      }, function () { return null; });
    });
  }
  /* raid-wallet-slow: what the burn sheet shows while a burn waits for this check */
  function checkNote() { return ready ? 'Checking your pets against the rules…' : progressText(lastProg) + ' (this device is loading the full game check once; the server check did not answer)'; }
  function checkPlans(plans) {
    return serverCheck(plans).then(function (out) { return out || deviceCheck(plans); });
  }
  function deviceCheck(plans) {
    showProgress();
    if (!worker) startVerify();
    if (!worker) return Promise.resolve({ ok: false, plans: plans || [], skip: ['Press Verify to check this world. Nothing was burned.'] });
    return (readyP || Promise.resolve(null)).then(function () {
      if (!ready) return { ok: false, plans: [], skip: ['The check did not finish. Nothing was burned.'] };
      return new Promise(function (res) {
        var id = ++seq;
        pending[id] = res;
        var S = window.V2Mock && V2Mock.state && V2Mock.state();
        worker.postMessage({ cmd: 'check', id: id, plans: plans || [], tip: S && S.tip, me: pageWallet(), pending: [] });
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
    var newRules = last && last.man && last.man.other ? ' <span class="muted">(built just before the latest rules update; the new world is on its way)</span>' : '';
    bar.innerHTML = 'Published world at block <b id="splitViewTip"></b>' + lag + newRules + '. <button type="button" class="q" id="splitVerify">Verify</button>';
    var t = document.getElementById('splitViewTip');
    if (t) t.textContent = String(view && view.tip || '');
    document.getElementById('splitVerify').onclick = function () { var b = document.getElementById('splitVerify'); if (b) b.disabled = true; startVerify(); };
    trimStore();
    warm();
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
    for (i = 0; i < extra.length; i++) { p = extra[i]; if (!p || (p.id === 1765 && p.dead)) continue; keepExtra([p]); if (have[p.id]) continue; pets.push(p); have[p.id] = 1; }
    var pg = cur._pages, done = !pg || !!cur._full || (pg.got || 1) >= (pg.pages || 1);
    publishOwner(pets, pg, cur.fights || [], done);
  }
  function takePagePets(page) {
    if (!page) return Promise.resolve([]);
    if (page.pets && page.pets.length) return Promise.resolve(page.v === 3 ? openList(page.pets, page.hashes, page.owner || '') : page.pets);
    if (page.ids && page.ids.length) return resolveIds(page.ids);
    return Promise.resolve([]);
  }
  function ensureDead() {
    if (!gravePlan) return Promise.resolve(false);
    if (gravePlan.done) return Promise.resolve(true);
    function finish() { gravePlan.done = true; mergePets(gravePlan.pets); return true; }
    if (gravePlan.separate) {
      function pull(n) {
        var name = n === 0 ? gravePlan.key + '.d.json' : gravePlan.key + '.d.' + n + '.json';
        return getJson(gravePlan.folder + 'view/own/' + name).then(function (page) {
          return takePagePets(page).then(function (pets) {
            if (pets && pets.length) gravePlan.pets = gravePlan.pets.concat(pets);
            if (page && page.pages > n + 1) return pull(n + 1);
          });
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
          return takePagePets(page).then(function (pets) { if (pets && pets.length) gravePlan.pets = gravePlan.pets.concat(pets); });
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
    for (i = 0; i < pets.length; i++) { if (window.XcpArt && XcpArt.onRankBoard && !XcpArt.onRankBoard(pets[i])) continue; if ((pets[i].id | 0) === 1765) continue; byId[pets[i].id] = pets[i]; }
    cur = window.V2Mock && V2Mock.world && V2Mock.world();
    if (cur && cur.pets) cur.pets.forEach(function (p) {
      if (!p || p.id == null || (p.id | 0) === 1765) return;
      var prev = byId[p.id];
      if (prev && window.XcpArt && XcpArt.carryRank) XcpArt.carryRank(p, prev);
      else if (prev) {
        if (!p.art && prev.art) p.art = prev.art;
        if (!p.worn && prev.worn) p.worn = prev.worn;
        if (!p._hof) p._hof = prev._hof;
        if (p._bits == null && prev._bits != null) p._bits = prev._bits;
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
  function feedDays(tip, sk, td) {
    var d = Math.floor((tip || 0) / 144), fd = {}, i;
    if (td) { fd[d] = 1; for (i = 1; i < sk; i++) fd[d - i] = 1; }
    else for (i = 1; i <= sk; i++) fd[d - i] = 1;
    return fd;
  }
  function expandRank(row, tip) {
    var s = row.sg || [];
    var p = {
      id: row.id | 0, owner: (viewOwners || [])[row.o] || '', name: row.name || '', species: row.sp || '',
      tier: row.ti | 0, stage: row.st | 0, stageName: row.sn || '', care: row.care || 0,
      wins: row.w || 0, losses: row.l || 0, hatchBlock: row.hb, hatchTx: row.tx || '',
      dead: !!row.dead, released: !!row.rel, community: row.cm ? 1 : null, resurrected: row.rs || null,
      hybrid: row.hybrid || (row.hy ? 1 : null), parents: row.par ? new Array(row.par).fill(0) : null,
      mutation: row.mu || null, shows: row.shw || null, blackEye: row.be || null, crowned: row.cr || null,
      deed: row.dd || '', electric: row.el ? 1 : 0, rareHatch: row.rareHatch || null, shards: row.shards || null,
      stats: { vigor: s[0] || 0, spark: s[1] || 0, grit: s[2] || 0, zoom: s[3] || 0, luck: s[4] || 0 },
      feedDays: feedDays(tip, row.sk || 0, row.td), _hof: { n: (row.hf && row.hf[0]) || 0, t: (row.hf && row.hf[1]) || 0 },
      _bits: row.rb, _h: row._h, as: row.as || '', sid: row.sid || '', ax: row.ax || null, _ac: row._ac || 0
    };
    return p;
  }
  function hangHof(w, list) {
    var i, p, n, t, k;
    w.items = w.items || {};
    for (i = 0; i < list.length; i++) {
      p = list[i]; if (!p || !p._hof || !p._hof.n) continue;
      n = p._hof.n; t = p._hof.t || 0;
      for (k = 0; k < n; k++) w.items['hf' + p.id + ':' + k] = { gid: 'hf' + p.id + ':' + k, on: p.id, tier: k ? 0 : t, legendary: 0, item: 'hof', owner: p.owner };
    }
  }
  function loadRank(onProg) {
    var folder = viewFolder;
    boardP = getJson(folder + 'view/rank.json', 20000, false).then(function (rank) {
      if (!rank || !rank.pets) return null;
      viewOwners = rank.owners || viewOwners;
      rankHashes = rank.hashes || [];
      var pets = [], i, row;
      for (i = 0; i < rank.pets.length; i++) { if ((rank.pets[i].id | 0) === 1765) continue; row = expandRank(rank.pets[i], rank.tip || (lastSummary && lastSummary.tip) || 0); pets.push(row); }
      boardBytes += 1; boardFiles += 1;
      if (onProg) onProg(1, pets.length);
      var w = publishBoard(pets, {});
      hangHof(w, pets);
      w._bits = 1;
      if (window.V2Mock && V2Mock.setViewWorld) V2Mock.setViewWorld(w);
      return w;
    }, function () { boardP = null; return null; });
    return boardP;
  }
  /* lead-1123 (Jake Nov 23 2026: Rankings / Proof Parade took ~15 s on a phone): the server writes view/p/99900.json beside rank.json,
   * a small file with the top of every board, each listed wallet's best pets and every tokenized pet (tools/sync-server/split.js leadFile).
   * loadLead() adds those pets to the view world (marked _lead; their block hashes are the file's own list) and returns the boards with
   * owner addresses in place of indexes. null when the file is missing (an older server build), so pages fall back to loadBoard(). */
  var leadP = null, leadHashes = null, leadPets = null;
  function remergeLead() { if (leadPets) mergePets(leadPets); }
  function loadLead() {
    if (leadP) return leadP;
    var folder = viewFolder;
    if (!folder || !lastSummary || lastSummary.v !== 3) return Promise.resolve(null);
    leadP = Promise.all([getJson(folder + 'view/p/99900.json', 15000, false), ownersReady()]).then(function (r) {
      var L = r[0], own = viewOwners || [], tip = (L && L.tip) || lastSummary.tip || 0, pets = [], byId = {}, i, p;
      if (!L || !L.lead || !L.pets || !own.length) return null;
      leadHashes = L.hashes || [];
      for (i = 0; i < L.pets.length; i++) { if ((L.pets[i].id | 0) === 1765) continue; p = expandRank(L.pets[i], tip); p._lead = 1; pets.push(p); byId[p.id] = p; }
      var addr = function (o) { return own[o] || ''; }, players = {}, best = {}, ownN = {};
      Object.keys(L.players || {}).forEach(function (k) { players[k] = L.players[k].map(function (e) { return { o: addr(e[0]), v: e[1], id: e[2] }; }); });
      Object.keys(L.best || {}).forEach(function (o) { best[addr(o)] = L.best[o]; });
      (L.own || []).forEach(function (e) { ownN[addr(e[0])] = e[1]; });
      leadPets = pets; mergePets(pets);
      return { tip: tip, live: L.live, counts: L.counts || {}, tops: L.tops || {}, players: players, best: best, own: ownN, species: L.species || [], pets: pets, byId: byId };
    }, function () { return null; });
    return leadP;
  }
  function loadBoard(onProg) {
    if (boardP) return boardP;
    if (lastSummary && lastSummary.v === 3 && lastSummary.rank) return loadRank(onProg);
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
    var need = {}, i, id, p, name, names, n = 0, opt;
    opt = artOpt(); opt.hashes = rankHashes;
    for (i = 0; i < ids.length; i++) {
      id = ids[i] | 0; p = w.byId[id];
      if (!p || (p.art && p.art.dna)) continue;
      var hs = p._lead ? leadHashes : rankHashes;
      if (window.XcpArt && window.PetCore && hs && p._h != null) {
        try { opt.hashes = hs; p.art = XcpArt.buildArt(p, hs, PetCore, opt); n++; } catch (e) {}
        continue;
      }
      name = ('00000' + Math.floor(id / 2000)).slice(-5);
      (need[name] = need[name] || []).push(id);
    }
    names = Object.keys(need);
    if (!names.length) return Promise.resolve(n);
    return ownersReady().then(function () {
    opt = artOpt(); opt.hashes = rankHashes;
    return Promise.all(names.map(function (nm) {
      return pullShard(folder + 'view/p/' + nm + '.json').then(function (pack) {
        var map = pack && pack.pets || {}, j, src, dst;
        for (j = 0; j < need[nm].length; j++) {
          dst = w.byId[need[nm][j]]; src = map[String(need[nm][j])];
          if (!dst || !src) continue;
          if (pack && pack.v === 3) src = openList([src], pack.hashes)[0];
          if (src.art) dst.art = src.art;
          if (src.worn) dst.worn = src.worn;
          n++;
        }
        hangGear(w, need[nm].map(function (pid) { return w.byId[pid]; }));
      }, function () {});
    })).then(function () { return n; });
    });
  }
  /* Gooby's requests (Nov 23 2026): a request for one of my pets names the asker's pet, which a slim world does not hold, so the
   * accept check said 'no such pet' and the desk, pop-up and 'Asking you' shelf stayed empty. Fetch those pets once. Display only. */
  var reqAsked = {};
  function reqPetsSoon() {
    setTimeout(function () {
      var w = window.V2Mock && V2Mock.world && V2Mock.world(), me0 = me();
      if (!w || !w.byId || !me0) return;
      (w.breedReqs || []).forEach(function (r) {
        var B = w.byId[r.b], A = w.byId[r.a];
        [[B, r.b], [A, r.a]].forEach(function (x) { if (!x[0] && !reqAsked[x[1]] && (r.owner === me0 || (B && B.owner === me0) || !B)) { var id = x[1]; reqAsked[id] = 1; ensurePet(id).then(function (p) { if (!p) delete reqAsked[id]; }, function () { delete reqAsked[id]; }); } }); /* a failed fetch is tried again on the next publish */
      });
    }, 1200);
  }
  function ensurePet(id) {
    id = id | 0;
    var w = window.V2Mock && V2Mock.world && V2Mock.world();
    if (w && w.byId && w.byId[id]) return Promise.resolve(w.byId[id]);
    if (id === 1765) return Promise.resolve(null);
    var folder = viewFolder || (gravePlan && gravePlan.folder) || (pageJob && pageJob.pages && pageJob.pages.folder) || '';
    if (!folder) return Promise.resolve(null);
    var shard = ('00000' + Math.floor(id / 2000)).slice(-5);
    return idShard(folder + 'view/p/' + shard + '.json').then(function (pack) { /* memoized, 30 s + 45 s retry (a ~1.5 MB shard missed the old 12 s limit on phones) */
      function use(p) {
        if (!p || (p.id === 1765 && p.dead)) return null;
        mergePets([p]);
        return p;
      }
      var p = pack && pack.pets && pack.pets[String(id)];
      if (p && pack.v === 3) return ownersReady().then(function () { return use(openList([p], pack.hashes)[0]); });
      return use(p);
    }, function () { return null; });
  }
  /* The slim world only carries part of w.cem. Give it the same shape the rules engine builds (cemW in v2-rules.js),
   * so cemView and the altar do not crash on a missing altars table (seance button stayed off, Nov 22 2026). Display only. */
  function cemFill(c, full) { c = c || {}; if (!c.altars) c.altars = {}; if (!c.altarList) c.altarList = []; if (!c.zombies) c.zombies = []; if (!c.hunts) c.hunts = [];
    if (!c.huntDay) c.huntDay = {}; if (!c.raisedBy) c.raisedBy = {}; if (!c.huntedBy) c.huntedBy = {}; if (!c.log) c.log = [];
    /* full: the summary's state.cem is the rules' own table (seats, clocks, grudges...), so it is not a stand-in */
    if (full && c.mg) delete c._slim; else c._slim = 1; return c; }
  /* Mythic God table (Nov 25 2026): zombies.json now carries w.cem.mg (Pantheon seats, meals, the unleash list and the
   * per-wallet clocks). Keep it exactly as published; a world without it must stay without it, so V2MgRoad.mgReady can
   * tell "no seats yet" from "not loaded on this page" and no page offers an unleash the rules would then reject. */
  function cemMg(c, mg) { if (mg && mg.unleash) { c.mg = { seats: mg.seats || [], meals: mg.meals || [], unleash: mg.unleash || [], byWallet: mg.byWallet || {}, godBy: mg.godBy || {} }; delete c._slim; } return c; }
  var zombieP = null;
  function applyZombies(z) {
    if (!z || !z.pets) return 0;
    var sc = stateCopy(lastSummary); /* the summary's full cemetery table wins over this file's three tables */
    viewHold.cem = sc && sc.cem ? cemFill(sc.cem, true) : cemMg(cemFill({ huntedBy: z.huntedBy || {}, altars: z.altars || {} }), z.mg);
    if (z.pets.length) mergePets(openList(z.pets, null, ''));
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
  window.V2Split = { _keep: { put: keepPut, flush: keepFlush, start: keepStart, q: function () { return keepQ; }, busy: function () { return keepBusy; } }, follow: follow, checkedTip: function () { return checkedTip; }, loadLead: loadLead, remergeLead: remergeLead, STALE: STALE, SCREEN_PAGES: SCREEN_PAGES, AUTO_CAP: AUTO_CAP, prepare: prepare, recheck: recheck, install: install, assemble: assemble, startVerify: startVerify, checkPlans: checkPlans, checkNote: checkNote, serverCheck: serverCheck, serverShop: serverShop, publishedShop: publishedShop, serverStat: function () { return serverStat; }, rest: rest, more: more, loadBoard: loadBoard, loadZombies: loadZombies, dress: dress, boardBytes: function () { return { bytes: boardBytes, files: boardFiles }; }, ensureDead: ensureDead, ensurePet: ensurePet, ownerShard: function (addr, cb) { sha2(addr).then(function (h) { cb(h.slice(0, 2)); }); }, petSig: petSig, healthTip: function () { return healthTipN; }, noteHealth: noteHealth, pingHealth: pingHealth, ownersReady: ownersReady, ownersKnown: ownersKnown, adoptOwners: adoptOwners, openOwnerPets: openOwnerPets, openList: openList, notePets: notePets, ownerTable: ownerTable, pageWallet: pageWallet, resolveWorld: resolveWorld, newestPages: newestPages, rowsToLog: rowsToLog, loadNewest: loadNewest, keepStat: function () { return keepStat; }, _order: { idOrder: idOrder, pageFromOrder: pageFromOrder } };
})();
