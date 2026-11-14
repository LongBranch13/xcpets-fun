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
  function getJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('split ' + r.status); return r.json(); });
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
      tip: summary.tip, pets: pets, byId: byId, items: items, itemList: itemList, log: [], fights: [],
      community: summary.community || {},
      tokens: {},
      wizardMythic: cold.wizard || null, kekMythic: cold.kek || null, homerMythic: cold.homer || null,
      rabbitMythic: cold.rabbit || null, funtrumpMythic: cold.funtrump || null, djpepeMythic: cold.djpepe || null,
      _view: 1, _counts: { n: summary.n, alive: summary.alive, dead: summary.dead, burned: summary.burned, burns: summary.burns }
    };
  }
  var last = null, lastSummary = null;
  function prepare(cb) {
    if (off() || !base()) { cb(null); return; }
    var root = base();
    var chainTip = 0, man = null, manUrl = '';
    getJson(root + '/xp/v1/health').then(function (h) {
      chainTip = h && h.tip || 0;
      return getJson(root + '/xp/v1/world/latest.json');
    }).then(function (latest) {
      var path = latest && (latest.manifest || latest.url);
      if (!path) throw new Error('latest');
      manUrl = /^https?:/.test(path) ? path : root + path;
      var snapTip = latest.tip || 0;
      if (chainTip && snapTip && chainTip - snapTip > STALE) throw new Error('stale');
      return getJson(manUrl);
    }).then(function (m) {
      man = m;
      if (!man || !man.view || !man.rsig) throw new Error('no view');
      if (chainTip && man.tip != null && chainTip - man.tip > STALE) throw new Error('stale');
      var sig = window.V2Mock && V2Mock.rulesSig ? V2Mock.rulesSig() : null;
      return Promise.resolve(sig).then(function (rsig) {
        if (!rsig || rsig !== man.rsig) throw new Error('rules');
        var folder = dirOf(manUrl);
        return getJson(folder + 'view/summary.json').then(function (summary) {
          if (!summary || (summary.v !== 1 && summary.v !== 2) || summary.tip !== man.tip || summary.rsig !== man.rsig) throw new Error('summary');
          lastSummary = summary;
          var who = me();
          if (!who) return assemble(summary, null);
          return sha2(who).then(function (hex) {
            return getJson(folder + 'view/own/' + hex + '.json').then(function (page) {
              if (!page || !page.pets || !page.pets.length) return assemble(summary, null);
              var one = {}; one[page.owner || who] = aliveFirst(page.pets.slice());
              var view = assemble(summary, { owners: one });
              view._pages = { n: page.n, pages: page.pages, page: 0, key: hex, folder: folder, raw: page.pets };
              return view;
            }, function () { return assemble(summary, null); });
          });
        });
      });
    }).then(function (view) { last = { man: man, url: manUrl, tip: chainTip }; if (view && view._pages && view._pages.pages > 1) restView = view; cb(view); }, function () { cb(null); });
  }
  function recheck() {
    if (!last || !last.man) return Promise.resolve(false);
    return getJson(base() + '/xp/v1/health').then(function (h) {
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
      var slice = left.splice(0, 6);
      Promise.all(slice.map(function (n) {
        return getJson(pg.folder + 'view/own/' + pg.key + '.' + n + '.json').then(function (page) {
          if (page && page.pets) pageJob.pets = pageJob.pets.concat(page.pets);
        }, function () {});
      })).then(function () {
        if (verifiedTakeover) return;
        pageJob.batches = (pageJob.batches || 0) + 1;
        if (!left.length || pageJob.batches % 8 === 0) publishOwner(pageJob.pets, pg, pageJob.fights, !left.length);
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
    setTimeout(function () { startVerify(); }, 400);
  }
  window.V2Split = { STALE: STALE, prepare: prepare, recheck: recheck, install: install, assemble: assemble, startVerify: startVerify, checkPlans: checkPlans, rest: rest, ownerShard: function (addr, cb) { sha2(addr).then(function (h) { cb(h.slice(0, 2)); }); } };
})();
