/* XCPETS My Pets card tidy (Jake Nov 23 2026: "I dont like the dress buttons here, I want to click the pet, go to its pet card and see it there.
 * also these need cleaned up. the zombies make the card really long so maybe feeding them you need to click the card first").
 * Display only: CSS for the My Pets cards (the grid #pets and the phone 'One at a time' card #mpsBox). Nothing is removed from the game:
 * what a card no longer shows is on the pet's page (tap the card) and in the Open ▸ panel.
 *  - Two short chip rows: who it is (rarity, species, stage, token, era icon) and its numbers (power, score, rarity, gear slots, breeds, hunger).
 *    js/v2.js puts an <i class="cbr"> between them. Chips line up on one height (no stretched empty pills), the era icon is chip sized.
 *  - Off the card: "Not tokenized", "Full" / "Fed today" (a hungry pet still shows its meal chip), Gen N, how it was born (Hatched,
 *    Electric Egg, Bred from …), the Mythic-fed story line and "Raised by" on zombies.
 *  - Feed / breed / chores icons sit on the bottom row with Open ▸ and 🗑️ (desktop and tablet), so cards are shorter.
 *  Doom 2's falling candles and ash now fall behind the page content (css/doom-week.css), not over the cards. */
(function () {
  'use strict';
  if (typeof document === 'undefined' || document.getElementById('ctCss')) return;
  var C = '#pets .pet.card', M = '#mpsBox .pet.card';
  function both(sel) { return sel.split(',').map(function (s) { s = s.trim(); return C + ' ' + s + ',' + M + ' ' + s; }).join(','); }
  var css =
    /* chip rows: one height, no stretching, a forced break between "who" and "numbers" */
    both('.chips') + '{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:6px 0 4px}' +
    both('.chips > *') + '{order:3;margin:0!important;align-self:center}' +
    both('.zb-chiprow > *') + '{order:3;margin:0!important}' +
    both('.chips .cbr') + '{order:5;flex-basis:100%;height:0;display:block}' +
    both('.chips .tokmark, .chips .zb-risen, .chips .zb-halo, .chips .mg-fed, .chips .rare-badge') + '{order:1}' +
    both('.chips .pill.tier') + '{order:2}' +
    both('.chips .stg, .chips .era-badge') + '{order:4}' +
    both('.chips .fed.warn, .chips .warn, .chips .quest-chip, .chips .zb-hun') + '{order:6}' +
    both('.chips .pow') + '{order:7}' + both('.chips .psw') + '{order:8}' + both('.chips .prar') + '{order:9}' + both('.chips .gearchip') + '{order:10}' + both('.chips .brk') + '{order:11}' +
    both('.chips .chip, .chips .pill') + '{line-height:1.25;padding-top:2px;padding-bottom:2px;min-height:0;height:auto}' +
    both('.chips .era-badge') + '{width:20px;height:20px;padding:0;border:0;background:none;box-shadow:none;display:inline-flex;align-items:center;justify-content:center}' +
    both('.chips .era-badge svg') + '{width:18px;height:18px}' +
    both('.chips .tok-yes') + '{font-size:10px}' +
    /* zombie cards: the two rows become one wrap, same rules */
    both('.zb-groups') + '{display:flex;flex-direction:column;gap:4px}' + both('.zb-groups .zb-chiprow') + '{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:0;border:0;background:none}' +
    both('.zb-cta') + '{margin:4px 0 0;color:#ffb3b3;font-weight:700}' + both('.zb-cta.feral') + '{color:#ff6b6b}' +
    /* off the card (still on the pet page and in Open ▸) */
    both('.chips .tok-no, .chips .fed.ok, .chips .gen, .chips .origin, .mg-line, .zb-by, .zb-status, .zb-hbar, .zb-hl, .zb-help, .zb-zone') + '{display:none!important}' +
    /* bottom row: quick icons on the left, Open ▸ and 🗑️ on the right */
    '@media (min-width:601px){' + C + '{padding-bottom:48px}' + C + ' .lf-acts{position:absolute;left:8px;bottom:8px;margin:0;gap:4px;flex-wrap:nowrap}' + C + ' .lf-acts button{min-height:28px;height:28px;min-width:30px;padding:0 5px;font-size:12px}}';
  var s = document.createElement('style'); s.id = 'ctCss'; s.textContent = css; (document.head || document.documentElement).appendChild(s);
})();
