/* Tag safety (Nov 22 2026, plan item "show the memo before signing and block typos"). Display only: nothing is signed or sent here.
 *  1. Confirm burn sheet: every tag in the list gets a 📋 Copy button, so a player who burns by hand from a wallet pastes the exact
 *     tag instead of typing it (Evan nearly typed "pets:" by hand).
 *  2. Play page: "Burning by hand? Check your tag" reads a tag with the game's own parser (V2Rules.parseTag) and says what the
 *     burn would do, or warns before XCPETS are lost: not a game tag (only feeds the community pet) or a broken game tag. */
(function () {
  'use strict';
  var d = document;
  function $(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function copy(text, btn) {
    function done(ok) { if (!btn) return; var t = btn.textContent; btn.textContent = ok ? '✓ Copied' : 'Select it and copy'; setTimeout(function () { btn.textContent = t; }, 1400); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); } catch (e) { }
    try { var ta = d.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; d.body.appendChild(ta); ta.select(); var ok = d.execCommand('copy'); ta.remove(); done(ok); } catch (e2) { done(false); }
  }
  function css() {
    if ($('tcCss')) return; var s = d.createElement('style'); s.id = 'tcCss';
    s.textContent = '.tc-copy{font:inherit;font-size:11px;margin-left:6px;padding:1px 6px;border-radius:6px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;opacity:.8}' +
      '.tc-copy:hover{opacity:1}#tagCheck summary{cursor:pointer;font-weight:700}#tagCheck .tc-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}' +
      '#tagCheck input{flex:1 1 240px;min-width:0;font:14px ui-monospace,monospace;padding:8px;border-radius:8px;border:2px solid #2b2b2b}' +
      '#tagCheck .tc-out{padding:8px 10px;border-radius:8px;border:2px solid #2b2b2b}#tagCheck .tc-ok{background:rgba(70,200,120,.14)}' +
      '#tagCheck .tc-bad{background:rgba(255,91,91,.16);border-color:#ff5b5b}#tagCheck .tc-warn{background:rgba(255,200,60,.16);border-color:#e0a800}';
    d.head.appendChild(s);
  }
  /* 1. copy buttons on the confirm sheet */
  function arm(box) {
    box.querySelectorAll('#cfLog code').forEach(function (c) {
      if (c.nextSibling && c.nextSibling.className === 'tc-copy') return;
      var b = d.createElement('button'); b.type = 'button'; b.className = 'tc-copy'; b.textContent = '📋 Copy'; b.title = 'Copy this exact tag';
      b.onclick = function (e) { e.stopPropagation(); copy(c.textContent, b); }; c.parentNode.insertBefore(b, c.nextSibling);
    });
  }
  /* 2. the tag checker */
  var NAMES = { hatch: 'hatch one egg', feed: 'feed pet #{petId}', breed: 'breed #{a} with #{b}', zap: 'open an Electric Egg case', hd: 'discard pets for good', hu: 'add discarded pets back', fight: 'fight', roll: 'roll gear', spin: 'spin the Pepe Wheel' };
  function say(r, tag) {
    if (!tag) return '';
    if (!r || r.action === 'plain') {
      var near = /^\s*pets?\b|^\s*p[ea]t\b|^\s*pet\s/i.test(tag) || /^\s*[a-z]+:/i.test(tag);
      return '<div class="tc-out tc-warn">⚠️ <b>Not a game tag.</b> A burn with this memo does nothing for your pets: it only feeds the community pet.' +
        (near ? ' Game tags start with exactly <code>pet:</code> (no s, no spaces), like <code>pet:hatch</code> or <code>pet:feed:123</code>.' : '') + '</div>';
    }
    if (r.action === 'invalid' || r.action === 'rejected') return '<div class="tc-out tc-bad">🚫 <b>Broken game tag.</b> It starts like one but matches no action, so the game skips it and the XCPETS only feed the community pet. Check the spelling, the colons and the pet numbers.</div>';
    var n = NAMES[r.action], what = n ? n.replace(/\{(\w+)\}/g, function (m, k) { return r[k] != null ? r[k] : '?'; }) : r.action;
    return '<div class="tc-out tc-ok">✅ The game reads this as <b>' + esc(what) + '</b>' + (r.petId != null && !/#/.test(what) ? ' (pet #' + esc(r.petId) + ')' : '') +
      '. The rules still check the amount, the owner and the timing when it lands, so the page’s own buttons are the safest way to burn.</div>';
  }
  function checker() {
    if (!document.body || document.body.getAttribute('data-split') !== 'play' || /practice/.test(location.pathname) || $('tagCheck')) return;
    var anchor = $('pending'); anchor = anchor && anchor.closest('section'); if (!anchor || !window.V2Rules || !V2Rules.parseTag) return;
    css(); var box = d.createElement('details'); box.className = 'panel'; box.id = 'tagCheck';
    box.innerHTML = '<summary>✍️ Burning by hand from your wallet? Check your tag first</summary>' +
      '<p class="small">Paste the memo you are about to burn with. A typo can turn a burn into community food, and burns can’t be undone.</p>' +
      '<div class="tc-row"><input id="tcIn" type="text" autocomplete="off" spellcheck="false" placeholder="pet:feed:123" aria-label="Tag to check"></div><div id="tcOut" aria-live="polite"></div>';
    anchor.parentNode.insertBefore(box, anchor);
    var inp = $('tcIn'), out = $('tcOut');
    inp.addEventListener('input', function () { var t = inp.value; var r = null; try { r = V2Rules.parseTag(t); } catch (e) { r = { action: 'invalid' }; } out.innerHTML = say(r, t.trim()); });
  }
  function go() {
    var cb = $('confirmBox'); if (cb && window.MutationObserver) { css(); new MutationObserver(function () { arm(cb); }).observe(cb, { childList: true, subtree: true }); }
    checker();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
  window.V2TagCheck = { say: say, copy: copy };
})();
