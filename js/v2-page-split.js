/* species-ranks-split (owner Oct 24 2026): the three game places each have their own page (built from templates/game.html by
 * tools/build-game-pages.js). Navigation only, no burns, no rule changes.
 *  play.html      = hatch, My Pets, community pet, burns + a "Places to go" card     body data-split="play"
 *  fight.html     = X Circus Kekimus (battles)                                       body data-split="fight"
 *  rare-room.html = The Rare Room (gear, Pepe Wheel)                                 body data-split="rare"
 *  breed.html     = Gooby's No-Tail Motel (breeding)                                 body data-split="breed"
 * Old links keep working: any page's #battle-ID / #replay-N / #kekimus -> fight.html, #rare-room(-ID) / #lair / #drip-den / #dressing-room
 * -> rare-room.html, #breed-ID / #gooby-inn / #no-tail-motel -> breed.html (same hash, so js/v2-preselect.js, UXB.battleWith and
 * js/scene-hash.js run there exactly as before). Loaded before js/v2-preselect.js. */
(function () {
  'use strict';
  var R = [['fight', 'fight.html', /^#(kekimus|battle-\d+|replay-\d+)$/], ['rare', 'rare-room.html', /^#(rare-room|rare-room-\d+|lair|drip-den|dressing-room)$/],
    ['breed', 'breed.html', /^#(no-tail-motel|gooby-inn|breed-\d+)$/]];
  function mode() { return (document.body && document.body.getAttribute('data-split')) || 'play'; }
  function want(h) { for (var i = 0; i < R.length; i++) if (R[i][2].test(h)) return R[i]; return null; }
  function route() { var h = location.hash || '', w = want(h); if (!w || w[0] === mode()) return; location.replace(w[1] + location.search + h); }
  route(); window.addEventListener('hashchange', route);
  window.V2PageSplit = { mode: mode, want: function (h) { var w = want(h); return w ? w[0] : null; } };
})();
