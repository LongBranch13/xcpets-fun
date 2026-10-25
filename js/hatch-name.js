/* Hatch hub name (owner Oct 24 2026 10:30 PM CT: rename 'Pack Rips'). ONE constant: swap the name here (also the static fallback text in templates/game.html,
 * then run node tools/build-game-pages.js). Options (owner picked Hatch Eggs): Crack Attack, Yolk Rush, Egg Smash, Shell Yeah, The Cracklab. */
(function () { 'use strict'; var HATCH_HUB_NAME = 'Hatch Eggs'; window.HATCH_HUB_NAME = HATCH_HUB_NAME;
  function go() { var h = document.getElementById('hatchHubName'); if (h && h.textContent !== HATCH_HUB_NAME) h.textContent = HATCH_HUB_NAME; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); })();
