/* calm-first-screen (Nov 1 2026, owner-approved critique plan item 1): the full risk warning is in the page footer and on every signing
 * sheet; on a device's FIRST visit it is also shown once as a small notice at the bottom, until "Got it" (remembered per device in
 * localStorage 'xcpets-risk-seen-v1'). Automated browsers (navigator.webdriver: the test suite) skip it so it never covers a button
 * under test; ?risknote=1 forces it, ?risknote=0 hides it. UI only: no game rule reads this file. */
(function () {
  'use strict';
  var KEY = 'xcpets-risk-seen-v1';
  var FULL = '⚠️ This is experimental software. Token burns are irreversible. You can lose XCPETS and Bitcoin transaction fees. No one guarantees this game will work as expected or that the token will retain any value. Use at your own risk.';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function flag() { var m = /[?&]risknote=([01])/.exec(location.search); return m ? m[1] : null; }
  function want() { var f = flag(); if (f) return f === '1'; return !get(KEY) && !navigator.webdriver; }
  /* never stack on another first-visit card: wait while Coach Peepo's welcome (.tut-tip) or a sheet (.reveal.on) is open */
  function busy() { return !!document.querySelector('.tut-tip, .reveal.on'); }
  var waitT = null;
  function show() { if (!want() || document.getElementById('riskNote')) return;
    if (busy()) { if (!waitT) waitT = setInterval(function () { if (!busy()) { clearInterval(waitT); waitT = null; show(); } }, 1200); return; }
    var n = document.createElement('div'); n.id = 'riskNote'; n.setAttribute('role', 'note'); n.setAttribute('aria-label', 'Risk warning');
    n.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:880;max-width:760px;margin:0 auto;display:flex;gap:10px;align-items:center;padding:8px 12px;border:2px dashed #ff5a5a;border-radius:12px;background:#1a0f0f;color:#ff9a9a;font-size:12.5px;line-height:1.45;box-shadow:0 4px 18px rgba(0,0,0,.5)';
    var t = document.createElement('span'); t.textContent = FULL; t.style.flex = '1';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'q'; b.textContent = 'Got it'; b.style.cssText = 'flex:none;white-space:nowrap';
    b.onclick = function () { set(KEY, String(Date.now())); n.parentNode && n.parentNode.removeChild(n); };
    n.appendChild(t); n.appendChild(b); document.body.appendChild(n); }
  window.XCCalm = { KEY: KEY, FULL: FULL, want: want, show: show };
  function start() { setTimeout(show, 1500); } /* after the page's own first-visit cards have had a chance to open */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
