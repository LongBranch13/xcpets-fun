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
    return S.tip + '|' + (S.rows || []).length + '|' + fnv(JSON.stringify(S.rows || [])).toString(16) + '|' + hk.length + '|' + hh.toString(16) + (S.dex ? '|dex' + fnv(JSON.stringify([S.dex.issuances, S.dex.orders, S.dex.matches])).toString(16) : ''); } /* pet-shop-sales: S.dex only exists once ACTIVATE_SALES_BLOCK is set */
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
        wk.postMessage({ id: id, scripts: urls, rows: S.rows, hashes: S.hashes, ops: ops, tip: S.tip, dex: S.dex || undefined, idbKey: key });
      } catch (e) { wkOff = true; fin(); } }); }
  function fromIdb() { if (cache) return Promise.resolve(); return idbGet().then(function (v) { if (!v || cache) return; var w = v.world; if (V.reindex) V.reindex(w); cache = w; cacheSig = inSig(); opsSig = JSON.stringify(S.ops || []); idbKeyStored = v.key; S.fromCache = true; }, function () {}); }
  /* hotfix 2 (2026-10-14): save() used to drop the replay cache on EVERY call (every checkbox / click), so each click re-replayed all
   * burns (4,086 pets) and re-rendered everything. Selection / hidden list don't change the world: only a change in the local ops does. */
  function save() { var j = JSON.stringify(S.ops || []); try { localStorage.setItem(KEY, JSON.stringify({ ops: S.ops, sel: S.sel, hide: S.hide, hidden: S.hidden || [] })); } catch (e) {} if (j !== opsSig) cache = null; }
  function world() { if (!cache) { cache = V.replay(S.rows, S.hashes, S.ops, { tip: S.tip, live: E.RealCore, dex: S.dex || undefined }); opsSig = JSON.stringify(S.ops || []); cacheSig = inSig(); S.fromCache = false; } if (V.syncCosts) V.syncCosts(cache, (S.tip || 0) + 1); /* halving: UI prices at the next block */ return cache; }
  function burn() { var m = 'Burns from the v2 pages are not wired to a wallet in this build. Nothing was burned.'; try { var t = document.getElementById('toasts'); if (t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = m; t.appendChild(d); setTimeout(function () { d.remove(); }, 5000); } else alert(m); } catch (e) {} }
  /* hotfix 3: a short-TTL (60 s) sessionStorage copy of the burns + tip, so moving between pages doesn't re-read the whole chain;
   * refresh() always goes to the network. Block hashes were already cached in localStorage (HKEY). */
  var SKEY = 'xcpets-v2-prod-rows', STTL = 60000;
  function fromSession() { try { var c = JSON.parse(sessionStorage.getItem(SKEY)); if (!c || Date.now() - c.at > STTL || !c.rows) return false;
    var hc = JSON.parse(localStorage.getItem(HKEY)) || {}; if (!c.rows.every(function (x) { return hc[x.block_index]; })) return false;
    S.rows = c.rows; S.tip = c.tip; S.mempool = c.mempool || []; S.hashes = hc; if (V.salesGate && V.salesGate() != null && !c.dex) return false; /* sale-owner-fix: no sale data in the copy -> full load (never replay owners without sales) */ S.dex = c.dex || undefined; S.verified = true; if (c.me === ME) S.balance = c.balance || 0; else if (ME) return false; keepOrDrop(); return true; } catch (e) { return false; } }
  function toSession() { try { sessionStorage.setItem(SKEY, JSON.stringify({ at: Date.now(), rows: S.rows, tip: S.tip, mempool: S.mempool, me: ME, balance: S.balance, dex: S.dex || null })); } catch (e) {} }
  /* site-fast (2026-10-24): stale-while-revalidate. The last COMPLETE load (verified rows + tip + sale data) is kept in localStorage (LAST) and a
   * CI-built copy ships as api/boot.json. A page with no 60 s session copy renders AT ONCE from one of these (S.verified stays false and S.stale
   * is set, so js/v2-wallet.js refuses every burn), then load(true) re-reads the chain in the background. Same rows + hashes + sale data in ->
   * the same replay out (rules unchanged); when the fresh read differs, a small bar offers a refresh. */
  var LAST = 'xcpets-v2-last-1', LAST_MAX = 7 * 864e5;
  function toLast() { try { localStorage.setItem(LAST, JSON.stringify({ at: Date.now(), build: BUILD, rows: S.rows, tip: S.tip, dex: S.dex || null })); } catch (e) {} }
  function applyStale(c, hashes) { if (!c || !Array.isArray(c.rows) || !c.rows.length || !c.tip) return false;
    if (V.salesGate && V.salesGate() != null && !c.dex) return false; /* never replay owners without sales */
    var hc = (function () { try { return JSON.parse(localStorage.getItem(HKEY)) || {}; } catch (e) { return {}; } })(), seed = window.XCPETS_BLOCK_HASHES || {};
    Object.keys(seed).forEach(function (k) { if (!hc[k]) hc[k] = seed[k]; }); if (hashes) Object.keys(hashes).forEach(function (k) { if (!hc[k]) hc[k] = hashes[k]; });
    if (!c.rows.every(function (x) { return hc[x.block_index]; })) return false; /* family-tree-fix: never replay with a hash missing */
    if (hashes) try { localStorage.setItem(HKEY, JSON.stringify(hc)); } catch (e) {}
    S.rows = c.rows; S.tip = c.tip; S.mempool = []; S.hashes = hc; S.dex = c.dex || undefined; S.verified = false; S.stale = true; S.staleTip = c.tip; keepOrDrop(); return true; }
  function fromLast() { try { var c = JSON.parse(localStorage.getItem(LAST)); if (!c || Date.now() - c.at > LAST_MAX) return false; return applyStale(c, null); } catch (e) { return false; } }
  function fromStatic() { var ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ac && setTimeout(function () { ac.abort(); }, 4000);
    return fetch('api/boot.json', ac ? { signal: ac.signal, cache: 'no-cache' } : undefined).then(function (r) { clearTimeout(t); return r.ok ? r.json() : null; })
      .then(function (j) { try { if (j && window.V2Sales && window.V2Sales.setBase) window.V2Sales.setBase(j); } catch (e) {} return !!(j && applyStale(j, j.hashes)); }, function () { return false; }); }
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
      var rows = r[0], tip = r[1], blocks = {}; rows.forEach(function (x) { blocks[x.block_index] = 1; }); var FG = V.ACTIVATE_FIRESALE_BLOCK; if (FG != null && tip >= FG) for (var fb = FG; fb <= tip; fb++) blocks[fb] = 1; /* fire sales: every block's hash from the gate decides the schedule */
      var QG = V.questGate ? V.questGate() : null; if (QG != null && tip >= QG) for (var qb = QG; qb <= tip; qb++) blocks[qb] = 1; /* Mythic quests (2026-10-24): every block from the quest gate on, so each Homecoming block's hash is there even with no burn in it; inert while the gate is null */
      var need = Object.keys(blocks).filter(function (b) { return !hc[b]; }).length; step('Read ' + rows.length + ' burns. Checking block hashes' + (need ? ' (' + need + ' to fetch)' : '') + '… (step 2 of 3)');
      return chain.blockHashes(Object.keys(blocks), hc, tip, function (n, miss) { step('Some block-hash servers are busy. Retrying ' + miss.length + ' block' + (miss.length === 1 ? '' : 's') + ' (try ' + (n + 1) + ' of 4)… (step 2 of 3)'); }).then(function (bh) {
        try { localStorage.setItem(HKEY, JSON.stringify(hc)); } catch (e) {}
        /* family-tree-fix (2026-10-19): never replay with a block hash missing. Rules reject hatch/breed/roll burns in a block without its hash
         * ('block hash pending'), so every later pet would be renumbered and family links would point at the wrong pet. Stop here instead:
         * S.rows / S.tip keep the last COMPLETE load (empty on first boot), so the world shown (and any burn tag built from it) stays correct. */
        var miss = (bh.missing || []).filter(function (b) { return !hc[b] && !bh.hashes[b]; });
        if (miss.length) { var me = new Error('missing block hashes: ' + miss.join(', ')); me.missingBlocks = miss; throw me; }
        var nHashes = Object.assign({}, hc, bh.hashes), nTip = tip || rows.reduce(function (a, x) { return Math.max(a, x.block_index); }, 0); /* site-fast-reread: staged, committed together with the sale data below */
        /* pet-shop-sales: pet-token issuances + orders + matches (found from the pet:deed burns) are replay inputs once ACTIVATE_SALES_BLOCK is set (never fetched while it is null) */
        var dx = V.salesGate && V.salesGate() != null && window.V2Sales ? window.V2Sales.loadDex(rows, { tip: nTip, hashes: nHashes }).then(function (d) { if (!d) throw new Error('pet sale data is empty'); S.dex = d; S.rows = rows; S.hashes = nHashes; S.tip = nTip; },
          function (e) { throw new Error('pet sales and token transfers could not be read, so pet owners could be out of date (' + String(e && e.message || e).slice(0, 90) + ')'); }) : null;
        /* sale-owner-fix (2026-10-24): gate set but V2Sales missing = no sale data -> fail like any other read (Couldn't reach + Retry), never replay without it */
        if (!dx && V.salesGate && V.salesGate() != null) throw new Error('pet sale reader did not load, so pet owners could be out of date');
        if (!dx) { S.rows = rows; S.hashes = nHashes; S.tip = nTip; } /* site-fast-reread: rows + hashes + tip + sale data change as ONE set, so a failed sale read never mixes new burns with old sales */
        return Promise.all([dx, bal && bal.then(function (b) { if (b != null) S.balance = b; })]);
      });
    }).then(function () { keepOrDrop(); S.verified = true; S.stale = false; S.missingBlocks = []; toSession(); toLast(); step('Rebuilding every pet from the burns… (step 3 of 3)'); },
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
  function run(st, then) { stepEl = st; var done = false, w = setTimeout(function () { if (!done && st && !booted) { st.textContent = 'Using backup source, this can take a minute…'; st.className = 'small muted'; } }, BOOT_WATCH_MS); /* site-fast: calm note, the read keeps going (a real failure still shows Retry) */
    load(true).then(fromIdb).then(workerReplay).then(function () { done = true; clearTimeout(w); if (booted) return; setTimeout(function () { booted = true; if (st) st.remove(); then(); }, 30); },
      function (e) { done = true; clearTimeout(w); if (booted) return;
        bootFail(st, then, e && e.message ? String(e.message).slice(0, 160) : '', e && e.missingBlocks); }); }
  /* site-fast-reread (2026-10-24): the status bar is a slim strip at the top of the page (in the flow, never fixed), so it can't cover buttons
   * at the bottom of a phone screen. The background re-read retries on its own (RETRY_MS) before it shows Retry. */
  function staleBar(t, retry) { try { var b = document.getElementById('v2stale'); if (!b) { b = document.createElement('div'); b.id = 'v2stale'; b.setAttribute('role', 'status');
      b.style.cssText = 'background:#1d1b2e;color:#fff;border-bottom:2px solid #ffc93c;padding:4px 10px;font-size:12px;line-height:1.5;text-align:center'; document.body.insertBefore(b, document.body.firstChild); }
      b.textContent = t + ' '; if (retry === 'none') return; var k = document.createElement('button'); k.type = 'button'; k.className = 'btn'; k.textContent = retry ? 'Retry' : 'Refresh'; k.style.cssText = 'margin-left:6px;padding:2px 8px;font-size:12px';
      k.onclick = function () { if (retry) { b.textContent = 'Checking the chain…'; revalidate(0); } else location.reload(); }; b.appendChild(k); } catch (e) {} }
  function sigOf() { return S.rows.length + '|' + JSON.stringify(S.dex || null).length; }
  var RETRY_MS = [5000, 15000, 30000], reval = null;
  function revalidate(n) { if (reval) return reval; n = n || 0; var was = sigOf();
    reval = load(true).then(function () { reval = null; var b = document.getElementById('v2stale'); if (b) b.remove();
      if (sigOf() !== was) staleBar('New chain activity since your last visit.', false); return workerReplay(); },
    function (e) { reval = null; try { console.warn('[v2] background re-read failed (try ' + (n + 1) + '):', e && (e.message || e)); } catch (x) {}
      if (n < RETRY_MS.length) { setTimeout(function () { revalidate(n + 1); }, RETRY_MS[n]); return; }
      staleBar('Showing saved pets from block ' + fmtN(S.staleTip || S.tip) + '. The chain servers are slow right now, so burns wait until they answer.', true); });
    return reval; }
  /* site-fast-reread: an action pressed while the saved copy is showing WAITS for the re-read instead of failing. Resolves {ok, same}: same =
   * the fresh burns + sale data match the copy the action was built from (so its pet numbers are right); never resolves ok on a failed read. */
  function whenFresh() { if (!S.stale || S.verified) return Promise.resolve({ ok: !!S.verified, same: true }); var was = sigOf();
    staleBar('Checking the latest chain data before your burn. This can take a minute…', 'none');
    function wait(left) { var p = reval || (S.verified ? null : revalidate(RETRY_MS.length));
      return Promise.resolve(p).then(function () { if (S.verified) return { ok: true, same: sigOf() === was }; if (left > 0 && reval) return wait(left - 1); return { ok: false, same: false }; }); }
    return wait(4); }
  function bootStale(st, then) { fromIdb().then(workerReplay).then(function () { if (booted) return; booted = true; if (st) st.remove(); then(); setTimeout(function () { revalidate(0); }, 50); }); }
  function boot(then) { var st = document.getElementById('v2boot');
    if (fromSession()) { fromIdb().then(workerReplay).then(function () { if (booted) return; booted = true; if (st) st.remove(); then(); }); return; }
    if (/[?&]fresh=1/.test(location.search)) return run(st, then);
    if (fromLast()) return bootStale(st, then);
    fromStatic().then(function (ok) { if (ok) bootStale(st, then); else run(st, then); }); }
  /** refresh(cb): re-read the chain (new confirmed burns, e.g. your roll) and call cb() when the tip or burn count changed. */
  function refresh(cb) { var n = S.rows.length, t = S.tip, sig = function () { return (S.mempool || []).map(function (x) { return x.tx_hash; }).join(); }, m = sig(); return load(true).then(fromIdb).then(workerReplay).then(function () { if (S.rows.length !== n || S.tip !== t || sig() !== m) cb(); }, function () {}); }
  window.V2Mock = { KEY: KEY, ME: ME, NPCS: [], prod: true, state: function () { return S; }, save: save, burn: burn, adv: function () {}, world: world, whenFresh: whenFresh, seed: function () {}, boot: boot, refresh: refresh };
})();
