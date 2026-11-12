/* MYTHIC GOD LOOP: the Pantheon page (pantheon.html) and Homer Pepe's Pantheon Odyssey. DISPLAY ONLY.
 * 21 seats from V2Rules.mgPantheon(world): a Mythic eaten by its owner's unleashed zombie, raised from its violet grave and resurrected,
 * takes the next open seat. Each seat has its own title and look (V2MythicGod.SEATS). The Odyssey adds one book per seat, built from
 * owner-approved line templates: the facts (names, species, the zombie, the seat, the blocks) are filled in, and each line's variant is picked
 * from the seat's hash (sha256 of the seat block and its tx), so every visitor reads the same verse. Nothing is generated live and nothing
 * mocks the player or the pet. Before ACTIVATE_MYTHIC_UNLEASH_BLOCK the page shows 21 empty seats (and ?demo=1 shows example seats).
 *
 * Seat ceremony (display only, same verse, rules file untouched): a seat whose tx is not the one this browser stored in
 * localStorage xcpets-pn-seen plays the existing mgrise-win overlay (js/v2-cem-anim.js + js/v2-mg-anim.js) once for every visitor,
 * then that seat glows and Homer sings the new book line by line. Skip and an 8s cap always dismiss the overlay, including
 * prefers-reduced-motion. ?demo=1&ceremony=1 runs it on one example seat and writes nothing. #seat-N and #book-N open that seat or book.
 */
