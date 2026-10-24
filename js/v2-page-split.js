/* species-ranks-split (owner Oct 24 2026): Fighting and Breeding live on their own pages, like the shop. Navigation only, no burns, no rule changes.
 *  play.html  = hatch, My Pets, the Rare Room, community pet, burns   (arena + motel panels stay in the page, hidden, so every old flow still works)
 *  fight.html = X Circus Kekimus (battles)                              body data-split="fight"
 *  breed.html = Gooby's No-Tail Motel (breeding)                        body data-split="breed"
 * Old links keep working: play.html#battle-ID / #replay-N / #kekimus go to fight.html, play.html#breed-ID / #gooby-inn / #no-tail-motel go to breed.html
 * (same hash, so js/v2-preselect.js, UXB.battleWith and js/scene-hash.js run there exactly as before). Loaded before js/v2-preselect.js. */
(function () {
  'use strict';
  var FIGHT = /^#(kekimus|battle-\d+|replay-\d+)$/, BREED = /^#(no-tail-motel|gooby-inn|breed-\d+)$/;
  function mode() { return (document.body && document.body.getAttribute('data-split')) || 'play'; }
  function want(h) { return FIGHT.test(h) ? 'fight' : BREED.test(h) ? 'breed' : null; }
  function route() { var h = location.hash || '', w = want(h), m = mode(); if (!w || w === m) return;
    location.replace((w === 'fight' ? 'fight.html' : 'breed.html') + location.search + h); }
  route(); window.addEventListener('hashchange', route);
  window.V2PageSplit = { mode: mode, want: want };
})();
