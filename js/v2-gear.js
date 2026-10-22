/* XCPETS v2: SPECIES GEAR. Per-species pieces (LIST) drawn as 8-bit overlay maps with the shared BonusGear palette through BonusGear.apply anchors.
 * v2 slots (player names): head = Headwear, face = Guise, back = Drip, hand = Grip (weapon + held), body = Outfits, feet = Footwear.
 * Removed over time (kept resolvable via RETIRED/ALIAS): Rare Pepe beret, Tennis ball, Pincer blade, Energy drink, Pearl, Rose, Peepo Hoodie, Pink peeking
 * sweater, several recoloured capes/faces; the bonus-gear Clone mirror is excluded from v2's pool. Crowns are a SHARED set (SHARED_CROWNS).
 * SIGNATURE (★) gear (SIG below, 2026-10-14): each species has up to 7 Legendary, species-exclusive pieces (head, face, back, body, weapon, held, feet);
 * Dodo has no face ★ and Nakamoto no head ★ (6 each). Every other piece is open to all species. Sig-gear shuffle (2026-10-16, gated from
 * ACTIVATE_SIG_SHUFFLE_BLOCK in v2-rules.js): Wow bandana leaves Doge's back ★ (open Outfits piece, tier 1); new Doge back ★ 'sig-doge-cape'. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.V2Gear = factory();
})(this, function () {
  'use strict';
  // ---------------------------------------------------------------- NAKAMOTO REWORK (2026-10-14, v2 runtime only; pet-core.js is untouched)
  // The community pet's base sprite becomes a human 'anon dev': calm face, dark hair that greys with age (Elder/Mythic grey), dark hoodie with a
  // Bitcoin-orange pin, and a sleek dark VR headset BAKED INTO the base (not gear) whose lenses glow orange. No hood, no hachimaki, no magenta shades.
  // The headset lenses keep the 'eye'/'pupil' keys so eye anchors, eye traits and the Powered laser eyes still centre on them.
  // Face-slot gear is drawn OVER the headset (face gear wins; nothing is hidden).
  // Nakamoto (scaled back 2026-10-14, supersedes the anon-dev redraw): keep his pet-core look (green face, hair, pose); since 2026-10-16 without the hachimaki.
  // Only: VR glasses baked into the face (the eye/lens colours become a dark headset visor with an orange glow; the lens shape and
  // frames are pet-core's own, so face gear still layers on top), and the stray white hook (the hachimaki knot tails off the back
  // of the head) is removed in the v2 render. His old signature hat item is deleted (see v2-nakamoto-rework.test.js). generator/pet-core.js is not edited.
  var NAKA_LIPS = 1 /* owner 2026-10-20: two lips allowed; at 32 px the single fuller lip reads better (see previews/naka-face/lips-one-vs-two.png) */, NAKA_MAPS = null, NAKA_VR = { eyeWhite: '#ecece4', pupil: '#141018' }; /* naka-face-card 2026-10-20: card eyes (white, dark pupil) replace the dark visor + orange glow */
  function reworkNakamoto(PC) { var sp = PC && PC.SPECIES && PC.SPECIES.filter(function (x) { return x.id === 'nakamoto'; })[0]; if (!sp || sp.v2rework) return;
    sp.v2rework = true; sp.eyeWhite = NAKA_VR.eyeWhite; sp.pupil = NAKA_VR.pupil;
    sp.hachimaki = false; /* 2026-10-16 (Jake): no white headband / Bitcoin disc in Nakamoto's art at any stage (visual only; the Genesis Block headband gear item stays) */
    var orig = PC.render; if (!orig || orig.v2naka) return;
    /* Nakamoto face/head pass (2026-10-14, Jake; v2 only): hatched stages get (1) a mouth: a small 4 px line (ink corners, mouth-pink centre) two rows under the visor/eyes, centred
     * under the pupils, painted on skin only, so faceSpots / mouth gear (cigarette...) find it; (2) a rounder skull: the flat top outline is raised
     * into a 1-2 px dome (hair colour from the row below), only over background, so hats re-anchor to the new head top. The egg is untouched. */
    function nakaFace(r, opts) { var st = opts && opts.stage | 0; if (!r || !r.data || st < 1) return r; var W = r.width || 32, H = r.height || 32, d = r.data, x, y, q;
      var at = function (x2, y2) { var q2 = (y2 * W + x2) * 4; return [d[q2], d[q2 + 1], d[q2 + 2]]; }, put = function (x2, y2, c) { var q2 = (y2 * W + x2) * 4; d[q2] = c[0]; d[q2 + 1] = c[1]; d[q2 + 2] = c[2]; d[q2 + 3] = 255; };
      var same = function (c, k) { return c[0] === k[0] && c[1] === k[1] && c[2] === k[2]; }, BG = at(0, 0), OL = [0x1a, 0x10, 0x20], PU = [0x14, 0x10, 0x18], VI = [0xec, 0xec, 0xe4];
      var hx3 = function (h3) { h3 = String(h3 || '#000000'); return [parseInt(h3.slice(1, 3), 16), parseInt(h3.slice(3, 5), 16), parseInt(h3.slice(5, 7), 16)]; }, SKC = hx3(sp.colors && sp.colors['3']), LDC = hx3(sp.colors && sp.colors['4']); /* naka-combined 2026-10-20: the CURRENT skin colours (hybridRender swaps sp.colors), so hybrids on his body get the card face in their own colours */
      var skin = function (c) { return (c[1] > c[0] + 15 && c[1] > c[2] + 15) || same(c, SKC) || same(c, LDC); };
      /* naka-face-card 2026-10-20 (owner, from the RAREPEPE Nakamoto Card): red downturned lips in card red #CD0000 (V2Render.faceSpots also keys on it,
       * so mouth gear still anchors). NAKA_LIPS = 2: upper lip / dark line / fuller lower lip, like the card; 1: one fuller lip shape. Ink corners droop
       * below the lip ends. Painted on skin only; rows that would touch the glasses are skipped. A drawn interior ink mouth line (Hatchling) is reused. */
      var LIP = [0xcd, 0x00, 0x00], oneRow = st >= 3; /* owner 2026-10-20: Adult, Elder + Mythic lip is exactly 1 px row of card red */
      function nakaMouth(cx, my, ey) { var two = NAKA_LIPS === 2, lineY = -1, P = [], add = function (dx, y3, c3) { P.push([dx, y3, c3]); };
        for (var yl = ey + 2; yl < my; yl++) { var r0 = -1, r1 = -1; for (var xl = cx - 4; xl <= cx + 4; xl++) { var ok = xl > 0 && xl < W - 1 && same(at(xl, yl), OL) && skin(at(xl, yl - 1)) && skin(at(xl, yl + 1)); if (ok) { if (r0 < 0) r0 = xl; r1 = xl; } else if (r0 >= 0 && r1 - r0 < 2) r0 = -1; else if (r0 >= 0) break; }
          if (r0 >= 0 && r1 - r0 >= 2) { my = yl; lineY = yl; cx = Math.floor((r0 + r1 + 1) / 2); break; } }
        var top = two ? my - 2 : my - 1, safe = function (y3) { return y3 > ey + 1; };
        if (two) { if (safe(my - 2)) { add(-1, my - 2, LIP); add(0, my - 2, LIP); } for (var k = -2; k <= 1; k++) add(k, my - 1, safe(my - 1) ? OL : LIP); for (k = -2; k <= 1; k++) add(k, my, LIP); add(-3, my, OL); add(2, my, OL); }
        else { if (safe(top) && !oneRow) { add(-1, top, LIP); add(0, top, LIP); } for (k = -2; k <= 1; k++) add(k, my, LIP); add(-3, my + 1, OL); add(2, my + 1, OL); }
        P.forEach(function (o) { var xx = cx + o[0], yy = o[1]; if (xx >= 0 && xx < W && yy >= 0 && yy < H && (skin(at(xx, yy)) || same(at(xx, yy), OL) && yy === lineY)) put(xx, yy, o[2]); }); }
      /* Eyes: white lenses (NAKA_VR.eyeWhite) keep their shape; every pupil pixel becomes white, then ONE dark pupil sits in the bottom row of each lens
       * (low = droopy); lenses 2+ rows tall get their top row painted as a heavy lid (dark skin). Glasses: frame ink more than 1 px from a lens, inside
       * the head and not the head outline, becomes skin, so the thick black frame thins to a 1 px wire rim (bridge row kept). Lens pixels never move,
       * so eye anchors, Beam eyes and eye gear still centre on them. */
      function nakaEyes() { var L = [], x2, y2; for (y2 = 0; y2 < H; y2++) for (x2 = 0; x2 < W; x2++) { var c2 = at(x2, y2); if (same(c2, PU) || same(c2, VI)) L.push([x2, y2]); }
        if (L.length < 2) return; var mx = L.reduce(function (s2, q) { return s2 + q[0]; }, 0) / L.length, G = [L.filter(function (q) { return q[0] < mx; }), L.filter(function (q) { return q[0] >= mx; })];
        var isL = {}; L.forEach(function (q) { isL[q[0] + ',' + q[1]] = 1; }); var LID = LDC, SK = SKC; /* = #41621a / #568023 on a pure Nakamoto */
        var bb = G.map(function (g) { var b = { x0: 99, x1: -1, y0: 99, y1: -1 }; g.forEach(function (q) { b.x0 = Math.min(b.x0, q[0]); b.x1 = Math.max(b.x1, q[0]); b.y0 = Math.min(b.y0, q[1]); b.y1 = Math.max(b.y1, q[1]); }); return b; });
        if (bb.some(function (b) { return b.x1 < 0; })) return;
        var gx0 = Math.min(bb[0].x0, bb[1].x0) - 2, gx1 = Math.max(bb[0].x1, bb[1].x1) + 2, gy0 = Math.min(bb[0].y0, bb[1].y0) - 2, gy1 = Math.max(bb[0].y1, bb[1].y1) + 1, nearL = function (x3, y3) { for (var a2 = -1; a2 <= 1; a2++) for (var b2 = -1; b2 <= 1; b2++) if (isL[(x3 + a2) + ',' + (y3 + b2)]) return true; return false; };
        var bridgeY = Math.min(bb[0].y0, bb[1].y0), inGap = function (x3) { return x3 > bb[0].x1 && x3 < bb[1].x0; }, thin = [];
        for (y2 = Math.max(1, gy0); y2 <= Math.min(H - 2, gy1); y2++) for (x2 = Math.max(1, gx0); x2 <= Math.min(W - 2, gx1); x2++) { if (!same(at(x2, y2), OL) || nearL(x2, y2)) continue; if (y2 === bridgeY && inGap(x2)) continue;
          var nb = [at(x2 - 1, y2), at(x2 + 1, y2), at(x2, y2 - 1), at(x2, y2 + 1)]; if (nb.some(function (c3) { return same(c3, BG); })) continue; /* head outline stays */
          if (x2 < gx0 + 1 || x2 > gx1 - 1) continue; thin.push([x2, y2]); }
        /* audit fix 2026-10-20: the side block. Between the head's outer outline pixel and each lens' 1 px rim, the extra frame ink becomes skin (Juvenile 2-3 px block, Adult 1 px) */
        for (y2 = Math.max(1, gy0); y2 <= Math.min(H - 2, gy1); y2++) { var fx = -1, lx2 = -1; for (x2 = 0; x2 < W; x2++) if (!same(at(x2, y2), BG)) { if (fx < 0) fx = x2; lx2 = x2; } if (fx < 0) continue;
          for (x2 = fx + 1; x2 <= bb[0].x0; x2++) if (same(at(x2, y2), OL) && !isL[(x2 - 1) + ',' + y2] && !isL[(x2 + 1) + ',' + y2] && !isL[x2 + ',' + (y2 - 1)] && !isL[x2 + ',' + (y2 + 1)] && y2 !== bridgeY - 1) thin.push([x2, y2]); }
        thin.forEach(function (q) { put(q[0], q[1], SK); });
        bb.forEach(function (b) { for (var yy = b.y0; yy <= b.y1; yy++) for (var xx = b.x0; xx <= b.x1; xx++) if (isL[xx + ',' + yy]) put(xx, yy, VI);
          var rowOf = function (y3) { var o = []; for (var x5 = b.x0; x5 <= b.x1; x5++) if (isL[x5 + ',' + y3]) o.push(x5); return o; }, low = rowOf(b.y1), py = b.y1;
          if (b.y1 > b.y0 && low.length >= 2) { for (xx = b.x0; xx <= b.x1; xx++) if (isL[xx + ',' + b.y0]) put(xx, b.y0, LID); } else if (b.y1 > b.y0) { low = rowOf(b.y0); py = b.y0; } /* tapered lens (Juvenile): no lid, pupil in the wide row */
          if (low.length) put(low[(low.length - 1) >> 1], py, PU); }); }
      // (1) mouth
      var ey = -1, sx = 0, n = 0, vx = 0, vn = 0; for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var c = at(x, y); if (same(c, PU)) { sx += x; n++; } if (same(c, VI)) { vx += x; vn++; } if ((same(c, PU) || same(c, VI)) && y < H - 6) ey = Math.max(ey, y); }
      if (vn) { sx = vx; n = vn; } // centre on the visor lenses (the headband knot shares the pupil orange)
      if (n && ey >= 0) { var cx = Math.round(sx / n), my = ey + 3, yy0, run; /* sit just above his chin line (first >=4 px ink run under the visor) so the nose zone between stays free */
        for (yy0 = ey + 3; yy0 <= ey + 7 && yy0 < H; yy0++) { run = 0; for (x = cx - 4; x <= cx + 4; x++) { if (x >= 0 && x < W && same(at(x, yy0), OL)) { if (++run >= 4) break; } else run = 0; } if (run >= 4) { my = yy0 - 1; break; } } nakaMouth(cx, my, ey); }
      // (1b) naka-face-card 2026-10-20: card eyes + thin wire rims (see design/naka-face-redesign.md)
      nakaEyes();
      // (2) dome
      var top = -1, x0 = 99, x1 = -1; for (y = 0; y < H && top < 0; y++) for (x = 0; x < W; x++) if (!same(at(x, y), BG)) { top = y; break; }
      if (top < 1) return r; for (x = 0; x < W; x++) if (same(at(x, top), OL)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      var lv = st >= 3 ? 2 : 1, hair = function (x2) { return at(x2, top + 1); }, hc = []; for (x = 0; x < W; x++) hc[x] = hair(x);
      for (var i = 1; i <= lv && top - i >= 0; i++) { var a0 = x0 + 2 * i, a1 = x1 - 2 * i; if (a1 - a0 < 2) break;
        for (x = a0; x <= a1; x++) if (same(at(x, top - i), BG)) put(x, top - i, OL);
        for (x = a0 - 2 + 1; x <= a1 + 2 - 1; x++) if (x > a0 - 2 && x < a1 + 2 && (i === 1 ? x > x0 + 1 && x < x1 - 1 : true) && x > a0 - 1 - 0 && x < a1 + 1 && same(at(x, top - i + 1), OL)) put(x, top - i + 1, hc[x]); }
      return r; }
    var wrapped = function (pet, opts) { if (pet && pet.species === 'nakamoto' && opts && opts.powered) opts = Object.assign({}, opts, { powered: false }); /* 2026-10-14 (Jake): no laser eyes in Nakamoto's Powered look (v2 only) */ var r = wrapped0.call(this, pet, opts); return pet && pet.species === 'nakamoto' && r && r.data ? nakaFace(r, opts) : r; };
    var wrapped0 = function (pet, opts) { return orig.apply(this, arguments); }; /* the old hachimaki-knot trim is gone with the headband */
    wrapped.v2naka = true; PC.render = wrapped;
    var origRF = PC.renderFrames; if (origRF) PC.renderFrames = function (pet, opts) { if (!pet || pet.species !== 'nakamoto') return origRF.apply(this, arguments); opts = opts || {}; var out = [];
      for (var f = 0; f < (opts.frames || 4); f++) out.push(wrapped(pet, { stage: opts.stage, frame: f, powered: opts.powered, gearCap: opts.gearCap, gearOverride: opts.gearOverride })); return out; }; }
  try { reworkNakamoto(typeof PetCore !== 'undefined' ? PetCore : (typeof require === 'function' ? require('../../../generator/pet-core.js') : null)); } catch (e) {}
  try { if (typeof window !== 'undefined' && window.GenPetCore) reworkNakamoto(window.GenPetCore); } catch (e) {} // front page: the full generator copy that still has Nakamoto
  // colour keys per species: a = main, b = second, c = accent (keys from BonusGear.COLORS)
  var PAL = {
    pepe: 'MmQ', wojak: 'dDZ', chud: 'ZMQ', bobo: 'QXr', mumu: 'mgG', snibby: 'Uut', dodo: 'ZjQ', kevin: 'DXm',
    doge: 'gGO', sarutobi: 'baX', lenny: 'aAn', peepo: 'KkH', nakamoto: 'EeZ'
  };
  // 8-bit templates (a/b/c replaced by the species palette)
  var T = {
    band: { at: 'head', dy: 5, map: ['aaaaaaaaa', 'abababab.', '.......bb'] },
    hat: { at: 'head', dy: 2, map: ['...aaa...', '..aaaaa..', '.aaaaaaa.', '.abbbbba.', 'aaaaaaaaa'] },
    crown: { at: 'head', dy: 1, map: ['c..c..c..c', 'a.aa.aa.aa', 'aaaaaaaaaa', 'abacabacaa', 'bbbbbbbbbb'] },
    face: { at: 'eyes', map: ['aaaa.aaaa', 'abba.abba', 'aaaaaaaaa'] },
    cape: { at: 'neck', behind: true, map: ['.aaaaaaaaaaa.', 'aaaaaaaaaaaaa', 'aabaaaaaaabaa', 'aaaaaaaaaaaaa', 'aaaaaaaaaaaaa', 'aaaaaaaaaaaaa', 'abababababab.'] },
    body: { at: 'chest', dy: -1, map: ['aa...aa', 'aaaaaaa', 'bacaaab', '.acaab.', '.aaaab.', '..bbb..'] }, // breastplate: shoulder pieces, highlight (c), shading (b); redrawn 2026-10-14
    weapon: { at: 'tallR', map: ['..c..', '.ccc.', '.ccc.', '..c..', '.aaa.', '..b..', '..b..', '..b..', '..b..', '..b..', '..b..'] },
    held: { at: 'handR', map: ['.cc.', 'aaaa', 'abba', 'abba', 'aaaa'] },
    feet: { at: 'feetBoth', map: ['aaaa', 'abba', 'bbbb'] }
  };
  var KIND_SLOT = { band: 'head', hat: 'head', crown: 'head', face: 'face', cape: 'back', body: 'body', weapon: 'hand', held: 'hand', feet: 'feet' };
  var KIND_TIER = { band: 0, hat: 1, crown: 3, face: 1, cape: 2, body: 2, weapon: 2, held: 1, feet: 0 };
  var KINDS = ['band', 'hat', 'crown', 'face', 'cape', 'body', 'weapon', 'held', 'feet'];
  // labels in KINDS order; legendary exclusive = the species' signature hat (SIG_HAT); species crowns retired into SHARED_CROWNS
  var LIST = {
    pepe: ['FEELS sweatband', null /* Rare Pepe beret REMOVED (owner request; the Rare Pepe card stays) */, null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Smug shades', 'Lily-pad cape', 'Frog-scale vest', 'Cattail spear', 'Feels Good mug (v2)', 'Lily-pad flippers'],
    wojak: ['Grey sweatband', 'Doomer beanie (v2)', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Single tear', 'Hoodie with hood (ash)', null /* Office cardigan REMOVED (owner request) */, '"It\'s over" chart pointer', 'Coffee cup', 'Worn sneakers'],
    chud: ['Gamer headband', 'Based trucker cap (v2)', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, null /* Dark glasses w/ glare REMOVED (duplicate sunglasses; Guise cleanup) */, null /* Flannel cape REMOVED (redundant recoloured cape; Drip cleanup) */, 'Tactical vest', 'Keyboard sword', null /* Energy drink REMOVED (owner request; the Energy-drink can stays) */, 'Crocs'],
    bobo: ['Red-candle bandana', 'Bear ushanka', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Shades', null /* Bear-pelt cape REMOVED (redundant recoloured cape; Drip cleanup) */, 'Bear-claw plate', 'Red-candle shiv', 'Honey jar', 'Bear paws'],
    mumu: ['Green bull headband', 'Cowboy hat', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Silver septum ring', null /* Green-candle cape REMOVED (redundant recoloured cape; Drip cleanup) */, 'Brass bull chestplate', 'Horn lance', 'Green candle', 'Brass horseshoes'],
    snibby: ['Seaweed band', 'Sailor cap', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Eyestalk goggles', null /* Kelp cape REMOVED (redundant recoloured cape; Drip cleanup) */, 'Shell plate', null /* Pincer blade REMOVED (owner request) */, null /* Pearl REMOVED (owner request) */, 'Sand boots'],
    dodo: ['Red feather band', 'Top hat', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Monocle', 'Storm-feather cape', 'Dark-feather mail', 'Crash-chart scythe', 'Black egg', 'Red webbed boots'],
    kevin: ['Grey hair-clip band', 'Stamp-collector cap', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Green slit visor', null /* Stamp #4258 cape REMOVED (redundant recoloured cape; Drip cleanup) */, 'Stamp-sheet vest', 'Postmark mallet', 'Magnifying glass', 'Brown loafers'],
    doge: ['WOW bandana (v2)', 'Shiba-ear beanie', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, null /* Side-eye shades REMOVED (duplicate sunglasses; Guise cleanup) */, null /* Couch-blanket cape REMOVED (redundant recoloured cape; Drip cleanup) */, 'Golden pup plate', 'Bone sword', null /* Tennis ball REMOVED (owner request) */, 'Orange paws'],
    sarutobi: ['Ninja headband (v2)', 'Monkey king cap', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Ninja mask', null /* Ninja scarf cape REMOVED (redundant recoloured cape; Drip cleanup) */, 'Staff harness', 'Bo staff', 'Banana', 'Tabi socks'],
    lenny: ['Lenny-brow yellow band', 'Beret', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Eyebrow-wiggle glasses', null /* Yellow stamp cape REMOVED (redundant recoloured cape; Drip cleanup) */, 'Smug argyle vest', 'Pointer finger', null /* Rose REMOVED (owner request) */, 'Yellow slippers'],
    peepo: ['Pink happy band', 'Party hat (v2)', null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, 'Blush cheeks', null /* Cozy blanket cape REMOVED (redundant recoloured cape; Drip cleanup) */, null /* Hoodie REMOVED (owner request) */, 'Pillow sword', 'Juice box', 'Bunny slippers'],
    nakamoto: ['Genesis Block headband', null /* Nakamoto rework 2026-10-14: his signature hat was deleted; Nakamoto has no hat ★ */, null /* species crown -> now a SHARED crown set (SHARED_CROWNS) / signature hat is the legendary */, null /* Laser eyes (v2-nakamoto-face) REMOVED 2026-10-14 (Jake): redundant with the regular Beam eyes item */, 'Whitepaper cape', 'Hash-block plate', 'Private-key sword', 'Satoshi Card', 'Block-chain boots']
  };
  // Redrawn on request (2026-10-14) so they read as what they are; literal BonusGear colour keys (not the a/b/c species palette).
  // One map drives both the piece on the pet and its catalog/inventory icon (V2Render.itemIcon crops the drawn pixels).
  var REDRAW = {
    'v2-sarutobi-held': ['X....', 'aA...', 'aaA..', '.aaA.', '.aaA.', '.aaA.', 'aaA..', 'B....'],                                  // Banana: curved, brown stem + tip
    'v2-dodo-held': ['..ZZ..', '.ZsZZ.', 'ZsjZZZ', 'ZjZZZZ', 'ZZZZZn', '.ZZZn.', '..nn..'],                                          // Black egg: charcoal oval + highlight
    'v2-wojak-held': ['.d.d...', 'd.d....', 'wBXBXw.', 'wwwwwwd', 'wwwww.d', 'wwwwwwd', '.ddddd.'],                                  // Coffee cup: handle, coffee top, steam
    'energy-can': ['.dd.', 'dddd', 'ZZZZ', 'MMMM', 'ZhZZ', 'ZZhZ', 'ZhZZ', 'MMMM', 'dddd'],                                          // Energy-drink can (bonus-gear piece; v2 render only): tall can, top rim, bright stripe + bolt
    'v2-peepo-held': ['...ww', '...w.', 'KKKwk', 'Kwwkk', 'KwbKk', 'KwwKk', 'KKKKk'],                                              // Juice box: small carton + bent straw
    'v2-nakamoto-held': ['gggggg', 'gDDDDg', 'gnwwng', 'gnnwng', 'gnwnng', 'gDDDDg', 'gwwwwg', 'gggggg'],                         // Satoshi Card: Rare Pepe card layout, hooded ?-face Nakamoto
    'v2-bobo-held': ['.QQQQQ.', 'QQQQQQQ', 'EYEEEEe', 'EYYEEEe', 'EYEEEEe', 'EEEEEEe', '.eeeee.'],                                      // Honey jar: red cloth top, squat amber jar, golden drip down from the lid
    'smoke-sandals': ['s..s', '.ss.', 'XXXX'],                                                                                         // Smoke-bomb sandals (bonus-gear piece; v2 render only): straps + sole
    'feels-mug': ['.d.d...', 'd.d....', 'MBXBXM.', 'MMMMMMm', 'MKKKM.m', 'MMMMMMm', '.mmmmm.']                                        // "Feels good" mug (bonus-gear piece; v2 render only)
  };
  // ---------------------------------------------------------------- HEADWEAR REDO (2026-10-14, Jake): every head piece looks like its name at 32 px.
  // Before this, all 11 v2 hats were ONE recoloured dome, all 13 v2 bands ONE recoloured sweatband, the 7 shared crowns ONE recoloured crown.
  // { map, dy, at, label } overrides; bonus-gear ids are overridden in the v2 runtime only (install), live keeps its own art.
  var HEAD_REDO = {
    // --- named by Jake
    'v2-lenny-hat': { dy: 3, map: ['.....Z.....', '...iiiiii..', '.iiiiiiiii.', 'iiiiiiiiiii', '.rrrrrrrrr.'] },                                         // Beret: flat slouched disc + stem
    'v2-sarutobi-hat': { dy: 2, map: ['i.........i', 'X.........X', '.X.......X.', '.X.......X.', '..X.....X..', '..X.....X..', '.gGgigiGgG.', 'GgggggggggG'] },             // Monkey king cap: gold circlet + two tall pheasant feathers
    'v2-peepo-hat': { dy: 2, label: 'Confetti party hat', map: ['....h....', '...hKh...', '...KwK...', '..KbKhK..', '..wKhKw..', '.KhKbKwK.', 'KKKKKKKKK'] },   // Confetti party hat (was "Party hat (v2)", a duplicate name): dotted cone, pom-pom
    'party-hat': { dy: 1, map: ['...hhh...', '....h....', '...bKb...', '...Kbb...', '..bbKbb..', '..Kbbbk..', '.bbKbbbb.', '.Kbbbkbb.', 'w.......w'] },                       // Party hat: striped cone, pom-pom, elastic
    'v2-snibby-hat': { dy: 3, map: ['..wwwwwwww.', '.wwwwwwwwww', '.wdwwwwwdw.', '.jjjjjjjjj.', '.........jj', '..........j'] },                                     // Sailor cap: white crown, navy band, ribbons
    'v2-doge-hat': { dy: 3, map: ['.O.......O.', 'OpO.....OpO', 'OOOOOOOOOOO', 'OoOoOoOoOoO', 'OOOOOOOOOOO', 'PoPoPoPoPoP'] },                                     // Shiba-ear beanie: knit, pointed orange ears
    'v2-kevin-hat': { dy: 3, map: ['...DDDDDD...', '..DDw.w.wD..', '.DDDwiiwDDD.', 'DDDDw.w.wDDD', '.....ZZZZZZZ'].map(function (r) { return r.replace(/\./g, function (c, i) { return i > 2 && i < 9 ? 'D' : c; }); }) },                                           // Stamp-collector cap: flat cap + perforated stamp patch, side brim
    'v2-mumu-hat': { dy: 3, map: ['....LL.LL....', '...LLLLLLL...', '...LlLLLLL...', '...XXXXXXX...', 'L..LLLLLLL..L', 'LLLLLLLLLLLLL', '.LLLLLLLLLLL.'] },   // Cowboy hat: pinched crown, band, curled wide brim
    'doomer-beanie': { dy: 4, snug: true, map: ['..ZZZZZ..', '.ZZjZZjZ.', 'ZZZZZZZZZ', 'ZjZjZjZjZ'] },                                                       // Doomer beanie + cig (wojak fix 2026-10-14): drawn snug to the skull by V2Render.drawSnugBeanie (top of the dome + rib cuff at the hairline, face left bare); map is only the icon/audit fallback
    'v2-wojak-hat': { dy: 3, label: 'Grey bobble beanie', map: ['...ww...', '...ww...', '.dddddd.', 'dDdDdDdD', 'dddddddd', 'DsDsDsDs'] },                      // was "Doomer beanie (v2)" (duplicate of the legendary): grey knit + white bobble
    'hard-hat': { dy: 2, map: ['....hhh....', '..hhhwhhh..', '.hhhhwhhhh.', '.hhhhwhhhh.', '.hhhhwhhhh.', 'zzzzzzzzzzz'] },                                     // Hard hat: yellow dome, centre ridge, brim
    // --- signature pieces (species-only, ★)
    'shell-helm': { dy: 4, label: 'Seashell cap', map: ['....UUU....', '..UuUUUuU..', '.UuUuUuUuU.', 'UuUuUuUuUuU', 'UuUuUuUuUuU', 'u.u.u.u.u.u', 'c.........c'] },   // Seashell cap: ribbed scallop shell (Snibby ★), eyestalks peek at the sides
    'wow-bandana': { at: 'neck', map: ['QQQQQQQQQQQQQQQQQ', 'QhQQQhQhhhQhQQQhQ', 'QhQQQhQhQhQhQQQhQ', 'QhQhQhQhQhQhQhQhQ', 'QQhQhQQhhhQQhQhQQ', '.QQQQQQQQQQQQQQQ.', '....QQQQQQQQQ....', '.......QQQ.......'] },   // "Wow" bandana: red neckerchief with big yellow W-O-W (5-px letters), point down (Doge ★ back/Drip)
    // --- look-alikes found in the audit (were the shared dome / sweatband / crown with a colour swap)
    'v2-bobo-hat': { dy: 5, map: ['..XXXXXXX..', '.XXlXlXlXX.', 'XXXXXXXXXXX', 'lX.......Xl', 'lX.......Xl', 'l.........l'] },                                     // Bear ushanka: fur crown + ear flaps
    'v2-chud-hat': { dy: 3, label: 'Backwards gamer cap', map: ['....ZZZZZ..', '...ZZMZZZZ.', '..ZZZZZZZZZ', 'ZZZZZZZZZZZ', 'ZZ.........'] },                  // was "Based trucker cap (v2)" (duplicate of the legendary): backwards cap, brim at the back
    'v2-dodo-hat': { dy: 1, map: ['......ii.', '..ZZZZZi.', '..ZZZZZ..', '..ZZZZZ..', '..ZZZZZ..', '..QQQQQ..', 'jjjjjjjjj'] },  /* dodo fix 2026-10-14: red band + slate brim so it reads on the black bird, brim seated on the crown (not on the eyes) */                         // Top hat: tall stovepipe + red feather (Bobo's short-seller hat is short)
    'v2-pepe-band': { map: ['wwwwwwwww', 'MMMMMMMMM', 'wwwwwwwww'] },                                                                                         // FEELS sweatband: striped terry
    'v2-wojak-band': { map: ['ddddddddd', 'dDDDDDDDd', '..c......', '..c......'] },                                                                         // Grey sweatband: thin band + sweat drop
    'v2-chud-band': { map: ['ZZZZZZZZZ', 'ZtZbZtZbZ', 'ZZZZZZZZZ'] },                                                                                        // Gamer headband: RGB LED strip
    'v2-bobo-band': { map: ['.n..n..n..', 'QQQQQQQQQQ', 'QrQQrQQrQQ', '........QQ'] },                                                                       // Red-candle bandana: red candles + knot
    'v2-mumu-band': { map: ['.....m...', 'mmmmMmmmm', 'mmmMmMmmm', 'mmMmmmMmm'] },                                                                           // Green bull headband: up-chart zig-zag
    'v2-snibby-band': { map: ['m.m.m.m.m', 'mMmMmMmMm', '.m.m.m.m.'] },                                                                                      // Seaweed band: wavy kelp
    'v2-dodo-band': { map: ['......i..', '.....ii..', '....ii...', 'ZZZZZZZZZ'] },                                                                           // Red feather band: band + upright red feather
    'v2-kevin-band': { map: ['DDDDDDDDD', '.ss......', '.ss......'] },                                                                                       // Grey hair-clip band: thin band + metal clip
    'v2-doge-band': { label: 'Bone headband', map: ['w.......w', 'wwwwwwwww', 'w.......w'] },                                                                 // was "WOW bandana (v2)" (duplicate of the Doge ★ bandana): a dog bone
    'v2-sarutobi-band': { label: 'Leaf-plate headband', map: ['bbbbbbbbb', 'bbsssssbb', 'bbsDsDsbb', '.......bb'] },                                         // was "Ninja headband (v2)" (duplicate name): steel forehead plate
    'v2-lenny-band': { map: ['aaaaaaaaa', '.nn...nn.', 'n..n.n..n'] },                                                                                       // Lenny-brow yellow band: raised ( ͡° ͜ʖ ͡°) brows
    'v2-peepo-band': { map: ['KKKKKKKKK', 'KKKiKiKKK', 'KKKiiiKKK', '....i....'] },                                                                          // Pink happy band: heart charm
    'v2-nakamoto-band': { map: ['EEEEEEEEE', 'EnEnEnEnE', 'EEEEEEEEE'] },                                                                                    // Genesis Block headband: chained blocks
    'v2-crown-cardboard': { map: ['l...l.l..l', 'll.lll.lll', 'llllllllll', 'lLXLlLXLll', 'LLLLLLLLLL'] },                                                   // Cardboard crown: jagged uneven points + tape
    'v2-crown-tin': { dy: 2, map: ['s.s.s.s.s.', 'ssssssssss', 'sDsDsDsDss', 'DDDDDDDDDD'] },                                                                // Tin crown: low riveted band
    'v2-crown-icicle': { dy: 3, map: ['W..W..W..W', 'WWWWWWWWWW', 'CWCWWCWCWW', 'C.C..C.C.C', 'c....c....'] },                                               // Icicle crown: drips hanging down
    'v2-crown-coral': { map: ['O..K...O..', 'OKK.K.KO.K', '.K.KKK.KK.', 'KKKKKKKKKK', 'kkkkkkkkkk'] },                                                       // Coral crown: branching coral
    'v2-crown-feather': { dy: 1, map: ['Z...j...Z.', 'Zj..Z..jZ.', '.Z.jZj.Z..', '.ZZZZZZZ..', 'jjjjjjjjjj'] }                                              // Black-feather crown: fanned feathers
  };
  // Outfits (body) redrawn 2026-10-14: each piece gets its own silhouette (species palette a/b/c, same colours as before).
  var BODY_MAPS = {
    pepe: ['a.....a', 'aa...aa', 'abab.ba', 'baba.ab', 'abab.ba', 'aaa.aaa'],          // Frog-scale vest: open front, scale rows
    chud: ['aa...aa', 'aaaaaaa', 'abbabba', 'acbacba', 'abbabba', 'aaaaaaa'],          // Tactical vest: pouches + buckles
    bobo: ['.aaaaa.', 'acaacaa', 'aacaaca', 'aaacaac', 'aaaaaaa', '.bbbbb.'],          // Bear-claw plate: three claw slashes
    mumu: ['c.....c', 'cc...cc', '.aaaaa.', 'abaaaba', 'aabcbaa', '.aaaaa.'],          // Brass bull chestplate: horns on the shoulders
    snibby: ['..aaa..', '.ababa.', 'abababa', 'abababa', '.aaaaa.', '..ccc..'],        // Shell plate: scalloped fan shell
    dodo: ['aa...aa', 'abaaaba', '.abcba.', 'aabcbaa', '.abcba.', '..aba..'],          // Dark-feather mail: feather chevrons
    kevin: ['a.a.a.a', '.bbbbb.', 'abcccba', '.bcccb.', 'abbbbba', '.a.a.a.'],         // Stamp-sheet vest: perforated stamp edges
    doge: ['aa...aa', 'aaaaaaa', 'aabbbaa', 'abcccba', 'aabbbaa', '.aaaaa.'],          // Gold Doge-coin breastplate: round coin centre
    sarutobi: ['b.....b', '.b...b.', '..bcb..', '..bcb..', '.b...b.', 'b.....b'],      // Staff harness: crossed straps + buckle
    lenny: ['a.....a', 'aa...aa', 'abacaba', 'aacacaa', 'abacaba', '.aaaaa.'],         // Smug argyle vest (re-themed 2026-10-16 from the Stamp-frame vest, display only): argyle diamonds; was: open vest, framed stamp patch
    nakamoto: ['aaaaaaa', 'abacaba', 'aaaaaaa', 'acabaca', 'aaaaaaa', 'abacaba']       // Hash-block plate: grid of blocks
  };
  // New Drip pieces (2026-10-14) in the HODL banner's style: a pole + flag with a 3x5 pixel word. Drawn with at:'banner'.
  var FONT = { Y: ['w.w', 'w.w', '.w.', '.w.', '.w.'], A: ['www', 'w.w', 'www', 'w.w', 'w.w'], B: ['ww.', 'w.w', 'ww.', 'w.w', 'ww.'], C: ['www', 'w..', 'w..', 'w..', 'www'], E: ['www', 'w..', 'ww.', 'w..', 'www'],
    F: ['www', 'w..', 'ww.', 'w..', 'w..'], G: ['www', 'w..', 'w.w', 'w.w', 'www'], I: ['www', '.w.', '.w.', '.w.', 'www'], K: ['w.w', 'w.w', 'ww.', 'w.w', 'w.w'],
    L: ['w..', 'w..', 'w..', 'w..', 'www'], M: ['w.w', 'www', 'www', 'w.w', 'w.w'], N: ['w.w', 'www', 'www', 'www', 'w.w'], O: ['www', 'w.w', 'w.w', 'w.w', 'www'],
    P: ['www', 'w.w', 'www', 'w..', 'w..'], R: ['ww.', 'w.w', 'ww.', 'w.w', 'w.w'], S: ['www', 'w..', 'www', '..w', 'www'], T: ['www', '.w.', '.w.', '.w.', '.w.'],
    U: ['w.w', 'w.w', 'w.w', 'w.w', 'www'], W: ['w.w', 'w.w', 'www', 'www', 'w.w'], X: ['w.w', 'w.w', '.w.', 'w.w', 'w.w'] };
  function flag(word, bg, edge, ink) { var rows = ['y' + new Array(word.length * 4 + 2).join(bg)], j, i;
    for (j = 0; j < 5; j++) { var r = 'L' + bg; for (i = 0; i < word.length; i++) r += FONT[word[i]][j].replace(/\./g, bg).replace(/w/g, ink) + bg; rows.push(r); }
    rows.push('L' + new Array(word.length * 4 + 2).join(edge)); for (j = 0; j < 22; j++) rows.push(j % 3 ? 'L' : 'l'); return rows; }
  // NGU sign only (2026-10-15, Jake): wider, shorter glyphs so the N reads as a capital N. Same 14x7 flag; word starts flush at the pole so the U keeps a 1-px right margin; other banners keep FONT.
  var WIDE = { N: ['w..w', 'ww.w', 'w.ww', 'w..w'], G: ['www', 'w..', 'w.w', 'www'], U: ['w.w', 'w.w', 'w.w', 'www'] };
  function wideFlag(word, bg, edge, ink) { var W = word.length * 4 + 1, rows = flag(word, bg, edge, ink), j, i;
    for (j = 0; j < 5; j++) { var r = 'L'; for (i = 0; i < word.length; i++) r += j < 4 ? WIDE[word[i]][j].replace(/\./g, bg).replace(/w/g, ink) + bg : new Array(WIDE[word[i]][0].length + 2).join(bg);
      rows[j + 1] = ('L' + (r.slice(1) + new Array(W + 1).join(bg)).slice(0, W)); }
    return rows; }
  var BANNERS = [ // id, label, tier, word, flag colour, bottom edge, letters
    ['v2-wagmi-flag', 'WAGMI flag', 0, 'WAGMI', 'm', 'Z', 'w'], ['v2-gm-flag', 'GM flag', 0, 'GM', 'g', 'G', 'n'],
    ['v2-few-sign', 'Few understand sign', 1, 'FEW', 'v', 'V', 'w'], ['v2-xcp-flag', 'XCP flag', 1, 'XCP', 'b', 'C', 'w'],
    ['v2-burn-banner', '"Burn it" banner', 2, 'BURN', 'Q', 'r', 'y'], ['v2-stack-sign', 'Stay humble stack sats sign', 2, 'STACK', 'E', 'e', 'w'], ['v2-lfg-banner', 'LFG banner', 2, 'LFG', 't', 'Z', 'n'],
    ['v2-ngu-sign', '"Number go up" sign', 3, 'NGU', 'M', 'm', 'n'], ['v2-moon-banner', 'MOON banner', 3, 'MOON', 'j', 'n', 'a']];
  // Guise glasses redesigned 2026-10-14: each pair has its own frame shape + colours (literal BonusGear keys).
  var FACE_MAPS = {
    'v2-pepe-face': ['.........', 'nnnn.nnnn', '.nn...nn.'],                        // Smug shades: small half-moon lenses
    'v2-bobo-face': ['nnnnnnnnn', 'nZZn.nZZn', '.nn...nn.'],                        // Shades: classic wide black wayfarers (the one sunglasses)
    'v2-snibby-face': ['DCCC.CCCD', 'DCWcCCWcD', '.CCC.CCC.'],          // Eyestalk goggles: round blue lenses + strap
    'v2-kevin-face': ['ZZZZZZZZZ', 'ZMMMMMMMZ', 'ZZZZZZZZZ'],                       // Green slit visor: one-piece visor
    'v2-lenny-face': ['XX.....XX', 'ZZZZ.ZZZZ', 'Z..ZZZ..Z', 'ZZZZ.ZZZZ'],          // Eyebrow-wiggle glasses: thick nerd rims + raised brows
    // Guise polish 2026-10-14: the last generic face pieces get their own look
    'v2-wojak-face': ['.........', '.........', '.c.......', '.C.......', '.c.......'],      // Single tear: one blue drop under the left eye
    'v2-sarutobi-face': ['.........', '.........', 'ZZZZZZZZZ', 'ZZjZZZjZZ', '.ZZZZZZZ.'],      // Ninja mask: dark cloth over the lower face
    'v2-peepo-face': ['.........', '.........', 'KK.....KK', '.k.....k.'],                // Blush cheeks: two pink cheek patches
    /* 'v2-nakamoto-face' (Laser eyes) REMOVED 2026-10-14 (Jake): redundant with the regular Beam eyes item */
    'v2-mumu-face': ['.s.s.', 's...s', 's...s', '.sss.']                                   // Nose ring (v2): open SILVER hoop (the Gold nose ring stays gold)
  };
  // Footwear redrawn 2026-10-14 (species palette a/b/c; drawn once per foot by at:'feetBoth').
  var FEET_MAPS = {
    pepe: ['a...', 'aa..', 'aaaa', 'abab'],            // Lily-pad flippers: fanned flipper
    wojak: ['.ab.', 'aaaa', 'wwww'],                   // Worn sneakers: laces + white sole
    chud: ['aaa.', 'abab', 'aaaa'],                    // Crocs: clog with holes
    bobo: ['.aa.', 'aaaa', 'acac'],                    // Bear paws: paw with claws
    mumu: ['.aa.', '.aa.', 'bb.b'],                    // Golden hooves: split hoof
    snibby: ['aa..', 'aa..', 'aab.', 'aaaa', 'bbbb'],  // Sand boots: tall boot
    dodo: ['aa..', 'aab.', 'aaaa', 'b.b.'],            // Red webbed boots: boot with webbed toes
    kevin: ['.aa.', 'acaa', 'bbbb'],                   // Brown loafers: low shoe with penny slot
    doge: ['.aa.', 'aaaa', 'bcbc'],                    // Orange paws: toe beans
    sarutobi: ['aa..', 'aa..', 'aaa.', 'a.aa'],        // Tabi socks: split toe
    lenny: ['..aa', '.aaa', 'bbbb'],                   // Yellow slippers: open-back slipper
    peepo: ['a.a.', 'aaa.', 'aaca', 'bbbb'],           // Bunny slippers: ears + eye
    nakamoto: ['aa..', 'ab..', 'aaaa', 'cbcb']         // Block-chain boots: chain-link sole
  };
  // New Guise jewellery (2026-10-14) in the Gold nose ring's style.
  var JEWELRY = [ // id, label, tier, at, map
    // 2026-10-14 (Jake): Gold lip ring REMOVED; its catalogue slot (same pool position, so existing rolls such as Pipbo's g15 map onto it) is now the
    // Gold nose ring (v2): a small gold hoop through the nostril edge, placed by V2Render on each pet's DETECTED nose ('v2nose').
    ['v2-gold-nose-ring', 'Gold nose ring (v2)' /* (v2) suffix: the bonus-gear Mumu 'Gold nose ring' keeps its name */, 0, 'v2nose', ['gg', '.g', 'gg']],
    ['v2-brow-piercing', 'Eyebrow piercing', 1, 'eyes', ['.......s.s', '..........', '..........']],
    ['v2-diamond-stud', 'Diamond nose stud', 2, 'v2stud', ['W', 'c']] /* polish pass: on the detected nose */,
    ['v2-septum-chain', 'Septum chain', 2, 'v2septum', ['g...g', '.ggg.', 'g.g.g']] /* polish pass: hangs from the detected nose */,
    ['v2-gold-grill', 'Gold grill', 3, 'v2mouth' /* placed by V2Render on the DETECTED mouth row */, ['gGgGg', 'ggggg']],
    ['v2-teardrop-gem', 'Teardrop gem', 3, 'eyes', ['.........', '.........', '.c.......', 'cCc......', '.c.......']]
  ];
  // Shades variants (Guise polish 2026-10-14): same idea as Bobo's Shades, different size + colour, spread over the rarities.
  var SHADES = [['v2-red-shades', 'Red shades', 0, ['QQQQ.QQQQ', 'QrrQQQrrQ', '.QQ...QQ.']], ['v2-big-shades', 'Big shades', 2, ['nnnnnnnnnnn', 'nZZZZnZZZZn', 'nZZZZnZZZZn', '.nnnn.nnnn.']],
    ['v2-gold-aviators', 'Gold aviators', 3, ['ggggggggg', 'gEEg.gEEg', 'geeg.geeg', '.gg...gg.']]];
  SHADES.forEach(function (x) { JEWELRY.push([x[0], x[1], x[2], 'eyes', x[3], 'glasses']); });
  // ---------------------------------------------------------------- SIGNATURE GEAR (2026-10-14, /workspace/signature-gear-plan.md): every species gets an exclusive
  // ★ piece in every kind: head, face, back (cape), body, weapon + held (both hand slot), feet = 7 per species, 91 total. Tier 3, species-only, never takeable.
  // Hybrids may wear BOTH parents' signatures except the head one (Jake's locked hybrid spec). Signatures roll at weight 5 (half the usual 10).
  var SIG = {
    pepe: { head: 'pimp-hat', face: 'sig-pepe-face', back: 'sig-pepe-cape', body: 'sig-pepe-body', weapon: 'sig-pepe-weapon', held: 'sig-pepe-held', feet: 'sig-pepe-feet' },
    wojak: { head: 'doomer-beanie', face: 'sig-wojak-face', back: 'sig-wojak-cape', body: 'sig-wojak-body', weapon: 'sig-wojak-weapon', held: 'sig-wojak-held', feet: 'sig-wojak-feet' },
    chud: { head: 'based-cap', face: 'sig-chud-face', back: 'sig-chud-cape', body: 'sig-chud-body', weapon: 'sig-chud-weapon', held: 'sig-chud-held', feet: 'sig-chud-feet' },
    bobo: { head: 'short-hat', face: 'sig-bobo-face', back: 'sig-bobo-cape', body: 'sig-bobo-body', weapon: 'sig-bobo-weapon', held: 'sig-bobo-held', feet: 'sig-bobo-feet' },
    mumu: { head: 'moon-cap', face: 'sig-mumu-face', back: 'sig-mumu-cape', body: 'sig-mumu-body', weapon: 'sig-mumu-weapon', held: 'sig-mumu-held', feet: 'sig-mumu-feet' },
    snibby: { head: 'shell-helm', face: 'sig-snibby-face', back: 'sig-snibby-cape', body: 'sig-snibby-body', weapon: 'sig-snibby-weapon', held: 'sig-snibby-held', feet: 'sig-snibby-feet' },
    dodo: { head: 'v2-dodo-hat', /* face ★ (Black-swan eye mask) REMOVED 2026-10-14 (Jake) */ back: 'sig-dodo-cape', body: 'sig-dodo-body', weapon: 'sig-dodo-weapon', held: 'sig-dodo-held', feet: 'sig-dodo-feet' },
    kevin: { head: 'v2-kevin-hat', face: 'sig-kevin-face', back: 'sig-kevin-cape', body: 'sig-kevin-body', weapon: 'sig-kevin-weapon', held: 'sig-kevin-held', feet: 'sig-kevin-feet' },
    doge: { head: 'v2-doge-hat', face: 'sig-doge-face', back: 'wow-bandana' /* before ACTIVATE_SIG_SHUFFLE_BLOCK only; from it the back ★ is 'sig-doge-cape' (SIG_SHUFFLE) */, body: 'sig-doge-body', weapon: 'sig-doge-weapon', held: 'sig-doge-held', feet: 'sig-doge-feet' },
    sarutobi: { head: 'v2-sarutobi-hat', face: 'sig-sarutobi-face', back: 'sig-sarutobi-cape', body: 'sig-sarutobi-body', weapon: 'banana-katana', held: 'v2-sarutobi-held', feet: 'smoke-sandals' },
    lenny: { head: 'v2-lenny-hat', face: 'sig-lenny-face', back: 'sig-lenny-cape', body: 'sig-lenny-body', weapon: 'sig-lenny-weapon', held: 'sig-lenny-held', feet: 'sig-lenny-feet' },
    peepo: { head: 'v2-peepo-hat', face: 'sig-peepo-face', back: 'sig-peepo-cape', body: 'sig-peepo-body', weapon: 'sig-peepo-weapon', held: 'sig-peepo-held', feet: 'sig-peepo-feet' },
    nakamoto: { /* no head ★ (deleted in the Nakamoto rework) */ face: 'sig-nakamoto-face', back: 'sig-nakamoto-cape', body: 'sig-nakamoto-body', weapon: 'sig-nakamoto-weapon', held: 'sig-nakamoto-held', feet: 'sig-nakamoto-feet' }
  };
  var SIG_KIND_SLOT = { head: 'head', face: 'face', back: 'back', body: 'body', weapon: 'hand', held: 'hand', feet: 'feet' };
  var SIG_AT = { face: 'eyes', back: 'neck', body: 'chest', weapon: 'tallR', held: 'handR', feet: 'feetBoth' };
  // [id, label, map, anchor override]
  var SIG_MAPS = [
    ['sig-pepe-face', 'Smug Pepe brows', ['mm.....mm', '.mmm.mmm.', 'mwww.wwwm']],
    ['sig-pepe-cape', 'Rare Pepe trading-card cape', ['.ggggggggggg.', 'gMMMMMMMMMMMg', 'gMMMwMMwMMMMg', 'gMMMMMMMMMMMg', 'gMMQQQQQMMMMg', 'gMMMMMMMMMMMg', 'ggggggggggggg']],
    ['sig-pepe-body', 'Feels-Good tee', ['Q.....Q', 'MMMMMMM', 'MMMMMMM', 'MwMMMwM', 'MMwwwMM', '.MMMMM.']],
    ['sig-pepe-weapon', 'Pepe Cash scepter', ['.ggg.', 'gVVVg', 'gVgVg', 'gVVVg', 'gVggg', '.ggg.', '..V..', '..V..', '..V..', '..V..', '..V..']],
    ['sig-pepe-held', 'Comfy lily cup', ['.w.w..', 'w.w...', '.wwww.', '.wwwwm', '.wwww.', 'mmmmmm']],
    ['sig-pepe-feet', 'Pond-frog webbed feet', ['M.M.', 'MMMM', 'mMmM']],
    ['sig-wojak-face', 'Feels-guy eye bags', ['.........', '.........', '.........', '.dd...dd.']],
    ['sig-wojak-cape', 'Pink-wojak sell-wall cape', ['.QQQQQQQQQQQ.', 'QQQQQQQQQQQQQ', 'QZQQQQQQQQQQQ', 'QQZZQQQQQQQQQ', 'QQQQZZZQQQQQQ', 'QwwwwwwZZwwwQ', 'QQQQQQQQQZZQ.']],
    ['sig-wojak-body', 'Wagie apron', ['Q.....Q', '.Q...Q.', 'QQQQQQQ', 'QQhQhQQ', 'QhQhQhQ', 'QQQQQQQ']],
    ['sig-wojak-weapon', 'Spatula of cope', ['ZZZZZ', 'ZZZZZ', 'ZZZZZ', '..s..', '..s..', '..s..', '..s..', '..s..', '..s..', '..Z..', '..Z..']],
    ['sig-wojak-held', '"It\'s over" phone', ['ZZZZZ', 'ZQwwZ', 'ZwQwZ', 'ZwwQZ', 'ZZZZZ']],
    ['sig-wojak-feet', 'Doomer slides', ['ww..', 'DDDD', 'ZZZZ']],
    ['sig-chud-face', 'Chud jaw beard', ['h.....h', 'hh...hh', 'hhhhhhh', '.hhzhh.', '..hhh..'], 'v2mouth'],
    ['sig-chud-cape', 'Gamer chair back', ['..ZZZZZZZZZ..', '.ZQZZZZZZZQZ.', '.ZQZZZZZZZQZ.', '.ZQZZZZZZZQZ.', '.ZQZZZZZZZQZ.', '.ZZZZZZZZZZZ.', '..Z.......Z..']],
    ['sig-chud-body', '"Based" hoodie', ['ZZw.wZZ', 'ZZZZZZZ', 'ZZwwZZZ', 'ZZwZwZZ', 'ZZwwZZZ', 'ZZwwwZZ']],
    ['sig-chud-weapon', 'Ban hammer', ['sssss', 'sQsQs', 'ssQss', 'sQsQs', 'sssss', '..Z..', '..Z..', '..Z..', '..Z..', '..Z..', '..Z..']],
    ['sig-chud-held', 'RGB controller', ['.ZZZZZ.', 'ZZsZZtZ', 'ZsssZQZ', 'ZZsZZtZ', '.ZZ.ZZ.']],
    ['sig-chud-feet', 'LED gamer sneakers', ['ZZ..', 'ZZZZ', 'tQMt']],
    ['sig-bobo-face', 'Bear-market snout muzzle', ['.XXXXX.', 'XXnnnXX', 'XXXnXXX', '.XnXnX.'], 'nose'],
    ['sig-bobo-cape', 'Red-candle cape', ['.n...n...n...', 'QQQ.QQQ.QQQ..', 'QQQ.QQQ.QQQ.n', 'QQQ.QQQ.QQQQQ', 'QQQQQQQQQQQQQ', 'QQQQQQQQQQQQQ', '.Q..Q..Q..Q..']],
    ['sig-bobo-body', 'Short-seller suit vest', ['w.....w', 'Zw...wZ', 'ZZwQwZZ', 'ZsZQZsZ', 'ZsZQZsZ', 'ZZZZZZZ']],
    ['sig-bobo-weapon', 'Margin-call axe', ['QQQ..', 'QQwQ.', 'QQQQX', 'QQQ.X', '....X', '....X', '....X', '....X', '....X', '....X', '....X']],
    ['sig-bobo-held', 'Liquidation notice', ['wwwww', 'wnnnw', 'wwwww', 'wnnnw', 'wwwQw', 'wwwww'], 'handL'],
    ['sig-bobo-feet', 'Grizzly claw boots', ['XXXX', 'XXXX', 'wXwX']],
    ['sig-mumu-face', 'Bull-run war paint', ['.........', '.........', '.........', '.M.....M.', 'MMM...MMM']],
    ['sig-mumu-cape', 'Matador-green cape', ['.mmmmmmmmmmm.', 'mmmmmmmmmmmmm', 'mmmmmmMmmmmmm', 'mmmmmMMMmmmmm', 'mmmmmmMmmmmmm', 'mmmmmmMmmmmmm', 'ggggggggggggg']],
    ['sig-mumu-body', 'Green-candle sash', ['M......', '.MM....', '..MgM..', '...MMM.', '....MgM', '.....MM']],
    ['sig-mumu-weapon', 'Golden bull horn spear', ['.ww..', 'w..w.', '...w.', '..g..', '..g..', '..g..', '..g..', '..g..', '..g..', '..g..', '..g..']],
    ['sig-mumu-held', 'Bull-market bell', ['...g...', '..g.g..', '..ggg..', '.gwggG.', '.gwggG.', '.gggggG', 'gggggGG', '...n...'] /* polish: flared brass bell, top loop, highlight, clapper */],
    ['sig-mumu-feet', 'Stampede hooves', ['GG..', 'GGGG', 'gggg', 's..s']],
    ['sig-snibby-face', 'Crab eyestalks', ['n.......n', 'U.......U', 'U.......U', 'U.......U'], 'head', 2],
    ['sig-snibby-cape', 'Hermit-crab spiral shell', ['....UUUU.....', '..UUuuuuU....', '.UuUUUUuU....', '.UuUuuUuU....', '.UuUUuUuU....', '..UuuuuU.....', '...UUUU......']],
    ['sig-snibby-body', 'Sideways-chart carapace', ['U.UUU.U', 'UUUUUUU', 'UtttttU', 'UUUUUUU', 'UuUuUuU', '.UUUUU.']],
    ['sig-snibby-weapon', 'Giant pincer claw', ['U...U', 'UU.UU', 'UuUuU', '.UUU.', '..U..', '..U..'], 'handR'],
    ['sig-snibby-held', 'Sand-dollar coin', ['.uuu.', 'uuUuu', 'uUUUu', 'uuUuu', '.uuu.'], 'handL'],
    ['sig-snibby-feet', 'Sideways crab legs', ['U..U', '.UU.', 'U..U']],
    /* sig-dodo-face 'Black-swan eye mask' REMOVED 2026-10-14 (Jake) */
    ['sig-dodo-cape', 'Black-swan wings', ['g...........g', 'Zg.........gZ', 'ZZg.......gZZ', 'ZZZg.....gZZZ', 'ZZZZg...gZZZZ', 'QZQZQ...QZQZQ', '.Q.Q.....Q.Q.']],
    ['sig-dodo-body', 'Tail-risk feather ruff', ['gZgZgZg', 'ZwZZZwZ', '.ZZQZZ.', '..ggg..']],
    ['sig-dodo-weapon', 'Black Swan quill blade', ['....w', '...Zw', '...Z.', '..ZZ.', '..Z..', '.ZZ..', '.Z...', 'gZ...', 'g....', 'g....', 'Q....']],
    ['sig-dodo-held', '"?" event card (framed)', ['gggggg', 'gvvvvg', 'gvwwvg', 'gvvwvg', 'gvwvvg', 'gvvvvg', 'gvwvvg', 'gggggg'], 'handL'],
    ['sig-dodo-feet', 'Swan webbed feet', ['gZ..', 'ZZZZ', 'QgQg']],
    ['sig-kevin-face', 'Copy-paste visor', ['DDDDDDDDD', 'DMMDDDMMD', 'DDDDDDDDD']],
    ['sig-kevin-cape', 'Stamp #4258 cape', ['w.w.w.w.w.w.w', 'wwwwXwwXwwwww', 'wwwwXwXwwwwww', 'wwwwXXwwwwwww', 'wwwwXwXwwwwww', 'wwwwXwwXwwwww', 'w.w.w.w.w.w.w']],
    ['sig-kevin-body', 'KEVIN name-tag cardigan', ['D.....D', 'DD...DD', 'DDQQQDD', 'DDwwwDD', 'DDDDDDD', 'D.D.D.D']],
    ['sig-kevin-weapon', 'Giant KEVIN stamp', ['.QQQ.', 'QwQwQ', '.QQQ.', '..X..', '..X..', '..X..', '..X..', '..X..', '.XXX.', 'XXXXX', 'QQQQQ']],
    ['sig-kevin-held', 'Stamp album', ['XXXXXX', 'XQwbwX', 'XwQwQX', 'XbwQwX', 'XXXXXX']],
    ['sig-kevin-feet', 'Stamped penny loafers', ['XXX.', 'XwXX', 'XXXX']],
    ['sig-doge-face', 'Side-eye Shiba look', ['.........', 'wwn...wwn', 'www...www']],
    ['sig-doge-body', 'Much-wow Comic Sans tee', ['O.....O', 'OOOOOOO', 'OKOOOOO', 'OOOtOOO', 'OOOOOMO', 'OOOOOOO']],
    ['sig-doge-weapon', 'To-the-moon rocket staff', ['..w..', '.www.', '.wQw.', '.www.', '.wQw.', '.www.', 'QwwwQ', '..O..', '.OyO.', '..y..', '..y..']],
    ['sig-doge-held', 'Dogecoin', ['.ggg.', 'gwwgg', 'gwgwg', 'gwwgg', '.ggg.']],
    ['sig-doge-feet', 'Shiba toe-bean paws', ['wO..', 'OOOO', 'KOKO']],
    ['sig-sarutobi-face', 'Monkey-king gold mask', ['QgggggggQ', 'gg.ggg.gg', '.gQ...Qg.']],
    ['sig-sarutobi-cape', 'Somersault cloud', ['....www....www.....', '..wwwwwwwwwwwwww...', '.wwwcwwwwwwwwcwww..', 'wwwwwwwwwwwwwwwwwww', 'wwcwwwwwwwwwwwwwcww', 'wwwwwwwwwwwwwwwwwww', '.wwcwww.www.wwwcww.', '..www....w....www..']],
    ['sig-sarutobi-body', 'Ninja gi wrap', ['b.....b', '.b...b.', 'bbb.bbb', 'bbbbbbb', 'aaaaaaa', 'bbbbbbb']],
    ['sig-lenny-face', '( ͡° ͜ʖ ͡°) smirk', ['....n...', '....nn..', 'n......n', '.nnnnnn.'], 'v2mouth'],
    ['sig-lenny-cape', 'Lenny banner', null, 'banner'],
    ['sig-lenny-body', 'Smug turtleneck', ['..aaa..', 'ZZZZZZZ', 'ZZZZZZZ', 'ZZZZZZZ', 'ZZZZZZZ', '.ZZZZZ.']],
    ['sig-lenny-weapon', 'Paintbrush rapier', ['..a..', '.aaa.', '.aaa.', '..A..', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..']],
    ['sig-lenny-held', 'Monocle on a chain', ['.ggg.', 'g...g', 'g...g', '.ggg.', '...g.', '..g..', '.g...']],
    ['sig-lenny-feet', 'Pointy loafers', ['.nn.', 'nann', 'nnnn']],
    ['sig-peepo-face', 'Peeking big eyes', ['.www...www.', 'wwnww.wwnww', 'wwwww.wwwww', '.www...www.']],
    ['sig-peepo-cape', 'Pink blanket-fort cape', ['.KKKKKKKKKKK.', 'KKKKKKKKKKKKK', 'KkKKKKKKKKkKK', 'KKKKKiKiKKKKK', 'KKKKKiiiKKKKK', 'KkKKKKiKKKkKK', 'kkkkkkkkkkkkk']],
    ['sig-peepo-body', 'Pink peeking sweater (v2)', ['.kkkkk.', 'KkkkkkK', 'KKKKKKK', 'KkKkKkK', 'KKKKKKK', 'kkkkkkk']],
    ['sig-peepo-weapon', 'Binocular baton', ['ZZ.ZZ', 'ZcZcZ', 'ZZZZZ', '..K..', '..K..', '..K..', '..K..', '..K..', '..K..', '..K..', '..K..']],
    ['sig-peepo-held', 'Heart balloon', ['KK.KK', 'KKKKK', 'KKKKK', '.KKK.', '..K..', '..w..', '..w..', '..w..']],
    ['sig-peepo-feet', 'Frog-peep slippers', ['w.w.', 'MMMM', 'MMMM']],
    ['sig-nakamoto-face', 'Shadowed face', ['.ZZZZZ.', 'ZZZZZZZ', 'ZZZZZZZ', 'ZZZZZZZ', 'ZZZZZZZ', 'ZZZZZZZ', 'ZZZZZZZ', '.ZZZZZ.']] /* "?" mark removed 2026-10-14 (Jake) */, // polish: glowing question mark (hook + dot) over a shadowed face, inside the hood
    ['sig-nakamoto-cape', 'Genesis-block cloak', ['.EEEEEEEEEEE.', 'EEEEEEEEEEEEE', 'EEEEEZZZEEEEE', 'EEEEEZEZEEEEE', 'EEEEEZZZEEEEE', 'EEEEEZEZEEEEE', 'eEeEeEeEeEeEe']],
    ['sig-nakamoto-body', 'Cypherpunk trenchcoat', ['E.....E', 'DE...ED', 'DDEEEDD', 'DDDDDgD', 'DDDDDDD', 'DDDDDDD', 'DD...DD']],
    ['sig-nakamoto-weapon', '21M hash staff', ['EEEEE', 'EZEZE', 'EEEEE', 'EZEZE', 'EEEEE', '..Z..', '..Z..', '..Z..', '..Z..', '..Z..', '..Z..']],
    ['sig-nakamoto-held', 'Whitepaper scroll', ['DwwwD', '.wnw.', '.www.', '.wnw.', '.www.', 'DwwwD'], 'handL'],
    ['sig-nakamoto-feet', 'Cold-wallet boots', ['ZZZ.', 'ZZZZ', 'ZZEE']]
  ];
  function isSig(sp, id) { var s = SIG[sp]; if (!s) return false; for (var k in s) if (s[k] === id) return true; return false; }
  function sigKindOf(sp, id) { var s = SIG[sp]; if (!s) return null; for (var k in s) if (s[k] === id) return k; return null; }
  var SIG_HAT = {}; Object.keys(SIG).forEach(function (sp) { if (SIG[sp].head) SIG_HAT[sp] = SIG[sp].head; }); // head signature (kept for older callers)
  // Crowns are now a SHARED set (any pet, any rarity, never exclusive). id, label, tier, colours a/b/c
  var SHARED_CROWNS = [['v2-crown-cardboard', 'Cardboard crown', 0, 'lLX'], ['v2-crown-tin', 'Tin crown', 0, 'sDd'], ['v2-crown-icicle', 'Icicle crown', 1, 'cCW'],
    ['v2-crown-coral', 'Coral crown', 1, 'KkO'], /* Heart crown REMOVED 2026-10-14 (Jake) */ ['v2-crown-feather', 'Black-feather crown', 2, 'ZjQ'], ['v2-crown-gold', 'Royal gold crown', 3, 'gGi']];
  var DEFS = {}, ITEMS = [];
  Object.keys(LIST).forEach(function (sp) {
    var p = PAL[sp];
    LIST[sp].forEach(function (label, k) {
      if (label == null) return; // removed piece
      var kind = KINDS[k], t = T[kind], id = 'v2-' + sp + '-' + kind;
      var map = t.map.map(function (r) { return r.replace(/a/g, p[0]).replace(/b/g, p[1]).replace(/c/g, p[2]); });
      if (kind === 'body' && BODY_MAPS[sp]) map = BODY_MAPS[sp].map(function (r) { return r.replace(/a/g, p[0]).replace(/b/g, p[1]).replace(/c/g, p[2]); });
      if (kind === 'feet' && FEET_MAPS[sp]) map = FEET_MAPS[sp].map(function (r) { return r.replace(/a/g, p[0]).replace(/b/g, p[1]).replace(/c/g, p[2]); });
      if (FACE_MAPS[id]) map = FACE_MAPS[id].slice(); var faceAt = id === 'v2-mumu-face' ? 'nose' : null;
      if (REDRAW[id]) map = REDRAW[id].slice();
      var hr = HEAD_REDO[id]; if (hr) { map = hr.map.slice(); if (hr.label) label = hr.label; }
      var ex = isSig(sp, id);
      DEFS[id] = { slot: KIND_SLOT[kind], tier: ex ? 3 : KIND_TIER[kind], label: label, at: faceAt || (id === 'v2-nakamoto-held' ? 'handL' : t.at), /* Satoshi Card held like the Rare Pepe card */ dy: hr && hr.dy != null ? hr.dy : t.dy, behind: t.behind, map: map, origin: sp, exclusive: ex, species: ex ? sp : undefined, kind: kind };
      ITEMS.push({ id: id, label: label, slot: KIND_SLOT[kind], tier: ex ? 3 : KIND_TIER[kind], origin: sp, exclusive: ex, legendary: ex, kind: kind, overlay: true });
    });
  });
  SHARED_CROWNS.forEach(function (c) { var map = T.crown.map.map(function (r) { return r.replace(/a/g, c[3][0]).replace(/b/g, c[3][1]).replace(/c/g, c[3][2]); }), hr = HEAD_REDO[c[0]]; if (hr) map = hr.map.slice();
    DEFS[c[0]] = { slot: 'head', tier: c[2], label: c[1], at: 'head', dy: hr && hr.dy != null ? hr.dy : T.crown.dy, map: map, origin: null, exclusive: false, kind: 'crown' };
    ITEMS.push({ id: c[0], label: c[1], slot: 'head', tier: c[2], origin: null, exclusive: false, legendary: false, kind: 'crown', overlay: true }); });
  BANNERS.forEach(function (b) { var id = b[0];
    DEFS[id] = { slot: 'back', tier: b[2], label: b[1], at: 'banner', map: (b[0] === 'v2-ngu-sign' ? wideFlag : flag)(b[3], b[4], b[5], b[6]), origin: null, exclusive: false, kind: 'banner' };
    ITEMS.push({ id: id, label: b[1], slot: 'back', tier: b[2], origin: null, exclusive: false, legendary: false, kind: 'banner', overlay: true }); });
  JEWELRY.forEach(function (j) { DEFS[j[0]] = { slot: 'face', tier: j[2], label: j[1], at: j[3], map: j[4], origin: null, exclusive: false, kind: j[5] || 'jewelry' };
    ITEMS.push({ id: j[0], label: j[1], slot: 'face', tier: j[2], origin: null, exclusive: false, legendary: false, kind: j[5] || 'jewelry', overlay: true }); });
  // wojak fix 2026-10-14 (v2 only): cigarette held in the mouth (anchored at the detected mouth corner via V2Render.facePos 'v2cig'; still a hand-slot piece) (white stick, orange ember, wisp of grey smoke); OPEN to every species, regular hand piece
  /* (comment fix 2026-10-16) the Cigarette is an OPEN piece: any species can roll and wear it (exclusive: false); origin wojak only names its theme. */
  DEFS['v2-wojak-cig'] = { slot: 'hand', tier: 1, label: 'Cigarette', at: 'v2cig', free: true, map: ['.....s', '....s.', '.....s', 'wwwwwO'], origin: 'wojak', exclusive: false, kind: 'held' };
  ITEMS.push({ id: 'v2-wojak-cig', label: 'Cigarette', slot: 'hand', tier: 1, origin: 'wojak', exclusive: false, legendary: false, kind: 'held', overlay: true });
  // polish pass 2026-10-14 (v2 only): readable redraws
  DEFS['v2-mumu-held'].map = ['..h..', '.hOh.', '..m..', '.MMM.', '.MmM.', 'MMmM.', '.MmM.', '.MMM.', '..m..'];   // Green candle: green chart-candle body, wick, flame on top, wax drip
  DEFS['v2-kevin-held'].map = ['.DDD...', 'DwccD..', 'DcccD..', 'DcccD..', '.DDDX..', '....XX.', '.....XX'];         // Magnifying glass: round lens + glint, rim, angled handle
  var ALIAS = { 'v2-pepe-held': 'feels-mug', 'v2-dodo-face': 'v2-bobo-face' }; ITEMS.forEach(function (x) { if (ALIAS[x.id]) x.alias = ALIAS[x.id]; }); // regular Monocle retired (Lenny-face monocle is the only monocle): its roll-pool slot now gives the same-tier shared Shades, so mock-chain item ids stay stable // Grip had two "Feels good" mugs: v2-pepe-held now rolls/resolves as the coffee-cup feels-mug (same pool position, so old rolls stay valid)
  SIG_MAPS.forEach(function (x) { var sp = x[0].split('-')[1], kind = sigKindOf(sp, x[0]), at = x[3] || SIG_AT[kind], map = x[2] || flag('LENNY', 'a', 'A', 'n');
    DEFS[x[0]] = { slot: SIG_KIND_SLOT[kind], tier: 3, label: x[1], at: at, dy: x[4], behind: kind === 'back' && at === 'neck', map: map, origin: sp, exclusive: true, species: sp, kind: kind, sig: true };
    ITEMS.push({ id: x[0], label: x[1], slot: SIG_KIND_SLOT[kind], tier: 3, origin: sp, exclusive: true, legendary: true, kind: kind === 'back' && at === 'banner' ? 'banner' : kind, sig: true, w: 5, overlay: true }); });
  /* Sig-gear shuffle (2026-10-16, owner approved): Doge's new back ★ = "Much-wow cape" (shiba-orange fur, cream hem, Comic-Sans "wow" in Doge-meme
   * colours). Listed from ACTIVATE_SIG_SHUFFLE_BLOCK only (item.since; v2-rules keeps it out of every roll pool before the block). */
  var SIG_SHUFFLE = { doge: { back: 'sig-doge-cape' } };
  DEFS['sig-doge-cape'] = { slot: 'back', tier: 3, label: 'Much-wow cape', at: 'neck', behind: true, map: ['.OOOOOOOOOOO.', 'OOOOOOOOOOOOO', 'OMOMObbbOKOKO', 'OMMMObObOKKKO', 'OOOOObbbOOOOO', 'OOOOOOOOOOOOO', 'PPPPPPPPPPPPP'], origin: 'doge', exclusive: true, species: 'doge', kind: 'back', sig: true };
  ITEMS.push({ id: 'sig-doge-cape', label: 'Much-wow cape', slot: 'back', tier: 3, origin: 'doge', exclusive: true, legendary: true, kind: 'back', sig: true, w: 5, overlay: true, since: 'sig-shuffle' });
  /* Gear audit (2026-10-16, owner approved): Lenny's ★ held 'Monocle on a chain' (duplicated the Lenny-face monocle) is replaced by 'Smug teacup' from
   * ACTIVATE_GEAR_AUDIT_BLOCK (v2-rules GA). Owned chain monocles are kept and stay wearable by Lenny; they just leave the roll pools. */
  DEFS['sig-lenny-teacup'] = { slot: 'hand', tier: 3, label: 'Smug teacup', at: 'handR', map: ['..s.s..', '.s.s...', 'wwwwww.', 'wgwgwwg', 'wwwwwwg', '.wwww..', 'ggggggg'], origin: 'lenny', exclusive: true, species: 'lenny', kind: 'held', sig: true };
  ITEMS.push({ id: 'sig-lenny-teacup', label: 'Smug teacup', slot: 'hand', tier: 3, origin: 'lenny', exclusive: true, legendary: true, kind: 'held', sig: true, w: 5, overlay: true, since: 'gear-audit' });
  /* STAR GEAR BATCH (2026-10-16, owner request): 12 OPEN (non-★) companion pieces, one per species except Nakamoto, riffing on each species' theme
   * without copying its ★ pieces. Mostly fill slots where the species had no open piece. Per-species ★ counts are unchanged (7 each, 6 Dodo/Nakamoto).
   * Listed from ACTIVATE_STAR_BATCH_BLOCK only (item.since 'star-batch'; v2-rules keeps them out of every roll pool before the block).
   * Appended at the END of ITEMS so every earlier pool keeps its order. [id, label, slot, tier, origin, anchor, dy, map] (literal BonusGear colour keys). */
  var STAR_BATCH = [
    ['v2-pepe-buckethat', 'Pond bucket hat', 'head', 1, 'pepe', 'head', 3, ['...mmmmm...', '..mMMMMMm..', '..mMMMKHm..', '..mmmmmmm..', '.mMMMMMMMm.', 'mMMMMMMMMMm']],
    ['v2-wojak-flannel', 'Doomer flannel', 'body', 1, 'wojak', 'chest', -1, ['ZR...RZ', 'RZRwRZR', 'ZRZwZRZ', 'RZRwRZR', 'ZRZwZRZ', '.RZwZR.']],
    ['v2-chud-bluelight', 'Blue-light glasses', 'face', 1, 'chud', 'eyes', null, ['nnnn.nnnn', 'nbcn.nbcn', 'nnnnnnnnn']],
    ['v2-bobo-hide', 'Bear-hide cloak', 'back', 2, 'bobo', 'neck', null, ['.XXXXXXXXXXX.', 'XLLLLLLLLLLLX', 'XLlLLLLLLLlLX', 'XLLLLLLLLLLLX', 'lXlXlXlXlXlXl']],
    ['v2-mumu-blanket', 'Saddle blanket', 'back', 1, 'mumu', 'neck', null, ['.EEEEEEEEEEE.', 'EbbbbbbbbbbbE', 'EwwwwwwwwwwwE', 'EbbbbbbbbbbbE', 'w.w.w.w.w.w.w']],
    ['v2-snibby-net', 'Fishing-net cape', 'back', 1, 'snibby', 'neck', null, ['dddddddddd', 'jdjdjdjdjd', 'djdjdjdjdj', 'jdjdjdjdjd', '.O...O...O']],
    ['v2-dodo-newsboy', 'Storm newsboy cap', 'head', 1, 'dodo', 'head', 3, ['..LLLLLLL..', '.LlLlLlLlL.', 'LlLlLlLlLlL', 'LLLLLLLLLLL', '.......LLLL']],
    ['v2-kevin-airmail', 'Airmail cape', 'back', 1, 'kevin', 'neck', null, ['WWWWWWWWWW', 'WWWWWWWWWW', 'WWWWWWWWWW', 'RbRbRbRbRb']],
    ['v2-doge-bowl', 'Dog-bowl helmet', 'head', 1, 'doge', 'head', 3, ['...RRRRR...', '..RpRRRrR..', '.RpRRRRRrR.', 'wwwwwwwwwww', 'sssssssssss']],
    ['v2-sarutobi-scroll', 'Scroll sash', 'body', 1, 'sarutobi', 'chest', -1, ['PP....X', 'PwP..X.', '.PTPX..', '..XTP..', '.X..TP.', 'X....PP']],
    ['v2-lenny-smock', 'Paint-splat smock', 'body', 1, 'lenny', 'chest', -1, ['ww...ww', 'wwwwwww', 'wRwwbww', 'wwwMwww', 'wbwwwRw', '.wwwww.']],
    ['v2-peepo-overalls', 'Denim overalls', 'body', 1, 'peepo', 'chest', -1, ['C.....C', 'C.....C', 'CCCCCCC', 'CCgCgCC', 'CCCCCCC', '.CC.CC.']]
  ];
  var STAR_KIND = { head: 'hat', back: 'cape', body: 'body', face: 'face' };
  STAR_BATCH.forEach(function (x) { var kind = STAR_KIND[x[2]];
    DEFS[x[0]] = { slot: x[2], tier: x[3], label: x[1], at: x[5], dy: x[6] == null ? undefined : x[6], behind: x[5] === 'neck', map: x[7], origin: x[4], exclusive: false, kind: kind };
    ITEMS.push({ id: x[0], label: x[1], slot: x[2], tier: x[3], origin: x[4], exclusive: false, legendary: false, kind: kind, overlay: true, since: 'star-batch' }); });
  /* WIZARD GEAR (owner, Oct 19 2026 ~9:11 PM CT; design/bitcoin-wizard-story.md). Join the roll pools only once the Bitcoin Wizard is in Cold Storage
   * (item.since 'wiz-cold'; v2-rules view() hides them before WIZ_POOL_FROM = max(ACTIVATE_WIZ_COLD_BLOCK, Mythic block + 1), so every earlier roll replays exactly). Appended at the END of ITEMS.
   * Three ★ Wizard-only pieces (Wizard Hat, "Join us" sign = the feeders' free claim, Crystal orb; weight 5 like other ★) + three OPEN Rare pieces (Star robe, MS Paint staff, Star-cloak). Owner-default list: edit this array.
   * [id, label, slot, tier, exclusive, kind, anchor, dy, map] (literal BonusGear colour keys). */
  var WIZ_BATCH = [
    ['wizard-hat', 'Wizard Hat', 'head', 3, true, 'hat', 'head', 1, ['.....v..', '....vv..', '...vvv..', '...vvvv.', '..vvvvv.', '..vvyvv.', '.ggggggg', 'VVVVVVVV']],
    ['sig-wizard-sign', '"Join us" sign', 'hand', 3, true, 'held', 'handL', null, ['nnnnnnnnn', 'nOOOOOOOn', 'nOnOnOnOn', 'nOnnOnnOn', 'nOOOOOOOn', 'nnnnnnnnn']], /* meme redraw 2026-10-20: orange 'Join us' board held low at the left (ink squiggle letters) */
    ['sig-wizard-orb', 'Crystal orb', 'hand', 3, true, 'held', 'handR', null, ['.ccc.', 'cWccc', 'ccccc', 'cccbc', '.ccc.', '.GGG.']],
    ['wiz-star-robe', 'Star robe', 'body', 2, false, 'body', 'chest', -1, ['b.....b', 'bbybbbb', 'bbbbbyb', 'bybbbbb', 'bbbbybb', '.bbbbb.']],
    ['wiz-paint-staff', 'MS Paint staff', 'hand', 2, false, 'weapon', 'tallR', null, ['.EE..', 'EwEE.', 'EEEe.', '.ee..', '..X..', '.X...', '..X..', '..X..', '.X...', '..X..', '..X..']],
    ['wiz-star-cloak', 'Star-cloak', 'back', 2, false, 'cape', 'neck', null, ['.vvvvvvvvvvv.', 'vvvyvvvvvvyvv', 'vvvvvvyvvvvvv', 'vyvvvvvvvvyvv', 'vvvvyvvvvvvvv', 'VvVvVvVvVvVvV']],
  ];
  WIZ_BATCH.forEach(function (x) {
    DEFS[x[0]] = { slot: x[2], tier: x[3], label: x[1], at: x[6], dy: x[7] == null ? undefined : x[7], behind: x[6] === 'neck', map: x[8], origin: 'wizard', exclusive: x[4], species: x[4] ? 'wizard' : undefined, kind: x[5], sig: x[4] };
    ITEMS.push({ id: x[0], label: x[1], slot: x[2], tier: x[3], origin: 'wizard', exclusive: x[4], legendary: x[4], kind: x[5], sig: x[4], overlay: true, since: 'wiz-cold' }); });
  /* LORDKEK Rare Pepe card (branch lord-kek): RENDER-ONLY map for Kek hybrids holding the card (player Keks draw it in KekSprite). NOT in ITEMS,
   * so it is never in a roll pool; the rules create it only through the gated pet:kekcard claim / 1-in-69 drop (V2Rules ACTIVATE_KEK_CARD_BLOCK). */
  DEFS['kek-card'] = { slot: 'hand', tier: 3, label: 'LORDKEK Rare Pepe card', at: 'handL', map: ['wwwww', 'wgbgw', 'wMMMw', 'wiiiw', 'wgggw', 'wnnnw', 'wwwww'], origin: 'kek', exclusive: true, species: 'kek', kind: 'held', sig: true };
  /* BITCOIN STAFF (owner, Oct 20 2026): Wizard-only ★ weapon, the meme's long brown staff tilted up-right with a big orange ₿ coin. Worn in its own
   * 'weapon' slot (right hand) so it pairs with the "Join us" sign (Grip, left hand); rolls inside the Grip pool (rollSlot 'hand', weight 5 like other ★).
   * item.since 'wiz-staff' = OFF until V2Rules.ACTIVATE_WIZ_STAFF_BLOCK is set (null now). Appended at the END of ITEMS. No grants. */
  var WIZ_STAFF = ['sig-wizard-staff', 'Bitcoin staff', 'weapon', 3, true, 'weapon', 'tallR', null, ['..OOO', '.OwOO', '.OwwO', '.OOOo', '..oo.', '..L..', '.L...', '.L...', 'L....', 'L....', 'L....']];
  DEFS[WIZ_STAFF[0]] = { slot: 'weapon', tier: 3, label: WIZ_STAFF[1], at: 'tallR', dy: undefined, behind: false, map: WIZ_STAFF[8], origin: 'wizard', exclusive: true, species: 'wizard', kind: 'weapon', sig: true };
  ITEMS.push({ id: WIZ_STAFF[0], label: WIZ_STAFF[1], slot: 'weapon', rollSlot: 'hand', tier: 3, origin: 'wizard', exclusive: true, legendary: true, kind: 'weapon', sig: true, overlay: true, since: 'wiz-staff' });
  /** install(BonusGear): adds the v2 maps to BonusGear.DEFS (render only) and the 'eyes' anchor support is in bonus-gear.js. */
  function install(BG) { if (BG && BG.DEFS) Object.keys(DEFS).forEach(function (k) { if (!BG.DEFS[k]) BG.DEFS[k] = DEFS[k]; }); if (BG && BG.DEFS) Object.keys(REDRAW).forEach(function (k) { if (!DEFS[k] && BG.DEFS[k] && !BG.DEFS[k].v2redraw) BG.DEFS[k] = Object.assign({}, BG.DEFS[k], { map: REDRAW[k].slice(), v2redraw: true }); }); if (BG && BG.DEFS) Object.keys(HEAD_REDO).forEach(function (k) { var o = HEAD_REDO[k]; if (!DEFS[k] && BG.DEFS[k] && !BG.DEFS[k].v2head) BG.DEFS[k] = Object.assign({}, BG.DEFS[k], { map: o.map.slice(), v2head: true }, o.dy != null ? { dy: o.dy } : {}, o.at ? { at: o.at } : {}, o.label ? { label: o.label } : {}, o.snug ? { v2snug: true } : {}); }); // headwear redo: v2 runtime only
    if (BG && BG.DEFS && BG.DEFS['pink-sweater'] && !BG.DEFS['pink-sweater'].sweaterOnly) BG.DEFS['pink-sweater'] = Object.assign({}, BG.DEFS['pink-sweater'], { sweaterOnly: true }); // Pink peeking sweater: no hood in v2 (owner request)
    // polish pass (v2 runtime only, live bonus-gear.js untouched): Mumu's gold nose ring hangs from the detected nose; the doomer cig sits on the detected mouth
    if (BG && BG.DEFS && BG.DEFS['nose-ring'] && BG.DEFS['nose-ring'].at === 'nose') BG.DEFS['nose-ring'] = Object.assign({}, BG.DEFS['nose-ring'], { at: 'v2septum' });
    if (BG && BG.DEFS && BG.DEFS['doomer-beanie'] && BG.DEFS['doomer-beanie'].extra) { var db = Object.assign({}, BG.DEFS['doomer-beanie']); db.v2cig = { at: 'v2cig', free: true, map: db.extra.map }; delete db.extra; BG.DEFS['doomer-beanie'] = db; }
    // eye-gear fit (2026-10-14, v2 runtime only): glasses / masks / eye bags are traced from each detected eye (V2Render.drawEyeGear) instead of a fixed
    // 9-px stamp that sat between wide-set eyes (Pepe, Bobo) or vanished on Dodo; the map stays as the icon + eyeless-pose fallback
    if (BG && BG.DEFS && BG.DEFS['v2-mumu-face'] && !BG.DEFS['v2-mumu-face'].v2silver) BG.DEFS['v2-mumu-face'] = Object.assign({}, BG.DEFS['v2-mumu-face'], { at: 'v2septum', map: ['s...s', 's...s', '.sWs.'], v2silver: true }); /* redraw-2 2026-10-14: Silver nose ring hangs from the detected nose (was the generic 'nose' slot); open silver hoop + bright bead, never gold */
    if (BG && BG.DEFS) Object.keys(EYE_GEAR).forEach(function (k) { if (BG.DEFS[k] && !BG.DEFS[k].v2eye) BG.DEFS[k] = Object.assign({}, BG.DEFS[k], { v2eye: EYE_GEAR[k] }); });
    return BG; }
  var EYE_GEAR = { // style, frame key, lens keys (top row, rest), extra lens rows
    'v2-gold-aviators': { s: 'glasses', f: 'g', l: ['E', 'e'], drop: 1, up: 1, wide: 1 } /* 2026-10-14: lenses 1 px wider each side + 1 row taller so each fully covers its eye */, 'v2-red-shades': { s: 'glasses', f: 'Q', l: ['r', 'r'] },
    'v2-big-shades': { s: 'glasses', f: 'n', l: ['Z', 'Z'], drop: 1, up: 1, wide: 2 } /* 2026-10-14: noticeably bigger: 2 px past each eye (was 1), 1 row taller upward; frame stays within 3 rows of the eye line */, 'v2-bobo-face': { s: 'glasses', f: 'n', l: ['Z', 'Z'] },
    'v2-pepe-face': { s: 'glasses', f: 'n', l: ['n', 'Z'] }, 'v2-lenny-face': { s: 'glasses', f: 'Z', l: [null, null], brows: 'X' } /* brows ride 1 row above the frames, eye-anchored per frame (bob with the head) */,
    'sig-wojak-face': { s: 'bags', f: 'd' }, 'sig-doge-face': { s: 'sideeye', f: 'n' }, 'sig-pepe-face': { s: 'brows', f: 'm' }, 'v2-peepo-face': { s: 'blush' }, 'v2-brow-piercing': { s: 'piercing' }, 'v2-nakamoto-face': { s: 'laser' }, 'v2-wojak-face': { s: 'tear' }, 'v2-sarutobi-face': { s: 'ninja', f: 'Z', l: ['j'] },
    'v2-snibby-face': { s: 'glasses', f: 'D', l: ['C', 'C'] }, 'v2-kevin-face': { s: 'visor', f: 'Z', l: ['M', 'M'] }, 'sig-kevin-face': { s: 'visor', f: 'D', l: ['M', 'M'] },
    'sig-sarutobi-face': { s: 'mask', f: 'Q', l: ['g', 'g'] }, 'v2-chud-bluelight': { s: 'glasses', f: 'n', l: ['c', 'b'] } /* star batch 2026-10-16: Blue-light glasses, traced from each eye */, 'lenny-monocle': { s: 'monocle', f: 'g' }, 'sig-lenny-held': { s: 'monocle', f: 'G', side: 'L', chain: 1 } /* Monocle on a chain: worn ON his right eye (viewer-left), dark-gold ring (light gold vanished on Lenny's yellow skin), chain down the cheek (2026-10-14, Jake) */ };
  var REMOVED = ['v2-pepe-hat', 'v2-doge-held', 'v2-snibby-weapon', 'v2-chud-held', 'v2-snibby-held', 'v2-lenny-held', 'v2-wojak-body',
    'v2-chud-cape', 'v2-bobo-cape', 'v2-mumu-cape', 'v2-snibby-cape', 'v2-kevin-cape', 'v2-doge-cape', 'v2-sarutobi-cape', 'v2-lenny-cape', 'v2-peepo-cape', 'v2-doge-face', 'v2-chud-face', 'clone-mirror', 'xcp-coin', 'v2-peepo-body', 'pink-sweater']; // clone-mirror lives in bonus-gear.js (shared with live): excluded in v2 only, via V2Rules
  // Front-page kits (cast GIF + hero grid, 2026-10-14): varied ★ + regular pieces, one crown in total, exclusivity-checked by the users
  var CAST_KITS = {
    pepe: ['pimp-hat', 'v2-gold-aviators', 'sig-pepe-cape', 'v2-pepe-body', 'feels-mug'], wojak: ['doomer-beanie', 'v2-wojak-cig', 'sig-wojak-feet'] /* wojak fix 2026-10-14 (Jake): beanie + hand-held cigarette; dropped sig-wojak-face (eye bags read as dark shades), its-over chart (read as a smiley sign) and the hooded cape (hid the bald head) */,
    chud: ['based-cap', 'sig-chud-body', 'sig-chud-held'], bobo: ['short-hat', 'v2-bobo-face', 'sig-bobo-cape', 'sig-bobo-weapon'],
    mumu: ['moon-cap', 'sig-mumu-cape', 'sig-mumu-body', 'sig-mumu-held'], snibby: ['shell-helm', 'sig-snibby-cape', 'sig-snibby-weapon'],
    dodo: ['v2-dodo-hat', 'sig-dodo-cape', 'sig-dodo-weapon'], kevin: ['v2-kevin-hat', 'sig-kevin-body', 'v2-kevin-held'],
    peepo: [/* Heart crown removed 2026-10-14 (Jake): no hat */ 'sig-peepo-cape', 'sig-peepo-held'], sarutobi: ['v2-sarutobi-hat', 'sig-sarutobi-cape', 'banana-katana'],
    doge: ['v2-doge-hat', 'wow-bandana', 'sig-doge-held'], lenny: ['v2-lenny-hat', 'lenny-monocle', 'sig-lenny-body', 'sig-lenny-weapon'],
    nakamoto: ['sig-nakamoto-cape', 'sig-nakamoto-body', 'v2-nakamoto-held'] };
  // RETIRED (append-only, 2026-10-14, Jake): ids removed from the visible lists + drop pool but still RESOLVED wherever an old id appears
  // (saved loadouts, live gear migrated at the cutoff, replays). [old id, current item it resolves to, date, why]. Never delete a row; only append.
  var RETIRED = [
    ['v2-crown-heart', 'v2-crown-feather', '2026-10-14', 'Heart crown removed -> nearest crown (same tier 2 shared crown)'],
    ['sig-dodo-face', 'v2-bobo-face', '2026-10-14', 'Black-swan eye mask removed -> nearest eyewear (same as the retired Dodo face alias)'],
    ['v2-nakamoto-face', 'beam-eyes', '2026-10-14', 'Laser eyes removed (redundant) -> the regular Beam eyes']
  ];
  return { WIZ_BATCH: WIZ_BATCH, WIZ_STAFF: WIZ_STAFF, STAR_BATCH: STAR_BATCH, SIG_SHUFFLE: SIG_SHUFFLE, RETIRED: RETIRED, CAST_KITS: CAST_KITS, reworkNakamoto: reworkNakamoto, NAKA_MAPS: NAKA_MAPS, ALIAS: ALIAS, SIG: SIG, SIG_MAPS: SIG_MAPS, isSig: isSig, sigKindOf: sigKindOf, HEAD_REDO: HEAD_REDO, EYE_GEAR: EYE_GEAR, SHADES: SHADES, SIG_HAT: SIG_HAT, SHARED_CROWNS: SHARED_CROWNS, FACE_MAPS: FACE_MAPS, FEET_MAPS: FEET_MAPS, JEWELRY: JEWELRY, BANNERS: BANNERS, BODY_MAPS: BODY_MAPS, REDRAW: REDRAW, REMOVED: REMOVED, DEFS: DEFS, ITEMS: ITEMS, LIST: LIST, KINDS: KINDS, KIND_SLOT: KIND_SLOT, PAL: PAL, install: install };
});