(function () {
  'use strict';
  var V = window.V2Rules, MGd = function () { return window.V2MythicGod; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function sha(s) { try { return PetCore.sha256Hex(s); } catch (e) { return '0000000000000000'; } }
  /* line templates: {M} Mythic's name, {SP} its species, {Z} the zombie's name, {T} seat title, {N} seat ordinal word, {FX} its effects, {EB} block it was eaten, {RB} block it rose */
  var T = [
    ['Sing to me, Muse of the swamp, of the {SP} who was eaten and rose,', 'Sing, O Muse, of {M} the {SP}, who went down to the grave and came back,', 'Tell me, Muse, of the {SP} {M}, swallowed whole and returned in glory,'],
    ['{M}, the pride of its keeper\'s hall, kept safe for many a day,', 'keen-eyed and stubborn of jaw, the pride of its keeper\'s hall,', 'a Mythic held long and loved, the jewel of its keeper\'s stash,'],
    ['whom a zombie devoured, {Z}, the starving one, hollow and moon-pale,', 'whom {Z} took in the night, the hungry one, risen and pale,', 'whom the starving {Z} found, the restless one, lean as the moon,'],
    ['loosed by that same keeper\'s burn to wander the hall in the night.', 'set free by its keeper\'s own burn, and sent through the hall in the dark.', 'unleashed by the keeper\'s hand, by a burn on the chain that night.'],
    ['No hand chose the meal; the hash of the block drew the lot,', 'Six blocks it waited; then the hash of block {EB} drew the lot,', 'No one could see the pick; a block\'s own hash cast the die,'],
    ['and the feral one feasted, and swelled with the violet of swallowed stars.', 'and {Z} feasted and grew, and the moon came to rest in its eyes.', 'and the hungry one ate, and never was hungry again.'],
    ['Violet the grave that stood where the hero had stood before;', 'A violet stone rose up where {M} had stood before;', 'Violet the stone on the hill, and violet the candles there;'],
    ['Legendaries were laid at its foot, and the altar fire was fed,', 'the bravest were offered there, and the altar burned through the night,', 'gifts of Legendary kind were laid, and the altar was lit,'],
    ['and up from the dust came the Mythic, a zombie, star-traced and grim,', 'and up from the earth rose {M}, a zombie with stars in its seams,', 'and the Mythic climbed from the dust, a zombie, silent and grey,'],
    ['till its keeper burned once more, and the chain smiled kindly that day:', 'till the keeper burned once more, and fortune turned its way:', 'till one more burn was made, and the block hash answered yes:'],
    ['it rose with {FX} at its call,', 'it shone with {FX} about it,', 'and {FX} came down upon it,'],
    ['and took the {N} seat of the Pantheon, {T}.', 'and sat in the {N} seat of the Pantheon, {T}, at block {RB}.', 'and the {N} seat was its own: {T}, now and for good.']];
  var ORD = 'first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth twenty-first'.split(' ');
  function fxWords(n) { var G = MGd(), L = G.seatLook(n), a = L.fx.split('').filter(function (k) { return k !== 'E'; }).map(function (k) { return G.NAMES[k]; }); a.push(L.pal + ' light');
    return a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0]; }
  function verse(seat, w) { var G = MGd(), h = sha('XCPETS:odyssey:' + seat.n + ':' + seat.block + ':' + (seat.tx || '')), Z = w && w.byId[seat.eatenBy];
    var f = { M: seat.name || ('#' + seat.petId), SP: spName(seat.species), Z: (Z && Z.name) || ('#' + seat.eatenBy), T: G.seatTitle(seat.n), N: ORD[seat.n - 1] || ('#' + seat.n), FX: fxWords(seat.n), EB: fmt(seat.eatenAt + 6), RB: fmt(seat.block) };
    return T.map(function (vars, i) { var k = parseInt(h.substr(i * 2, 2), 16) % vars.length; return vars[k].replace(/\{(\w+)\}/g, function (m, x) { return f[x] != null ? f[x] : m; }); }); }
  function spName(s) { try { return V.speciesLabel ? V.speciesLabel(s) : s; } catch (e) { return s; } }
  var SEEN_KEY = 'xcpets-pn-seen', CAP_MS = 8000, LINE_MS = 420;
  function readSeen() { try { var o = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); if (!o || typeof o !== 'object' || Array.isArray(o)) return {}; return o; } catch (e) { return {}; } }
  function writeSeen(o) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (e) {} }
  /* a seat is new when this browser has not stored that seat's tx yet (every visitor, not only the keeper) */
  function freshSeats(seats, seen) { seen = seen || {}; return (seats || []).filter(function (s) { return s && seen[String(s.n)] !== String(s.tx || ''); }); }
  function ceremonyQueue(seats, seen, opts) { seats = seats || []; opts = opts || {};
    if (opts.demo && opts.ceremony && seats.length) { var n = opts.seat | 0, pick = n > 0 && seats[n - 1] ? seats[n - 1] : seats[seats.length - 1]; return [pick]; }
    if (opts.demo) return []; return freshSeats(seats, seen); }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function hashRef() { var m = /^#(seat|book)-(\d+)$/.exec((location && location.hash) || ''); if (!m) return null; var n = +m[2]; return n >= 1 && n <= 21 ? { kind: m[1], n: n } : null; }
  function css() { if (document.getElementById('pnCss')) return; var st = document.createElement('style'); st.id = 'pnCss'; st.textContent =
    '.pn-sub{color:#a8a3c8}.pn-count{font-size:18px;color:#c9b8ff;margin:6px 0}.pn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:14px}' +
    '.pn-seat{border-radius:12px;padding:12px;text-align:center;background:#171a2a;border:1px solid #2c3050;color:#e6e3f5}.pn-seat.on{background:radial-gradient(circle at 50% 30%,#2a2550,#171a2a 70%);border-color:#7f6be0;box-shadow:0 0 14px #5b47c055}' +
    '.pn-seat canvas{width:128px;height:128px;image-rendering:pixelated;display:block;margin:6px auto;border-radius:6px;background:#1b1f2e}.pn-num{font-weight:700;color:#c9b8ff;font-size:12px;letter-spacing:1px;text-transform:uppercase}' +
    '.pn-title{font-weight:700;color:#f3dfa0;margin-top:4px}.pn-who{color:#d8d4ee;font-size:13px}.pn-who a{color:#d8d4ee}.pn-meta{color:#8e89b0;font-size:12px}.pn-meta a{color:#b7a6ff}' +
    '.pn-plinth{width:128px;height:128px;margin:6px auto;border:2px dashed #3d4268;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#3d4268;font-size:30px;font-weight:800}' +
    '.pn-seat:not(.on) .pn-title{color:#bfb9a0}.pn-seat:not(.on) .pn-who{color:#8e89b0;font-style:italic}.pn-chips{margin-top:6px}.pn-chip{display:inline-block;font-size:11px;padding:1px 6px;margin:2px;border-radius:9px;background:#26294a;color:#cfc8f5}.pn-chip.tint{background:#3b3420;color:#f1dc9a}.pn-dim{opacity:.55}' +
    '.pn-ody{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap;margin-top:10px}.pn-bard{text-align:center;color:#a8a3c8;font-size:12px}.pn-bard canvas{width:160px;height:160px;image-rendering:pixelated;background:#1b1f2e;border-radius:8px}' +
    '.pn-scroll{flex:1;min-width:280px;background:#f1e6c8;color:#3b2b17;border-radius:10px;padding:16px 22px;font-family:Georgia,serif;box-shadow:inset 0 0 30px #c9b27f}.pn-scroll h3{margin:0 0 6px;font-variant:small-caps;letter-spacing:1px;color:#3b2b17}.pn-scroll ol{margin:0;padding-left:28px}.pn-scroll li{margin:2px 0;font-size:16px}' +
    '.pn-books li{margin:2px 0}.pn-books a{cursor:pointer}.pn-demo{background:#3a1d1d;color:#ffd7c2;border:1px solid #7a3b3b;border-radius:8px;padding:8px 12px;margin:8px 0;font-size:13px}' +
    '#odyssey,.pn-seat,.pn-books li{scroll-margin-top:calc(var(--navh, 72px) + 10px)}' +
    '@keyframes pnPulse{0%,100%{box-shadow:0 0 10px #7f6be088;border-color:#c9b27a}50%{box-shadow:0 0 28px #f3dfa0,0 0 8px #fff6c8;border-color:#f3dfa0}}' +
    '.pn-seat.pn-new{animation:pnPulse .9s ease-in-out 4;border-color:#f3dfa0}.pn-seat.pn-focus{outline:2px solid #f3dfa0;outline-offset:3px}' +
    '.pn-scroll li.pn-line{opacity:0}.pn-scroll li.pn-line.on{opacity:1;transition:opacity .4s ease}' +
    '.pn-bard.pn-sing canvas{box-shadow:0 0 16px #f3dfa0}.pn-hold{font-style:italic}' +
    '.pn-x{background:#1b1f2e;color:#f3dfa0;border:2px solid #f3dfa0;border-radius:8px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer}' +
    '.pn-x:focus{outline:3px solid #fff;outline-offset:2px}.pn-verse-skip{background:#3b2b17;color:#f1e6c8;border-color:#3b2b17;margin-top:8px}' +
    '.pn-live{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}' +
    '@media (prefers-reduced-motion: reduce){.pn-scroll li.pn-line{opacity:1;transition:none}.pn-seat.pn-new{animation:none;border-color:#f3dfa0;box-shadow:0 0 0 2px #f3dfa0,0 0 16px #f3dfa0}}';
    document.head.appendChild(st); }
  /* ?demo=1: example seats from real living pets, so the page can be previewed before the gate (never saved, never sent) */
  function demoSeats(w, k) { var L = w.pets.filter(function (p) { return !p.dead && !p.released && !p.community && p.stage >= 3 && p.art; }).slice(0, 400), out = [];
    for (var i = 0; i < k && L.length; i++) { var p = L[(i * 37 + 11) % L.length], z = L[(i * 53 + 5) % L.length]; out.push({ n: i + 1, petId: p.id, name: p.name || null, species: p.species, block: 975000 + i * 911, tx: 'demo' + i, owner: p.owner, eatenBy: z.id, eatenAt: 974000 + i * 911, demo: true }); }
    return out; }
  function godPet(seat, w) { var p = w.byId[seat.petId]; if (!p) return null; if (!seat.demo) return p; return Object.assign(Object.create(Object.getPrototypeOf(p)), p, { mythicGod: { seat: seat.n, block: seat.block }, zombie: null, dead: false, stage: 5 }); }
  function page(ctx) { var w = ctx.w, R = ctx.R, sa = ctx.shortAddr || function (a) { return String(a).slice(0, 8) + '…'; }, root = document.getElementById('pantheon'), G = MGd(); if (!root || !G) return; css();
    var P = V.mgPantheon(w), demo = /[?&]demo=1\b/.test(location.search) && !P.seats.length, seats = demo ? demoSeats(w, 10) : P.seats, b = (w.tip || 0) + 1, on = V.mgOn ? V.mgOn(b) : false;
    var wantCer = /[?&]ceremony=1(?:&|$)/.test(location.search), href0 = hashRef();
    var queue = ceremonyQueue(seats, readSeen(), { demo: !!demo, ceremony: wantCer, seat: href0 ? href0.n : 0 });
    var h = (demo ? '<div class="pn-demo">Example seats (?demo=1): real pets shown as they would look if seated. Nothing here is on the chain.' + (wantCer ? ' The seat ceremony (?ceremony=1) is a preview and is not saved.' : '') + '</div>' : '') +
      '<p class="pn-sub">21 seats, 21 Mythic Gods. When a Mythic eaten by its owner\'s starving zombie is raised from its violet grave and resurrected, it becomes a Mythic God and takes the next open seat, in the order they rise. Each seat has its own title and its own mix of divine effects, so no two Mythic Gods look alike.' + (on ? '' : ' <b>The Pantheon opens at block ' + ((V.mythicUnleashGate && V.mythicUnleashGate()) != null ? fmt(V.mythicUnleashGate()) : '(not set yet)') + '.</b>') + '</p>' +
      '<p class="pn-count">' + seats.length + ' of 21 seats filled' + (seats.length >= 21 ? ': the Pantheon is complete' : '') + '</p><div class="pn-grid">';
    for (var n = 1; n <= 21; n++) { var s = seats[n - 1], L = G.seatLook(n), chips = '<div class="pn-chips' + (s ? '' : ' pn-dim') + '">' + L.fx.split('').map(function (k) { return '<span class="pn-chip">' + G.NAMES[k] + '</span>'; }).join('') + '<span class="pn-chip tint">' + L.pal + ' light</span></div>';
      if (s) h += '<div class="pn-seat on" id="seat-' + n + '"><div class="pn-num">Seat ' + G.ROMAN[n - 1] + '</div><canvas width="32" height="32" data-seat="' + n + '" role="img" aria-label="Seat ' + G.ROMAN[n - 1] + ' Mythic God"></canvas><div class="pn-title">' + esc(G.seatTitle(n)) + '</div>' +
        '<div class="pn-who"><a href="pet.html?id=' + s.petId + '">' + esc(s.name || ('#' + s.petId)) + '</a> · ' + esc(spName(s.species)) + ' · #' + s.petId + '</div><div class="pn-meta">seated at block ' + fmt(s.block) + ' · <a href="#book-' + n + '">Odyssey, Book ' + G.ROMAN[n - 1] + '</a></div>' +
        '<div class="pn-meta" title="' + esc(s.owner) + '">keeper ' + esc(sa(s.owner)) + (ctx.ME && s.owner === ctx.ME ? ' (you)' : '') + '</div>' + chips + '</div>';
      else h += '<div class="pn-seat" id="seat-' + n + '"><div class="pn-num">Seat ' + G.ROMAN[n - 1] + '</div><div class="pn-plinth">' + G.ROMAN[n - 1] + '</div><div class="pn-title">' + esc(G.seatTitle(n)) + '</div><div class="pn-who">awaiting its god</div>' + chips + '</div>'; }
    h += '</div><h2 id="odyssey" class="meme sec">📜 The Pantheon Odyssey</h2><p class="pn-sub">Sung by Homer Pepe, community pet #5. Each time a Mythic God takes its seat, a new book of the Odyssey is added: the zombie that ate it, its rise from the grave, and its resurrection.</p>';
    if (!seats.length) h += '<p class="small muted">No book yet: the first Mythic God has not taken its seat.</p>';
    else { h += '<div class="pn-ody"><div class="pn-bard"><canvas width="32" height="32" id="pnBard" role="img" aria-label="Homer Pepe"></canvas><br>Homer Pepe, the bard</div><div class="pn-scroll" id="pnScroll"></div></div>' +
      '<h3>Books so far</h3><ol class="pn-books">' + seats.map(function (s) { return '<li id="book-' + s.n + '"><a data-book="' + s.n + '"><b>Book ' + G.ROMAN[s.n - 1] + '</b>: ' + esc(G.seatTitle(s.n)) + '</a> · ' + esc(s.name || ('#' + s.petId)) + '</li>'; }).join('') + '</ol>'; }
    root.innerHTML = h;
    var rev = 0, locked = false;
    function book(n) { var s = seats[n - 1], box = document.getElementById('pnScroll'); if (!s || !box) return; rev++;
      box.innerHTML = '<h3>Book ' + G.ROMAN[n - 1] + ': The ' + esc(G.seatTitle(n)) + '</h3><ol>' + verse(s, w).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol>'; }
    function goHash(ref) { if (!ref) return; if (ref.kind === 'book') { if (seats[ref.n - 1]) book(ref.n); var od = document.getElementById('odyssey'); if (od) od.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); return; }
      var el = document.getElementById('seat-' + ref.n); if (!el) return; el.classList.add('pn-focus'); try { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } catch (e) {}
      el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); }
    if (seats.length) { var queued = {}; queue.forEach(function (s) { queued[s.n] = 1; });
      if (href0 && href0.kind === 'book' && seats[href0.n - 1] && !queued[href0.n]) book(href0.n);
      else if (!queued[seats[seats.length - 1].n]) book(seats.length);
      else { var box0 = document.getElementById('pnScroll'); if (box0) box0.innerHTML = '<h3 class="pn-hold">The next book</h3><p class="pn-hold">Homer Pepe is about to sing a new book of the Pantheon Odyssey.</p>'; }
      root.querySelectorAll('[data-book]').forEach(function (a) { a.addEventListener('click', function () { book(+a.dataset.book); var od = document.getElementById('odyssey'); if (od) od.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }); });
      var bc = document.getElementById('pnBard'); try { if (window.HomerSprite) R.animate(bc, HomerSprite.frames(4, [27, 31, 46])); } catch (e) {} }
    root.querySelectorAll('canvas[data-seat]').forEach(function (c) { var s = seats[+c.dataset.seat - 1], p = s && godPet(s, w); if (!p) return; try { var fr = R.petFrames(p, w); R.animate(c, fr); } catch (e) { if (window.console) console.warn('pantheon seat', e); } });
    window.addEventListener('hashchange', function () { if (!locked) goHash(hashRef()); });
    if (!queue.length) { setTimeout(function () { if (!locked) goHash(hashRef()); }, 120); return; }
    if (root.getAttribute('data-pn-arm') === '1') return; root.setAttribute('data-pn-arm', '1');
    function say(t) { var live = document.getElementById('pnLive'); if (!live) { live = document.createElement('div'); live.id = 'pnLive'; live.className = 'pn-live'; live.setAttribute('aria-live', 'polite'); root.appendChild(live); } live.textContent = t; }
    function mark(seat) { if (!seat || seat.demo) return; var o = readSeen(); o[String(seat.n)] = String(seat.tx || ''); writeSeen(o); }
    function asset(file) { var s = document.querySelector('script[src*="js/v2-pantheon.js"],script[src*="js/v2-rules.js"]'), m = s && /[?&]v=([0-9a-z]+)/.exec(s.src); return 'js/' + file + (m ? '?v=' + m[1] : ''); }
    function loadOne(file) { return new Promise(function (res) { if (document.querySelector('script[src*="js/' + file + '"]')) { res(); return; } var t = document.createElement('script'); t.src = asset(file); t.async = false; t.onload = t.onerror = function () { res(); }; document.body.appendChild(t); }); }
    function animReady() { return !!(window.V2CemAnim && window.V2CemAnim.play && window.V2CemAnim.KINDS && window.V2CemAnim.KINDS.indexOf('mgrise-win') >= 0); }
    function loadAnims() { if (animReady()) return Promise.resolve(true); return loadOne('v2-zombie-look.js').then(function () { return loadOne('v2-cem-anim.js'); }).then(function () { return loadOne('v2-mg-anim.js'); }).then(animReady); }
    function whenAnims() { return new Promise(function (res) { var done = false; function go(ok) { if (done) return; done = true; res(!!ok); } loadAnims().then(go, function () { go(false); }); setTimeout(function () { go(animReady()); }, 4000); }); }
    /* the existing mgrise-win overlay, plus a real Skip/Close control and an 8s cap so the page can never stay covered */
    function playRise(ev, done) { var finished = false, handle, cap;
      function finish() { if (finished) return; finished = true; clearTimeout(cap); try { done(); } catch (e) {} }
      if (!animReady()) { finish(); return; }
      cap = setTimeout(function () { try { if (handle && handle.end) handle.end(); } catch (e1) {} var ov = document.querySelector('.ca-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov); finish(); }, CAP_MS);
      try { handle = window.V2CemAnim.play(ev, { w: w, noClip: true, done: finish }); } catch (e2) { finish(); return; }
      var ov = document.querySelector('.ca-ov'); if (!ov) return; var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pn-x';
      var word = reduced() ? 'Close' : 'Skip'; btn.textContent = word; btn.setAttribute('aria-label', word + ' the seat ceremony');
      btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); try { if (handle && handle.end) handle.end(); } catch (e3) {} finish(); });
      ov.appendChild(btn); try { btn.focus({ preventScroll: true }); } catch (e4) { try { btn.focus(); } catch (e5) {} } }
    function reveal(seat, done) { var s = seat, box = document.getElementById('pnScroll'); if (!s || !box) { if (done) done(); return; }
      var lines = verse(s, w), my = ++rev, bard = document.querySelector('.pn-bard'); if (bard) bard.classList.add('pn-sing');
      box.innerHTML = '<h3>Book ' + G.ROMAN[s.n - 1] + ': The ' + esc(G.seatTitle(s.n)) + '</h3><ol id="pnLines">' + lines.map(function (l) { return '<li class="pn-line">' + esc(l) + '</li>'; }).join('') + '</ol>' +
        (reduced() ? '' : '<p><button type="button" class="pn-x pn-verse-skip" id="pnVerseSkip">Show the whole book</button></p>');
      var lis = box.querySelectorAll('.pn-line'), i = 0, timer = null, stopped = false;
      function later() { setTimeout(function () { if (rev === my && done) done(); }, reduced() ? 0 : 700); }
      function showAll() { if (stopped) return; if (rev !== my) { locked = false; return; } stopped = true; clearTimeout(timer);
        for (var k = 0; k < lis.length; k++) lis[k].classList.add('on'); var b = document.getElementById('pnVerseSkip'); if (b) b.remove(); later(); }
      var skip = document.getElementById('pnVerseSkip'); if (skip) skip.addEventListener('click', showAll);
      var od = document.getElementById('odyssey'); if (od) od.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      if (reduced()) { showAll(); return; }
      (function step() { if (stopped) return; if (rev !== my) { locked = false; return; } if (i >= lis.length) { showAll(); return; } lis[i].classList.add('on'); i++; timer = setTimeout(step, LINE_MS); })(); }
    function glowAndVerse(seat, done) { var el = document.getElementById('seat-' + seat.n);
      if (el) { el.classList.add('pn-new'); el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); }
      say((seat.name || ('#' + seat.petId)) + ' took Seat ' + G.ROMAN[seat.n - 1] + ' of XXI. Homer Pepe is singing the new book.');
      setTimeout(function () { reveal(seat, done); }, reduced() ? 0 : 900); }
    function run(list, animOk) { var i = 0; function next() { if (i >= list.length) { locked = false; var h2 = hashRef(), last = list[list.length - 1]; if (h2 && (!last || h2.n !== last.n)) goHash(h2); return; }
      var seat = list[i++]; mark(seat); var ev = { kind: 'mgrise-win', id: seat.petId, seat: seat.n, roll: seat.roll != null ? seat.roll : 1873, need: seat.need != null ? seat.need : 2500, block: seat.block, tx: seat.tx };
      function after() { glowAndVerse(seat, next); } if (animOk) playRise(ev, after); else after(); } next(); }
    function arm() { if (document.prerendering) { document.addEventListener('prerenderingchange', arm, { once: true }); return; } locked = true; whenAnims().then(function (ok) { run(queue, ok); }); }
    arm(); }
  window.V2Pantheon = { page: page, verse: verse, T: T, seenKey: SEEN_KEY, freshSeats: freshSeats, ceremonyQueue: ceremonyQueue, CAP_MS: CAP_MS };
})();
