/* PRACTICE WALLET (practice-fun-1102). Loaded on practice.html right after js/v2-wallet.js and replaces the parts that would reach a wallet:
 * no XCP Wallet / Casa / Horizon window, no compose, no signing, no broadcast. "Burning" writes a pretend burn into this browser's practice
 * ledger (js/practice-engine.js) and mines it into the next pretend block at once, then the real page re-reads the pretend chain and replays it
 * with the real rules, so the hatch reveal, feeding, gear, fights and breeding all play exactly like the real game. */
(function () {
  'use strict';
  var W = window, XP = W.XcpPractice, V = W.V2Wallet; if (!XP || !V) return;
  var ME = XP.ME, NAME = 'Practice wallet';
  try { localStorage.setItem('xcpets-v2-me', ME); localStorage.setItem('xcpets-xcpwallet-address', ME); } catch (e) {}
  var refreshT = null;
  function refreshSoon() { clearTimeout(refreshT); refreshT = setTimeout(function () { try { var M = W.V2Mock; if (M && M.refresh) M.refresh(function () { try { if (W.V2UI && W.V2UI.render) W.V2UI.render(); } catch (e) {} try { W.dispatchEvent(new Event('xcpets:practice')); } catch (e) {} }); } catch (e) {} }, 250); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var busy = Promise.resolve();
  V.send = function (plan, viewed, onTry) {
    if (window.XcpMaint && XcpMaint.on()) return Promise.reject(XcpMaint.err());
    if (viewed && viewed !== ME) return Promise.reject(new Error('Practice plays as the practice wallet only.'));
    var run = busy.then(function () {
      try { onTry && onTry(1, 1, 'build'); } catch (e) {}
      return wait(120).then(function () { try { onTry && onTry(1, 1, 'sign', { text: 'Pretend burn, free' }); } catch (e) {} return wait(60); }).then(function () {
        var r = XP.burn(plan); refreshSoon(); return { txid: r.txid, composed: { practice: true, block: r.block } }; }); });
    busy = run.catch(function () {}); return run; };
  V.sendDex = function () { if (window.XcpMaint && XcpMaint.on()) return Promise.reject(XcpMaint.err()); return Promise.reject(new Error('Trading is real-wallet only. Practice is for hatching, feeding, gear, fights and breeding.')); };
  V.connect = function () { return Promise.resolve(ME); };
  V.getWallet = function () { return Promise.resolve({ address: ME, w: { label: NAME } }); };
  V.current = function () { return ME; };
  V.label = function () { return NAME; };
  V.status = function () { return 'on'; };
  V.silent = function () { return Promise.resolve(ME); };
  V.autoBoot = function () {};
  V.inCasa = function () { return false; };
  V.hasWallet = function () { return true; };
  V.pollPending = function () { return Promise.resolve(0); };
  V.feeRate = function () { return Promise.resolve(1); };
  V.feeQuote = function () { return Promise.resolve({ rate: 1, sats: 0, text: 'free (practice)' }); };
  V.feeEstimate = function () { return 0; };
  V.feeInfo = function () { return { rate: 1, text: 'free (practice)' }; };
  V.rateText = function () { return 'free (practice)'; };
  V.allowUnconfirmedOnce = function () {};
  V.cancel = function () {};
  V.paint = function (me, $) { try { var m = $('me'); if (m) m.textContent = 'Practice wallet (pretend XCPETS)'; var c = $('wconnect'); if (c) { c.textContent = '✓ Practice wallet'; c.disabled = true; } } catch (e) {} };
  W.addEventListener('xcpets:practice-refresh', refreshSoon);
})();
