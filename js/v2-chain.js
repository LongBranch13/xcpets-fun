/* XCPETS v2 PRODUCTION chain adapter (replaces the demo's v2-mock.js; same V2Mock interface so every v2 page runs unchanged).
 * READ-ONLY: real XCPETS destroys from the Counterparty API the live site uses (rjs/config.js -> api.xcp.fun/node/v2, then counterparty.io),
 * replayed by V2Rules with the FROZEN live engine (window.LiveEngine.RealCore) for every burn at or before CUTOFF_BLOCK (971,500).
 * Burns go through js/v2-wallet.js (live compose + XCP Wallet signing); this file only reads. Local equips are saved per device. */
(function () {
  'use strict';
  var V = window.V2Rules, E = window.LiveEngine, KEY = 'xcpets-v2-prod', HKEY = 'xcpets-v2-prod-hashes';
  function q(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
  var ME = q('addr') || (function () { try { return localStorage.getItem('xcpets-v2-me') || ''; } catch (e) { return ''; } })();
  if (q('addr')) try { localStorage.setItem('xcpets-v2-me', ME); } catch (e) {}
  var loc = (function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  var S = { rows: [], hashes: {}, ops: loc.ops || [], tip: 0, balance: 0, n: 0, sel: loc.sel || [], hide: loc.hide != null ? loc.hide : -1, hidden: loc.hidden || [], prod: true, mempool: [] };
  var cache = null, opsSig = null;
  /* hotfix 2 (2026-10-14): save() used to drop the replay cache on EVERY call (every checkbox / click), so each click re-replayed all
   * burns (4,086 pets) and re-rendered everything. Selection / hidden list don't change the world: only a change in the local ops does. */
  function save() { var j = JSON.stringify(S.ops || []); try { localStorage.setItem(KEY, JSON.stringify({ ops: S.ops, sel: S.sel, hide: S.hide, hidden: S.hidden || [] })); } catch (e) {} if (j !== opsSig) cache = null; }
  function world() { if (!cache) { cache = V.replay(S.rows, S.hashes, S.ops, { tip: S.tip, live: E.RealCore }); opsSig = JSON.stringify(S.ops || []); } return cache; }
  function burn() { var m = 'Burns from the v2 pages are not wired to a wallet in this build. Nothing was burned.'; try { var t = document.getElementById('toasts'); if (t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = m; t.appendChild(d); setTimeout(function () { d.remove(); }, 5000); } else alert(m); } catch (e) {} }
  /* hotfix 3: a short-TTL (60 s) sessionStorage copy of the burns + tip, so moving between pages doesn't re-read the whole chain;
   * refresh() always goes to the network. Block hashes were already cached in localStorage (HKEY). */
  var SKEY = 'xcpets-v2-prod-rows', STTL = 60000;
  function fromSession() { try { var c = JSON.parse(sessionStorage.getItem(SKEY)); if (!c || Date.now() - c.at > STTL || !c.rows) return false;
    var hc = JSON.parse(localStorage.getItem(HKEY)) || {}; if (!c.rows.every(function (x) { return hc[x.block_index]; })) return false;
    S.rows = c.rows; S.tip = c.tip; S.mempool = c.mempool || []; S.hashes = hc; if (c.me === ME) S.balance = c.balance || 0; else if (ME) return false; cache = null; return true; } catch (e) { return false; } }
  function toSession() { try { sessionStorage.setItem(SKEY, JSON.stringify({ at: Date.now(), rows: S.rows, tip: S.tip, mempool: S.mempool, me: ME, balance: S.balance })); } catch (e) {} }
  function load(force) {
    if (!force && fromSession()) return Promise.resolve();
    var chain = new E.Chain();
    var hc = (function () { try { return JSON.parse(localStorage.getItem(HKEY)) || {}; } catch (e) { return {}; } })();
    /* pending battles (2026-10-15): unconfirmed XCPETS destroys from the node mempool, for the battles box ONLY ('pending confirmation').
     * Never passed to V.replay, so no replay result can change. A failed read just means an empty list. */
    var mp = chain.getJson('/mempool/events/ASSET_DESTRUCTION?limit=1000').then(function (j) { return ((j && j.result) || []).map(function (e) { var x = e.params || {}, t = x.tag;
      if (typeof t === 'string' && /^([0-9a-f]{2})+$/i.test(t)) { try { t = decodeURIComponent(t.replace(/(..)/g, '%$1')); } catch (er) { } }
      return x.asset === E.CFG.asset && String(x.status || 'valid') === 'valid' ? { tx_hash: x.tx_hash || e.tx_hash, source: x.source, tag: t, amount: Number(x.quantity) / 1e8, at: e.timestamp ? e.timestamp * 1000 : null } : null; }).filter(Boolean); }, function () { return []; });
    return Promise.all([chain.destructions(E.CFG.asset), chain.tip().catch(function () { return null; }), mp]).then(function (r) { S.mempool = r[2] || [];
      var rows = r[0], tip = r[1], blocks = {}; rows.forEach(function (x) { blocks[x.block_index] = 1; });
      return chain.blockHashes(Object.keys(blocks), hc, tip).then(function (bh) {
        try { localStorage.setItem(HKEY, JSON.stringify(hc)); } catch (e) {}
        S.rows = rows; S.hashes = Object.assign({}, hc, bh.hashes); S.tip = tip || rows.reduce(function (a, x) { return Math.max(a, x.block_index); }, 0);
        if (ME) return chain.balance(ME, E.CFG.asset).then(function (b) { S.balance = Number(b) / 1e8; }, function () {});
      });
    }).then(function () { cache = null; toSession(); });
  }
  /* Boot with a clear failure state (2026-10-16): chain.js fails over quickly (6 s primary / 5 s backups, ~20 s worst case per request). If the read
   * fails, or is still running after BOOT_WATCH_MS, the spinner text becomes a message with a Retry button that re-runs the boot (no full reload;
   * location.reload() if anything throws). A late success still completes the boot. Data and replay are unchanged. */
  var BOOT_WATCH_MS = 30000, booted = false;
  function bootFail(st, then, why) { if (!st || booted) return; st.textContent = ''; st.className = 'small muted bootfail';
    var m = document.createElement('p'); m.textContent = "Couldn't reach the chain servers right now. Your pets are safe on chain."; m.style.margin = '6px 0';
    var d = document.createElement('p'); d.className = 'small muted'; d.textContent = why ? '(' + why + ')' : ''; d.style.margin = '0 0 6px';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'v2bootRetry'; b.textContent = 'Retry';
    b.onclick = function () { try { st.textContent = 'Reading XCPETS burns from the chain…'; st.className = 'small muted'; run(st, then); } catch (e) { location.reload(); } };
    st.appendChild(m); if (why) st.appendChild(d); st.appendChild(b); }
  function run(st, then) { var done = false, w = setTimeout(function () { if (!done) bootFail(st, then, 'still waiting for the chain servers'); }, BOOT_WATCH_MS);
    load(true).then(function () { done = true; clearTimeout(w); if (booted) return; booted = true; if (st) st.remove(); then(); },
      function (e) { done = true; clearTimeout(w); bootFail(st, then, e && e.message ? String(e.message).slice(0, 160) : ''); }); }
  function boot(then) { var st = document.getElementById('v2boot');
    if (fromSession()) { booted = true; if (st) st.remove(); then(); return; }
    run(st, then); }
  /** refresh(cb): re-read the chain (new confirmed burns, e.g. your roll) and call cb() when the tip or burn count changed. */
  function refresh(cb) { var n = S.rows.length, t = S.tip, sig = function () { return (S.mempool || []).map(function (x) { return x.tx_hash; }).join(); }, m = sig(); return load(true).then(function () { if (S.rows.length !== n || S.tip !== t || sig() !== m) cb(); }, function () {}); }
  window.V2Mock = { KEY: KEY, ME: ME, NPCS: [], prod: true, state: function () { return S; }, save: save, burn: burn, adv: function () {}, world: world, seed: function () {}, boot: boot, refresh: refresh };
})();
