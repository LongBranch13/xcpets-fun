/* XCPETS HOLDER WELCOME GIFT (Nov 28 2026, Jake picked "a one-time free starter pack for holders who never played").
 * On Play, for a connected wallet on the rules' fixed holder list (V2Rules.welcomeInfo / WELCOME_LIST, 97 wallets that held XCPETS at block
 * 977,947 and had never played): one card at the top of the page.
 *   before the gate   "Your free starter pack unlocks in about N hours" (nothing to sign yet)
 *   open, unclaimed    CLAIM -> one pet:welcome plan (1 dander) through the normal confirm sheet; the rules' own check (sendWhy) runs first
 *   claimed            "Your 3 eggs are in My Pets: feed each once to hatch it, the Pantry pays" until the player closes it
 * Wallets not on the list never see anything. Nothing here signs: the wallet does, after the player approves. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.V2Welcome = api;
  if (root && root.document) api.start();
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  var d = root && root.document, SEEN = 'xcpets-welcome-done', WAIT = 'xcpets-welcome-wait', last = '';
  function $(id) { return d.getElementById(id); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function hours(blocks) { var h = Math.max(1, Math.round(blocks * 10 / 60)); return h < 48 ? 'about ' + h + ' hour' + (h === 1 ? '' : 's') : 'about ' + Math.round(h / 24) + ' days'; }
  /** view(I, nb, waiting, dismissed): what the card says, or null when it shows nothing. Pure (node-tested, tools/welcome-gift-page-test.js). */
  function view(I, nb, waiting, dismissed) {
    if (!I || !I.listed) return null;
    if (I.claimed) return dismissed ? null : { k: 'done', title: 'YOUR STARTER PACK IS HERE!', text: 'Your ' + I.eggs + ' eggs are in My Pets (the last one is a Golden Egg). Feed each one once to hatch it: your Pantry already holds ' + I.meals + ' free meals for that.', btn: '🥚 SEE MY EGGS' };
    if (!I.on) return I.gate ? { k: 'soon', title: 'A FREE STARTER PACK IS WAITING', text: 'You held XCPETS before you ever played, so your wallet gets a one-time gift: ' + I.eggs + ' Eggs (one Golden) + ' + I.meals + ' meals to hatch them. It unlocks in ' + hours(I.gate - nb) + '.', btn: null } : null;
    if (!I.open) return null;
    if (waiting) return { k: 'wait', title: 'YOUR GIFT IS ON ITS WAY', text: 'The next Bitcoin block rolls your eggs (usually about 10 minutes). They show up in My Pets by themselves.', btn: null };
    return { k: 'claim', title: 'WELCOME, HOLDER!', text: 'You held XCPETS before you ever played, so here is a one-time free starter pack: ' + I.eggs + ' Eggs (the last one a Golden Egg, best of 3 rolls) + ' + I.meals + ' meals in your Pantry to hatch them. Claiming signs one tiny burn: 1 dander of XCPETS plus the Bitcoin fee. ' + I.daysLeft + ' day' + (I.daysLeft === 1 ? '' : 's') + ' left to claim.', btn: '🎁 CLAIM MY STARTER PACK' };
  }
  function css() { if ($('wgCss')) return; var s = d.createElement('style'); s.id = 'wgCss'; s.textContent =
    '#welcomeGift{margin:10px 0;padding:12px 14px;border:4px solid #000;border-radius:14px;background:linear-gradient(135deg,#fff3b0,#ffcf40);color:#2b2b2b;box-shadow:5px 5px 0 #000;display:flex;gap:12px;align-items:center;flex-wrap:wrap}' +
    '#welcomeGift .wg-ico{font-size:52px;line-height:1;filter:drop-shadow(2px 2px 0 #000)}#welcomeGift .wg-b{flex:1 1 240px;min-width:0}' +
    '#welcomeGift .wg-t{font:26px/1.05 Bangers,Impact,sans-serif;letter-spacing:1px;color:#7a3cff;text-shadow:2px 2px 0 #fff}#welcomeGift .wg-t sup{font-size:.5em}' +
    '#welcomeGift .wg-x{font-size:14px;line-height:1.35;margin-top:4px}#welcomeGift .wg-go{font:20px Bangers,Impact,sans-serif;letter-spacing:1px;padding:10px 14px;border:3px solid #000;border-radius:12px;background:#55c35a;color:#fff;text-shadow:2px 2px 0 #000;box-shadow:0 4px 0 #000;cursor:pointer;white-space:nowrap}' +
    '#welcomeGift .wg-close{background:none;border:0;font-size:18px;cursor:pointer;align-self:flex-start}' +
    '#welcomeGift.wg-claim .wg-ico{animation:wgBob .6s steps(2) infinite}@keyframes wgBob{50%{transform:translateY(-4px) rotate(-6deg)}}' +
    '@media (max-width:640px){#welcomeGift .wg-go{flex:1 1 100%}}@media (prefers-reduced-motion:reduce){#welcomeGift.wg-claim .wg-ico{animation:none}}';
    d.head.appendChild(s); }
  function chain() { var V = root.V2Rules, U = root.V2UI; if (!V || !V.welcomeInfo || !U || !U.world || !U.ME) return null; var w; try { w = U.world(); } catch (e) { return null; } if (!w) return null;
    var nb = (w.tip || 0) + 1, I = V.welcomeInfo(w, U.ME, nb); return I ? { V: V, U: U, w: w, nb: nb, I: I } : null; }
  function waiting(me) { var x = ls(WAIT); return !!x && x.split('|')[0] === me && Date.now() - (+x.split('|')[1] || 0) < 3 * 3600e3; }
  function paint() { var c = chain(), el = $('welcomeGift');
    var v = c ? view(c.I, c.nb, waiting(c.U.ME), ls(SEEN) === c.U.ME) : null, key = v ? v.k + v.text : '';
    if (c && c.I.claimed && waiting(c.U.ME)) ls(WAIT, null);
    if (!v) { if (el) el.remove(); last = ''; return; } if (el && key === last) return; last = key; css();
    if (!el) { el = d.createElement('section'); el.id = 'welcomeGift'; el.setAttribute('aria-label', 'Holder welcome gift'); var main = d.querySelector('main'); if (!main) return;
      if (!(root.XcpTopStrip && XcpTopStrip.mountMain(el, 5))) main.insertBefore(el, main.firstChild); el.addEventListener('click', click); }
    el.className = 'wg-' + v.k;
    el.innerHTML = '<div class="wg-ico" aria-hidden="true">' + (v.k === 'done' ? '🥚' : v.k === 'wait' ? '⛏️' : '🎁') + '</div><div class="wg-b"><div class="wg-t">' + v.title + '<sup>®</sup></div><div class="wg-x">' + v.text + '</div></div>' +
      (v.btn ? '<button type="button" class="wg-go" data-wg="' + v.k + '">' + v.btn + '</button>' : '') + (v.k === 'done' ? '<button type="button" class="wg-close" data-wg="close" aria-label="Close">✕</button>' : ''); }
  function click(e) { var b = e.target.closest('[data-wg]'); if (!b) return; var k = b.getAttribute('data-wg'), c = chain(); if (!c) return;
    if (k === 'close') { ls(SEEN, c.U.ME); return paint(); }
    if (k === 'done') { ls(SEEN, c.U.ME); paint(); var eg = c.I.rec && c.I.rec.eggs; if (eg && eg.length && c.U.detail) return c.U.detail(eg[eg.length - 1]); var pp = $('petsPanel'); if (pp) pp.scrollIntoView({ behavior: 'smooth' }); return; }
    if (k === 'claim') { if (c.U.viewBlock && c.U.viewBlock()) return; var plan = c.V.welcomePlan(), why = c.U.sendWhy ? c.U.sendWhy(plan) : null;
      if (why) return c.U.toast ? c.U.toast('⚠️ ' + why) : null;
      c.U.confirmPlans('🎁 Holder welcome gift', [plan], function () { ls(WAIT, c.U.ME + '|' + Date.now()); paint(); }); } }
  function start() { if (!d || /practice/.test(location.pathname)) return; var go = function () { if (!d.body || d.body.getAttribute('data-split') !== 'play') return; paint(); setInterval(paint, 2500); };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go(); }
  return { view: view, paint: paint, start: start, chain: chain };
});
