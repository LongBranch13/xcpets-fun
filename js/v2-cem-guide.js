/* XCPETS Pet Cemetery guide (Nov 22 2026, Jake: "all the workings there need to be more intuitive"). Display only; never read by replay.
 * 1) V2CemGuide.mount(before, V): the "How the Cemetery works" box: the whole cycle as four tappable steps (a pet dies, raise it, keep it fed,
 *    resurrect it) plus the two side paths (feral, the Mythic God path), with one plain sentence per step. Open on the first visit in this
 *    browser, folded to one line after that. Numbers come from the live rules (V.CEM), so the text follows the rules.
 * 2) V2CemGuide.time(blocks): blocks as plain time ("2d 4h", "5h", "40 min"); one block is about 10 minutes, 144 blocks a game day.
 * The five words used on the cemetery page: Sacrifice, Raise, Feral, Halo points, Resurrect. Chain memos stay as they are. */
(function () {
  'use strict';
  var SEEN = 'xcpets-cemhow-seen';
  function time(n) { n = Math.max(0, Math.round(Number(n) || 0)); var m = n * 10, d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d) return d + 'd' + (h ? ' ' + h + 'h' : ''); if (h) return h + 'h' + (mm && h < 3 ? ' ' + mm + 'm' : ''); return mm ? mm + ' min' : 'now'; }
  function days(n) { var d = Math.round((Number(n) || 0) / 144); return d + ' day' + (d === 1 ? '' : 's'); }
  function icon(name) { return window.V2CemArt ? '<img class="cemhow-ico" src="' + V2CemArt.url(name) + '" width="48" height="48" alt="" aria-hidden="true">' : ''; }
  function steps(V) { var C = (V && V.CEM) || {}, P = C.POINTS || [1, 3, 10, 33], feral = days(C.FERAL || 432), crumble = days(C.CRUMBLE || 432), min = C.RES_MIN || 25;
    return {
      die: { n: 1, ico: 'grave', t: 'A pet dies', s: '7 days with no food', x: '<b>A pet that goes 7 days without a meal dies</b> and gets a grave here. Mythic pets never starve. Most graves fade after 14 days; Legendary and Mythic pets, rare species, hybrids, special and weird pets stay (<a href="rules-short.html">full list</a>). A dead pet\u2019s gear goes back to its owner\u2019s stash unless the owner left it on the grave.' },
      raise: { n: 2, ico: 'candle', t: 'Raise it', s: 'sacrifice unwanted pets', x: '<b>Raise any grave, even another player’s, by sacrificing pets from your Discard pile.</b> The zombie is yours. Rarer graves need a rarer sacrifice (each grave says what it needs). More and rarer sacrifices make a stronger zombie, up to 3 times what the pet had when it died.' },
      feed: { n: 3, ico: 'zombie', t: 'Keep it fed', s: 'a meal every ' + feral, x: '<b>Feed your zombie at least every ' + feral + '</b> by sacrificing a Discarded pet to it. Every meal makes it stronger. Zombies fight in battles too, and take 2% of the loser’s power when they win.' },
      res: { n: 4, ico: 'halo', t: 'Resurrect', s: 'bring it back as a God', x: '<b>Sacrifice pets or gear to your zombie to collect halo points</b> (Common ' + P[0] + ', Uncommon ' + P[1] + ', Rare ' + P[2] + ', Legendary ' + P[3] + '). At ' + min + ' points you can try a Resurrection: win and it lives again as a God, for good; miss and it turns to dust. More points, better odds.' },
      feral: { ico: 'feral', t: 'Forget to feed it?', s: 'It goes FERAL. Other players can hunt it.', x: '<b>' + feral + ' without a meal and your zombie goes FERAL.</b> Any player can hunt it, and if their pet wins the zombie becomes theirs. ' + crumble + ' later an unfed feral zombie crumbles to dust and is <b>gone forever</b>: no grave, no second raise.' },
      mythic: { ico: 'mgrave', t: 'The Mythic God path', s: 'Unleash a feral zombie on your Mythic.', x: '<b>Unleash your feral zombie on one of your Mythics</b> (once every 30 days, from its card in My Pets). It eats one of them and is cured for good. The Mythic leaves a violet grave: raise it with a Legendary sacrifice, then resurrect it (66 halo points) for a Mythic God and one of the 21 seats in <a href="pantheon.html">the Pantheon</a>.' } }; }
  function css() { if (document.getElementById('cemHowCss')) return; var s = document.createElement('style'); s.id = 'cemHowCss';
    s.textContent = '.cemhow{margin:10px 0;border:3px solid #000;box-shadow:3px 3px 0 #000;background:#1c1830;color:#f3ecd8}' +
      '.cemhow>summary{cursor:pointer;padding:8px 12px;font-family:Bangers,Impact,sans-serif;font-size:22px;letter-spacing:.05em;color:#ffc93c;text-shadow:2px 2px 0 #000;list-style:none}' +
      '.cemhow>summary::-webkit-details-marker{display:none}.cemhow>summary::after{content:" \\25BE";color:#f3ecd8}.cemhow[open]>summary::after{content:" \\25B4"}' +
      '.cemhow-body{display:flex;flex-direction:column;gap:10px;padding:0 12px 12px}' +
      '.cemhow-loop{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.cemhow-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
      '.cemhow-n{position:relative;background:#2f2a4a;color:#f3ecd8;border:3px solid #000;box-shadow:3px 3px 0 #000;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;cursor:pointer;font:inherit}' +
      '.cemhow-n:focus-visible{outline:3px solid #fff3b0;outline-offset:2px}.cemhow-n[aria-pressed=true]{background:#3b3460;box-shadow:3px 3px 0 #000,inset 0 0 0 3px #7dff6a}' +
      '.cemhow-loop .cemhow-n:not(:last-child)::after{content:"";position:absolute;right:-13px;top:50%;width:12px;height:4px;background:#ffc93c;box-shadow:0 2px 0 #000}' +
      '.cemhow-k{font-family:"Press Start 2P",monospace;font-size:8px;color:#ffc93c}.cemhow-t{font-family:Bangers,Impact,sans-serif;font-size:20px;letter-spacing:.05em;line-height:1.05}.cemhow-s{font-size:13px;line-height:1.25;color:#b9b4d0}' +
      '.cemhow-ico{image-rendering:pixelated;image-rendering:crisp-edges}.cemhow-side .cemhow-n{flex-direction:row;text-align:left}.cemhow-side .cemhow-n>span{display:flex;flex-direction:column;gap:2px}' +
      '.cemhow-x{background:#0f0d1e;border:3px dashed #b9b4d0;padding:8px 10px;font-size:15px;line-height:1.45}.cemhow-x b{color:#7dff6a}.cemhow-x a{color:#9fe8ff}' +
      '@media (max-width:640px){.cemhow-loop{grid-template-columns:repeat(2,minmax(0,1fr))}.cemhow-loop .cemhow-n:nth-child(2)::after{display:none}.cemhow-side{grid-template-columns:1fr}}';
    document.head.appendChild(s); }
  function node(k, d, side) { return '<button type="button" class="cemhow-n" data-how="' + k + '" aria-pressed="false">' + (side ? icon(d.ico) + '<span><span class="cemhow-t">' + d.t + '</span><span class="cemhow-s">' + d.s + '</span></span>'
    : '<span class="cemhow-k">' + d.n + '</span>' + icon(d.ico) + '<span class="cemhow-t">' + d.t + '</span><span class="cemhow-s">' + d.s + '</span>') + '</button>'; }
  /** mount(before, V): inserts the guide before the element `before` (once). */
  function mount(before, V) { if (!before || !before.parentNode || document.getElementById('cemHow')) return; css(); var S = steps(V), seen = false;
    try { seen = !!localStorage.getItem(SEEN); localStorage.setItem(SEEN, '1'); } catch (e) {}
    var el = document.createElement('details'); el.className = 'cemhow'; el.id = 'cemHow'; if (!seen) el.open = true;
    el.innerHTML = '<summary>📖 How the Cemetery works</summary><div class="cemhow-body"><div class="cemhow-loop" role="group" aria-label="The cemetery cycle">' + ['die', 'raise', 'feed', 'res'].map(function (k) { return node(k, S[k]); }).join('') + '</div>' +
      '<div class="cemhow-side">' + node('feral', S.feral, 1) + node('mythic', S.mythic, 1) + '</div><div class="cemhow-x" id="cemHowX" aria-live="polite"></div></div>';
    before.parentNode.insertBefore(el, before);
    function pick(k) { el.querySelectorAll('[data-how]').forEach(function (n) { n.setAttribute('aria-pressed', n.getAttribute('data-how') === k ? 'true' : 'false'); }); el.querySelector('#cemHowX').innerHTML = S[k].x; }
    el.addEventListener('click', function (e) { var n = e.target.closest('[data-how]'); if (n) pick(n.getAttribute('data-how')); });
    pick('raise'); return el; }
  window.V2CemGuide = { mount: mount, time: time };
})();
