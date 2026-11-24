/* Other-wallet lookup (display only). The light view paints this wallet's owner pages and
 * never the whole board. Lists that need someone else's pet (Gooby's Other wallets, fight
 * opponents, the Rare Room hall) stay empty until the player types a wallet address or a
 * pet number. A wallet loads its published owner pages, capped at one screen (V2Split.SCREEN_PAGES).
 * A pet number loads that one pet through V2Split.ensurePet. Nothing here signs or changes a rule. */
(function (root) {
  'use strict';
  var PAGE_CAP = (root.V2Split && root.V2Split.SCREEN_PAGES) || 7;
  var held = {}, rev = 0, last = null, hooked = false, folderP = null, ownerCache = {};
  var boxes = {};
  function now() { return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function world() { try { return root.V2Mock && V2Mock.world ? V2Mock.world() : null; } catch (e) { return null; } }
  function me() { try { return (root.V2UI && V2UI.ME) || ''; } catch (e) { return ''; } }
  function fetchFn() { return root.fetch; }
  function sha2(s) {
    var buf = new TextEncoder().encode(String(s || ''));
    return crypto.subtle.digest('SHA-256', buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    });
  }
  function parse(q) {
    q = String(q == null ? '' : q).trim();
    if (!q) return { ok: false, error: 'Type a wallet address or a pet number.' };
    var idm = q.replace(/^#/, '');
    if (/^\d{1,9}$/.test(idm)) {
      var id = +idm;
      if (!(id > 0) || id === 1765) return { ok: false, error: 'That pet number is not one you can look up.' };
      return { ok: true, kind: 'pet', id: id, query: String(id) };
    }
    var addr = q.replace(/\s+/g, '');
    if (/^bc1/i.test(addr)) addr = addr.toLowerCase();
    if (/^bc1[ac-hj-np-z02-9]{11,87}$/.test(addr) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)) return { ok: true, kind: 'wallet', addr: addr, query: addr };
    return { ok: false, error: 'Type a full wallet address or a pet number.' };
  }
  function pull(url, fetcher) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 12000) : null;
    return fetcher(url, { cache: 'force-cache', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (t) clearTimeout(t);
      if (!r) throw new Error('lookup');
      if (r.status === 404) return { bytes: 0, json: null, missing: true, files: 1 };
      if (!r.ok) throw new Error('lookup ' + r.status);
      return r.arrayBuffer().then(function (buf) {
        return { bytes: buf.byteLength, json: JSON.parse(new TextDecoder().decode(buf)), missing: false, files: 1 };
      });
    }, function (e) { if (t) clearTimeout(t); throw e; });
  }
  function folderOf(opts) {
    if (opts && opts.folder) return Promise.resolve(opts.folder);
    var w = world(), f = w && w._pages && w._pages.folder;
    if (f) return Promise.resolve(f);
    if (folderP) return folderP;
    var base = '';
    try { base = root.V2BootSync && V2BootSync.base ? V2BootSync.base() : ''; } catch (e) {}
    if (!base && opts && opts.base) base = opts.base;
    if (!base) return Promise.reject(new Error('The published world is not loaded yet.'));
    folderP = pull(base.replace(/\/+$/, '') + '/xp/v1/world/latest.json', opts && opts.fetch || fetchFn()).then(function (got) {
      var latest = got && got.json, path = latest && (latest.manifest || latest.url);
      if (!path) throw new Error('The published world is not loaded yet.');
      var man = /^https?:/.test(path) ? path : base.replace(/\/+$/, '') + path;
      return String(man).replace(/[^/]+$/, '');
    }, function (e) { folderP = null; throw e; });
    return folderP;
  }
  function living(list) {
    var out = [], i, p;
    for (i = 0; i < (list || []).length; i++) { p = list[i]; if (p && p.id && !p.dead && !p.released && p.id !== 1765) out.push(p); }
    return out;
  }
  /* A v3 owner page stores owner as an index. Open it the same way the own page does,
   * so a looked-up pet is not left with an empty owner. */
  function openRows(page) {
    var pets = (page && page.pets) || [];
    if (!page || page.v !== 3) return pets;
    if (root.V2Split && V2Split.openList) return V2Split.openList(pets, page.hashes, page.owner || '');
    if (root.XcpArt && XcpArt.openPet) {
      var out = [], i;
      for (i = 0; i < pets.length; i++) out.push(XcpArt.openPet(pets[i], { pageOwner: page.owner || '', owners: root.V2Split && V2Split.ownerTable ? V2Split.ownerTable() : null }));
      if (root.V2Split && V2Split.notePets) V2Split.notePets(out);
      return out;
    }
    return pets;
  }
  /* Nov 24 2026: with js/v2-merge.js loaded, looked-up pets are pinned there and every view world keeps them (V2Merge.carry in
   * setViewWorld), so this page no longer wraps setViewWorld. The wrap stays only as a fallback for a page without v2-merge.js. */
  function hook() {
    if (root.V2Merge) return;
    var M = root.V2Mock;
    if (hooked || !M || typeof M.setViewWorld !== 'function' || M.setViewWorld.__lookup) return;
    var orig = M.setViewWorld;
    function wrapped(w) { stamp(w); return orig.apply(this, arguments); }
    wrapped.__lookup = 1;
    M.setViewWorld = wrapped;
    hooked = true;
  }
  function stamp(w) {
    if (!w || !w.pets || !w.byId) return;
    var ids = Object.keys(held), i, p;
    for (i = 0; i < ids.length; i++) {
      p = held[ids[i]];
      if (!p || w.byId[p.id]) continue;
      w.pets.push(p);
      w.byId[p.id] = p;
    }
  }
  function absorb(pets) {
    hook();
    var w = world(), i, p, added = 0;
    for (i = 0; i < (pets || []).length; i++) {
      p = pets[i];
      if (!p || !p.id || p.dead || p.released || p.id === 1765) continue;
      var already = w && w.byId && w.byId[p.id];
      if (!held[p.id] && !already) added++;
      held[p.id] = already || held[p.id] || p;
    }
    if (root.V2Merge) { var hl = [], hk = Object.keys(held), hi; for (hi = 0; hi < hk.length; hi++) hl.push(held[hk[hi]]); V2Merge.pin(hl, me(), true); }
    w = world();
    if (w && !root.V2Merge) stamp(w);
    rev++;
    var M = root.V2Mock;
    if (M && typeof M.setViewWorld === 'function' && w) {
      var neu = {}, ks = Object.keys(w), k;
      for (k = 0; k < ks.length; k++) neu[ks[k]] = w[ks[k]];
      try { M.setViewWorld(neu); } catch (e) {}
    }
    return added;
  }
  function noteFor(kind, pets, meta) {
    var n = pets.length, mine = 0, i, own = me();
    for (i = 0; i < n; i++) if (own && pets[i].owner === own) mine++;
    if (!n) return kind === 'pet' ? 'No pet with that number is in the published world.' : 'No living pets published for that wallet.';
    if (mine === n && own) return 'Loaded ' + n + ' living pet' + (n === 1 ? '' : 's') + ' from this wallet. They stay under your own lists.';
    var tail = meta && meta.capped ? ' First ' + (meta.loadedPages || PAGE_CAP) + ' pages of ' + (meta.alive || n).toLocaleString('en-US') + ' living pets. Look up a pet number for one further down.' : '';
    if (kind === 'pet') return 'Loaded #' + pets[0].id + (pets[0].name ? ' ' + pets[0].name : '') + '.' + tail;
    return 'Loaded ' + n + ' living pet' + (n === 1 ? '' : 's') + '.' + tail;
  }
  function finish(kind, query, pets, meta, t0) {
    var added = absorb(pets);
    var res = {
      ok: true, kind: kind, query: query, pets: pets, added: added,
      bytes: meta.bytes || 0, files: meta.files || 0, ms: Math.round(now() - t0),
      alive: meta.alive == null ? pets.length : meta.alive,
      pages: meta.pages || 1, loadedPages: meta.loadedPages || 1, capped: !!meta.capped,
      empty: !pets.length, error: ''
    };
    res.note = noteFor(kind, pets, res);
    if (!pets.length) { res.ok = false; res.error = res.note; res.empty = true; }
    return res;
  }
  function loadOwner(addr, opts) {
    opts = opts || {};
    var cap = opts.cap || PAGE_CAP, fetcher = opts.fetch || fetchFn(), t0 = now();
    return sha2(addr).then(function (hex) {
      return folderOf(opts).then(function (folder) {
        var cacheKey = String(folder || '') + '|' + addr;
        if (ownerCache[cacheKey]) return ownerCache[cacheKey];
        var rootUrl = String(folder || '').replace(/\/?$/, '/');
        return pull(rootUrl + 'view/own/' + hex + '.json', fetcher).then(function (first) {
          if (!first || first.missing || !first.json) return finish('wallet', addr, [], { bytes: first ? first.bytes : 0, files: first ? first.files : 0, pages: 0, loadedPages: 0, alive: 0 }, t0);
          var page = first.json, pages = page.pages || 1, take = Math.min(pages, cap), rest = [], i;
          for (i = 1; i < take; i++) rest.push(pull(rootUrl + 'view/own/' + hex + '.' + i + '.json', fetcher));
          return Promise.all(rest).then(function (more) {
            var pets = living(openRows(page)), bytes = first.bytes || 0, files = first.files || 0, j;
            for (j = 0; j < more.length; j++) {
              bytes += more[j].bytes || 0; files += more[j].files || 0;
              if (more[j].json && more[j].json.pets) pets = pets.concat(living(openRows(more[j].json)));
            }
            var res = finish('wallet', addr, pets, { bytes: bytes, files: files, pages: pages, loadedPages: take, alive: page.alive == null ? pets.length : page.alive, capped: pages > take }, t0);
            if (res.ok) ownerCache[cacheKey] = res;
            return res;
          });
        });
      });
    });
  }
  function meter(fn) {
    var orig = root.fetch, bytes = 0, files = 0;
    if (typeof orig !== 'function') return Promise.resolve().then(fn).then(function (v) { return { value: v, bytes: 0, files: 0 }; });
    root.fetch = function () {
      var args = arguments;
      return orig.apply(this, args).then(function (r) {
        if (!r || typeof r.clone !== 'function') return r;
        files++;
        return r.clone().arrayBuffer().then(function (b) { bytes += b.byteLength || 0; return r; }, function () { return r; });
      });
    };
    return Promise.resolve().then(fn).then(function (v) { root.fetch = orig; return { value: v, bytes: bytes, files: files }; }, function (e) { root.fetch = orig; throw e; });
  }
  function loadPet(id, opts) {
    opts = opts || {};
    var t0 = now(), S = root.V2Split;
    if (!S || typeof S.ensurePet !== 'function') return Promise.resolve({ ok: false, kind: 'pet', query: String(id), pets: [], empty: true, error: 'Pet lookup is not ready yet.', bytes: 0, files: 0, ms: 0 });
    return meter(function () { return S.ensurePet(id); }).then(function (m) {
      var p = m.value, w = world(), got = (w && w.byId && w.byId[id]) || (p && p.id === id ? p : null);
      if (got && (got.dead || got.released)) {
        var gone = finish('pet', String(id), [], { bytes: m.bytes, files: m.files }, t0);
        gone.error = gone.note = 'Pet #' + id + ' is not a living pet, so it is not in these lists.';
        gone.empty = true; gone.ok = false;
        return gone;
      }
      return finish('pet', String(id), got ? [got] : [], { bytes: m.bytes, files: m.files, pages: 1, loadedPages: got ? 1 : 0, alive: got ? 1 : 0 }, t0);
    });
  }
  function load(q, opts) {
    var p = parse(q);
    if (!p.ok) return Promise.resolve({ ok: false, kind: '', query: String(q || ''), pets: [], empty: true, error: p.error, bytes: 0, files: 0, ms: 0, note: p.error });
    var run = p.kind === 'pet' ? loadPet(p.id, opts) : loadOwner(p.addr, opts);
    return run.then(function (res) { return res; }, function () {
      return { ok: false, kind: p.kind, query: p.query, pets: [], empty: true, error: 'Could not load that. Check the address or pet number and try again.', note: 'Could not load that. Check the address or pet number and try again.', bytes: 0, files: 0, ms: Math.round(0) };
    });
  }
  function defaultMsg(mode) {
    if (mode === 'fight') return 'Opponents from other wallets are not loaded yet. Type a wallet address or a pet number.';
    if (mode === 'rare') return 'The full hall is not loaded on this page. Type a wallet address or a pet number.';
    return 'Other wallets are not loaded on this page. Type a wallet address or a pet number.';
  }
  function paint(el) {
    if (!el) return;
    var st = boxes[el.id] || { q: '', msg: '' }, input = el.querySelector('input'), msg = el.querySelector('[data-xmsg]');
    if (input && root.document && document.activeElement !== input) input.value = st.q || '';
    if (msg) msg.textContent = st.busy ? 'Loading…' : (st.msg || defaultMsg(el.getAttribute('data-xmode')));
  }
  function remember(el) {
    var input = el.querySelector('input');
    boxes[el.id] = boxes[el.id] || { q: '', msg: '' };
    if (input) boxes[el.id].q = input.value;
  }
  function go(el) {
    remember(el);
    var st = boxes[el.id], n = (st.token = (st.token || 0) + 1);
    st.busy = true; st.msg = 'Loading…'; paint(el);
    load(st.q).then(function (res) {
      if (st.token !== n) return;
      last = res; st.busy = false; st.msg = res.error || res.note || defaultMsg(el.getAttribute('data-xmode')); paint(el);
      var nodes = root.document ? document.querySelectorAll('.xlook') : [], i, fn;
      for (i = 0; i < nodes.length; i++) { fn = nodes[i]._onReady; if (fn) try { fn(res); } catch (e) {} }
    });
  }
  function mount(parent, opts) {
    if (!parent || !opts || !opts.id || !root.document) return null;
    opts.mode = opts.mode || 'breed';
    var el = document.getElementById(opts.id);
    if (!el) {
      el = document.createElement('div');
      el.id = opts.id;
      el.className = 'xlook';
      el.setAttribute('data-xmode', opts.mode);
      el.innerHTML = '<label class="xlook-l">' + (opts.mode === 'rare' ? 'Look up a find' : opts.mode === 'fight' ? 'Look up an opponent' : 'Look up a mate') +
        ' <input type="text" class="xlook-q" autocomplete="off" spellcheck="false" placeholder="Wallet address or pet #" aria-label="Wallet address or pet number"></label>' +
        '<button type="button" class="xlook-go">Look up</button><p class="xlook-msg" data-xmsg role="status" aria-live="polite"></p>';
      boxes[opts.id] = boxes[opts.id] || { q: '', msg: '' };
      var input = el.querySelector('input'), btn = el.querySelector('button');
      input.addEventListener('input', function () { remember(el); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(el); } });
      btn.addEventListener('click', function () { go(el); });
      if (!document.getElementById('xlookCss')) {
        var cs = document.createElement('style'); cs.id = 'xlookCss';
        cs.textContent = '.xlook[hidden]{display:none!important}.xlook{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 6px;padding:6px;border:2px dashed #4b3f7a;background:#120e22}' +
          '.xlook-l{display:flex;flex:1 1 180px;gap:6px;align-items:center;min-width:0;color:#ffd166;font-size:12px}.xlook-q{flex:1 1 120px;min-width:0;min-height:36px;padding:4px 8px;border:2px solid #000;background:#fff8e1;color:#1b1b1b;font:inherit;font-size:14px}' +
          '.xlook-go{min-height:36px;padding:4px 10px;border:2px solid #000;background:#ffd166;color:#140f24;font:inherit;font-weight:700;box-shadow:2px 2px 0 #000;cursor:pointer}' +
          '.xlook-msg{flex:1 1 100%;margin:0;font-size:12px;color:#9fe8ff}';
        (document.head || document.documentElement).appendChild(cs);
      }
    }
    el._onReady = opts.onReady || null;
    el.setAttribute('data-xmode', opts.mode);
    if (opts.mode !== 'rare') browse(el);
    if (opts.before && opts.before.parentNode === parent) parent.insertBefore(el, opts.before);
    else if (el.parentNode !== parent) parent.appendChild(el);
    if (quietIds[opts.id]) { el.hidden = true; el.style.display = 'none'; }
    paint(el);
    return el;
  }
  /* Nov 22 2026 (Jake: "other wallets dont show"): an empty Other wallets / opponents list looked broken. On first open, load one
   * screen from each of the top 3 players by XCPETS burned (the published leaderboard, not this wallet), so there is always
   * someone to pick. Typing an address or a pet number still loads anyone. Display only. */
  var browsed = false, warmCbs = [], warmDone = false, quietIds = {};
  function browse(el) {
    var st = boxes[el.id] || (boxes[el.id] = { q: '', msg: '' });
    if (warmDone) return;
    if (!browsed) { st.busy = true; paint(el); }
    warm(function (n, k) { st.busy = false; st.msg = n ? 'Showing ' + n + ' pets from the top ' + k + ' players. Type a wallet address or a pet number for anyone else.' : ''; paint(el);
      var nodes = root.document ? document.querySelectorAll('.xlook') : [], i; for (i = 0; i < nodes.length; i++) { var fn = nodes[i]._onReady; if (fn) try { fn({ ok: true, browse: true }); } catch (e) {} } });
    if (!browsed) { st.busy = false; paint(el); }
  }
  /** warm(cb): load one screen from each of the top 3 players once per page (the pickers' search box calls this when the other side opens).
   * cb(nPets, nPlayers) runs when they are in; later calls after that do nothing. */
  function warm(cb) {
    if (warmDone) return; if (cb && warmCbs.indexOf(cb) < 0 && warmCbs.length < 8) warmCbs.push(cb); if (browsed) return;
    var w = world(), lb = w && w.community && w.community.leaderboard; if (!lb || !lb.length) return;
    var own = me(), picks = lb.map(function (x) { return x && x.address; }).filter(function (a) { return a && a !== own && parse(a).ok; }).slice(0, 3);
    if (!picks.length) return; browsed = true;
    var n = 0, i = 0;
    (function next() {
      if (i >= picks.length) { warmDone = true; var cbs = warmCbs; warmCbs = []; cbs.forEach(function (f) { try { f(n, picks.length); } catch (e) {} }); return; }
      loadOwner(picks[i++], { cap: 3 }).then(function (res) { n += (res && res.pets && res.pets.length) || 0; next(); }, function () { next(); });
    })();
  }
  /** quiet(id): a lookup box that a picker's own search box replaces stays hidden (mount keeps it hidden too). */
  function quiet(id) { quietIds[id] = 1; var el = root.document && document.getElementById(id); if (el) { el.hidden = true; el.style.display = 'none'; } }
  root.V2Lookup = {
    PAGE_CAP: PAGE_CAP, parse: parse, rev: function () { return rev; }, last: function () { return last; },
    load: load, loadOwner: loadOwner, loadPet: loadPet, absorb: absorb, mount: mount, warm: warm, quiet: quiet, held: function () { return held; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
