/* XCPETS v2 PRODUCTION chain adapter (same V2Mock interface as the old v2-mock.js so every v2 page runs unchanged).
 * READ-ONLY: real XCPETS destroys from the Counterparty API the live site uses (rjs/config.js -> api.xcp.fun/node/v2, then counterparty.io),
 * replayed by V2Rules with the FROZEN live engine (window.LiveEngine.RealCore) for every burn at or before CUTOFF_BLOCK (971,500).
 * Burns go through js/v2-wallet.js (live compose + XCP Wallet signing); this file only reads. Local equips are saved per device. */
(function () {
  'use strict';
  var V = window.V2Rules, E = window.LiveEngine, KEY = 'xcpets-v2-prod', HKEY = 'xcpets-v2-prod-hashes';
  function q(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
  var ME = q('addr') || (function () { try { return localStorage.getItem('xcpets-v2-me') || ''; } catch (e) { return ''; } })();
  /* address-lookup (2026-10-19): a viewed ?addr= is remembered as before, except when a different XCP Wallet is connected in this browser:
   * then the wallet stays the saved address, so play.html without ?addr= goes back to the wallet's own pets (the wallet wins). */
  if (q('addr')) try { var wa = localStorage.getItem('xcpets-xcpwallet-address'); if (!wa || wa === ME) localStorage.setItem('xcpets-v2-me', ME); } catch (e) {}
  var loc = (function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  var S = { rows: [], hashes: {}, ops: loc.ops || [], tip: 0, balance: 0, n: 0, sel: loc.sel || [], hide: loc.hide != null ? loc.hide : -1, hidden: loc.hidden || [], prod: true, mempool: [] };
  var cache = null, opsSig = null, cacheSig = null;
  /* smooth-perf (owner approved 2026-10-19): the replay is rebuilt ONLY when its inputs changed. inSig() = tip + an FNV-1a hash of the burn rows +
   * a hash of every block hash, i.e. everything V.replay reads besides the local ops (opsSig). load() used to drop the cache on every read, so the 60 s
   * play.html poll threw away an identical world and the next click paid a full replay (≈12 s on a phone). Same inputs -> same world object. */
  function fnv(s, h) { h = h == null ? 0x811c9dc5 : h; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function inSig() { var hk = Object.keys(S.hashes || {}).sort(function (a, b) { return a - b; }), hh = 0x811c9dc5; hk.forEach(function (k) { hh = fnv(k + ':' + S.hashes[k] + ';', hh); });
    return S.tip + '|' + (S.rows || []).length + '|' + fnv(JSON.stringify(S.rows || [])).toString(16) + '|' + hk.length + '|' + hh.toString(16); }
  function keepOrDrop() { if (cache && cacheSig !== inSig()) cache = null; }
  /* Cross-visit cache (smooth-perf): the last replayed world is kept in IndexedDB under ONE entry, keyed by build id + inSig() + opsSig. A page whose
   * inputs match (same build, burns, tip, hashes and local ops) reuses it instead of replaying; anything else replays as before. The stored value is
   * a structured clone of the world V.replay returned, so it is the same data; V.reindex() rebuilds the gear index on it. Best effort: any IDB error,
   * a missing build id or a slow read (> IDB_WAIT_MS) simply means a normal replay. */
  var BUILD = (function () { try { var m = /[?&]v=([0-9a-f]{6,})/.exec((document.currentScript && document.currentScript.src) || ''); return m ? m[1] : null; } catch (e) { return null; } })();
  var IDB_NAME = 'xcpets-world', IDB_WAIT_MS = 2500, idbKeyStored = null;
  function idb() { return new Promise(function (res, rej) { if (!BUILD || typeof indexedDB === 'undefined') return rej(new Error('no idb'));
    var r = indexedDB.open(IDB_NAME, 1); r.onupgradeneeded = function () { r.result.createObjectStore('w'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.onblocked = function () { rej(new Error('blocked')); }; }); }
  function idbKey() { return BUILD + '|' + inSig() + '|' + JSON.stringify(S.ops || []); }
  function idbGet() { var key = idbKey(); return new Promise(function (res) { var done = false, t = setTimeout(function () { done = true; res(null); }, IDB_WAIT_MS);
    idb().then(function (db) { var q = db.transaction('w', 'readonly').objectStore('w').get('world'); q.onsuccess = function () { var v = q.result; db.close(); if (done) return; done = true; clearTimeout(t); res(v && v.key === key && v.world ? v : null); };
      q.onerror = function () { db.close(); if (!done) { done = true; clearTimeout(t); res(null); } }; }, function () { if (!done) { done = true; clearTimeout(t); res(null); } }); }); }
  /* Replay worker (smooth-perf): the boot replay (and a poll that brought new burns) runs in js/v2-replay-worker.js with the page's own rule scripts,
   * so the page stays responsive; the worker also writes the IDB entry. The result is a structured clone of the same world (V.reindex() restores the
   * gear index). No worker / an error / WORKER_MS without an answer -> cache stays empty and world() replays on the main thread exactly as before. */
  var RULE_SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
  var WORKER_MS = 45000, wk = null, wkId = 0, wkOff = false;
  function ruleUrls() { var all = Array.prototype.map.call(document.scripts || [], function (x) { return x.src || ''; }), out = [];
    for (var i = 0; i < RULE_SCRIPTS.length; i++) { var f = RULE_SCRIPTS[i], hit = null; for (var j = 0; j < all.length; j++) { var u = all[j].split('?')[0]; if (u.slice(-f.length - 1) === '/' + f) { hit = all[j]; break; } } if (!hit) return null; out.push(hit); } return out; }
  function workerReplay() { if (cache || wkOff || !BUILD || typeof Worker === 'undefined' || !(E.CFG && E.CFG.isMainnet)) return Promise.resolve();
    var urls = ruleUrls(); if (!urls) return Promise.resolve();
    return new Promise(function (res) { var id = ++wkId, sig = inSig(), ops = S.ops || [], oj = JSON.stringify(ops), key = idbKey(), done = false, t;
      function fin() { if (done) return; done = true; clearTimeout(t); res(); }
      try { if (!wk) { wk = new Worker(new URL('js/v2-replay-worker.js?v=' + BUILD, location.href).href); wk.onerror = function () { wkOff = true; try { wk.terminate(); } catch (e) {} wk = null; fin(); }; }
        wk.onmessage = function (ev) { var m = ev.data || {}; if (m.id !== id) return; if (m.ok && m.world && !cache && inSig() === sig && JSON.stringify(S.ops || []) === oj) { var w = m.world; if (V.reindex) V.reindex(w); cache = w; cacheSig = sig; opsSig = oj; idbKeyStored = key; S.fromCache = false; S.workerMs = m.ms; } else if (!m.ok) wkOff = true; fin(); };
        t = setTimeout(function () { wkOff = true; try { wk.terminate(); } catch (e) {} wk = null; fin(); }, WORKER_MS);
        wk.postMessage({ id: id, scripts: urls, rows: S.rows, hashes: S.hashes, ops: ops, tip: S.tip, idbKey: key });
      } catch (e) { wkOff = true; fin(); } }); }
  function fromIdb() { if (cache) return Promise.resolve(); return idbGet().then(function (v) { if (!v || cache) return; var w = v.world; if (V.reindex) V.reindex(w); cache = w; cacheSig = inSig(); opsSig = JSON.stringify(S.ops || []); idbKeyStored = v.key; S.fromCache = true; }, function () {}); }
  /* hotfix 2 (2026-10-14): save() used to drop the replay cache on EVERY call (every checkbox / click), so each click re-replayed all
   * burns (4,086 pets) and re-rendered everything. Selection / hidden list don't change the world: only a change in the local ops does. */
  function save() { var j = JSON.stringify(S.ops || []); try { localStorage.setItem(KEY, JSON.stringify({ ops: S.ops, sel: S.sel, hide: S.hide, hidden: S.hidden || [] })); } catch (e) {} if (j !== opsSig) cache = null; }
  function world() { if (!cache) { cache = V.replay(S.rows, S.hashes, S.ops, { tip: S.tip, live: E.RealCore }); opsSig = JSON.stringify(S.ops || []); cacheSig = inSig(); S.fromCache = false; } return cache; }
  function burn() { var m = 'Burns from the v2 pages are not wired to a wallet in this build. Nothing was burned.'; try { var t = document.getElementById('toasts'); if (t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = m; t.appendChild(d); setTimeout(function () { d.remove(); }, 5000); } else alert(m); } catch (e) {} }
  /* hotfix 3: a short-TTL (60 s) sessionStorage copy of the burns + tip, so moving between pages doesn't re-read the whole chain;
   * refresh() always goes to the network. Block hashes were already cached in localStorage (HKEY). */
  var SKEY = 'xcpets-v2-prod-rows', STTL = 60000;
  function fromSession() { try { var c = JSON.parse(sessionStorage.getItem(SKEY)); if (!c || Date.now() - c.at > STTL || !c.rows) return false;
    var hc = JSON.parse(localStorage.getItem(HKEY)) || {}; if (!c.rows.every(function (x) { return hc[x.block_index]; })) return false;
    S.rows = c.rows; S.tip = c.tip; S.mempool = c.mempool || []; S.hashes = hc; S.verified = true; if (c.me === ME) S.balance = c.balance || 0; else if (ME) return false; keepOrDrop(); return true; } catch (e) { return false; } }
  function toSession() { try { sessionStorage.setItem(SKEY, JSON.stringify({ at: Date.now(), rows: S.rows, tip: S.tip, mempool: S.mempool, me: ME, balance: S.balance })); } catch (e) {} }
  function load(force) {
    if (!force && fromSession()) return Promise.resolve();
    var chain = new E.Chain();
    /* smooth-perf: the ?addr= balance read starts together with the burns (it used to wait for them); display only, never a replay input */
    var bal = ME ? chain.balance(ME, E.CFG.asset).then(function (b) { return Number(b) / 1e8; }, function () { return null; }) : null;
    var hc = (function () { try { return JSON.parse(localStorage.getItem(HKEY)) || {}; } catch (e) { return {}; } })();
    var seed = window.XCPETS_BLOCK_HASHES || {}; Object.keys(seed).forEach(function (k) { if (!hc[k]) hc[k] = seed[k]; }); /* shipped hash seed (js/block-hashes.js) */
    step('Reading XCPETS burns from the chain… (step 1 of 3)');
    /* pending battles (2026-10-15): unconfirmed XCPETS destroys from the node mempool, for the battles box ONLY ('pending confirmation').
     * Never passed to V.replay, so no replay result can change. A failed read just means an empty list. */
    var mp = chain.getJson('/mempool/events/ASSET_DESTRUCTION?limit=1000').then(function (j) { return ((j && j.result) || []).map(function (e) { var x = e.params || {}, t = x.tag;
      if (typeof t === 'string' && /^([0-9a-f]{2})+$/i.test(t)) { try { t = decodeURIComponent(t.replace(/(..)/g, '%$1')); } catch (er) { } }
      return x.asset === E.CFG.asset && String(x.status || 'valid') === 'valid' ? { tx_hash: x.tx_hash || e.tx_hash, source: x.source, tag: t, amount: Number(x.quantity) / 1e8, at: e.timestamp ? e.timestamp * 1000 : null } : null; }).filter(Boolean); }, function () { return []; });
    return Promise.all([chain.destructions(E.CFG.asset), chain.tip().catch(function () { return null; }), mp]).then(function (r) { S.mempool = r[2] || [];
      var rows = r[0], tip = r[1], blocks = {}; rows.forEach(function (x) { blocks[x.block_index] = 1; });
      var need = Object.keys(blocks).filter(function (b) { return !hc[b]; }).length; step('Read ' + rows.length + ' burns. Checking block hashes' + (need ? ' (' + need + ' to fetch)' : '') + '… (step 2 of 3)');
      return chain.blockHashes(Object.keys(blocks), hc, tip, function (n, miss) { step('Some block-hash servers are busy. Retrying ' + miss.length + ' block' + (miss.length === 1 ? '' : 's') + ' (try ' + (n + 1) + ' of 4)… (step 2 of 3)'); }).then(function (bh) {
        try { localStorage.setItem(HKEY, JSON.stringify(hc)); } catch (e) {}
        /* family-tree-fix (2026-10-19): never replay with a block hash missing. Rules reject hatch/breed/roll burns in a block without its hash
         * ('block hash pending'), so every later pet would be renumbered and family links would point at the wrong pet. Stop here instead:
         * S.rows / S.tip keep the last COMPLETE load (empty on first boot), so the world shown (and any burn tag built from it) stays correct. */
        var miss = (bh.missing || []).filter(function (b) { return !hc[b] && !bh.hashes[b]; });
        if (miss.length) { var me = new Error('missing block hashes: ' + miss.join(', ')); me.missingBlocks = miss; throw me; }
        S.rows = rows; S.hashes = Object.assign({}, hc, bh.hashes); S.tip = tip || rows.reduce(function (a, x) { return Math.max(a, x.block_index); }, 0);
        if (bal) return bal.then(function (b) { if (b != null) S.balance = b; });
      });
    }).then(function () { keepOrDrop(); S.verified = true; S.missingBlocks = []; toSession(); step('Rebuilding every pet from the burns… (step 3 of 3)'); },
      function (e) { if (e && e.missingBlocks) S.missingBlocks = e.missingBlocks; throw e; });
  }
  var stepEl = null; function step(t) { var el = stepEl || document.getElementById('v2boot'); if (el && !booted && !el.querySelector('button')) el.textContent = t; }
  /* Boot with a clear failure state (2026-10-16): chain.js fails over quickly (6 s primary / 5 s backups, ~20 s worst case per request). If the read
   * fails, or is still running after BOOT_WATCH_MS, the spinner text becomes a message with a Retry button that re-runs the boot (no full reload;
   * location.reload() if anything throws). A late success still completes the boot. Data and replay are unchanged. */
  var BOOT_WATCH_MS = 30000, booted = false;
  function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* missing block hash (family-tree-fix, 2026-10-19): plain "Couldn't verify block N" + Retry; nothing is replayed until every block checks out. */
  function missText(list) { return "Couldn't verify block " + fmtN(list[0]) + (list.length > 1 ? ' (and ' + (list.length - 1) + ' more)' : '') + '. Pets are not shown until every block checks out, so none are numbered wrong. Your pets are safe on chain.'; }
  function bootFail(st, then, why, missing) { if (!st || booted) return; st.textContent = ''; st.className = 'small muted bootfail' + (missing ? ' bootverify' : '');
    var m = document.createElement('p'); m.textContent = missing ? missText(missing) : "Couldn't reach the chain servers right now. Your pets are safe on chain."; m.style.margin = '6px 0'; if (missing) why = 'the block-hash servers are busy; Retry asks them again';
    var d = document.createElement('p'); d.className = 'small muted'; d.textContent = why ? '(' + why + ')' : ''; d.style.margin = '0 0 6px';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'v2bootRetry'; b.textContent = 'Retry';
    b.onclick = function () { try { st.textContent = 'Reading XCPETS burns from the chain…'; st.className = 'small muted'; run(st, then); } catch (e) { location.reload(); } };
    st.appendChild(m); if (why) st.appendChild(d); st.appendChild(b);
    /* the boot line sits at the bottom of the page; a verify failure is moved to the top of <main> as a panel so it can't be missed */
    if (missing) { try { var mn = document.querySelector('main'); if (mn && st.parentNode !== mn) mn.insertBefore(st, mn.firstChild); st.classList.add('panel'); st.style.textAlign = 'center'; st.style.margin = '12px auto'; st.style.border = '2px solid #ffc93c'; st.setAttribute('role', 'alert'); } catch (e) {} } }
  function run(st, then) { stepEl = st; var done = false, w = setTimeout(function () { if (!done) bootFail(st, then, 'still waiting for the chain servers'); }, BOOT_WATCH_MS);
    load(true).then(fromIdb).then(workerReplay).then(function () { done = true; clearTimeout(w); if (booted) return; setTimeout(function () { booted = true; if (st) st.remove(); then(); }, 30); },
      function (e) { done = true; clearTimeout(w); if (booted) return;
        bootFail(st, then, e && e.message ? String(e.message).slice(0, 160) : '', e && e.missingBlocks); }); }
  function boot(then) { var st = document.getElementById('v2boot');
    if (fromSession()) { fromIdb().then(workerReplay).then(function () { if (booted) return; booted = true; if (st) st.remove(); then(); }); return; }
    run(st, then); }
  /** refresh(cb): re-read the chain (new confirmed burns, e.g. your roll) and call cb() when the tip or burn count changed. */
  function refresh(cb) { var n = S.rows.length, t = S.tip, sig = function () { return (S.mempool || []).map(function (x) { return x.tx_hash; }).join(); }, m = sig(); return load(true).then(fromIdb).then(workerReplay).then(function () { if (S.rows.length !== n || S.tip !== t || sig() !== m) cb(); }, function () {}); }
  window.V2Mock = { KEY: KEY, ME: ME, NPCS: [], prod: true, state: function () { return S; }, save: save, burn: burn, adv: function () {}, world: world, seed: function () {}, boot: boot, refresh: refresh };
})();
