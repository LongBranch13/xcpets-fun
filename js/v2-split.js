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
      tip: summary.tip, pets: pets, byId: byId, items: items, itemList: itemList, log: [],
      community: summary.community || {},
      tokens: {},
      wizardMythic: cold.wizard || null, kekMythic: cold.kek || null, homerMythic: cold.homer || null,
      rabbitMythic: cold.rabbit || null, funtrumpMythic: cold.funtrump || null, djpepeMythic: cold.djpepe || null,
      _view: 1, _counts: { n: summary.n, alive: summary.alive, dead: summary.dead, burned: summary.burned, burns: summary.burns }
    };
  }
  var last = null;
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
          if (!summary || summary.v !== 1 || summary.tip !== man.tip || summary.rsig !== man.rsig) throw new Error('summary');
          var who = me();
          if (!who) return assemble(summary, null);
          return sha2(who).then(function (hex) {
            return getJson(folder + 'view/o/' + hex.slice(0, 2) + '.json').then(function (pack) {
              if (!pack || !pack.owners || !pack.owners[who]) return assemble(summary, null);
              var one = {}; one[who] = pack.owners[who];
              return assemble(summary, { owners: one });
            }, function () { return assemble(summary, null); });
          });
        });
      });
    }).then(function (view) { last = { man: man, url: manUrl, tip: chainTip }; cb(view); }, function () { cb(null); });
  }
  function recheck() {
    if (!last || !last.man) return Promise.resolve(false);
    return getJson(base() + '/xp/v1/health').then(function (h) {
      var tip = h && h.tip || 0;
      return !(tip && last.man.tip != null && tip - last.man.tip > STALE);
    }, function () { return false; });
  }
  function install(view) {
    var bar = document.getElementById('splitViewBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'splitViewBar';
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'background:#1d1b2e;color:#d7ffe4;padding:6px 10px;font-size:12px;line-height:1.5;text-align:center';
      bar.innerHTML = 'Published world at block <b id="splitViewTip"></b>. <button type="button" class="q" id="splitVerify">Verify</button> checks every burn on this device before a burn is sent.';
      document.body.insertBefore(bar, document.body.firstChild);
      document.getElementById('splitVerify').onclick = function () {
        var b = document.getElementById('splitVerify');
        b.disabled = true; b.textContent = 'Checking…';
        var go = window.V2Mock && V2Mock.loadReal;
        if (!go) { b.textContent = 'Verify'; b.disabled = false; return; }
        go(function () { b.textContent = 'Verified'; var note = document.getElementById('splitViewBar'); if (note) note.textContent = 'Verified on this device.'; });
      };
    }
    var t = document.getElementById('splitViewTip');
    if (t) t.textContent = String(view && view.tip || '');
  }
  window.V2Split = { STALE: STALE, prepare: prepare, recheck: recheck, install: install, assemble: assemble, ownerShard: function (addr, cb) { sha2(addr).then(function (h) { cb(h.slice(0, 2)); }); } };
})();
