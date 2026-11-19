/* Published split world (speed phase 2). The snapshot builder writes a summary, per-owner
 * pet lists and per-pet shards next to the world. This file paints from those and does not
 * read the saved full world or reindex it. Full replay runs only from the Verify button.
 * If the files are missing, the rules signature differs, or the snapshot is more than 8
 * blocks behind, the page uses today's path. Doom Week is not involved. */
(function () {
  'use strict';
  window.__xcpSplitHold = true;
  var STALE = 8;
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
    var pets = [], items = {}, n = 1, byId = {};
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
      if (!p) return;
      var copy = {};
      Object.keys(p).forEach(function (k) { if (k !== 'worn') copy[k] = p[k]; });
      pets.push(copy);
      byId[copy.id] = copy;
      (p.worn || []).forEach(function (g) { addItem(g, copy.id); });
    }
    if (pack && pack.owners) Object.keys(pack.owners).forEach(function (addr) {
      var o = pack.owners[addr];
      if (Array.isArray(o)) o.forEach(addPet);
      else if (o && o.pets) o.pets.forEach(addPet);
    });
    var cold = summary.cold || {};
    var itemList = [];
    Object.keys(items).forEach(function (k) { itemList.push(items[k]); });
    return {
      tip: summary.tip, pets: pets, byId: byId, items: items, itemList: itemList, log: [], fights: [], breedReqs: [],
      community: summary.community || {},
      tokens: {},
      wizardMythic: cold.wizard || null, kekMythic: cold.kek || null, homerMythic: cold.homer || null,
      rabbitMythic: cold.rabbit || null, funtrumpMythic: cold.funtrump || null, djpepeMythic: cold.djpepe || null,
      wagmi: summary.wagmi || {},
      _view: 1, _counts: { n: summary.n, alive: summary.alive, dead: summary.dead, burned: summary.burned, burns: summary.burns }
    };
  }
  var last = null, lastSummary = null;
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
      return getJson(root + '/xp/v1/world/latest.json', 8000, true);
    }).then(function (latest) {
      var path = latest && (latest.manifest || latest.url);
      if (!path || !latest.rsig) throw new Error('latest');
      manUrl = /^https?:/.test(path) ? path : root + path;
      var snapTip = latest.tip || 0;
      if (chainTip && snapTip && chainTip - snapTip > STALE) throw new Error('stale');
      var folder = dirOf(manUrl);
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
        if (!summary || (summary.v !== 1 && summary.v !== 2) || summary.tip !== latest.tip || summary.rsig !== latest.rsig) throw new Error('summary');
        lastSummary = summary;
        last = { man: { tip: latest.tip, rsig: latest.rsig, view: true }, url: manUrl, tip: chainTip };
        if (!own || !own.page || !own.page.pets || !own.page.pets.length) return assemble(summary, null);
        var raw0 = own.page.pets, living0 = livingOf(raw0), separate = own.page.alive != null;
        var stop0 = !separate && endsDead(raw0);
        var livingPages = separate ? Math.max(1, Math.ceil((own.page.alive || 0) / (own.page.pageSize || 24)) || 1) : (stop0 ? 1 : own.page.pages);
        var one = {}; one[own.page.owner || who] = living0;
        var view = assemble(summary, { owners: one });
        view._pages = { n: separate ? own.page.alive : living0.length, pages: livingPages, total: own.page.pages, page: 0, key: own.hex, folder: folder, raw: living0 };
        if (separate) noteGraves(view._pages, 0, true);
        else if (stop0) noteGraves(view._pages, 1, false);
        return view;
      });
    }).then(function (view) { if (view && view._pages && view._pages.pages > 1) restView = view; cb(view); }, function () { cb(null); });
  }
  function recheck() {
    if (!last || !last.man) return Promise.resolve(false);
    return getJson(base() + '/xp/v1/health', 8000, true).then(function (h) {
      var tip = h && h.tip || 0;
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
  var pageJob = null, verifiedTakeover = false;
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
  function publishOwner(pets, pages, fights, done) {
    if (!lastSummary || !window.V2Mock || !V2Mock.setViewWorld) return;
    var who = me(), one = {};
    one[who] = aliveFirst(pets.slice());
    var v = assemble(lastSummary, { owners: one });
    v._pages = pages || null;
    v._full = done ? 1 : 0;
    v.fights = fights || [];
    V2Mock.setViewWorld(v);
  }
  var restView = null;
  function rest() { var v = restView; restView = null; if (v) loadRest(v); }
  function loadRest(view) {
    var pg = view._pages;
    if (!pg || !(pg.pages > 1)) return;
    pageJob = { pets: (pg.raw || view.pets || []).slice(), fights: view.fights || [], pages: pg };
    var left = [], i;
    for (i = 1; i < pg.pages; i++) left.push(i);
    function step() {
      if (verifiedTakeover) return;
      if (!left.length) { publishOwner(pageJob.pets, pg, pageJob.fights, true); return; }
      var slice = left.splice(0, 3);
      Promise.all(slice.map(function (n) {
        return getJson(pg.folder + 'view/own/' + pg.key + '.' + n + '.json').then(function (page) {
          if (!page || !page.pets) return;
          if (page.alive != null || !endsDead(page.pets)) { pageJob.pets = pageJob.pets.concat(livingOf(page.pets).length === page.pets.length ? page.pets : livingOf(page.pets)); return; }
          pageJob.pets = pageJob.pets.concat(livingOf(page.pets));
          noteGraves(pg, n + 1, false);
          left.length = 0;
        }, function () {});
      })).then(function () {
        if (verifiedTakeover) return;
        pageJob.batches = (pageJob.batches || 0) + 1;
        if (!left.length || pageJob.batches === 1 || pageJob.batches % 8 === 0) publishOwner(pageJob.pets, pg, pageJob.fights, !left.length);
        if (left.length) setTimeout(step, 0);
      });
    }
    setTimeout(step, 40);
  }
  function takeMine(m) {
    if (!m || !m.total) return;
    verifiedTakeover = true;
    var pages = pageJob && pageJob.pages;
    if (!pageJob || m.from === 0) pageJob = { pets: [], fights: [], pages: pages };
    if (m.pets && m.pets.length) pageJob.pets = pageJob.pets.concat(m.pets);
    if (m.fights) pageJob.fights = m.fights;
    if (m.last) publishOwner(pageJob.pets, pageJob.pages, pageJob.fights, true);
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
      try { worker = new Worker(new URL('js/v2-verify-worker.js?v=00a80f9312', location.href).href); }
      catch (e) { res(null); return; }
      worker.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.cmd === 'progress') { var note = document.getElementById('splitViewBar'); if (note) note.textContent = progressText(m); return; }
        if (m.cmd === 'check') { var fn = pending[m.id]; if (fn) { delete pending[m.id]; fn(m); } return; }
        if (m.cmd === 'mine') { takeMine(m); return; }
        if (m.cmd === 'ready') { if (m.ok) unlock(m); else { var b = document.getElementById('splitViewBar'); if (b) b.textContent = 'The check did not finish. The published world is still on screen.'; } res(m); }
      };
      worker.onerror = function () { var b = document.getElementById('splitViewBar'); if (b) b.textContent = 'The check did not finish. The published world is still on screen.'; res({ ok: false }); };
      worker.postMessage({ cmd: 'start', base: base(), scripts: scripts, me: me() });
    });
    return readyP;
  }
  function checkPlans(plans) {
    if (!worker) return Promise.resolve({ ok: false, plans: plans || [], skip: ['The check has not started'] });
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
    bar.innerHTML = 'Published world at block <b id="splitViewTip"></b>. <button type="button" class="q" id="splitVerify">Verify</button>';
    var t = document.getElementById('splitViewTip');
    if (t) t.textContent = String(view && view.tip || '');
    document.getElementById('splitVerify').onclick = function () { var b = document.getElementById('splitVerify'); if (b) b.disabled = true; startVerify(); };
    setTimeout(function () { startVerify(); }, 2000);
  }
  function mergePets(extra) {
    if (!extra || !extra.length || !window.V2Mock || !V2Mock.world || !V2Mock.setViewWorld) return;
    var cur = V2Mock.world(), have = {}, pets = (cur.pets || []).slice(), i, p;
    for (i = 0; i < pets.length; i++) have[pets[i].id] = 1;
    for (i = 0; i < extra.length; i++) { p = extra[i]; if (!p || have[p.id] || (p.id === 1765 && p.dead)) continue; pets.push(p); have[p.id] = 1; }
    publishOwner(pets, cur._pages, cur.fights || [], true);
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
  function ensurePet(id) {
    id = id | 0;
    var w = window.V2Mock && V2Mock.world && V2Mock.world();
    if (w && w.byId && w.byId[id]) return Promise.resolve(w.byId[id]);
    if (id === 1765) return Promise.resolve(null);
    return ensureDead().then(function () {
      w = V2Mock.world();
      if (w && w.byId && w.byId[id]) return w.byId[id];
      if (!gravePlan) return null;
      var shard = ('00000' + Math.floor(id / 2000)).slice(-5);
      return getJson(gravePlan.folder + 'view/p/' + shard + '.json').then(function (pack) {
        var p = pack && pack.pets && pack.pets[String(id)];
        if (!p || (p.id === 1765 && p.dead)) return null;
        mergePets([p]);
        return p;
      }, function () { return null; });
    });
  }
  window.V2Split = { STALE: STALE, prepare: prepare, recheck: recheck, install: install, assemble: assemble, startVerify: startVerify, checkPlans: checkPlans, rest: rest, ensureDead: ensureDead, ensurePet: ensurePet, ownerShard: function (addr, cb) { sha2(addr).then(function (h) { cb(h.slice(0, 2)); }); } };
})();
