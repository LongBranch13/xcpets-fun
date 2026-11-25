/* PET YOUR PET (Nov 23 2026, owner "who does it best" list, item 6: "pets that idle and react to taps", Balatro / Tamagotchi).
 * DISPLAY ONLY: nothing is signed, nothing on chain changes, no burn is ever suggested.
 * On a pet's page (pet.html, #cv) the big sprite breathes gently. Tap it: it hops, pixel hearts and sparkles burst out, a pop number floats up
 * ("+1 ❤"), the pet says a meme line in a speech bubble, and a blip plays if the player's sound is on. Tap fast for a combo (x2, x3 ... up to
 * x10 = "MAXIMUM VIBES"). A per-browser count (localStorage 'xcpets-pets-<id>') shows "petted N times". Dead pets get a respectful "F" instead.
 * prefers-reduced-motion: no breathing, no hop; the bubble and count still show. */
(function (root) {
  'use strict';
  var d = root.document; if (!d) return;
  var SAY = {
    any: ['gm', 'wagmi', 'ser, this is a pet', 'stay humble, stack blocks', 'few understand', 'wen moon', 'not financial advice', 'bullish on you', 'i was here before the halving', 'touch grass? no. touch me.', 'hodl me', 'based', 'chain says i’m a good pet', 'ok one more pat'],
    hungry: ['bro i haven’t eaten in blocks', 'pats are nice but food is nicer', 'feed me and i’ll love you forever'],
    mythic: ['i am eternal', 'mortals pet me now?', 'MYTHIC VIBES'],
    combo: ['MORE', 'again again', 'ok ok OK', 'vibes rising', 'MAXIMUM VIBES']
  };
  /* species-registry (Nov 25 2026): each species' own lines live on its entry in js/species-registry.js (tap) */
  if (root.XcpSpecies) root.XcpSpecies.LIST.forEach(function (s) { if (s.tap && s.tap.length && !SAY[s.id]) SAY[s.id] = s.tap; });
  var RM = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function pid() { var m = /[?&]id=(\d+)/.exec(location.search) || /\/pet\/(\d+)/.exec(location.pathname); return m ? +m[1] : null; }
  function pet() { try { var w = root.V2Mock && V2Mock.world && V2Mock.world(), id = pid(); return w && w.byId ? w.byId[id] : null; } catch (e) { return null; } }
  function pick(L) { return L[Math.floor(Math.random() * L.length)]; }
  function count(id, add) { var k = 'xcpets-pets-' + id, n = 0; try { n = +(localStorage.getItem(k) || 0); if (add) localStorage.setItem(k, String(n += add)); } catch (e) { } return n; }
  function css() { if (d.getElementById('ptCss')) return; var s = d.createElement('style'); s.id = 'ptCss'; s.textContent =
    '.pt-wrap{position:relative;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
    '.pt-breathe{animation:ptBreathe 2.4s steps(2) infinite;transform-origin:50% 100%}@keyframes ptBreathe{50%{transform:scaleY(.985) scaleX(1.01)}}' +
    '.pt-hop{animation:ptHop .42s steps(5)!important;transform-origin:50% 100%}@keyframes ptHop{0%{transform:scale(1.05,.9)}35%{transform:translateY(-14%) scale(.95,1.06)}70%{transform:translateY(0) scale(1.06,.92)}100%{transform:none}}' +
    '.pt-fx{position:absolute;pointer-events:none;font:16px/1 "Press Start 2P",monospace;color:#ff4f7a;text-shadow:2px 2px 0 #000;animation:ptUp .9s steps(9) forwards;z-index:3}' +
    '@keyframes ptUp{to{transform:translate(var(--dx),-90px);opacity:0}}' +
    '.pt-pop{position:absolute;left:50%;top:18%;transform:translateX(-50%);pointer-events:none;font:22px Bangers,Impact,sans-serif;letter-spacing:1px;color:#ffe27a;text-shadow:3px 3px 0 #000;animation:ptPop .8s steps(6) forwards;z-index:4;white-space:nowrap}' +
    '@keyframes ptPop{0%{transform:translateX(-50%) scale(.4)}30%{transform:translateX(-50%) scale(1.25)}100%{transform:translate(-50%,-50px);opacity:0}}' +
    '.pt-say{position:absolute;left:50%;top:6px;transform:translateX(-50%);max-width:88%;background:#fff;color:#16141f;border:3px solid #000;border-radius:10px;padding:6px 10px;font:15px/1.25 "Comic Neue",var(--comic,sans-serif);font-weight:700;box-shadow:3px 3px 0 #000;z-index:5;pointer-events:none;text-align:center}' +
    '.pt-say::after{content:"";position:absolute;left:50%;bottom:-10px;border:7px solid transparent;border-top-color:#000;transform:translateX(-50%)}' +
    '.pt-count{position:absolute;right:6px;bottom:6px;font:9px "Press Start 2P",monospace;color:#fff;background:rgba(0,0,0,.6);padding:4px 6px;border-radius:6px;pointer-events:none;z-index:3}' +
    '.pt-hint{position:absolute;left:6px;bottom:6px;font:9px "Press Start 2P",monospace;color:#ffe27a;background:rgba(0,0,0,.6);padding:4px 6px;border-radius:6px;pointer-events:none;z-index:3;animation:ptBlink 1.2s steps(2) infinite}@keyframes ptBlink{50%{opacity:.4}}' +
    '@media (prefers-reduced-motion:reduce){.pt-breathe,.pt-hop,.pt-fx,.pt-pop,.pt-hint{animation:none!important}.pt-fx,.pt-pop{display:none}}';
    d.head.appendChild(s); }
  var combo = 0, lastTap = 0, sayT = 0;
  function tap(e, box, cv) { var p = pet(), id = pid(); if (id == null) return; var now = Date.now(); combo = now - lastTap < 700 ? Math.min(10, combo + 1) : 1; lastTap = now;
    var hint = box.querySelector('.pt-hint'); if (hint) hint.remove();
    if (p && p.dead) { say(box, 'F. Press F to pay respects.'); return; }
    var n = count(id, 1), S = root.V2Sfx;
    if (!RM.matches) { cv.classList.remove('pt-hop'); void cv.offsetWidth; cv.classList.add('pt-hop');
      var r = box.getBoundingClientRect(), ex = e && e.clientX != null ? e.clientX - r.left : r.width / 2, ey = e && e.clientY != null ? e.clientY - r.top : r.height / 2, k = Math.min(3 + combo, 9);
      for (var i = 0; i < k; i++) { var f = d.createElement('span'); f.className = 'pt-fx'; f.textContent = i % 3 === 2 ? '✦' : '♥'; f.style.left = (ex - 8 + (Math.random() * 30 - 15)) + 'px'; f.style.top = (ey - 8) + 'px';
        f.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px'); f.style.color = i % 3 === 2 ? '#ffe27a' : i % 2 ? '#ff8fd8' : '#ff4f7a'; f.style.animationDelay = (i * 0.04) + 's'; box.appendChild(f); setTimeout(f.remove.bind(f), 1300); }
      Array.prototype.forEach.call(box.querySelectorAll('.pt-pop'), function (o) { o.remove(); }); var pop = d.createElement('span'); pop.className = 'pt-pop'; pop.textContent = combo >= 10 ? 'MAXIMUM VIBES' : combo > 1 ? '+1 ♥ x' + combo : '+1 ♥'; box.appendChild(pop); setTimeout(pop.remove.bind(pop), 900); }
    if (S) try { if (combo >= 10 && S.reveal) S.reveal(3); else if (S.blip) S.blip(); } catch (er) { }
    var L = SAY.any; if (p) { if (p.stage >= 5 || p.mythicCare) L = SAY.mythic.concat(L); else if (p.hungry) L = SAY.hungry.concat(SAY.hungry, L); var sp = String(p.species || '').replace(/^hyb3?:([a-z]+).*/, '$1'); if (SAY[sp]) L = SAY[sp].concat(SAY[sp], L); }
    if (combo >= 3) L = SAY.combo; say(box, combo >= 10 ? 'MAXIMUM VIBES' : pick(L));
    var c = box.querySelector('.pt-count'); if (c) c.textContent = '♥ ' + n.toLocaleString('en-US'); }
  function say(box, t) { var b = box.querySelector('.pt-say'); if (!b) { b = d.createElement('div'); b.className = 'pt-say'; box.appendChild(b); } b.textContent = t; clearTimeout(sayT); sayT = setTimeout(function () { b.remove(); }, 2200); }
  function hook() { var cv = d.getElementById('cv'), box = cv && cv.parentNode; if (!cv || !box || box.__pt) return !!(box && box.__pt); var id = pid(); if (id == null) return true;
    css(); box.__pt = 1; box.classList.add('pt-wrap'); if (!RM.matches) cv.classList.add('pt-breathe');
    var n = count(id, 0), c = d.createElement('span'); c.className = 'pt-count'; c.textContent = '♥ ' + n.toLocaleString('en-US'); box.appendChild(c);
    if (!n) { var h = d.createElement('span'); h.className = 'pt-hint'; h.textContent = 'tap to pet'; box.appendChild(h); }
    box.setAttribute('role', 'button'); box.setAttribute('tabindex', '0'); box.setAttribute('aria-label', 'Pet this pet');
    box.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a,button,input')) return; tap(e, box, cv); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(null, box, cv); } });
    return true; }
  var tries = 0, t = setInterval(function () { if (hook() || ++tries > 120) clearInterval(t); }, 500);
  root.V2PetTap = { SAY: SAY, hook: hook };
})(typeof window !== 'undefined' ? window : this);
