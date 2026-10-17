/*!
 * XCPETS pet-core.js — deterministic pixel-pet generator.
 * One file, shared by the browser (window.PetCore) and Node (require).
 * No dependencies. Same seed => same pet, byte for byte.
 *
 * Algorithm (see generator/ALGORITHM.md):
 *   seedString = lower(trim(blockHash)) + ":" + lower(trim(petId))
 *   digest     = SHA-256(UTF-8(seedString))            (32 bytes)
 *   PRNG       = sfc32 seeded with digest words 0..3 (big-endian uint32), 12 warm-up draws
 *   traits     = drawn from the PRNG in a FIXED order:
 *                tier, species, pattern, eyes, mouth, cheeks, accessory,
 *                background, bgColor, 5 base stats, name
 *   art        = pure function of (traits, digest bytes 16..31, stage, frame) -> 32x32 RGBA
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PetCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 'xcpets-pet-core/3.16.0';
  var N = 32;

  // ------------------------------------------------------------------ SHA-256
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [], i, c;
    str = unescape(encodeURIComponent(str));
    for (i = 0; i < str.length; i++) { c = str.charCodeAt(i); out.push(c); }
    return new Uint8Array(out);
  }

  function sha256Bytes(msg) {
    var len = msg.length, bitLenHi = Math.floor(len / 0x20000000), bitLenLo = (len << 3) >>> 0;
    var padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    padded.set(msg); padded[len] = 0x80;
    var p = padded.length;
    padded[p - 8] = (bitLenHi >>> 24) & 255; padded[p - 7] = (bitLenHi >>> 16) & 255;
    padded[p - 6] = (bitLenHi >>> 8) & 255; padded[p - 5] = bitLenHi & 255;
    padded[p - 4] = (bitLenLo >>> 24) & 255; padded[p - 3] = (bitLenLo >>> 16) & 255;
    padded[p - 2] = (bitLenLo >>> 8) & 255; padded[p - 1] = bitLenLo & 255;
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Array(64), i, t, a, b, c, d, e, f, g, h, s0, s1, t1, t2;
    for (var off = 0; off < p; off += 64) {
      for (t = 0; t < 16; t++) {
        i = off + t * 4;
        W[t] = ((padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3]) >>> 0;
      }
      for (t = 16; t < 64; t++) {
        s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3);
        s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (t = 0; t < 64; t++) {
        s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        t1 = (h + s1 + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0;
        s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) {
      out[i * 4] = H[i] >>> 24; out[i * 4 + 1] = (H[i] >>> 16) & 255; out[i * 4 + 2] = (H[i] >>> 8) & 255; out[i * 4 + 3] = H[i] & 255;
    }
    return out;
  }
  function toHex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); return s; }
  function sha256Hex(str) { return toHex(sha256Bytes(utf8Bytes(String(str)))); }

  // --------------------------------------------------------------------- PRNG
  // sfc32 (Small Fast Counter, Chris Doty-Humphrey). 32-bit integer ops only.
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return t >>> 0;
    };
  }
  function word(bytes, i) { return ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0; }
  function makeRng(digest) {
    var next = sfc32(word(digest, 0), word(digest, 4), word(digest, 8), word(digest, 12));
    for (var i = 0; i < 12; i++) next();
    return {
      next: next,
      int: function (n) { return next() % n; },               // uniform-ish in [0,n)
      pick: function (pool, tierIdx) { return weightedPick(next, pool, tierIdx); }
    };
  }

  // --------------------------------------------------------------- Trait data
  var TIERS = [
    { id: 'common', label: 'Common', chance: 6000, statBonus: 0, color: '#9aa3b5', gearSlots: 0 },
    { id: 'uncommon', label: 'Uncommon', chance: 2700, statBonus: 3, color: '#4fd18b', gearSlots: 2 },
    { id: 'rare', label: 'Rare', chance: 1000, statBonus: 6, color: '#4f9dff', gearSlots: 4 },
    { id: 'legendary', label: 'Legendary', chance: 300, statBonus: 10, color: '#ffc93c', gearSlots: 5 }
  ]; // chances out of 10,000; gearSlots = how many gear ranks this tier can ever wear

  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var STAGE_MULT = [50, 100, 150, 225, 300, 400]; // percent
  var STAGE_SCALE = [0, 0.62, 0.78, 0.9, 1, 1];
  // Gear rank n unlocks at stage n: Hatchling band, Juvenile armor, Adult cape, Elder weapon, Mythic crown.
  var GEAR_RANKS = ['band', 'armor', 'cape', 'weapon', 'crown'];

  /*
   * SPECIES: the twelve meme characters (personal pets) + Nakamoto (the community pet; no hood, signature hachimaki from Adult).
   * All are original, hand-authored pixel maps drawn for this project (not traced/copied from any image).
   * Map legend:  .  transparent      b body      a accent      l belly/secondary
   *              k  ink detail       B brow (erasable ink)     w white
   *              E  eye white        P pupil     m mouth line  h horn   g gold   T tear   f/F ember
   * b/a/l are the character's canon colors (SPECIES[].canon); pattern traits paint with them. No text or names are ever drawn on sprites.
   * gear: armor [startRow, endRow, inset], band = headband row, scarf = scarf row (sprite coordinates).
   * arc: expression for stages 1..5 (Hatchling..Mythic): [label, eyes, brows, mouth].
   * w = base weight, t = minimum tier (items at exactly the pet's tier get x4 weight). w 0 = never rolled.
   */
  // v3.13 Peepo: one base head (peepoHappy) + per-stage mouth/tear rows (rows 9-14). All maps are 25x20.
  var PEEPO_BASE = [
    '......bbbbbb..bbbbbbb....',
    '.....b1EEEEE1b1EEEEEE1b..',
    '....bb1EEEwPP11EEEEwPP1b.',
    '...bbb1EEEPPP11EEEEPPP1b.',
    '..bbbb1EEEEEE11EEEEEEE1b.',
    '..bbbbb1EEEE1bb1EEEEE1bb.',
    '.bbbbbbb1111bbbb11111bbb.',
    '.bbbbbbbbbbbbbbbbbbbbbbbb',
    '.bbbbbbbbbbbbb1b1bbbbbbbb',
    'bbbbbbbbbmbbbbbbbbbbbbbmb',
    'bbbbbbbbbbmmmmmmmmmmmmmbb',
    'bbbbbbbbbbm66666666666mbb',
    'bbbbbbbbbbbm665555566mbbb',
    'bbbbbbbbbbbb444444444bbb.',
    '.bbbbbbbbbbbbbbbbbbbbbb..',
    'aaabbbbbbbbbbbbbbbbbbaaa.',
    'aaaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaaa'
  ];
  function peepoMap(rows) { var m = PEEPO_BASE.slice(); for (var r in rows) m[r] = rows[r]; return m; }
  var PEEPO_MAPS = {
    // Juvenile: peepoSad - light-blue tear streams under both eyes, a small open mouth with drooping corners
    2: peepoMap({ 6: '.bbbbbbT1111bbbb11111Tbb.', 7: '.bbbbbbTbbbbbbbbbbbbbTbbb', 8: '.bbbbbbTbbbbbbbbbbbbbTbbb', 9: '.bbbbbbbTbbbbb1b1bbbbTbbb',
      10: 'bbbbbbbbTbbmmmmmmmmmbbbTb', 11: 'bbbbbbbbbbm666666666mbbbb', 12: 'bbbbbbbbbbm665555566mbbbb',
      13: 'bbbbbbbbbbbb4444444bbbbbb', 14: 'bbbbbbbbbbbbbbbbbbbbbbbb.' }),
    // Adult: smug, a wide open lopsided grin (right corner hiked up)
    3: peepoMap({ 9: 'bbbbbbbbbbbbbbbbbbbbbbbmb', 10: 'bbbbbbbbbmmmmmmmmmmmmmmbb', 11: 'bbbbbbbbbbm666666666666mb',
      12: 'bbbbbbbbbbbm6655555666mbb', 13: 'bbbbbbbbbbbb4444444444bbb', 14: 'bbbbbbbbbbbbbbbbbbbbbbbb.' }),
    // Elder: content, a smaller open grin
    4: peepoMap({ 9: 'bbbbbbbbbbmbbbbbbbbbbmbbb', 10: 'bbbbbbbbbbbmmmmmmmmmmbbbb', 11: 'bbbbbbbbbbbm66555566mbbbb',
      12: 'bbbbbbbbbbbbb444444bbbbbb', 13: 'bbbbbbbbbbbbbbbbbbbbbbbbb', 14: 'bbbbbbbbbbbbbbbbbbbbbbbb.' })
  };
  var DOGE_MAP = [
    '.....bb..........bb.......',
    '.....bbb........bbbb......',
    '....bllbb......bblllb.....',
    '....blllbbbbbbbblllbb.....',
    '....bbbllbbbbbbbbllbbb....',
    '...bbbbbbbbbbbbbbbbbbb....',
    '...b22bbbbb22bbbbbbbbbb...',
    '...bEPPPbbbEPPPbbbbbbbb...',
    '...bEPPPbbbEPPPbbbbbbbb...',
    '..blEEPPlbbEEPPlbbbbbbbb..',
    '..llllllllllllllllbbbbbb..',
    '.lll33llllllllllllbbbbbb..',
    '.lll33lllllllllllbbbbbb...',
    '..lllmmmmmlllllllbbbbbb...',
    '...lllllllllllllbbbbbb....',
    '....llllllllllllbbbbbbb...',
    '...blllllllllllbbbbbbbbb..',
    '..bbllllllllllbbbbbbbbbbb.',
    '..bbllllllllllbbbbbbbbbbb.',
    '..bbbllllllllbbbbbbbbbbbb.',
    '.bbbbblllllllbbbbbbbbbbbb.',
    '.bbbllllll1llllllbbbbbbb..',
    '..bbllllllllllllll.bbbb...'
  ];
  var LENNY_MAP = [
    '.......bbbbbbbb.......',
    '....bbbbbbbbbbbbbb....',
    '..bbbbbbbbbbbbbbbbbb..',
    '.bbbbbbbbbbbbbbbbbbbb.',
    '.bbbbBBBBbbbbbBBBBbbb.',
    'bbbbBbbbbBbbbBbbbbBbbb',
    'bbbBbbPPPbbbbbPPPbbbbb',
    'bbbbbbPEPbbbbbPEPbbbbb',
    'bbbbbbPPPbbbbbbPPPbbbb',
    'bbbbbbbbbbbkkbbbbbbbbb',
    'bbbbbbbbbbbbkbbbbbbbbb',
    '.bbbbbbbbbkkbbbbbbbbb.',
    '.bbbbbmbbbbbbbbmbbbbb.',
    '..bbbbbmmmmmmmmbbbbb..',
    '...bbbbbbbbbbbbbbbb...',
    '.....bbbbbbbbbbbb.....',
    '.......bbbbbbbb.......',
    '.....bbblllllbbbb.....',
    '...bb.bbllllllbb.bb...',
    '......bbbbbbbbbb......',
    '.......bb....bb.......',
    '......aaa....aaa......'
  ];
  // Hatchling (0.62x) samples only some rows: a one-row brow over solid dot eyes keeps the Lenny read at the smallest size
  var LENNY_MAPS = { 1: LENNY_MAP.slice(0, 4).concat(['.bbbbbbbbbbbbbbbbbbbb.', 'bbbBBBBBBbbbbBBBBBBbbb', 'bbbbbbPPPbbbbbPPPbbbbb'], LENNY_MAP.slice(7)) };
  var SPECIES = [
    { id: 'pepe', label: 'Pepe', w: 12, t: 0, canon: { body: '#6aa84f', accent: '#3d6fd1', belly: '#b5533c' },
      gear: { armor: [14, 18, 1], band: 1, scarf: 13 },
      pose: { col: 4, row: 12, map: ['.kkkkk.', 'kbbbbbk', 'kbbbbbk', 'kkkkbbk', '.kbbbk.', '.kaak..', 'kaak...'] },
      arc: [['Smug', 'base', 'keep', 'smirk'], ['Curious', 'base', 'raised', 'base'], ['Determined', 'halflid', 'angry', 'flat'],
        ['Wise', 'closed', 'keep', 'smile'], ['Triumphant', 'base', 'raised', 'cheer']],
      map: [
        '..bbbbbb....bbbbbb....',
        '.bbbbbbbb..bbbbbbbb...',
        '.bkkkkkkb..bkkkkkkb...',
        '.bEEEEPPb..bEEEEPPb...',
        '.bEEEEPPbbbbEEEEPPb...',
        'bbbEEEEEbbbbbEEEEEbb..',
        'bbbbbbbbbbbbbbbbbbbbb.',
        'bbbbbbbbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbbbbbbbb',
        'bllllllllllllllllllllb',
        'blmmmmmmmmmmmmmmmmmmlb',
        'bbllllllllllllllllllbb',
        '.bbbbbbbbbbbbbbbbbbbb.',
        '..bbbbbbbbbbbbbbbbbb..',
        '...aaaaaaaaaaaaaaaa...',
        '..aaaaaaaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaaaaaaa.'
      ] },
    { id: 'wojak', label: 'Wojak', w: 12, t: 0, canon: { body: '#f1e4d4', accent: '#5a6a8a', belly: '#dcb8a2' }, outline: '#6e5f5c', colors: { '1': { from: 'body', dark: 0.4 } }, eyeWhite: '#ffffff', eyeLid: true, bellyKey: 'accent', // pattern fix 2026-10-12: Belly patch on the shirt, not the face
      gear: { armor: [20, 21, 0], band: 5, scarf: 19, cape: 17, crownSink: 2, noHeadband: true },
      pose: { col: 2, row: 12, map: ['.kkkkk.', 'kbbbbbk', 'kbbbbbk', 'kkkkbbk', '.kbbbk.', '.kaak..'] },
      arc: [['Sad', 'base', 'keep', 'base'], ['Doubtful', 'halflid', 'keep', 'flat'], ['Calm', 'base', 'none', 'flat'],
        ['Hopeful', 'base', 'raised', 'smile'], ['Enlightened', 'closed', 'none', 'smile']],
      tearDrop: { 5: 2 }, // v3.14: at Mythic the tear sits on the cheek, two rows below the closed eye
      // classic Wojak: tall oval bald head, moderate brow area with forehead creases, eyes at mid-height looking aside,
      // eyes = white sclera + dark pupil with an ink upper lid (eyeLid) so the whites read on pale skin
      map: [
        '.....bbbbbbb......',
        '...bbbbbbbbbbb....',
        '..bbbbbbbbbbbbbb..',
        '.bbbbbb111111bbbb.',
        '.bbbbbbbbbbbbbbbb.',
        'bbbbb111111111bbb.',
        'bbbbbbBBBbbbBBbbb.',
        'bbbbbbbbb1bb1bbbb.',
        'bbbbbbbbbbbbbbbbb.',
        'bbbbbbEPPbbbEPPbb.',
        'bbbbbbEPPbbbEPPbb.',
        'bbbbbbbTbbbbbbbbb.',
        'bbbbbbbbbbbbkbbbb.',
        '.bbbbbbbbkbbbkbbb.',
        '.bbbbbbbbbkbkbbbb.',
        '..bbbbbbbbbbbbbbb.',
        '...bbbbbbbbbbbbb..',
        '....bbbbbmmmmbbb..',
        '.....bbbbbbbbmb...',
        '......bbbbbbbb....',
        '..aaaaaaaaaaaaaa..',
        'aaaaaaaaaaaaaaaaaa'
      ] },
    { id: 'chud', label: 'Chud', w: 8, t: 0, canon: { body: '#f1e4d4', accent: '#6b7a3a', belly: '#6b4a2b' }, outline: '#6e5f5c', colors: { '1': { from: 'body', dark: 0.4 }, '2': '#5e3f26', '3': '#1d1b22', '4': '#45414f' }, eyeWhite: '#ffffff', glasses: true, bellyKey: 'accent', // pattern fix 2026-10-12: Belly patch on the shirt, not the face
      gear: { armor: [20, 21, 0], band: 5, scarf: 19, cape: 17, crownSink: 2, noHeadband: true },
      pose: { col: 2, row: 12, map: ['.kkkkk.', 'kbbbbbk', 'kbbbbbk', 'kkkkbbk', '.kbbbk.', '.kaak..'] },
      arc: [['Stern', 'base', 'keep', 'base'], ['Smirking', 'base', 'keep', 'smirk'], ['Determined', 'halflid', 'angry', 'flat'],
        ['Grinning', 'base', 'keep', 'grin'], ['Proud', 'closed', 'raised', 'cheer']],
      // straight, level gaze (centred pupils, no droopy lid) behind always-on clear eyeglasses (glasses: true)
      // the new Wojak head (same proportions: creases, brows with inner ticks, white eyes, hooked nose, mouth low)
      // plus a full beard ('2' = fixed dark-brown beard colour) over jaw and chin that frames the mouth; near-black hair ('3', '4' = subtle highlight) with a straight fringe of bangs above the brows; no headband (neck-scarf rule)
      map: [
        '.....3333333......',
        '...33344443333....',
        '..33344444433333..',
        '.3333333333333333.',
        '.3333333333333333.',
        '33bbbbbbbbbbbbb33.',
        '3bbbbbBBBbbbBBbb3.',
        '3bbbbbbbb1bb1bbbb.',
        'bbbbbbbbbbbbbbbbb.',
        'bbbbbbEPEbbbEPEbb.',
        'bbbbbbEPEbbbEPEbb.',
        'bbbbbbbbbbbbbbbbb.',
        '2bbbbbbbbbbbkbbb2.',
        '.22bbbbbbkbbbkb22.',
        '.222bbbbbbkbkbb22.',
        '..222bbbbbbbbb222.',
        '...22222222222222.',
        '....22222mmmm2222.',
        '.....22222222m22..',
        '......22222222....',
        '..aaaaaaaaaaaaaa..',
        'aaaaaaaaaaaaaaaaaa'
      ] },
    { id: 'bobo', label: 'Bobo', w: 10, t: 1, canon: { body: '#704728', accent: '#cc1414', belly: '#c4805b' }, sunFrame: '#ffd23f', // gold Sunglasses frame: default black blends into the dark brown fur
      colors: { '1': { from: 'body', dark: 0.24 } }, eyeWhite: '#ffffff', shades: { chance: 25, stages: [1, 2, 3, 4] },
      gear: { armor: [18, 21, 1], band: 3, scarf: 16, cape: 17 },
      pose: { col: 2, row: 15, map: ['.kkkkk.', 'klllllk', 'klllllk', 'kkkkllk', '.klllk.', '.kaak..', 'kaak...'] },
      arc: [['Gloomy', 'base', 'keep', 'base'], ['Grumpy', 'base', 'angry', 'frown'], ['Steady', 'base', 'keep', 'flat'],
        ['Cheerful', 'base', 'raised', 'smile'], ['Jolly', 'base', 'none', 'cheer']], // v3.14: Mythic keeps the smug open eyes,
      // Bitcoin-Stamp-style bear: big square head, round ears (tan insides), dark muzzle block + black nose,
      // Pepe-style heavy, half-lidded smug eyes (ink lid, whites, pupils to one side), red shirt.
      // Black pixel shades are an occasional accessory (~25%, see shades / render); off at Mythic.
      map: [
        '.bbb..............bbb.',
        'bblbb............bblbb',
        'bbllbbbbbbbbbbbbbbllbb',
        'bbbbbbbbbbbbbbbbbbbbbb',
        '.bbbbbbbbbbbbbbbbbbbb.',
        '.bbbbbbbbbbbbbbbbbbbb.',
        '.bbkkkkkkbbbbkkkkkkbb.',
        '.bbEEEEPPbbbbEEEEPPbb.',
        '.bbEEEEPPbbbbEEEEPPbb.',
        '.bbbEEEEbbbbbbEEEEbbb.',
        '.bbbbb1111111111bbbbb.',
        '.bbbb111kkkkkk111bbbb.',
        '.bbbb1111kkkk1111bbbb.',
        '.bbbb111111111111bbbb.',
        '.bbbb1111mmmmmm11bbbb.',
        '.bbbbb1111111111bbbbb.',
        '..bbbbbbbbbbbbbbbbbb..',
        '...bbbbbbbbbbbbbbbb...',
        '..aaaaaaaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaaaaaaaa'
      ] },
    { id: 'mumu', label: 'Mumu', w: 10, t: 1, canon: { body: '#d06311', accent: '#33ae1f', belly: '#f0d8b2' },
      colors: { '2': '#f3da8e', '3': '#fdefd5', '4': '#fbf6ec', '5': '#f2a0a8' }, eyeWhite: '#ffffff',
      gear: { armor: [17, 20, 1], band: 4, scarf: 15, cape: 16, crownSink: 2 },
      pose: { col: 1, row: 14, map: ['.kkkkk.', 'klllllk', 'klllllk', 'kkkkllk', '.klllk.', '.kaak..', 'kaak...'] },
      arc: [['Calm', 'base', 'keep', 'base'], ['Snorting', 'base', 'angry', 'flat'], ['Charging', 'halflid', 'angry', 'open'],
        ['Confident', 'base', 'keep', 'smile'], ['Triumphant', 'base', 'raised', 'cheer']],
      // burnt-orange bull: white blaze ending in a spiky tuft, wide peach snout with nostrils, heavy smug lids,
      // cream horns curving up/out, sideways ears with pink insides, green shirt
      map: [
        '.2.......4.44.4.......2.',
        '.23......444444......32.',
        '..23...bbb4444bbb...32..',
        '...23bbbbbb44bbbbbb32...',
        '....bbbbbbb44bbbbbbb....',
        'b55bbbbbbbb44bbbbbbbb55b',
        '.bbbbkkkkbb44bbkkkkbbbb.',
        '...bbEEPPbb44bbEEPPbb...',
        '...bbbbbbbb44bbbbbbbb...',
        '..bbbbllllllllllllbbbb..',
        '..bbllllllllllllllllbb..',
        '..bblllkkllllllkklllbb..',
        '..bbllllllllllllllllbb..',
        '..bbllllmmmmmmmmllllbb..',
        '...bbllllllllllllllbb...',
        '....bbbbbbbbbbbbbbbb....',
        '.....bbbbbbbbbbbbbb.....',
        '...aaaaaaaaaaaaaaaaaa...',
        '..aaaaaaaaaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaaaaaaaaa'
      ] },
    { id: 'snibby', label: 'Snibby', w: 10, t: 2, canon: { body: '#ffdf01', accent: '#fba901', belly: '#dd9604' },
      eyeWhite: '#ffffff', browOnBody: true,
      gear: { armor: [17, 18, 3], cape: 12, band: 1, scarf: 16, crownSink: 9 },
      pose: { col: 1, row: 15, map: ['.kkkkk.', 'kaaaaak', 'kaaaaak', 'kkkkaak', '.kaaak.', '.kllk..'] },
      arc: [['Happy', 'base', 'keep', 'base'], ['Excited', 'base', 'raised', 'open'], ['Fierce', 'base', 'angry', 'grin'],
        ['Smug', 'halflid', 'keep', 'smirk'], ['Triumphant', 'base', 'raised', 'cheer']],
      // yellow blob crab: two tall eyestalks (slit eyes near the top), wide duck-bill grin with orange lips,
      // raised C-shaped orange pincers, stubby pointed legs
      map: [
        '.....bbbb......bbbb.....',
        '....bbbbbb....bbbbbb....',
        '....bbEEbb....bbEEbb....',
        '....bbEPbb....bbPEbb....',
        '....bbEPbb....bbPEbb....',
        '....bbbbbb....bbbbbb....',
        '.....bbbb......bbbb.....',
        '.aa..bbbb......bbbb..aa.',
        'aa.a.bbbb......bbbb.a.aa',
        'a....bbbbbbbbbbbbbb....a',
        'aa.a.bbbbbbbbbbbbbb.a.aa',
        '.aaabbbbbbbbbbbbbbbbaaa.',
        '...abbbbbbbbbbbbbbbba...',
        '...bbbaaaaaaaaaaaabbb...',
        '..bbbaammmmmmmmmmaabbb..',
        '..bbbbaammmmmmmmaabbbb..',
        '..bbbbbaaaaaaaaaabbbbb..',
        '...bbbbbbbbbbbbbbbbbb...',
        '....bbbbbbbbbbbbbbbb....',
        '...a.a.a........a.a.a...',
        '..a.a.a..........a.a.a..'
      ] },
    { id: 'dodo', label: 'Dodo', w: 10, t: 3, canon: { body: '#4a4a56', accent: '#c41a1a', belly: '#6b6b78' }, sunFrame: '#d63031', // red frame: dark shades vanish on the charcoal head; red matches his beak
      colors: { '5': '#6b6b6b', '6': '#7a0000', '7': { from: 'accent', light: 0.45 } }, eyeWhite: '#ffffff', eyeSplit: 14,
      gear: { armor: [14, 17, 8], cape: 12, capeHalf: 9, band: 1, scarf: 9, crownCol: 15 },
      pose: { col: 16, row: 8, map: ['.kkkkk.', 'k55555k', 'k55555k', 'kkkk55k', '.k55k..', 'k55k...'] },
      // v3.10: Determined keeps the eyes open (the 2-px eyes are 1 px at Adult scale, so a half lid would erase them) and Serene
      // half-lids instead of closing (an ink closed line is invisible on the charcoal head); labels and brow/mouth shifts unchanged
      arc: [['Blank', 'base', 'keep', 'base'], ['Curious', 'base', 'raised', 'base'], ['Determined', 'base', 'angry', 'flat'],
        ['Serene', 'halflid', 'keep', 'base'], ['Majestic', 'base', 'raised', 'open']],
      // black swan, side view facing right: S-curve neck, round head, spiky back feathers, long red wedge beak
      // (red runs under the eyes), smirk line, red webbed feet. v3.10: head turned toward the viewer with TWO smug lidded eyes
      // (grey upper lid, 2-px-tall white with the pupil pushed toward the beak = a sideways glance); eyeSplit = map column that
      // separates the left and right eye anchors (both eyes sit right of canvas x=16 on this off-centre head).
      // v3.11: bigger head (rows 0-8, 15 px wide; the neck is one row shorter so body/gear rows are unchanged), eyes moved up
      // two rows, and a bolder full-length beak: light-red top highlight ('7' = accent lightened), red upper bill, ink smirk
      // line, red lower bill with a dark-red ('6') underside. Headband moved up to row 1 so it never covers the lids.
      // v3.14: rounder head (stepped crown, one column wider on the left) and ONE side-profile eye (4x3 white, pupil toward
      // the beak, 2-px grey lid over the pupil side) set forward on the head above the red cheek stripe.
      map: [
        '...........bbbbbbb........',
        '.........bbbbbbbb55b......',
        '........bbbbbbbEEPEbbb....',
        '.......bbbbbbbbEEPEbbb7777',
        '.......bbbbbbbbEEPEbbaaaaa',
        '.......bbbbbbbbaaaaaaaaaa7',
        '........bbbbbbbbbbmmmmmmmm',
        '.........bbbbbbbbaaaaaaa6.',
        '...........bbbbbb666666...',
        '............bbbbb.........',
        '............bbbb..........',
        '...........bbbb...........',
        '.b.b.b....bbbbbb..........',
        'bbbbbbbbbbbbbbbbbbb.......',
        '.bbbbbbbbbbbbbbbbbbbb.....',
        'bbbbbbbbbbllllllbbbbb.....',
        '.bbbbbbbbllllllllbbbbb....',
        '..bbbbbbbbllllllbbbbbb....',
        '...bbbbbbbbbbbbbbbbbb.....',
        '.....bbbbbbbbbbbbbbb......',
        '........aa...aa...........',
        '.......aaaa.aaaa..........'
      ] },
    { id: 'kevin', label: 'KEVIN', w: 5, t: 0, tw: [6, 5, 4, 5], canon: { body: '#bd8a75', accent: '#84a1b6', belly: '#b1806c' },
      colors: { '1': { from: 'body', dark: 0.07 }, '2': { from: 'body', dark: 0.2 }, '3': '#958a87', '4': '#83746d', '5': '#6b5751', '6': '#894a28' },
      eyeWhite: '#84a1b6', pupil: '#136613',
      egg: { shell: '#dc6e16', spot: '#83746d' },
      gear: { armor: [21, 21, 1], band: 2, scarf: 18, cape: 18, crownSink: 0, noHeadband: true },
      pose: { col: 4, row: 15, map: ['.kkkkk.', 'kbbbbbk', 'kbbbbbk', 'kkkkbbk', '.kbbbk.', '.kaak..', 'kaak...'] },
      arc: [['Deadpan', 'base', 'keep', 'base'], ['Suspicious', 'base', 'angry', 'flat'], ['Amused', 'base', 'keep', 'smile'],
        ['Grinning', 'base', 'raised', 'grin'], ['Knowing', 'base', 'keep', 'smirk']],
      // KEVIN (Counterparty card, ref meme_ref/kevin): grey jaw-length helmet of hair over the ears ('3' light, '4' mid,
      // '5' dark), fuller on the viewer's right with a darker lock ('6'/'5') over the upper-right forehead; long warm tan face
      // ('1'/'2' = flat shading, nose drawn with shadow only); narrow green slit eyes (pale-blue glint) under flat black brows;
      // flat mouth over a brown lower lip ('6'); brown V at the neck; pale-blue shirt shoulders. Egg = his orange (#DC6E16).
      // Hats/crowns sit on top of the hair (crownSink 0) and never replace it; headbands become a neck scarf (noHeadband).
      map: [
        '......44333344......',
        '....443333333344....',
        '...4433333333553344.',
        '..443bbbbbbb6553344.',
        '..435bbbbbbbb655334.',
        '.4435bbbbbbbbb653544',
        '.4535bBBBbbBBBb53544',
        '.4535bPPEbbPPEb53534',
        '.4535bbbb2bbbbb53344',
        '.4435bbbb2bbbbb53344',
        '.4435bbb22bbbbb53344',
        '.4435b1bbbbbb1b53344',
        '.4435b1mmmmmm1b53344',
        '.4435bb166661bb53344',
        '.4435bbb1111bbb53344',
        '..445bb1111bb5344...',
        '......2bbbbbb2......',
        '.......6bbbb6.......',
        '........6bb6........',
        '..aaaaaaa66aaaaaaa..',
        '.aaaaaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaaaaa'
      ] },
    // ---- v3.13 additions (original pixel homages in the house style) ----
    // PEEPO (peepoHappy emote, ref meme_ref/peepo): a wide, round green head peeking up over a bright-blue shirt band,
    // big glossy white eyes bulging on top of the head (black pupils looking up, white highlight), nostril dots, and a wide
    // open mouth with brown lips and a pink tongue. Faces right like the emote. Per-stage maps swap only the mouth/tear rows:
    // Mouth inside ('6') is fixed #d63031, the exact red of Doge's red scarf (BANDS red-scarf), at every stage.
    // Hatchling peepoHappy, Juvenile peepoSad (tears, downturned lip), Adult flat smug lip, Elder content smile, Mythic happy.
    { id: 'peepo', label: 'Peepo', w: 6, t: 0, tw: [7, 6, 5, 5], canon: { body: '#8cc63f', accent: '#0649ff', belly: '#9f4d37' },
      // Sunglasses: fixed lenses in MAP coords (the auto eye boxes split his two bulging eyes unevenly and merged them into one visor)
      sunLens: { cols: [[7, 11], [15, 20]], rows: [1, 5], bridgeRow: 2 },
      colors: { '1': '#2d5b18', '4': '#9f4d37', '5': '#f1a7c4', '6': '#d63031' }, eyeWhite: '#ffffff', eyeSplit: 13, browOnBody: true,
      egg: { shell: '#6ba241', spot: '#0649ff' },
      gear: { armor: [17, 19, 0], band: 7, scarf: 16, cape: 15, crownSink: 1, noHeadband: true },
      pose: { col: 6, row: 12, map: ['.kkkkk.', 'kbbbbbk', 'kbbbbbk', 'kkkkbbk', '.kbbbk.', '.kaak..', 'kaak...'] },
      arc: [['Happy', 'base', 'keep', 'base'], ['Sad', 'halflid', 'worried', 'base'], ['Determined', 'base', 'angry', 'base'],
        ['Content', 'halflid', 'keep', 'base'], ['Overjoyed', 'base', 'raised', 'base']],
      stageMaps: PEEPO_MAPS,
      map: PEEPO_BASE },
    // SARUTOBI ('Tobi', the 8-bit monkey from the 2014 Bitcoin game SaruTobi; ref meme_ref/saratobo): brown body, a big round
    // tan face disc (must-keep), two tall black oval eyes, round ears with tan insides, tan belly, one arm raised, and a 2-px
    // thick curly tail (must-keep) curling up on the left.
    { id: 'sarutobi', label: 'Sarutobi', w: 5, t: 0, tw: [6, 5, 4, 5], canon: { body: '#7f4106', accent: '#5a2c03', belly: '#e9a63a' }, sunFrame: '#ffb000', // amber Sunglasses frame: default black blends into the dark brown body
      colors: { '1': { from: 'belly', dark: 0 } }, eyeWhite: '#ffffff',
      egg: { shell: '#7f4106', spot: '#e9a63a' },
      gear: { armor: [15, 17, 7], band: 2, scarf: 14, cape: 14, crownSink: 1 },
      pose: { col: 4, row: 11, map: ['.kkkkk.', 'k11111k', 'k11111k', 'kkkk11k', '.k111k.', '.kbbk..', 'kbbk...'] },
      arc: [['Cheeky', 'base', 'keep', 'base'], ['Hungry', 'base', 'raised', 'open'], ['Focused', 'base', 'keep', 'flat'],
        ['Grinning', 'base', 'keep', 'grin'], ['Triumphant', 'base', 'raised', 'cheer']],
      map: [
        '..........bbbbbb..........',
        '........bbbbbbbbbb........',
        '.......bbbbbbbbbbbb.......',
        '......bbbbllllllbbbb......',
        '..bbb.bbllllllllllbb.bbb..',
        '.bbllbbllllllllllllbbllbb.',
        '.bllllbllPPllllPPllbllllb.',
        '.bllllblPPPllllPPPlbllllb.',
        '.bbllbblPPPllllPPPlbbllbb.',
        '..bbb.blPPPllllPPPlb.bbb..',
        '......bllPPllllPPllb......',
        '......bllllllllllllb......',
        '.......llllmmmmllll.......',
        '........bllllllllb........',
        '.bbb......bbbbbb.......bb.',
        'b...b...bbbllllbbb....bb..',
        'b..bb..bbblllllllbbbbbb...',
        'b..b..bbbbllllllllbbb.....',
        '.b...bbb.bllllllllb.......',
        '..bbbbb..bbllllllbb.......',
        '.........bbbb..bbbb.......',
        '........aaaa....aaaa......'
      ] },
    // DOGE (Kabosu, the 2010 Doge photo; ref meme_ref/doge): orange-tan Shiba fur with a darker shadow ('1'), cream urajiro
    // muzzle, cheeks and chest, pale eyebrow dots ('2'), upright pointed ears with cream insides, black nose and a pulled-back
    // mouth line, and the side-eye (dark pupils pushed to one side, whites showing) on a 3/4 head turned to the viewer's left,
    // seated with crossed front paws.
    { id: 'doge', label: 'Doge', w: 6, t: 0, tw: [7, 6, 5, 6], canon: { body: '#ce9a41', accent: '#bd8a3b', belly: '#f0e6cc' },
      colors: { '1': { from: 'body', dark: 0.1 }, '2': '#e2c588', '3': '#383833' }, eyeWhite: '#ffffff', pupil: '#2a2a26', eyeSplit: 10,
      egg: { shell: '#ce9a41', spot: '#f0e6cc' },
      gear: { armor: [17, 20, 3], band: 5, scarf: 16, cape: 15, crownSink: 2, crownCol: 12 },
      pose: { col: 1, row: 15, map: ['.kkkkk.', 'klllllk', 'klllllk', 'kkkkllk', '.klllk.', '.kbbk..', 'kbbk...'] },
      arc: [['Skeptical', 'base', 'keep', 'base'], ['Suspicious', 'halflid', 'keep', 'flat'], ['Wow', 'base', 'keep', 'open'],
        ['Such Calm', 'halflid', 'keep', 'smile'], ['Much Wow', 'base', 'keep', 'cheer']],
      map: DOGE_MAP },
    // LENNY ( ͡° ͜ʖ ͡°) (LENNYSTAMP look; ref meme_ref/lenny_face): a big round warm-yellow face with black line features: two
    // long raised arched brows over small ring eyes (half-lidded: the arc sits right on the ring), a sideways hook nose and a
    // shallow smirk; a tiny body with stubby arms and feet so gear and the hand-to-chin pose work.
    { id: 'lenny', label: 'Lenny', w: 5, t: 0, tw: [6, 5, 5, 5], canon: { body: '#f2b98a', accent: '#3a3a44', belly: '#ffdcc0' },
      colors: { '1': { from: 'body', dark: 0.12 } }, eyeWhite: '#ffffff',
      egg: { shell: '#fecc66', spot: '#d99a2b' },
      gear: { armor: [16, 18, 5], band: 2, scarf: 15, cape: 15, crownSink: 1 },
      pose: { col: 2, row: 11, map: ['.kkkkk.', 'kbbbbbk', 'kbbbbbk', 'kkkkbbk', '.kbbbk.', '.kaak..', 'kaak...'] },
      arc: [['Sly', 'base', 'keep', 'base'], ['Suggestive', 'halflid', 'keep', 'smirk'], ['Scheming', 'halflid', 'angry', 'smirk'],
        ['Delighted', 'base', 'keep', 'grin'], ['Knowing', 'halflid', 'keep', 'base']],
      stageMaps: LENNY_MAPS,
      map: LENNY_MAP },
    // ---- The community pet: NAKAMOTO (never rolled for personal pets). A Rare-Pepe 'Nakamoto Card' face (green skin,
    // grey hair, black glasses, droopy red lips), drawn closer to Bitcoin Stamp #613 ('Nakamoto punk') from Elder on.
    // v3.14: the hood is gone at every stage, Mythic included. Each stage has its own pixel map (stageMaps).
    { id: 'nakamoto', label: 'Nakamoto', w: 0, t: 0, community: true,
      canon: { body: '#488101', accent: '#555555', belly: '#7f7f7f' },
      colors: { '1': '#555555', '2': '#888888', '3': '#568023', '4': '#41621a', '5': '#7f7f7f', '6': '#c1291c',
        '8': '#4a4a4a', '9': '#c8c8c8', r: '#636084', v: '#8677b3', e: '#c9c3e6' },
      eyeWhite: '#a82060', pupil: '#880858', lasers: true, symLenses: true,
      patternKeys: ['sp3', 'sp2'], patternBelowFace: true, patternCx: -5, // pattern fix 2026-10-12: patterns on his green neck + shirt (no plain body area)
      // v3.14 signature headwear: a white hachimaki (tied headband) with a small orange Bitcoin disc on the front, worn from
      // Adult up on every Nakamoto (render-only, not a rolled trait; his rolled band slot stays the neck scarf).
      hachimaki: false, noCheeks: true, // v3.14 stamp look: flat face, no blush
      // Egg: no hood. A pale grey-green shell with green speckles (spots = the DNA speckles) and a tiny pair of thin black
      // rectangular glasses (1-px white lenses) drawn on the shell as a hint of what hatches; the usual crack at frames 2-3.
      egg: { shell: '#a9b3a0', spot: '#488101', glasses: true },
      gear: { armor: [22, 23, 3], band: 6, scarf: 20, cape: 19, crownSink: 1, noHeadband: true },
      pose: { col: 12, row: 16, map: ['.kkkkk.', 'k33333k', 'k33333k', 'kkkk33k', '.k333k.', '.k22k..', 'k22k...'] }, // v3.14: one row lower so the lip shows
      arc: [['Shy', 'base', 'keep', 'base'], ['Curious', 'base', 'raised', 'base'], ['Studious', 'halflid', 'keep', 'base'],
        ['Sullen', 'base', 'angry', 'base'], ['Mysterious', 'base', 'keep', 'base']], // v3.14: mouth 'base' keeps the single red stamp lip
      // Growth arc (no hood at any stage since v3.14):
      // 1 Hatchling: a small green Pepe-style baby face: big heavy-lidded Pepe eyes (both pupils on the same side), wide red lips
      // 2 Juvenile: a dark hair tuft, brows, Pepe eyes (both glancing the same way), a nose and red lips
      // 3 Adult: green Pepe-style face, dark hair, thin black rectangular glasses (1-px frames, white lenses, centred pupils)
      // 4 Elder (v3.14, after Stamp #613): a big bushy grey mop ('5' #7f7f7f with '9' #c8c8c8 strands) that comes down the
      //   sides to the glasses, thick black glasses spanning the face (4-px white lenses, 2-px centred pupils), a big nose,
      //   droopy red lips, jowls, dark shirt
      // 5 Mythic: the same face with the hand-to-chin pose (green hand, dark sleeve) and all gear
      // Eyes are level and natural at every stage (no inward/cross-eyed pupils); powered laser eyes centre on the pupils.
      stageMaps: {
        1: [
          '....................',
          '....................',
          '....................',
          '....................',
          '..33334444333.......',
          '.333343333433333....',
          '.3333333333433333...',
          '.333333333333333333.',
          '.333333333333333333.',
          '.kkkkk3kkkkk3333333.',
          '.kPPPkkkPPPkk3333...',
          '.kEEEk3kEEEk33333...',
          '..kkk333kkk33334....',
          '..333443333333......',
          '..33333343433.......',
          '...4m333333333......',
          '....mmmm33333.......',
          '...4333333333.......',
          '....333333333.......',
          '....333333333.......',
          '....333333333.......',
          '....333333333.......',
          '...2333333222.......',
          '..22233322222.......'
        ],
        2: [
          '....................',
          '....................',
          '..8888888888888.....',
          '..88888833888888....',
          '..88334444333888....',
          '.888343333433888....',
          '.8833333333438888...',
          '.883333333333888888.',
          '.833333333333888888.',
          '.kkkkk3kkkkk3888888.',
          '.kPPPkkkPPPkk8888...',
          '.kEEEk3kEEEk38338...',
          '..kkk333kkk33834....',
          '..333443333333......',
          '..33333343433.......',
          '...4m333333333......',
          '....mmmm33333.......',
          '...4333333333.......',
          '....333333333.......',
          '....333333333.......',
          '....333333333.......',
          '....333333333.......',
          '...2333333222.......',
          '..22233322222.......'
        ],
        3: [
          '....................',
          '....................',
          '..8888888888888.....',
          '..88888833888888....',
          '..88334444333888....',
          '.888343333433888....',
          '.8833333333438888...',
          '.883333333333888888.',
          '.833333333333888888.',
          '.kkkkk3kkkkk3888888.',
          '.kPPPkkkPPPkk8888...',
          '.kEEEk3kEEEk38338...',
          '..kkk333kkk33834....',
          '..333443333333......',
          '..33333343433.......',
          '...4m333333333......',
          '....mmmm33333.......',
          '...4333333333.......',
          '....333333333.......',
          '....333333333.......',
          '....333333333.......',
          '....333333333.......',
          '...2333333222.......',
          '..22233322222.......'
        ],
        4: [
          '....................',
          '....................',
          '..5555555555555.....',
          '..55555533555555....',
          '..55334444333555....',
          '.555343333433555....',
          '.5533333333435555...',
          '.553333333333555555.',
          '.533333333333555555.',
          '.kkkkk3kkkkk3555555.',
          '.kPPPkkkPPPkk5555...',
          '.kEEEk3kEEEk35335...',
          '..kkk333kkk33534....',
          '..333443333333......',
          '..33333343433.......',
          '...4m333333333......',
          '....mmmm33333.......',
          '...4333333333.......',
          '....333333333.......',
          '....333333333.......',
          '....333333333.......',
          '....333333333.......',
          '...2333333222.......',
          '..22233322222.......'
        ]
      },
      // v3.14: no hood at any stage. Mythic = the Elder face (Stamp #613 'Nakamoto punk' look) plus the pose and gear.
      map: [
        '....................',
        '....................',
        '..5555555555555.....',
        '..55555533555555....',
        '..55334444333555....',
        '.555343333433555....',
        '.5533333333435555...',
        '.553333333333555555.',
        '.533333333333555555.',
        '.kkkkk3kkkkk3555555.',
        '.kPPPkkkPPPkk5555...',
        '.kEEEk3kEEEk35335...',
        '..kkk333kkk33534....',
        '..333443333333......',
        '..33333343433.......',
        '...4m333333333......',
        '....mmmm33333.......',
        '...4333333333.......',
        '....333333333.......',
        '....333333333.......',
        '....333333333.......',
        '....333333333.......',
        '...2333333222.......',
        '..22233322222.......'
      ] }
  ];
  /* SMALL_MAPS:BEGIN (2026-10-16 sprite cleanup) Hatchling (1) and Juvenile (2) maps drawn at native size, one pixel = one canvas pixel,
   * instead of nearest-neighbour shrinking. Same box size as the old 0.62x / 0.78x scale, so gear anchors (rowY/colX) are unchanged. */
  var SMALL_MAPS = {
    pepe: {
      1: [
        '.bbbb..bbbbb..',
        '.kkkkb.bkkkk..',
        '.EEEPb.bEEPP..',
        'bbEEEbbbEEEbb.',
        'bbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbb',
        'bmmmmmmmmmmmmb',
        'bbllllllllllbb',
        '.bbbbbbbbbbbb.',
        '..aaaaaaaaaa..',
        '.aaaaaaaaaaaa.',
        '.aaaaaaaaaaaa.'],
      2: [
        '.bbbbb...bbbbb...',
        '.bkkkkb..kkkkkb..',
        '.bEEEPb..EEEPPb..',
        '.EEEEPbbbEEEPPb..',
        'bbEEEEbbbbEEEEbb.',
        'bbbbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbbb',
        'blllllllllllllllb',
        'bmmmmmmmmmmmmmmmb',
        'bbbbbbbbbbbbbbbbb',
        '.bbbbbbbbbbbbbbb.',
        '..aaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.',
        '.aaaaaaaaaaaaaaa.'],
    },
    wojak: {
      1: [
        '...bbbbb...',
        '..bbbbbbb..',
        '.bbbbbbbbb.',
        '.bbbbbbbbb.',
        '.bbkkbkkbb.',
        '.bbEPbEPbb.',
        '.bbbbbbbbb.',
        '.bbbb1bbbb.',
        '.bbbbbbbbb.',
        '.bbbbbbbbb.',
        '..bbmmmbb..',
        '..bbbbbbb..',
        '...bbbbb...',
        'aaaaaaaaaaa'],
      2: [
        '....bbbbb.....',
        '..bbbbbbbbb...',
        '.bbbbb1111bbb.',
        '.bbbbbbbbbbbb.',
        'bbbb1111111bb.',
        'bbbbbBBbbBBbb.',
        'bbbbbkkbbkkkb.',
        'bbbbbPPbbEPPb.',
        'bbbbbPPbbbPPb.',
        'bbbbbbbbbkbbb.',
        '.bbbbbbkbbkbb.',
        '.bbbbbbbbkbbb.',
        '..bbbbbbbbbbb.',
        '...bbbbmmmmb..',
        '....bbbmbbm...',
        '..aaaaaaaaaa..',
        'aaaaaaaaaaaaaa'],
    },
    chud: {
      1: [
        '..3333333..',
        '.333333333.',
        '.333333333.',
        '3bbbbbbbbb3',
        '3bkkbbbkkb3',
        'bbEPbbbEPbb',
        'bbbbb1bbbbb',
        '22bbbbbbb22',
        '222bbbbb222',
        '2222mmm2222',
        '.222222222.',
        '..2222222..',
        '...22222...',
        'aaaaaaaaaaa'],
      2: [
        '....33333.....',
        '..334444333...',
        '.333333333333.',
        '.333333333333.',
        '3bbbbbbbbbbb3.',
        '3bbbbBBbbBBbb.',
        'bbbbbkkbbkkkb.',
        'bbbbbPEbbEPEb.',
        'bbbbbPEbbbPbb.',
        '2bbbbbbbbkbbb.',
        '.2bbbbbkbbkb2.',
        '.22bbbbbbkb22.',
        '..22222222222.',
        '...2222mmmm22.',
        '....222m22m2..',
        '..aaaaaaaaaa..',
        'aaaaaaaaaaaaaa'],
    },
    bobo: {
      1: [
        'bbb........bbb',
        'blbbbbbbbbbblb',
        'bbbbbbbbbbbbbb',
        '.bkkbkbbkkbkb.',
        '.bEEkPbbEEkPb.',
        '.bEEEPbbEEEPb.',
        '.bbE111111Ebb.',
        '.bb11kkkk11bb.',
        '.bb11111111bb.',
        '.bb111mmm11bb.',
        '.bbbbbbbbbbbb.',
        '..aaaaaaaaaa..',
        'aaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaa'],
      2: [
        '.bb...........bb.',
        'bblb.........blbb',
        'bbbbbbbbbbbbbbbbb',
        '.bbbbbbbbbbbbbbb.',
        '.bkkkkkbbbkkkkkb.',
        '.bEEEPPbbbEEEPPb.',
        '.bEEEPPbbbEEEPPb.',
        '.bbEEEbbbbbEEEbb.',
        '.bbb11kkkkk11bbb.',
        '.bbb111kkk111bbb.',
        '.bbb111111111bbb.',
        '.bbb111mmmmm1bbb.',
        '.bbbbbbbbbbbbbbb.',
        '..bbbbbbbbbbbbb..',
        '.aaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaaa'],
    },
    mumu: {
      1: [
        '......444......',
        '.2..bb444bb..2.',
        '..bbbbb4bbbbb..',
        'b5bkkkb4bkkkb5b',
        '..bEPPb4bEEPb..',
        '..bbbbb4bbbbb..',
        '.bblllllllllbb.',
        '.bbllllllllllb.',
        '.bbllmmmmmllbb.',
        '..bbbbbbbbbbb..',
        '...abbbbbbba...',
        '.aaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaa'],
      2: [
        '.2.....4.4.4.....2.',
        '.23....44444....32.',
        '..23bbbbb4bbbbb32..',
        '...bbbbbb4bbbbbb...',
        'b5bbkkkbb4bbkkkbb5b',
        '..bbEPPbb4bbEPPbb..',
        '..bbbbbbb4bbbbbbb..',
        '..bblllllllllllbb..',
        '..blllklllllklllb..',
        '..blllllllllllllb..',
        '..blllmmmmmmmlllb..',
        '...bbbbbbbbbbbbb...',
        '....bbbbbbbbbbb....',
        '..aaaaaaaaaaaaaaa..',
        '.aaaaaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaaaaa'],
    },
    snibby: {
      1: [
        '...bkb...bkb...',
        '..bbEb...bEb...',
        '...bPb...bPb...',
        '...bbb...bbb...',
        '.a.bbb...bbb.a.',
        'a..bbb...bbb..a',
        'a..bbbbbbbbba.a',
        '..abbbbbbbbbb..',
        '..bbammmmmabb..',
        '.bbbammmmmabbb.',
        '..bbbaaaaabbb..',
        '..bbbbbbbbbbb..',
        '...............'],
      2: [
        '....bkb.....bkb....',
        '...bbEbb...bbEbb...',
        '...bbEbb...bbEbb...',
        '...bbPbb...bbPbb...',
        '....bbbb...bbbb....',
        '.a..bbb.....bbb..a.',
        'aaa.bbb.....bbb.aaa',
        'a...bbbbbbbbbbb...a',
        'aaabbbbbbbbbbbbbaaa',
        '..abbbbbbbbbbbbba..',
        '..bbbammmmmmmabbb..',
        '..bbaammmmmmmaabb..',
        '..bbbaaaaaaaaabbb..',
        '...bbbbbbbbbbbbb...',
        '...bbbb.....bbbb...',
        '...a.a.......a.a...'],
    },
    dodo: {
      1: [
        '......bbbkk.....',
        '.....bbbbEPEb...',
        '....bbbbbEPEba77',
        '....bbbbbaaaaaaa',
        '.....bbbbbbmmmmm',
        '.......bbbb666..',
        '.......bbb......',
        '.......bb.......',
        'bbbbbbbbbbbb....',
        'bbbbbbbbbbbbb...',
        '.bbbbbllllbbb...',
        '..bbbbbbbbbbb...',
        '...bbbbbbbbb....',
        '.....aa.aa......'],
      2: [
        '........bbbbkk......',
        '.......bbbbbEPEb....',
        '......bbbbbEEPEbb777',
        '.....bbbbbbEEPEbaaaa',
        '......bbbbbbaammmmmm',
        '.......bbbbbbammmmmm',
        '........bbbbb66666..',
        '.........bbbb.......',
        '.........bbb........',
        '..b.....bbbb........',
        'bbbbbbbbbbbbbbb.....',
        'bbbbbbbbbbbbbbbb....',
        'bbbbbbbllllllbbbb...',
        '..bbbbbbllllbbbbb...',
        '...bbbbbbbbbbbbb....',
        '......ab..ab........',
        '......aa.aaa........'],
    },
    kevin: {
      1: [
        '..44333344..',
        '.4333333334.',
        '433bbbbbb334',
        '43bbbbbbbb34',
        '43bkkbbkkb34',
        '43bEPbbPEb34',
        '43bbb22bbb34',
        '43bbbbbbbb34',
        '43bmmmmmmb34',
        '43bb1111bb34',
        '.4bbbbbbbb4.',
        '...bbbbbb...',
        '.aaaaaaaaaa.',
        'aaaaaaaaaaaa'],
      2: [
        '.....433334.....',
        '...4333333353...',
        '..43bbbbbb55334.',
        '..35bbbbbb65534.',
        '.435bkbbbkb65344',
        '.435bPBbbPBb5354',
        '.435bbb2bbbb5344',
        '.435bbb2bbbb5344',
        '.435bbb2bbbb5344',
        '.435bmmmmmmb5344',
        '.435bb6666bb5344',
        '.445bb111bbb5344',
        '.....bbbbbb.....',
        '......bbbb......',
        '......6bb6......',
        '.aaaaaaaaaaaaaa.',
        'aaaaaaaaaaaaaaaa'],
    },
    peepo: {
      1: [
        '....kkkk.kkkkk..',
        '...bEEEP1EEEEP1.',
        '..bbEEEP1EEEPP1.',
        '.bbbbEEEbbEEEEb.',
        '.bbbbbbbbbbbbbbb',
        'bbbbbbbbbbbbbbbb',
        'bbbbbbmmmmmmmmmb',
        'bbbbbbm6666666mb',
        'bbbbbbbb44444bb.',
        'abbbbbbbbbbbbba.',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa'],
      2: [
        '.....kkkkk.bkkkkk...',
        '....bEEEEP11EEEEPPb.',
        '...bbEEEPPP1EEEPPPb.',
        '..bbbEEEEE11EEEEEEb.',
        '.bbbbbEEEEbb1EEEE1b.',
        '.bbbbbT11bbbb1111Tbb',
        '.bbbbbbbbbbbbbbbbTbb',
        '.bbbbbTbbbb1b1bbbTbb',
        'bbbbbbbbmmmmmmmmmbbb',
        'bbbbbbbbm6655566mbbb',
        'bbbbbbbbbb44444bbbbb',
        'bbbbbbbbbbbbbbbbbbb.',
        'aaabbbbbbbbbbbbbbaa.',
        'aaaaaaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaaaaaa'],
    },
    sarutobi: {
      1: [
        '......bbbb......',
        '....bbbbbbbb....',
        '....bbllllbb....',
        '.blblkkllkklblb.',
        '.llllPPllPPllll.',
        '.blblPPllPPlblb.',
        '....lPPllPPl....',
        '....lllmmlll....',
        '.....llllll.....',
        '.b....bbbb....b.',
        'b.b.bbllllbbbb..',
        '...bbblllllb....',
        '.bbb..blllbb....',
        '.....aab..aa....'],
      2: [
        '........bbbb........',
        '......bbbbbbbb......',
        '.....bbbllllbbb.....',
        '..bb.blkllllklb.bb..',
        '.bllbllPllllPllbllb.',
        '.bllllPPPllPPPllllb.',
        '.bllblPPPllPPPlbllb.',
        '..bb.lPPPllPPPl.bb..',
        '.....llPllllPll.....',
        '.....lllmmmmlll.....',
        '......bllllllb......',
        '.bb....bbbbbb....bb.',
        'b..b..bblllllbbbbb..',
        'b.b..bbbllllllbb....',
        '.b..bb.bllllllb.....',
        '.......bbb.lbbb.....',
        '......aaa...aaa.....'],
    },
    doge: {
      1: [
        '...bb.....bb....',
        '...lbb...bllb...',
        '..bblbbbbbllb...',
        '..kkkbbkkbbbbb..',
        '..EPPbbPPbbbbb..',
        '..EPPbbEPPbbbb..',
        '.llllllllllbbbb.',
        '.ll3lllllllbbb..',
        '..lmmmllllbbbb..',
        '..llllllllbbbb..',
        '.blllllllbbbbbb.',
        '.bblllllbbbbbbb.',
        '.bblllllbbbbbbb.',
        '.blllllllllbbb..'],
      2: [
        '....bb.......bb.....',
        '....bb......bbbb....',
        '...bllbbbbbbbllb....',
        '...bbllbbbbbbllbb...',
        '..bkkkbbbkkbbbbbb...',
        '..bEPPbbbPPbbbbbbb..',
        '..bEPPbbEPPPbbbbbb..',
        '..lEEPlbEEPPbbbbbb..',
        '.lllllllllllllbbbb..',
        '.ll33llllllllbbbbb..',
        '.lllmmmmlllllbbbbb..',
        '..llllllllllbbbbb...',
        '...lllllllllbbbbbb..',
        '..bllllllllbbbbbbbb.',
        '..bllllllllbbbbbbbb.',
        '.bbbllllllbbbbbbbbb.',
        '.bbllllllllllbbbbbb.',
        '.bblllllllllllbbbb..'],
    },
    lenny: {
      1: [
        '....bbbbbb....',
        '.bbbbbbbbbbbb.',
        '.bbbbbbbbbbbb.',
        'bbBBBBbbBBBBbb',
        'bbbbPPbbbPPbbb',
        'bbbbPPbbbPPbbb',
        'bbbbbbbkbbbbbb',
        '.bbbbbkkbbbbb.',
        '.bbbmmmmmmbbb.',
        '..bbbbbbbbbb..',
        '....bbbbbb....',
        '..bbbllllbbb..',
        '....bbbbbb....',
        '....aa..aa....'],
      2: [
        '.....bbbbbbb.....',
        '...bbbbbbbbbbb...',
        '.bbbbbbbbbbbbbbb.',
        '.bbbBBBbbbbBBBbb.',
        'bbbBbPPBbbBPPbBbb',
        'bbbbPPPbbbbPPbbbb',
        'bbbbPPPbbbbPPPbbb',
        'bbbbbbbbbkbbbbbbb',
        'bbbbbbbbkkbbbbbbb',
        '.bbbbbbbbbbbbbbb.',
        '..bbbmmmmmmmbbb..',
        '...bbbbbbbbbbb...',
        '.....bbbbbbb.....',
        '....bbllllbbb....',
        '...b.blllllb.b...',
        '.....bb...bb.....',
        '.....aa...aa.....'],
    },
    nakamoto: {
      1: [
        '............',
        '....888.....',
        '..8888888...',
        '.888888888..',
        '.8333333388.',
        '.3333333338.',
        '.3333333333.',
        '.kkkk3kkkk3.',
        '.kPPk3kPPk3.',
        '.kEEk3kEEk3.',
        '.3333333333.',
        '..33mmmm33..',
        '..33333333..',
        '...333333...',
        '..22333322..'],
      2: [
        '................',
        '................',
        '..8888838888....',
        '..83344433888...',
        '.883433343888...',
        '.8333333338888..',
        '.83333333388888.',
        '.kkkkkkkkk88888.',
        '.kPPkkPPPk8888..',
        '.kEEk3kEk3833...',
        '..334333333.....',
        '..333333433.....',
        '...mmm33333.....',
        '...mmm3333......',
        '...3333333......',
        '...3333333......',
        '...3333333......',
        '...3333322......',
        '..22333222......'],
    },
  };
  SPECIES.forEach(function (sp) { if (SMALL_MAPS[sp.id]) sp.small = SMALL_MAPS[sp.id]; });
  /* SMALL_MAPS:END */
  var COMMUNITY_SPECIES = 'nakamoto';
  var CHARKEY = { b: 'body', a: 'accent', l: 'belly', k: 'ink', B: 'brow', w: 'white', E: 'eye', P: 'pupil', m: 'mouth',
    h: 'horn', g: 'gold', T: 'tear', f: 'ember', F: 'ember2', r: 'spr', v: 'spv', e: 'spe',
    '1': 'sp1', '2': 'sp2', '3': 'sp3', '4': 'sp4', '5': 'sp5', '6': 'sp6', '7': 'sp7', '8': 'sp8', '9': 'sp9' }; // 1-9: per-species fixed/derived colours (SPECIES[].colors)

  // v3.16: palettes removed. Every pet renders in its species' canon (Classic) colours. The roll slot that used to pick a
  // palette is still drawn and discarded (generate) so every other trait keeps its value.
  var PATTERNS = [
    { id: 'none', label: 'Plain', w: 14, t: 0 }, { id: 'belly', label: 'Belly patch', w: 12, t: 0 },
    { id: 'spots', label: 'Spots', w: 10, t: 0 },
    { id: 'stripes', label: 'Stripes', w: 10, t: 1 }, { id: 'socks', label: 'Socks', w: 8, t: 1 },
    { id: 'mask', label: 'Bandit mask', w: 8, t: 1 },
    { id: 'checker', label: 'Checker', w: 8, t: 2 }, { id: 'twotone', label: 'Two-tone', w: 8, t: 2 },
    { id: 'galaxy', label: 'Galaxy', w: 8, t: 3 }, { id: 'rainbow', label: 'Rainbow', w: 8, t: 3 }
  ];
  // Eye trait = a color/style variant of the character's own eyes (the stage sets the expression).
  var EYES = [
    { id: 'classic', label: 'Classic', w: 30, t: 0 }, { id: 'beady', label: 'Sunglasses', w: 10, t: 0 },
    { id: 'tinted', label: 'Tinted', w: 10, t: 1 }, { id: 'star', label: 'Star', w: 8, t: 2 },
    { id: 'laser', label: 'Laser eyes', w: 8, t: 3 }
  ];
  // Gear pools. What is SHOWN depends on stage (rank unlock) and tier (gearSlots);
  // which variant is shown is rolled from the seed. Higher tiers favour better variants.
  var BANDS = [
    { id: 'red-headband', label: 'Red headband', type: 'headband', color: '#e03b3b', w: 10, t: 0 },
    { id: 'blue-headband', label: 'Blue headband', type: 'headband', color: '#3b6fe0', w: 10, t: 0 },
    { id: 'red-scarf', label: 'Red scarf', type: 'scarf', color: '#d63031', w: 10, t: 0 },
    { id: 'green-scarf', label: 'Green scarf', type: 'scarf', color: '#2f9f5f', w: 10, t: 0 },
    { id: 'black-headband', label: 'Black headband', type: 'headband', color: '#2a2a33', w: 10, t: 1 },
    { id: 'white-scarf', label: 'White scarf', type: 'scarf', color: '#eeeeee', w: 10, t: 1 },
    { id: 'purple-scarf', label: 'Royal scarf', type: 'scarf', color: '#7b3fd1', w: 10, t: 2 },
    { id: 'gold-headband', label: 'Gold headband', type: 'headband', color: '#ffd23f', w: 10, t: 3 }
  ];
  var ARMORS = [
    { id: 'leather', label: 'Leather armor', metal: '#8a5a3a', trim: '#c08a5a', w: 10, t: 0 },
    { id: 'iron', label: 'Iron armor', metal: '#8d96a8', trim: '#c7ced9', w: 10, t: 1 },
    { id: 'silver', label: 'Silver armor', metal: '#c3cad8', trim: '#ffffff', w: 10, t: 2 },
    { id: 'gold', label: 'Gold armor', metal: '#e8a924', trim: '#ffe48a', w: 10, t: 3 },
    { id: 'obsidian', label: 'Obsidian armor', metal: '#3b3552', trim: '#a07cff', w: 10, t: 3 }
  ];
  var CAPES = [
    { id: 'red', label: 'Red cape', color: '#b8322a', trim: '#e8b04a', w: 10, t: 0 },
    { id: 'blue', label: 'Blue cape', color: '#2e5fbf', trim: '#d0d6e0', w: 10, t: 0 },
    { id: 'green', label: 'Forest cape', color: '#2f7f4f', trim: '#c9a54a', w: 10, t: 1 },
    { id: 'purple', label: 'Purple cape', color: '#6a3fb5', trim: '#d0d6e0', w: 10, t: 1 },
    { id: 'royal', label: 'Royal cape', color: '#5b2a86', trim: '#ffd23f', w: 10, t: 2 },
    { id: 'midnight', label: 'Midnight cape', color: '#1b1f4a', trim: '#9fd8ff', w: 10, t: 3 },
    { id: 'goldcape', label: 'Golden cape', color: '#d9a521', trim: '#fff1a8', w: 10, t: 3 }
  ];
  var WEAPONS = [
    { id: 'wooden-sword', label: 'Wooden sword', w: 10, t: 0 }, { id: 'staff', label: 'Staff', w: 10, t: 0 },
    { id: 'iron-sword', label: 'Iron sword', w: 10, t: 1 }, { id: 'axe', label: 'Axe', w: 10, t: 1 },
    { id: 'trident', label: 'Trident', w: 10, t: 2 }, { id: 'spear', label: 'Spear', w: 10, t: 2 },
    { id: 'golden-sword', label: 'Golden sword', w: 10, t: 3 }, { id: 'torch', label: 'Burn torch', w: 10, t: 3 }
  ];
  var CROWNS = [
    { id: 'laurel', label: 'Laurel wreath', w: 10, t: 0 }, { id: 'silver-crown', label: 'Silver crown', w: 10, t: 1 },
    { id: 'gold-crown', label: 'Gold crown', w: 10, t: 2 }, { id: 'jeweled-crown', label: 'Jeweled crown', w: 10, t: 3 },
    { id: 'flame-crown', label: 'Flame crown', w: 10, t: 3 }
  ];
  var BACKGROUNDS = [
    { id: 'solid', label: 'Solid', w: 10, t: 0 }, { id: 'dots', label: 'Dots', w: 6, t: 0 },
    { id: 'gradient', label: 'Gradient', w: 10, t: 1 }, { id: 'grid', label: 'Grid', w: 8, t: 1 },
    { id: 'stars', label: 'Starfield', w: 10, t: 2 }, { id: 'sunburst', label: 'Sunburst', w: 8, t: 2 },
    { id: 'aurora', label: 'Aurora', w: 10, t: 3 }, { id: 'cosmic', label: 'Cosmic', w: 10, t: 3 }
  ];
  // Background v2 (Bitcoin / XCP-style / mix): ONLY for pets hatched at or after this block, so every older pet renders exactly
  // as before. Chosen from DNA bytes (not the rng stream), so no other trait of a new pet changes either.
  var BG_V2_FROM_BLOCK = 971030; // = mainnet tip (971029) + 1 when this was added, 2026-10-11
  // Cheeks v2: Freckles / Tear tracks, only for pets hatched at or after CHEEKS_V2_FROM_BLOCK. Decided from a SEPARATE hash
  // (sha256('XCPETS:cheeks:v2:' + seed)), never the main rng stream, so every older pet and every other trait is unchanged.
  // The old draw stays (int(100) < 40 = blush); x = first 2 hash bytes % 1000: blush pets with x < 125 and plain pets with
  // x < 250 become freckles (lower half) or tear tracks (upper half). Odds: Blush 35%, None 45%, Freckles 10%, Tear tracks 10%.
  var CHEEKS_V2_FROM_BLOCK = 971040; // mainnet tip was 971036 when this was added, 2026-10-11
  var CHEEKS = [{ id: 'blush', label: 'Blush' }, { id: 'none', label: 'None' }, { id: 'freckles', label: 'Freckles' }, { id: 'tears', label: 'Tear tracks' }];
  /** cheeksId(pet): 'blush' | 'none' | 'freckles' | 'tears' (old boolean data: true = blush, false = none). */
  function cheeksId(pet) { var c = pet && pet.cheeks; return c === true ? 'blush' : (!c ? 'none' : String(c)); }
  var BG_V2 = [{ id: 'btc', label: 'Bitcoin' }, { id: 'xcp', label: 'XCP mark' }, { id: 'bxmix', label: 'Bitcoin + XCP' }];
  var BG_COLORS = ['#1d2b53', '#2b1d3f', '#1f3b2f', '#3b2a1f', '#14213d', '#2d1b2e', '#203040', '#3a1f2b'];
  var SYLLABLES = ['mo', 'chi', 'pip', 'zu', 'ka', 'ri', 'po', 'lu', 'bo', 'ne', 'tik', 'fu', 'yo', 'mi', 'to', 'ba', 'zo', 'ki', 'pe', 'ru', 'sa', 'nu', 'gi', 'wa'];
  var STAT_KEYS = ['vigor', 'spark', 'grit', 'zoom', 'luck'];

  // item.tw (optional) = an explicit per-tier weight [common, uncommon, rare, legendary], no 4x native bonus. Used by KEVIN so
  // his ~4.4% share is taken proportionally (about 4.2-4.7% of each tier's pool) from every other species.
  function itemWeight(item, tierIdx) { return item.tw ? item.tw[tierIdx] : item.w * (item.t === tierIdx ? 4 : 1); }
  function weightedPick(next, pool, tierIdx) {
    var total = 0, i, w;
    for (i = 0; i < pool.length; i++) if (pool[i].t <= tierIdx) total += itemWeight(pool[i], tierIdx);
    var r = next() % total;
    for (i = 0; i < pool.length; i++) {
      if (pool[i].t > tierIdx) continue;
      w = itemWeight(pool[i], tierIdx);
      if (w > 0 && r < w) return pool[i];
      r -= w;
    }
    return pool[pool.length - 1];
  }
  function byId(pool, id) { for (var i = 0; i < pool.length; i++) if (pool[i].id === id) return pool[i]; return null; }

  function normalizeHash(h) { return String(h == null ? '' : h).trim().toLowerCase(); }
  function seedString(blockHash, petId) { return normalizeHash(blockHash) + ':' + normalizeHash(petId); }

  /**
   * generate({blockHash, petId, community, overrides}) -> pet traits (plain JSON-able object).
   * community: true => the community pet: species is always Nakamoto and the tier is always Legendary
   *   (so it can wear every gear rank); every other trait is still rolled from the seed.
   * overrides (optional) replace trait ids AFTER rolling, so the PRNG sequence is unchanged.
   */
  function generate(input) {
    input = input || {};
    var seed = seedString(input.blockHash, input.petId);
    var digest = sha256Bytes(utf8Bytes(seed));
    var rng = makeRng(digest);

    var r = rng.int(10000), tierIdx = 0;
    if (r < TIERS[3].chance) tierIdx = 3;
    else if (r < TIERS[3].chance + TIERS[2].chance) tierIdx = 2;
    else if (r < TIERS[3].chance + TIERS[2].chance + TIERS[1].chance) tierIdx = 1;
    if (input.community) tierIdx = 3;

    var species = rng.pick(SPECIES, tierIdx);
    if (input.community) species = byId(SPECIES, COMMUNITY_SPECIES);
    rng.next(); // v3.16: former palette roll (one PRNG draw, result discarded) so later traits do not shift
    var pattern = rng.pick(PATTERNS, tierIdx);
    var eyes = rng.pick(EYES, tierIdx);
    var cheeks = rng.int(100) < 40;
    var band = rng.pick(BANDS, tierIdx);
    var armor = rng.pick(ARMORS, tierIdx);
    var cape = rng.pick(CAPES, tierIdx);
    var weapon = rng.pick(WEAPONS, tierIdx);
    var crown = rng.pick(CROWNS, tierIdx);
    var background = rng.pick(BACKGROUNDS, tierIdx);
    var bgColor = BG_COLORS[rng.int(BG_COLORS.length)];
    var base = {};
    for (var i = 0; i < STAT_KEYS.length; i++) base[STAT_KEYS[i]] = 1 + rng.int(20) + TIERS[tierIdx].statBonus;
    var nsyl = 2 + (rng.int(3) === 0 ? 1 : 0), name = '';
    for (i = 0; i < nsyl; i++) name += SYLLABLES[rng.int(SYLLABLES.length)];
    name = name.charAt(0).toUpperCase() + name.slice(1);

    var pet = {
      version: VERSION, seed: seed, dna: toHex(digest),
      tier: TIERS[tierIdx].id, tierIndex: tierIdx, community: !!input.community,
      species: species.id, pattern: pattern.id, eyes: eyes.id, cheeks: cheeks,
      band: band.id, armor: armor.id, cape: cape.id, weapon: weapon.id, crown: crown.id,
      background: background.id, bgColor: bgColor,
      baseStats: base, defaultName: name
    };
    if (input.blockHeight != null && Number(input.blockHeight) >= BG_V2_FROM_BLOCK && !input.community) {
      var v2 = digest[29] % 4; if (v2) { pet.background = BG_V2[v2 - 1].id; pet.bgV2 = true; } }
    if (input.blockHeight != null && Number(input.blockHeight) >= CHEEKS_V2_FROM_BLOCK) {
      var ch = sha256Bytes(utf8Bytes('XCPETS:cheeks:v2:' + seed)), cx = ((ch[0] << 8) | ch[1]) % 1000, lim = cheeks ? 125 : 250;
      if (cx < lim) pet.cheeks = cx < lim / 2 ? 'freckles' : 'tears'; // otherwise stays true (blush) / false (none)
    }
    var o = input.overrides;
    if (o) {
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) pet[k] = o[k];
      if (o.tier) { for (i = 0; i < TIERS.length; i++) if (TIERS[i].id === o.tier) pet.tierIndex = i; }
      pet.overridden = Object.keys(o);
    }
    return pet;
  }

  /** Gear ranks visible at a stage: rank n unlocks at stage n, capped by the tier's gearSlots. */
  // opts.gearCap (optional, render-time only): override the tier's gear-slot cap (the play demo passes 5 so every tier can
  // wear the full kit; the rolled variants still come from the tier-weighted rolls). Default = the real tier cap.
  function gearFor(pet, stage, opts) {
    stage = clampStage(stage);
    var cap = (opts && opts.gearCap != null) ? opts.gearCap : (TIERS[pet.tierIndex] || TIERS[0]).gearSlots;
    var n = Math.min(stage, cap, GEAR_RANKS.length);
    return GEAR_RANKS.slice(0, n);
  }
  function expressionFor(pet, stage) {
    stage = clampStage(stage);
    if (stage === 0) return null;
    var sp = byId(SPECIES, pet.species) || SPECIES[0];
    return sp.arc[stage - 1][0];
  }

  /** Effective stats for a pet at a stage with `care` whole tokens burned into it. */
  function stats(pet, stage, care) {
    stage = clampStage(stage); care = Math.max(0, Number(care) || 0);
    var growth = Math.floor(Math.sqrt(care / 10000)), out = {}, power = 0;
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i];
      out[k] = Math.floor(pet.baseStats[k] * STAGE_MULT[stage] / 100) + growth;
      power += out[k];
    }
    out.power = power;
    return out;
  }
  function clampStage(s) { s = Math.floor(Number(s)); if (!(s >= 0)) s = 3; return Math.min(5, s); }

  // ------------------------------------------------------------------ Colors
  function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  var BLACK = [0, 0, 0], WHITE = [255, 255, 255], INK = hex('#1a1020');
  var FIXED = {
    k: INK, w: [255, 255, 255], g: hex('#ffd23f'), G: hex('#c98a00'), r: hex('#e04060'), R: hex('#ff2a2a'),
    o: hex('#ff6a00'), y: hex('#ffd23f'), c: hex('#fff4c0'), p: hex('#ff8fd0'), P: hex('#d94fa0'),
    l: hex('#5fd35f'), L: hex('#2f8f3f'), b: hex('#3a3a4a'), s: hex('#d8dde8'), d: hex('#9aa3b5'), u: hex('#4f9dff'),
    m: hex('#ff5ca8'), h: hex('#f4e3b5'), e: hex('#ff9f1c')
  };
  var RAINBOW = ['#ff5c5c', '#ff9f43', '#ffd93d', '#6bcB77', '#4d96ff', '#9b5de5'].map(hex);
  var NO_SHADE = { tint: 1, hachi: 1, hachish: 1, btc: 1, ink: 1, brow: 1, white: 1, eye: 1, pupil: 1, mouth: 1, galstar: 1, gold: 1, laser: 1, laserlite: 1, tear: 1,
    tongue: 1, eyegold: 1, shade: 1, sgFrame: 1, ember: 1, ember2: 1, blade: 1, gem: 1, gemB: 1, flame: 1, flame2: 1, wood: 1, lwood: 1, iron: 1, capeTrim: 1 };
  var FACE_KEYS = { eye: 1, pupil: 1, mouth: 1, brow: 1, ink: 1, tear: 1, gold: 1, horn: 1, ember: 1, ember2: 1, frame: 1, lens: 1 };

  /** The pet's body/accent/belly colours: always its species' canon (Classic) colours (palettes were removed in v3.16). */
  function speciesColors(pet) { return (byId(SPECIES, pet.species) || SPECIES[0]).canon; }

  // ------------------------------------------------------------------ Render
  function Canvas() {
    this.key = new Array(N * N);
    this.sil = new Uint8Array(N * N);
    this.bg = new Array(N * N);
    this.top = new Array(N * N);
  }
  Canvas.prototype.setKey = function (x, y, k) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    this.key[y * N + x] = k; this.sil[y * N + x] = 1;
  };
  Canvas.prototype.getKey = function (x, y) { return (x >= 0 && y >= 0 && x < N && y < N) ? this.key[y * N + x] : undefined; };
  Canvas.prototype.isSil = function (x, y) { return x >= 0 && y >= 0 && x < N && y < N && this.sil[y * N + x] === 1; };
  Canvas.prototype.ellipse = function (cx, cy, rx, ry, k, filter) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!filter || filter(x, y))) this.setKey(x, y, k);
    }
  };
  Canvas.prototype.paint = function (x, y, rgb) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    this.top[y * N + x] = rgb;
  };
  Canvas.prototype.sprite = function (x0, y0, rows, colors) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var ch = rows[j].charAt(i);
      if (ch === '.' || ch === ' ') continue;
      var c = (colors && colors[ch]) || FIXED[ch];
      if (c) this.paint(x0 + i, y0 + j, c);
    }
  };
  Canvas.prototype.spriteKeys = function (x0, y0, rows, keys) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var ch = rows[j].charAt(i);
      if (ch !== '.' && keys[ch]) this.setKey(x0 + i, y0 + j, keys[ch]);
    }
  };

  var BTC_GLYPH = ['####.', '.#..#', '.###.', '.#..#', '####.'], XCP_GLYPH = ['.###.', '#.#.#', '##.##', '#.#.#', '.###.'];
  function drawBackground(cv, pet, digest, frame, pal) {
    var base = hex(pet.bgColor), lite = mix(base, WHITE, 0.12), x, y, i;
    var accent = hex(pal.accent);
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var c = base;
      switch (pet.background) {
        case 'dots': if (x % 4 === (y % 8 < 4 ? 1 : 3) && y % 4 === 1) c = lite; break;
        case 'gradient': c = mix(base, mix(accent, BLACK, 0.45), Math.floor(y / 4) / 8); break;
        case 'grid': if (x % 8 === 0 || y % 8 === 0) c = lite; break;
        case 'stars': c = mix(base, BLACK, 0.3); break;
        case 'sunburst': {
          var dx = x + 0.5 - 16, dy = y + 0.5 - 18, ad = Math.abs(dx) + Math.abs(dy), ang;
          if (ad === 0) ang = 0;
          else if (dy >= 0) ang = dx >= 0 ? dy / ad : 2 - dy / ad;
          else ang = dx < 0 ? 2 - dy / ad : 4 + dy / ad;
          c = (Math.floor(ang * 4 + frame * 0.5) % 2 === 0) ? mix(base, accent, 0.35) : base;
          break;
        }
        case 'aurora': {
          var tri = Math.abs(((x + frame * 2) % 12) - 6);
          var band = Math.floor((y + tri) / 4);
          var cols = [hex('#0b1026'), hex('#123d3a'), hex('#1f6f5c'), hex('#2a2a6e'), hex('#3d1f5c')];
          c = cols[band % 5];
          break;
        }
        case 'cosmic': c = mix(hex('#0a0618'), hex('#2a0f4a'), y / 31); break;
        case 'btc': case 'xcp': case 'bxmix': { // faint 5x5 glyphs on a 10px grid, low contrast so the pet stays readable
          var gx = x % 10, gy = y % 10, cell = (Math.floor(x / 10) + Math.floor(y / 10)) % 2, kind = pet.background === 'bxmix' ? (cell ? 'xcp' : 'btc') : pet.background;
          if (gx >= 2 && gx <= 6 && gy >= 2 && gy <= 6) { var row = (kind === 'btc' ? BTC_GLYPH : XCP_GLYPH)[gy - 2];
            if (row.charAt(gx - 2) === '#') c = mix(base, hex(kind === 'btc' ? '#f7931a' : '#33d6ff'), 0.22); }
          break;
        }
        default: break;
      }
      cv.bg[y * N + x] = c;
    }
    if (pet.background === 'stars' || pet.background === 'cosmic') {
      for (i = 0; i < 8; i++) {
        var sx = digest[16 + i * 2] % N, sy = digest[17 + i * 2] % 22;
        cv.bg[sy * N + sx] = (i + frame) % 3 !== 0 ? WHITE : mix(WHITE, base, 0.5);
      }
      if (pet.background === 'cosmic') {
        var px = 3 + digest[31] % 4, py = 3 + digest[30] % 4;
        for (y = -2; y <= 2; y++) for (x = -2; x <= 2; x++) if (x * x + y * y <= 4) cv.bg[(py + y) * N + px + x] = hex('#ff9f43');
        for (x = -3; x <= 3; x++) cv.bg[py * N + px + x] = hex('#ffd93d');
      }
    }
  }

  function shadow(cv, cx, rx, y) {
    for (var x = 0; x < N; x++) {
      var dx = (x + 0.5 - cx) / rx;
      if (dx * dx <= 1) cv.bg[y * N + x] = mix(cv.bg[y * N + x], BLACK, 0.4);
    }
  }

  /** The pixel map for a stage (species may give per-stage maps; all stage maps share one size). */
  function stageMap(sp, stage) { return (sp.stageMaps && sp.stageMaps[stage]) || sp.map; }
  function spriteBox(sp, stage, bob) {
    var map = stageMap(sp, stage), W = map[0].length, H = map.length, s = STAGE_SCALE[stage];
    var w = Math.max(4, Math.round(W * s)), h = Math.max(4, Math.round(H * s));
    var x0 = 16 - Math.round(w / 2);
    var small = sp.small && sp.small[stage] && sp.small[stage].length === h && sp.small[stage][0].length === w ? sp.small[stage] : null;
    var small = sp.small && sp.small[stage] && sp.small[stage].length === h && sp.small[stage][0].length === w ? sp.small[stage] : null;
    return { x0: x0, y0: 28 - h + bob, w: w, h: h, W: W, H: H, map: map, small: small, small: small,
      split: sp.eyeSplit != null ? x0 + Math.floor(sp.eyeSplit * w / W) : 16 }; // left/right eye divider (canvas x)
  }
  function rowY(box, row) { return box.y0 + Math.floor(row * box.h / box.H); }
  function colX(box, col) { return box.x0 + Math.floor(col * box.w / box.W); }

  /** Nearest-neighbour place a species pixel map, scaled for the stage, feet on row 28. */
  function placeSprite(cv, sp, box) {
    for (var dy = 0; dy < box.h; dy++) for (var dx = 0; dx < box.w; dx++) {
      var sm = box.small, ch = sm ? (sm[dy] || '').charAt(dx) || '.' : (box.map || sp.map)[Math.floor((dy + 0.5) * box.H / box.h)].charAt(Math.floor((dx + 0.5) * box.W / box.w));
      if (ch !== '.') cv.setKey(box.x0 + dx, box.y0 + dy, CHARKEY[ch]);
    }
  }

  function bbox(list) {
    var b = { minX: 99, maxX: -1, minY: 99, maxY: -1, n: list.length };
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p[0] < b.minX) b.minX = p[0]; if (p[0] > b.maxX) b.maxX = p[0];
      if (p[1] < b.minY) b.minY = p[1]; if (p[1] > b.maxY) b.maxY = p[1];
    }
    b.cx = (b.minX + b.maxX) / 2; b.cy = (b.minY + b.maxY) / 2;
    return b;
  }

  function anchors(cv, box) {
    var eyesL = [], eyesR = [], mouth = [], x, y, k, split = box.split == null ? 16 : box.split;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      k = cv.key[y * N + x];
      if (k === 'eye' || k === 'pupil') (x < split ? eyesL : eyesR).push([x, y]);
      else if (k === 'mouth') mouth.push([x, y]);
    }
    var clusters = [];
    if (eyesL.length) { clusters.push(bbox(eyesL)); clusters[clusters.length - 1].left = true; }
    if (eyesR.length) { clusters.push(bbox(eyesR)); clusters[clusters.length - 1].left = false; }
    var a = { cx: 16, x0: box.x0, top: box.y0, bottom: box.y0 + box.h - 1, rx: box.w / 2, ry: box.h / 2, cy: box.y0 + box.h / 2,
      eyes: clusters, mouth: mouth.length ? bbox(mouth) : null, box: box };
    a.eyeY = clusters.length ? Math.round((clusters[0].cy + clusters[clusters.length - 1].cy) / 2) : Math.round(a.top + box.h * 0.3);
    a.mouthY = a.mouth ? a.mouth.maxY : a.eyeY + 3;
    var all = eyesL.concat(eyesR, mouth);
    a.face = all.length ? bbox(all) : null;
    a.headTop = box.y0;
    for (y = box.y0; y < N; y++) { var hit = false; for (x = 12; x <= 19; x++) if (cv.isSil(x, y)) hit = true; if (hit) { a.headTop = y; break; } }
    return a;
  }

  function render(pet, opts) {
    opts = opts || {};
    var stage = clampStage(opts.stage == null ? 3 : opts.stage), frame = (opts.frame || 0) % 4;
    // opts.gearOverride (optional, render-time only; used by the play demo's loot): { band: id, armor: id, ... }. When given,
    // exactly these slots are worn with these variant ids (unknown ids are ignored) instead of the rolled kit and tier/stage
    // caps. Default (no option): unchanged real-game behaviour.
    var go = opts.gearOverride, LISTS = { band: BANDS, armor: ARMORS, cape: CAPES, weapon: WEAPONS, crown: CROWNS };
    if (go) { pet = Object.assign({}, pet); for (var gk in LISTS) if (go[gk] && byId(LISTS[gk], go[gk])) pet[gk] = go[gk]; }
    var cv = new Canvas(), digest = hexToBytes(pet.dna);
    var pal = speciesColors(pet);
    drawBackground(cv, pet, digest, frame, pal);
    var gear = {}, a = null, eggSp = null, eyes0 = [];
    var bob = [0, -1, -1, 0][frame];
    if (stage === 0) {
      drawEgg(cv, pet, digest, frame);
      eggSp = byId(SPECIES, pet.species);
      if (eggSp && eggSp.egg) drawSpeciesEgg(cv, eggSp, frame);
      else eggSp = null;
    } else {
      if (go) { for (var gs in LISTS) if (go[gs] && byId(LISTS[gs], go[gs])) gear[gs] = true; }
      else gearFor(pet, stage, opts).forEach(function (g) { gear[g] = true; });
      var sp = byId(SPECIES, pet.species) || SPECIES[0];
      var box = spriteBox(sp, stage, bob);
      shadow(cv, 16, box.w * 0.42 + (gear.cape ? 1 : 0), 29);
      if (gear.cape) drawCape(cv, sp, box);
      placeSprite(cv, sp, box);
      a = anchors(cv, box);
      eyes0 = a.eyes.slice(); // eye boxes before expressions (glasses keep their place when eyes close)
      applyPattern(cv, pet, a, digest, bob);
      if (gear.armor) drawArmor(cv, sp, box, a);
      applyExpression(cv, sp, a, stage);
      if (sp.tearDrop && sp.tearDrop[stage]) dropTears(cv, sp.tearDrop[stage]);
      a = anchors(cv, box);
      applyEyeTrait(cv, pet, a);
      if (sp.eyeLid) {
        // Hatchling (smallest scale): sclera can't survive the downscale, so use solid dark eyes there
        if (STAGE_SCALE[stage] < 0.7 && !box.small) for (var ei = 0; ei < N * N; ei++) { if (cv.key[ei] === 'eye') cv.key[ei] = 'pupil'; }
        else if (!box.small) drawEyeLids(cv, a);
      }
      // Chud: clear eyeglasses are part of the base look (not a trait) and stay on at every stage, Mythic included
      if (sp.glasses) { drawGlasses(cv, eyes0); levelEyesInGlasses(cv, eyes0); }
      // eye trait 'beady' (label Sunglasses, id kept so existing pets roll identically): dark pixel sunglasses, same look as Bobo's shades,
      // on the pre-expression eye boxes so they stay put when eyes close (over Chud's clear glasses too)
      if (pet.eyes === 'beady' && sp.sunLens) drawShadesMap(cv, sp.sunLens, box);
      else if (pet.eyes === 'beady') drawShades(cv, { eyes: eyes0.slice().sort(function (p1, p2) { return p1.cx - p2.cx; }), oneEye: true, frame: true });
      else if (sp.shades && hasShades(pet, sp, stage)) drawShades(cv, a);
      if (sp.symLenses) symmetricLenses(cv);
      /* 2026-10-16 sprite cleanup: Nakamoto's hachimaki is removed from the base art at every stage (the Genesis Block headband gear item still draws via band gear) */
      if (gear.band) drawBand(cv, pet, sp, box, a);
      // Mythic only: the smug hand-to-chin thinking pose (drawn over armor/band; weapons stay on the other side)
      if (stage === 5 && sp.pose) cv.spriteKeys(box.x0 + sp.pose.col, box.y0 + sp.pose.row, sp.pose.map, CHARKEY);
      if (gear.weapon) drawWeapon(cv, pet, box, frame, stage);
    }

    var armor = byId(ARMORS, pet.armor) || ARMORS[0], cape = byId(CAPES, pet.cape) || CAPES[0], band = byId(BANDS, pet.band) || BANDS[0];
    var colors = {
      body: hex(pal.body), accent: hex(pal.accent), belly: hex(pal.belly), horn: FIXED.h, gold: FIXED.g,
      ink: INK, brow: INK, white: WHITE, eye: hex((sp && stage > 0 && sp.eyeWhite) || '#f4f1ea'), pupil: (sp && stage > 0 && sp.pupil) ? hex(sp.pupil) : INK, mouth: INK, tear: hex('#7fc8ff'), tongue: FIXED.r,
      laser: FIXED.R, laserlite: hex('#ffb0b0'), eyegold: hex('#fff1a8'), ember: hex('#ff7a1a'), ember2: hex('#ffd23f'),
      gal: hex('#2a1a5e'), galstar: WHITE, hachi: hex('#f4f4f0'), hachish: hex('#c4c4cc'), btc: hex('#f7931a'),
      metal: hex(armor.metal), metalTrim: hex(armor.trim), cape: hex(cape.color), capeTrim: hex(cape.trim),
      band: hex(band.color), band2: mix(hex(band.color), BLACK, 0.3),
      blade: hex('#e6eaf2'), iron: hex('#8d96a8'), wood: hex('#8a5a2b'), lwood: hex('#c8955a'), gem: hex('#e0314f'), gemB: hex('#4f9dff'),
      frame: hex('#2b2b33'), lens: mix(hex('#cfe8ff'), WHITE, 0.35), flame: hex('#ff6a00'), flame2: hex('#ffd23f'), goldblade: hex('#ffd23f'), shade: hex('#0d0d10'), sgFrame: sunFrameColor(sp, hex(pal.body))
    };
    // Tinted eyes: pupils take the Classic accent; if that is too close to the species' pupil colour to read, a lighter accent.
    // Pattern colours (v3.16): the Classic accent / belly, unless too close to the body colour to read on it, then a
    // darker (light bodies) or lighter (dark bodies) shade of the body so every pattern stays visible on every species.
    var bodyLum = 0.3 * colors.body[0] + 0.59 * colors.body[1] + 0.11 * colors.body[2];
    var patShade = bodyLum > 110 ? mix(colors.body, BLACK, 0.4) : mix(colors.body, WHITE, 0.45);
    colors.patA = colorDist(colors.accent, colors.body) >= 60 ? colors.accent : patShade;
    colors.patB = colorDist(colors.belly, colors.body) >= 45 ? colors.belly : (bodyLum > 110 ? mix(colors.body, WHITE, 0.55) : mix(colors.body, WHITE, 0.35));
    colors.tint = colorDist(colors.accent, colors.pupil) >= 70 ? colors.accent : mix(colors.accent, WHITE, 0.5);
    for (var ri = 0; ri < 6; ri++) colors['rb' + ri] = RAINBOW[ri];
    var csp = sp || eggSp;
    if (eggSp) { colors.body = hex(eggSp.egg.shell); colors.accent = hex(eggSp.egg.spot); }
    if (csp && csp.colors) for (var ck in csp.colors) {
      var spec = csp.colors[ck];
      colors['sp' + ck] = typeof spec === 'string' ? hex(spec) : spec.dark ? mix(colors[spec.from], BLACK, spec.dark) : mix(colors[spec.from], WHITE, spec.light || 0);
    }
    // outline: one ink colour (INK #1a1020, the Wizard PNGs' outline) for every species; the single documented exception is the light-skin line #6e5f5c (Wojak, Chud)
    var outlineC = (stage > 0 && sp && sp.outline) ? hex(sp.outline) : INK;
    var out = new Uint8ClampedArray(N * N * 4), x, y, i;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      i = y * N + x;
      var c;
      if (cv.sil[i]) {
        var k = cv.key[i];
        c = colors[k] || colors.body;
        if (!NO_SHADE[k]) {
          if (!cv.isSil(x + 1, y) || !cv.isSil(x, y + 1)) c = mix(c, BLACK, 0.18);
          else if (!cv.isSil(x - 1, y) || !cv.isSil(x, y - 1)) c = mix(c, WHITE, 0.22);
        }
      } else if (cv.isSil(x + 1, y) || cv.isSil(x - 1, y) || cv.isSil(x, y + 1) || cv.isSil(x, y - 1)) c = outlineC;
      else if (stage === 5 && (cv.isSil(x + 2, y) || cv.isSil(x - 2, y) || cv.isSil(x, y + 2) || cv.isSil(x, y - 2) || cv.isSil(x + 1, y + 1) || cv.isSil(x - 1, y - 1) || cv.isSil(x + 1, y - 1) || cv.isSil(x - 1, y + 1)) && y < 29) c = mix(cv.bg[i], hex('#ffd23f'), 0.55); /* Mythic aura rim (all species) */
      else c = cv.bg[i];
      out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
    }
    if (a) {
      drawFaceExtras(cv, pet, a, frame);
      drawCheeksV2(cv, pet, eyes0, out);
      if (gear.crown) drawCrown(cv, pet, a, frame, sp);
    }
    // powered (render option, not a trait): Bitcoin Stamp #3 style laser eyes for species with lasers: true
    // symLenses (Nakamoto): beams start at the centre of each lens as finally drawn (after symmetricLenses, glasses and the
    // stage/bounce/pose offsets), derived per frame from the lens pixels rather than the pre-glasses eye boxes.
    if (opts.powered && sp && sp.lasers && stage > 0) drawLasers(cv, sp.symLenses ? lensAnchors(cv, eyes0) : eyes0, frame);
    for (i = 0; i < N * N; i++) if (cv.top[i]) { out[i * 4] = cv.top[i][0]; out[i * 4 + 1] = cv.top[i][1]; out[i * 4 + 2] = cv.top[i][2]; }
    return { width: N, height: N, data: out };
  }

  function hexToBytes(h) { var b = new Uint8Array(h.length / 2); for (var i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; }

  function drawEgg(cv, pet, digest, frame) {
    var wob = [0, 0, 1, -1][frame], cx = 16 + wob, cy = 19;
    shadow(cv, 16, 6, 28);
    cv.ellipse(cx, cy, 5.6, 7.5, 'body', function (x, y) { return y + 0.5 < cy; });
    cv.ellipse(cx, cy, 7, 8.6, 'body', function (x, y) { return y + 0.5 >= cy; });
    for (var i = 0; i < 6; i++) {
      var sx = cx - 6 + digest[16 + i] % 12, sy = 13 + digest[22 + i] % 13;
      for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
        var x = Math.round(sx + dx), y = Math.round(sy + dy);
        if (cv.isSil(x, y)) cv.key[y * N + x] = 'accent';
      }
    }
    var crack = [[-2, 16], [-1, 17], [0, 16], [1, 17], [2, 16]];
    if (frame >= 2) for (var c = 0; c < crack.length; c++) cv.paint(cx + crack[c][0], crack[c][1], INK);
  }

  /** bob = this frame's bounce offset (0 or -1). Canvas-anchored patterns use the sprite-relative row (y - bob) so
   *  they move with the pet; otherwise the bounce frames re-roll the galaxy speckles / shift the checker under it. */
  function applyPattern(cv, pet, a, digest, bob) {
    var x, y, i, k, ys, cy = a.cy, rx = a.rx, ry = a.ry, f = a.face, sp = byId(SPECIES, pet.species) || {};
    // v3.16.0 pattern areas (fix 2026-10-12): species whose sprite has no plain 'body' area (the community pet: its skin is a per-species colour) list the
    // keys to pattern (sp.patternKeys) and may limit them to below the face (sp.patternBelowFace = neck/shirt, never the face).
    // Head-only species (Wojak, Chud) put the Belly patch on the shirt (sp.bellyKey) instead of the face.
    var bodyKeys = sp.patternKeys || null;
    function inFace(x2, y2) { return f && x2 >= f.minX - 1 && x2 <= f.maxX + 1 && y2 >= f.minY - 1 && y2 <= f.maxY + 1; }
    function isBodyKey(x2, y2) { var kk = cv.key[y2 * N + x2]; return bodyKeys ? bodyKeys.indexOf(kk) >= 0 : kk === 'body'; }
    function isBody(x2, y2) { return isBodyKey(x2, y2) && !inFace(x2, y2) && !(sp.patternBelowFace && f && y2 <= f.maxY + 1); }
    switch (pet.pattern) {
      case 'belly':
        if (sp.bellyKey) { // belly-area anchor: the middle of the shirt/torso (bellyKey pixels in the lower part of the sprite)
          var bx = [], by = [];
          for (y = Math.round(cy); y < N; y++) for (x = 0; x < N; x++) if (cv.key[y * N + x] === sp.bellyKey) { bx.push(x); by.push(y); }
          if (bx.length) { var mx = (Math.min.apply(null, bx) + Math.max.apply(null, bx)) / 2, hw = Math.max(1, Math.round(rx * 0.35));
            for (i = 0; i < bx.length; i++) if (Math.abs(bx[i] + 0.5 - mx - 0.5) <= hw) cv.key[by[i] * N + bx[i]] = 'patB'; }
        } else if (sp.patternBelowFace && f) { // community pet: the patch sits on the neck/shirt under the face
          var top = f.maxY + 2, h = Math.max(1, a.bottom - top + 1);
          cv.ellipse(16 + (sp.patternCx || 0), top + h * 0.55, rx * 0.4, h * 0.45, 'patB', isBody);
        } else cv.ellipse(16, cy + ry * 0.45, rx * 0.5, ry * 0.45, 'patB', isBody);
        break;
      case 'spots':
        for (i = 0; i < 8; i++) {
          var sx = Math.round(16 - rx + digest[16 + i] % Math.max(1, Math.round(rx * 2))), sy = Math.round(cy - ry + digest[23 + i] % Math.max(1, Math.round(ry * 2)));
          for (y = 0; y < 2; y++) for (x = 0; x < 2; x++) if (sx + x < N && sy + y < N && isBody(sx + x, sy + y)) cv.key[(sy + y) * N + sx + x] = 'patA';
        }
        if (bodyKeys) { // small pattern area (community pet): if no spot landed, put the spots on the area itself (every 4th pixel, digest offset)
          var pa = []; for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (isBody(x, y)) pa.push(y * N + x);
          if (!pa.some(function (q) { return cv.key[q] === 'patA'; })) for (i = digest[16] % 4; i < pa.length; i += 4) cv.key[pa[i]] = 'patA';
        }
        break;
      case 'stripes':
        for (y = 0; y < N; y++) if ((y - a.top) % 3 === 1) for (x = 0; x < N; x++) if (isBody(x, y)) cv.key[y * N + x] = 'patA';
        break;
      case 'socks':
        for (y = a.bottom - 2; y <= a.bottom; y++) for (x = 0; x < N; x++) if (y >= 0 && y < N && cv.isSil(x, y) && !inFace(x, y) && cv.key[y * N + x] !== 'ink') cv.key[y * N + x] = 'white';
        break;
      case 'mask':
        for (y = a.eyeY - 1; y <= a.eyeY + 1; y++) for (x = 0; x < N; x++) if (y >= 0 && isBodyKey(x, y)) cv.key[y * N + x] = 'patA';
        break;
      case 'checker':
        for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (isBody(x, y) && ((x >> 1) + ((y - (bob || 0)) >> 1)) % 2 === 0) cv.key[y * N + x] = 'patA';
        break;
      case 'twotone':
        for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (isBody(x, y) && x >= 16) cv.key[y * N + x] = 'patB';
        break;
      case 'galaxy':
        for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (isBody(x, y)) {
          ys = y - (bob || 0);
          k = digest[(x * 7 + ys * 13) % 32];
          cv.key[y * N + x] = (k % 11 === 0) ? 'galstar' : ((x + ys) % 5 === 0 ? 'patA' : 'gal');
        }
        break;
      case 'rainbow':
        for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (isBody(x, y)) cv.key[y * N + x] = 'rb' + (Math.floor((y - a.top) / 2) % 6 + 6) % 6;
        break;
      default: break;
    }
  }

  // ------------------------------------------------------------- Expression
  /** Move every tear pixel down by d rows onto the cheek (only onto plain body pixels); the old spot gets the skin back. */
  function dropTears(cv, d) {
    var moved = [], i;
    for (i = 0; i < N * N; i++) if (cv.key[i] === 'tear') moved.push(i);
    moved.forEach(function (i0) {
      var x = i0 % N, y = Math.floor(i0 / N);
      var t = cv.getKey(x, y + d);
      cv.key[i0] = fillKeyNear(cv, x + 1, y);
      if (t && !FACE_KEYS[t] && t !== 'outline') cv.key[(y + d) * N + x] = 'tear';
    });
  }
  /** Nakamoto's hachimaki: a 2-row white headband across the head three rows above the top of the glasses (one face row
   *  stays between band and frame), a grey lower edge, a solid 2x2 orange Bitcoin disc on the front (a white B does not survive at 2 px)
   *  (centred between the lenses), and two knot tails flowing off the back of the head (the hair side, away from the face). */
  function drawHachimaki(cv) {
    var pts = [], i, x, y;
    for (i = 0; i < N * N; i++) if (cv.key[i] === 'eye' || cv.key[i] === 'pupil') pts.push(i);
    if (!pts.length) return;
    var gy = N, x0 = N, x1 = -1;
    pts.forEach(function (i) { gy = Math.min(gy, Math.floor(i / N)); x0 = Math.min(x0, i % N); x1 = Math.max(x1, i % N); });
    var by = gy - 4, cx = Math.round((x0 + x1) / 2), L = N, R = -1;
    for (x = 0; x < N; x++) if (cv.isSil(x, by) || cv.isSil(x, by + 1)) { L = Math.min(L, x); R = Math.max(R, x); }
    if (R < 0) return;
    for (x = L; x <= R; x++) { cv.setKey(x, by, 'hachi'); cv.setKey(x, by + 1, 'hachish'); }
    cv.setKey(cx, by, 'btc'); cv.setKey(cx + 1, by, 'btc'); cv.setKey(cx, by + 1, 'btc'); cv.setKey(cx + 1, by + 1, 'btc');
    // knot + tails off the back (right side of the head = the hair side on this left-facing face)
    var k = R + 1;
    cv.setKey(k, by, 'hachi'); cv.setKey(k, by + 1, 'hachish');
    cv.setKey(k + 1, by + 1, 'hachi'); cv.setKey(k + 2, by + 2, 'hachi'); cv.setKey(k + 1, by + 2, 'hachish');
    cv.setKey(k + 1, by - 1, 'hachi'); cv.setKey(k + 2, by - 1, 'hachish');
  }
  /** symLenses (Nakamoto): stage scaling can drop a column or row from one lens of a pair of glasses. Grow the smaller lens
   *  outward (away from the bridge) to the bigger one's size, copying its eye/pupil rows, and close it with a black frame. */
  function symmetricLenses(cv) {
    var pts = [], i;
    for (i = 0; i < N * N; i++) if (cv.key[i] === 'eye' || cv.key[i] === 'pupil') pts.push(i);
    if (!pts.length) return;
    var xs = pts.map(function (i) { return i % N; }).sort(function (a, b) { return a - b; }), cut = -1;
    for (i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 1) { cut = xs[i]; break; }
    if (cut < 0) return;
    function box(left) { var b = { minX: N, maxX: -1, minY: N, maxY: -1 }; pts.forEach(function (i) { var x = i % N, y = Math.floor(i / N);
      if ((x < cut) === left) { b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x); b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y); } }); return b; }
    var L = box(true), R = box(false), wL = L.maxX - L.minX, wR = R.maxX - R.minX, hL = L.maxY - L.minY, hR = R.maxY - R.minY;
    if (wL === wR && hL === hR) return;
    var big = (wR > wL || hR > hL) ? R : L, small = big === R ? L : R, toLeft = small === L, x, y;
    var W = big.maxX - big.minX + 1, Hh = big.maxY - big.minY + 1, nx0 = toLeft ? small.maxX - W + 1 : small.minX, ny0 = small.minY;
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) cv.setKey(nx0 + x, ny0 + y, cv.getKey(big.minX + x, big.minY + y));
    var fx = toLeft ? nx0 - 1 : nx0 + W;
    for (y = ny0 - 1; y <= ny0 + Hh; y++) cv.setKey(fx, y, 'ink');
    for (x = nx0; x < nx0 + W; x++) { cv.setKey(x, ny0 - 1, 'ink'); cv.setKey(x, ny0 + Hh, 'ink'); }
  }
  function fillKeyNear(cv, x, y) {
    var cand = [cv.getKey(x, y)];
    for (var i = 0; i < cand.length; i++) { var k = cand[i]; if (k && !FACE_KEYS[k]) return k; }
    return 'body';
  }
  function applyExpression(cv, sp, a, stage) {
    var ex = sp.arc[stage - 1], eyesOp = ex[1], browOp = ex[2], mouthOp = ex[3], x, y, i;
    // brows
    if (browOp !== 'keep') for (i = 0; i < N * N; i++) if (cv.key[i] === 'brow') cv.key[i] = fillKeyNear(cv, i % N, Math.floor(i / N) - 1) === 'brow' ? 'body' : fillKeyNear(cv, i % N, Math.floor(i / N) - 1);
    if (browOp === 'angry' || browOp === 'worried' || browOp === 'raised') {
      a.eyes.forEach(function (b) {
        var left = (b.left != null ? b.left : b.cx < 16), x1 = b.minX - 1, x2 = b.maxX + 1, base = b.minY - 2, span = x2 - x1;
        for (var xx = x1; xx <= x2; xx++) {
          var inner = left ? (xx - x1) / span : (x2 - xx) / span; // 0 outer .. 1 inner
          var yy = base;
          if (browOp === 'angry' && inner >= 0.5) yy = base + 1;
          if (browOp === 'worried' && inner >= 0.5) yy = base - 1;
          if (browOp === 'raised') yy = base - 1;
          var k = cv.getKey(xx, yy);
          if (k !== 'eye' && k !== 'pupil' && (!sp.browOnBody || cv.isSil(xx, yy))) cv.setKey(xx, yy, 'brow');
        }
      });
    }
    // eyes
    a.eyes.forEach(function (b) {
      if (eyesOp === 'halflid') {
        for (x = b.minX; x <= b.maxX; x++) { var k = cv.getKey(x, b.minY); if (k === 'eye' || k === 'pupil') cv.key[b.minY * N + x] = 'ink'; }
      } else if (eyesOp === 'closed') {
        var fk = fillKeyNear(cv, b.minX - 1, b.maxY);
        for (y = b.minY; y <= b.maxY; y++) for (x = b.minX; x <= b.maxX; x++) { var kk = cv.getKey(x, y); if (kk === 'eye' || kk === 'pupil') cv.key[y * N + x] = fk; }
        var wdt = b.maxX - b.minX + 1, yl = Math.round(b.cy);
        if (wdt >= 3) { cv.setKey(b.minX, yl + 1, 'ink'); cv.setKey(b.maxX, yl + 1, 'ink'); for (x = b.minX + 1; x <= b.maxX - 1; x++) cv.setKey(x, yl, 'ink'); }
        else for (x = b.minX; x <= b.maxX; x++) cv.setKey(x, yl, 'ink');
      }
    });
    // mouth
    var m = a.mouth;
    if (!m || mouthOp === 'base') return;
    var fill = fillKeyNear(cv, m.maxX + 1, m.minY);
    if (fill === 'body' && cv.getKey(m.minX - 1, m.minY) && !FACE_KEYS[cv.getKey(m.minX - 1, m.minY)]) fill = cv.getKey(m.minX - 1, m.minY);
    for (y = m.minY; y <= m.maxY; y++) for (x = m.minX; x <= m.maxX; x++) if (cv.getKey(x, y) === 'mouth') cv.key[y * N + x] = fill;
    var y0 = m.minY, L = m.minX, R = m.maxX;
    function row(yy, xa, xb, k) { for (var xx = xa; xx <= xb; xx++) cv.setKey(xx, yy, k); }
    switch (mouthOp) {
      case 'flat': row(y0, L, R, 'mouth'); break;
      case 'smile': row(y0, L + 1, R - 1, 'mouth'); cv.setKey(L, y0 - 1, 'mouth'); cv.setKey(R, y0 - 1, 'mouth'); break;
      case 'frown': row(y0, L + 1, R - 1, 'mouth'); cv.setKey(L, y0 + 1, 'mouth'); cv.setKey(R, y0 + 1, 'mouth'); break;
      case 'smirk': row(y0, L, R - 1, 'mouth'); cv.setKey(R, y0 - 1, 'mouth'); break;
      case 'grin': row(y0, L, R, 'white'); row(y0 + 1, L + 1, R - 1, 'mouth'); cv.setKey(L, y0 - 1, 'mouth'); cv.setKey(R, y0 - 1, 'mouth'); break;
      case 'open': row(y0, L, R, 'mouth'); row(y0 + 1, L + 1, R - 1, 'tongue'); row(y0 + 2, L + 2, R - 2, 'mouth'); break;
      case 'cheer': cv.setKey(L, y0 - 1, 'mouth'); cv.setKey(R, y0 - 1, 'mouth'); row(y0, L + 1, R - 1, 'mouth'); row(y0 + 1, L + 1, R - 1, 'tongue'); row(y0 + 2, L + 2, R - 2, 'mouth'); break;
    }
  }

  /** Bobo's black pixel shades: on by default for ~chance% of Bobos (from DNA byte 31; no extra PRNG draw, so
   *  rolled traits are unchanged), shown on sp.shades.stages. pet.shades (true/false) overrides (cast art). */
  function hasShades(pet, sp, stage) {
    if (sp.shades.stages.indexOf(stage) < 0) return false;
    if (pet.shades === true || pet.shades === false) return pet.shades;
    return Math.floor(parseInt(pet.dna.substr(62, 2), 16) * 100 / 256) < sp.shades.chance;
  }
  /** Dark pixel shades. a.frame (Sunglasses eye type only): the rim (top row + side columns), bridge and temple arm use the
   *  'sgFrame' key (per-species frame colour, see sunFrameColor); lenses stay dark 'shade' and the glint white.
   *  Bobo's own species shades call this without a.frame, so they are unchanged (all 'shade'). */
  function drawShades(cv, a) {
    var FR = a.frame ? 'sgFrame' : 'shade';
    if (a.eyes.length === 1 && a.oneEye) { // side-view species (Dodo): one lens + a temple arm toward the back of the head
      var e = a.eyes[0], ty0 = e.minY - 1, tx, ty, back = e.left === false ? -1 : 1;
      for (ty = ty0; ty <= e.maxY; ty++) for (tx = e.minX - 1; tx <= e.maxX + 1; tx++) if (cv.isSil(tx, ty))
        cv.key[ty * N + tx] = (ty === ty0 || tx < e.minX || tx > e.maxX) ? FR : 'shade';
      cv.setKey(e.minX, ty0, 'white');
      for (tx = 2; tx <= 4; tx++) { var ax = back < 0 ? e.minX - tx : e.maxX + tx; if (cv.isSil(ax, ty0)) cv.setKey(ax, ty0, FR); }
      return;
    }
    if (a.eyes.length < 2) return;
    var y0 = Math.min(a.eyes[0].minY, a.eyes[1].minY) - 1, y1 = Math.max(a.eyes[0].maxY, a.eyes[1].maxY), x, y;
    a.eyes.forEach(function (b) {
      for (y = y0; y <= y1; y++) for (x = b.minX - 1; x <= b.maxX + 1; x++) if (cv.isSil(x, y)) cv.key[y * N + x] = (y === y0 || x < b.minX || x > b.maxX) ? FR : 'shade';
      cv.setKey(b.minX, y0, 'white');
    });
    for (x = a.eyes[0].maxX + 2; x <= a.eyes[1].minX - 2; x++) cv.setKey(x, y0, FR);
  }
  /** Sunglasses from fixed map-coordinate lenses (species with sunLens): per lens a dark box over map rows/cols, frame one px
   *  around (top + sides, 'sgFrame'), a white glint top-left, and a bridge across the gap on bridgeRow. Scaled per stage. */
  function drawShadesMap(cv, L, box) {
    var y0 = rowY(box, L.rows[0]), y1 = Math.max(y0 + 1, rowY(box, L.rows[1] + 1) - 1), xs = L.cols.map(function (c) { return [colX(box, c[0]), Math.max(colX(box, c[0]) + 1, colX(box, c[1] + 1) - 1)]; }), x, y;
    if (xs[1][0] - xs[0][1] < 4) { xs[0][1] = xs[1][0] - 4; } // keep a visible bridge gap at small scales
    for (y = y1 + 1; y < N; y++) for (x = xs[0][0]; x <= xs[1][1]; x++) { var ek = cv.getKey(x, y); if (ek === 'eye' || ek === 'pupil') y1 = y; } // cover every eye pixel
    xs.forEach(function (c) {
      for (y = y0 - 1; y <= y1; y++) for (x = c[0] - 1; x <= c[1] + 1; x++) cv.setKey(x, y, (y === y0 - 1 || x < c[0] || x > c[1]) ? 'sgFrame' : 'shade');
      cv.setKey(c[0], y0, 'white');
    });
    for (y = y0 - 2; y <= y1 + 3; y++) for (x = xs[0][0] - 3; x <= xs[1][1] + 3; x++) { var lk = cv.getKey(x, y); if (lk === 'eye' || lk === 'pupil') cv.setKey(x, y, fillKeyNear(cv, x, y + 1)); } // stray eye pixels at small scales
    var by = rowY(box, L.bridgeRow); for (x = xs[0][1] + 2; x <= xs[1][0] - 2; x++) cv.setKey(x, by, 'sgFrame');
  }
  /** Sunglasses frame colour: the species' sunFrame (if any), else the default near-black; if that colour is too close to the
   *  pet's body colour to read, fall back to the first readable of near-black / silver / gold. */
  var SG_DEFAULT = '#0d0d10', SG_FALLBACK = ['#0d0d10', '#d8d8e0', '#ffd23f'];
  function colorDist(p, q) { var dr = p[0] - q[0], dg = p[1] - q[1], db = p[2] - q[2]; return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db); }
  function sunFrameColor(sp, body) {
    var want = (sp && sp.sunFrame) || SG_DEFAULT, MIN = 80;
    if (colorDist(hex(want), body) >= MIN) return hex(want);
    for (var i = 0; i < SG_FALLBACK.length; i++) if (colorDist(hex(SG_FALLBACK[i]), body) >= MIN) return hex(SG_FALLBACK[i]);
    return hex(SG_DEFAULT);
  }
  /** Clear eyeglasses (species with glasses: true): an ink frame one pixel outside each eye box, a bridge and short
   *  temple arms. Only frame pixels are drawn, so the eyes stay visible through the clear lenses. */
  // eye pixels already recoloured by a rolled eye trait (laser / star): glasses must keep them, not glaze them over as lens
  var TRAIT_EYE = { tint: 1, laser: 1, laserlite: 1, gold: 1, eyegold: 1 };
  function drawGlasses(cv, eyes) {
    if (eyes.length < 2) return;
    var L = eyes[0].cx < eyes[1].cx ? eyes[0] : eyes[1], R = L === eyes[0] ? eyes[1] : eyes[0], x, y;
    [L, R].forEach(function (b) {
      var x0 = b.minX - 1, x1 = Math.max(b.maxX + 1, b.minX + 3), y0 = b.minY - 1, y1 = Math.max(b.maxY + 1, b.minY + 2); // lens >= 3x2
      for (x = x0; x <= x1; x++) { cv.setKey(x, y0, 'frame'); cv.setKey(x, y1, 'frame'); }
      for (y = y0; y <= y1; y++) { cv.setKey(x0, y, 'frame'); cv.setKey(x1, y, 'frame'); }
      for (y = y0 + 1; y < y1; y++) for (x = x0 + 1; x < x1; x++) { var k = cv.getKey(x, y); if (k !== 'eye' && k !== 'pupil' && k !== 'ink' && !TRAIT_EYE[k]) cv.setKey(x, y, 'lens'); }
    });
    for (x = L.maxX + 2; x <= R.minX - 2; x++) cv.setKey(x, L.minY, 'frame');
    for (x = L.minX - 2; x >= L.minX - 4 && cv.isSil(x, L.minY - 1); x--) cv.setKey(x, L.minY - 1, 'frame');
    for (x = R.maxX + 2; x <= R.maxX + 4 && cv.isSil(x, R.minY - 1); x++) cv.setKey(x, R.minY - 1, 'frame');
  }
  /** v3.14: after scaling + expressions one eye behind the glasses can lose its pupil and end up as a 2-px white blob
   *  stuck in the top corner of its lens (Chud Adult). If exactly one lens has no pupil and both lens interiors are the
   *  same size, redraw it with the other lens's eye (lid / white / pupil rows), so both eyes sit level and centred. */
  function levelEyesInGlasses(cv, eyes) {
    if (eyes.length < 2) return;
    var lens = eyes.map(function (b) {
      var x0 = b.minX - 1, x1 = Math.max(b.maxX + 1, b.minX + 3), y0 = b.minY - 1, y1 = Math.max(b.maxY + 1, b.minY + 2), pupil = false, x, y;
      for (y = y0 + 1; y < y1; y++) for (x = x0 + 1; x < x1; x++) if (cv.getKey(x, y) === 'pupil' || cv.getKey(x, y) === 'laser' || cv.getKey(x, y) === 'gold') pupil = true;
      return { x0: x0 + 1, y0: y0 + 1, w: x1 - x0 - 1, h: y1 - y0 - 1, pupil: pupil };
    });
    var A = lens[0], B = lens[1];
    if (A.pupil === B.pupil || A.w !== B.w || A.h !== B.h) return;
    var src = A.pupil ? A : B, dst = A.pupil ? B : A, x, y;
    for (y = 0; y < src.h; y++) for (x = 0; x < src.w; x++) cv.setKey(dst.x0 + x, dst.y0 + y, cv.getKey(src.x0 + x, src.y0 + y));
  }
  /** Species egg extras drawn over the standard speckled egg (drawEgg + the species shell/spot colours).
   *  glasses: a tiny pair of thin black rectangular frames with 1-px white lenses (Nakamoto), below the crack line. */
  function drawSpeciesEgg(cv, sp, frame) {
    var wob = [0, 0, 1, -1][frame], cx = 16 + wob, x, y;
    if (!sp.egg.glasses) return; // shell/spot recolour only (e.g. KEVIN's orange egg)
    [cx - 4, cx + 1].forEach(function (x0) {
      for (x = x0; x < x0 + 3; x++) for (y = 19; y < 22; y++) cv.setKey(x, y, (x === x0 + 1 && y === 20) ? 'white' : 'ink');
    });
    cv.setKey(cx - 1, 19, 'ink'); cv.setKey(cx, 19, 'ink'); // bridge
  }
  /** Lens anchors for glasses-wearing laser species: one box per connected eye/pupil blob (the lenses), left to right. An
   *  even-width lens has two middle columns; take the outer one on each side so the pair stays mirror-symmetric. */
  function lensAnchors(cv, fallback) {
    var seen = {}, out = [], i;
    function isLens(j) { var k = cv.key[j]; return k === 'eye' || k === 'pupil'; }
    for (i = 0; i < N * N; i++) {
      if (!isLens(i) || seen[i]) continue;
      var st = [i], pts = []; seen[i] = 1;
      while (st.length) {
        var j = st.pop(), x = j % N, y = Math.floor(j / N); pts.push([x, y]);
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var X = x + dx, Y = y + dy, q = Y * N + X;
          if (X >= 0 && X < N && Y >= 0 && Y < N && !seen[q] && isLens(q)) { seen[q] = 1; st.push(q); }
        }
      }
      out.push(bbox(pts));
    }
    if (out.length !== 2) return fallback;
    out.sort(function (p, q) { return p.minX - q.minX; });
    out[0].left = true; out[1].left = false;
    out[0].cx = Math.floor(out[0].cx); out[1].cx = Math.ceil(out[1].cx);
    var cy = Math.ceil(Math.max(out[0].cy, out[1].cy)); out[0].cy = out[1].cy = cy;
    return out;
  }
  /** Laser eyes (Bitcoin Stamp #3 palette): hot core, red cross, orange glow and outward beams. Drawn on the top layer. */
  var LASER = { core: hex('#ffdb3c'), red: hex('#fb1a06'), glow: hex('#f85c0f') };
  function drawLasers(cv, eyes, frame) {
    eyes.forEach(function (b) {
      var ex = Math.round(b.cx), ey = Math.round(b.cy), dir = (b.left != null ? b.left : b.cx < 16) ? -1 : 1, d;
      [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]].forEach(function (o) { cv.paint(ex + o[0], ey + o[1], LASER.glow); });
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (o) { cv.paint(ex + o[0], ey + o[1], LASER.red); });
      cv.paint(ex, ey, LASER.core);
      var len = 5 + (frame % 2);
      for (d = 3; d < 3 + len; d++) {
        cv.paint(ex + dir * d, ey, d % 2 ? LASER.red : LASER.glow);
        if (d < 5) { cv.paint(ex + dir * d, ey - 1, LASER.glow); cv.paint(ex + dir * d, ey + 1, LASER.glow); }
      }
      cv.paint(ex - dir, ey - 3, LASER.glow); cv.paint(ex + dir * 2, ey + 3, LASER.glow); // little glow rays
    });
  }

  /** Thin ink upper lid over each still-open eye (species with eyeLid: true). */
  function drawEyeLids(cv, a) {
    a.eyes.forEach(function (b) {
      var y = b.minY - 1;
      for (var x = b.minX; x <= b.maxX; x++) { var k = cv.getKey(x, y); if (k && !FACE_KEYS[k]) cv.setKey(x, y, 'ink'); }
    });
  }
  function applyEyeTrait(cv, pet, a) {
    var e = pet.eyes;
    if (e === 'classic') return;
    a.eyes.forEach(function (b) {
      for (var y = b.minY; y <= b.maxY; y++) for (var x = b.minX; x <= b.maxX; x++) {
        var i = y * N + x, k = cv.key[i];
        if (k !== 'eye' && k !== 'pupil') continue;
        if (e === 'tinted' && k === 'pupil') cv.key[i] = 'tint';
        else if (e === 'star') cv.key[i] = k === 'pupil' ? 'gold' : 'eyegold';
        else if (e === 'laser') cv.key[i] = k === 'pupil' ? 'laser' : 'laserlite';
      }
    });
  }

  /** Cheeks v2. Freckles: flat 1-px dots, 3 per cheek under each eye + 2 across the nose (drawn on every species, the flat
   *  noCheeks stamp look included). Tear tracks: a thin 1-px streak running 3 rows down from each eye's inner-centre column;
   *  pixels on or next to a species' own tear (Wojak) are skipped so the two never merge. Uses the pre-expression eye boxes. */
  var FRECKLE = hex('#8a4a2c'), FRECKLE_LT = hex('#e0a070'), TRACK = hex('#8fd0ff');
  function drawCheeksV2(cv, pet, eyes, out) {
    var c = cheeksId(pet); if (c !== 'freckles' && c !== 'tears') return;
    function dot(x, y, col) { if (!cv.isSil(x, y) || FACE_KEYS[cv.getKey(x, y)] || cv.getKey(x, y) === 'shade') return;
      if (c === 'tears') for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) if (cv.getKey(x + dx, y + dy) === 'tear') return;
      var i = (y * N + x) * 4, lum = out ? out[i] * 0.3 + out[i + 1] * 0.59 + out[i + 2] * 0.11 : 200;
      cv.paint(x, y, col || (lum < 90 ? FRECKLE_LT : FRECKLE)); }
    var E = eyes.slice().sort(function (p, q) { return p.cx - q.cx; });
    E.forEach(function (b) {
      var x = Math.round(b.cx), y = b.maxY + 2;
      if (c === 'freckles') { dot(x - 1, y); dot(x + 1, y); dot(x, y + 1); }
      else { var tx = E.length > 1 ? (b === E[0] ? Math.ceil(b.cx) : Math.floor(b.cx)) : x; for (var ty = b.maxY + 1; ty <= b.maxY + 3; ty++) dot(tx, ty, TRACK); }
    });
    if (c === 'freckles' && E.length > 1) { var mx = Math.round((E[0].maxX + E[1].minX) / 2), my = Math.max(E[0].maxY, E[1].maxY) + 1; dot(mx - 1, my); dot(mx + 1, my); }
  }
  function drawFaceExtras(cv, pet, a, frame) {
    a.eyes.forEach(function (b) {
      var outer = ((b.left != null ? b.left : b.cx < 16)) ? b.minX - 1 : b.maxX + 1;
      if (cheeksId(pet) === 'blush' && !(byId(SPECIES, pet.species) || {}).noCheeks && cv.isSil(outer, b.maxY + 2)) { cv.paint(outer, b.maxY + 2, FIXED.p); cv.paint((b.left != null ? b.left : b.cx < 16) ? outer + 1 : outer - 1, b.maxY + 2, FIXED.p); }
      if (pet.eyes === 'laser') {
        var hasLaser = false;
        for (var yy = b.minY; yy <= b.maxY; yy++) for (var xx = b.minX; xx <= b.maxX; xx++) if (cv.getKey(xx, yy) === 'laser') hasLaser = true;
        if (!hasLaser) return; // eyes closed at this stage
        var dir = (b.left != null ? b.left : b.cx < 16) ? -1 : 1, yb = Math.round(b.cy), col = frame % 2 ? FIXED.R : hex('#ff6060');
        for (var x = dir < 0 ? b.minX - 1 : b.maxX + 1; x >= 0 && x < N; x += dir) cv.paint(x, yb, col);
      }
    });
  }

  // ------------------------------------------------------------------- Gear
  function drawCape(cv, sp, box) {
    var top = rowY(box, sp.gear.cape != null ? sp.gear.cape : sp.gear.armor[0]) - 1, bottom = box.y0 + box.h - 1;
    for (var y = top; y <= bottom; y++) {
      var hw = Math.min(Math.floor(box.w / 2) + 2, Math.floor(box.w / 2) + Math.floor((y - top) / 3));
      if (sp.gear.capeHalf) hw = Math.min(hw, Math.round(sp.gear.capeHalf * box.w / box.W));
      for (var x = 16 - hw; x < 16 + hw; x++) cv.setKey(x, y, y === bottom ? 'capeTrim' : 'cape');
    }
    
  }

  function drawArmor(cv, sp, box, a) {
    var g = sp.gear.armor, y1 = rowY(box, g[0]), y2 = Math.min(box.y0 + box.h - 1, rowY(box, g[1] + 1) - 1);
    var xl = colX(box, g[2]), xr = box.x0 + box.w - 1 - Math.floor(g[2] * box.w / box.W), f = a.face, x, y;
    for (y = y1; y <= y2; y++) for (x = xl; x <= xr; x++) {
      var k = cv.getKey(x, y);
      if (!cv.isSil(x, y) || FACE_KEYS[k] || k === 'cape' || k === 'capeTrim') continue;
      if (sp.gear.armorSkipsBelly && (k === 'belly' || k === 'patB')) continue;
      if (f && x >= f.minX && x <= f.maxX && y >= f.minY && y <= f.maxY) continue;
      cv.key[y * N + x] = (y === y1 || x === 16 || x === 15) ? 'metalTrim' : 'metal';
    }
    // shoulder pads
    var l = -1, r = -1;
    for (x = 0; x < N; x++) if (cv.getKey(x, y1) === 'metalTrim' || cv.getKey(x, y1) === 'metal') { if (l < 0) l = x; r = x; }
    if (l >= 0) {
      for (y = y1 - 1; y <= y1; y++) { cv.setKey(l - 1, y, 'metalTrim'); cv.setKey(l, y, 'metalTrim'); cv.setKey(r, y, 'metalTrim'); cv.setKey(r + 1, y, 'metalTrim'); }
    }
    if (y2 - y1 >= 3) { cv.setKey(15, y1 + 2, 'gem'); cv.setKey(16, y1 + 2, 'gem'); }
  }

  function drawBand(cv, pet, sp, box, a) {
    var b = byId(BANDS, pet.band) || BANDS[0], x, y, r = -1;
    // noHeadband (Wojak): nothing is drawn on the head; a rolled headband is worn as a neck scarf (same colour)
    if (b.type === 'headband' && !sp.gear.noHeadband) {
      y = rowY(box, sp.gear.band);
      /* gear-fit 2026-10-16 (owner approved): on the small Hatchling/Juvenile maps of Sarutobi and Dodo the scaled band row can land on the eyes or an
       * empty row; move the headband up to the nearest head row (within 4) with >= 3 free head pixels and no eye on it. */
      if (box.small && (sp.id === 'sarutobi' || sp.id === 'dodo')) { var bandOk = function (yy) { var n = 0, eye = false; for (var xx = 0; xx < N; xx++) { var kk = cv.getKey(xx, yy); if (kk === 'eye' || kk === 'pupil') eye = true; else if (cv.isSil(xx, yy) && !FACE_KEYS[kk]) n++; } return !eye && n >= 3; };
        if (!bandOk(y)) { for (var dyb = 1; dyb <= 4; dyb++) { if (y - dyb >= 0 && bandOk(y - dyb)) { y -= dyb; break; } } } }
      for (x = 0; x < N; x++) if (cv.isSil(x, y) && !FACE_KEYS[cv.getKey(x, y)]) { cv.key[y * N + x] = 'band'; r = x; }
      if (r >= 0) { cv.setKey(r + 1, y, 'band2'); cv.setKey(r + 2, y + 1, 'band2'); cv.setKey(r + 1, y + 1, 'band'); }
    } else {
      y = rowY(box, sp.gear.scarf);
      for (var yy = y; yy <= y + 1; yy++) for (x = 0; x < N; x++) {
        var k = cv.getKey(x, yy);
        if (cv.isSil(x, yy) && k !== 'cape' && k !== 'capeTrim' && k !== 'eye' && k !== 'pupil' && k !== 'mouth') cv.key[yy * N + x] = yy === y ? 'band' : 'band2';
      }
      cv.setKey(19, y + 2, 'band'); cv.setKey(19, y + 3, 'band2'); cv.setKey(20, y + 2, 'band2');
    }
  }

  var WEAPON_MAPS = {
    'wooden-sword': ['.L.', '.L.', '.L.', '.L.', '.L.', '.L.', '.L.', 'WWW', '.W.', '.W.', '.W.'],
    'iron-sword': ['.s.', '.s.', '.s.', '.s.', '.s.', '.s.', '.s.', 'iii', '.W.', '.W.', '.i.'],
    'golden-sword': ['.y.', '.y.', '.y.', '.y.', '.y.', '.y.', '.y.', 'ggg', '.r.', '.r.', '.g.'],
    'staff': ['.u.', 'uuu', '.u.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.'],
    'axe': ['.ii', 'iWi', '.ii', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.'],
    'trident': ['s.s', 'sss', '.s.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.'],
    'spear': ['.s.', 'sss', '.r.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.'],
    'torch': ['.o.', 'oyo', '.y.', 'ggg', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.']
  };
  var WEAPON_KEYS = { L: 'lwood', W: 'wood', s: 'blade', i: 'iron', y: 'goldblade', g: 'gold', r: 'gem', u: 'gemB', o: 'flame' };
  function drawWeapon(cv, pet, box, frame, stage) {
    var map = WEAPON_MAPS[pet.weapon] || WEAPON_MAPS['wooden-sword'];
    if (pet.weapon === 'torch' && frame % 2) map = ['o..', '.oy', '.y.'].concat(map.slice(3));
    var x0 = Math.min(N - 3, box.x0 + box.w - 1), y0 = box.y0 + box.h - map.length;
    /* gear-fit 2026-10-16 (owner approved): Dodo and Nakamoto at Adult: swords and torch sit right against the body (no 1-px gap) */
    if (stage === 3 && (pet.species === 'dodo' || pet.species === 'nakamoto') && /sword$|^torch$/.test(pet.weapon || 'wooden-sword')) {
      var wr = -1; for (var wy = Math.max(0, y0); wy < Math.min(N, y0 + map.length); wy++) for (var wx = 0; wx < N; wx++) if (cv.isSil(wx, wy)) wr = Math.max(wr, wx);
      if (wr >= 0) x0 = Math.max(0, Math.min(N - 3, wr)); }
    cv.spriteKeys(x0, y0, map, { L: 'lwood', W: 'wood', s: 'blade', i: 'iron', y: 'goldblade', g: 'gold', r: 'gem', u: 'gemB', o: 'flame' });
    if (pet.weapon === 'torch') for (var j = 0; j < 3; j++) for (var i = 0; i < 3; i++) if (map[j].charAt(i) === 'y') cv.setKey(x0 + i, y0 + j, 'flame2');
  }

  var CROWN_MAPS = {
    'laurel': ['l......l', 'Ll....lL', '.LllllL.'],
    'silver-crown': ['s..ss..s', 'ss.ss.ss', 'ssssssss', 'dsdssdsd'],
    'gold-crown': ['g..gg..g', 'gg.gg.gg', 'gggggggg', 'GgGGGGgG'],
    'jeweled-crown': ['g..gg..g', 'gr.gg.ug', 'gggggggg', 'GrGuGGrG'],
    'flame-crown': ['o..oo..o', 'gg.gg.gg', 'gggggggg', 'GrGGGGrG']
  };
  function drawCrown(cv, pet, a, frame, sp) {
    var map = CROWN_MAPS[pet.crown] || CROWN_MAPS['gold-crown'];
    // v3.14: the flame tips sway once per bounce cycle, on the landed rest frame (3) only. Frames 0-2 (rest and both bounce
    // frames) share one shape, so the crown never swaps shape on the bounce; only the two outer tips lean in.
    if (pet.crown === 'flame-crown' && frame === 3) map = ['.o.oo.o.'].concat(map.slice(1));
    // crownSink: narrow-domed heads (Wojak) wear the crown a little lower so it sits on the dome
    // crownCol: off-centre heads (side-view Dodo, 3/4 Doge) centre the crown over that sprite MAP column. v3.14.1: the column
    // is scaled to the stage like every other map anchor (colX); it used to be added unscaled, which pushed the crown right of
    // the head at Hatchling/Juvenile/Adult. Dodo's anchor moved 16 -> 15 for the v3.14 rounder head (top-of-head centre).
    var box = a.box, cc = (sp && sp.gear) ? sp.gear.crownCol : null;
    var cx0 = cc != null ? (box ? colX(box, cc) : a.x0 + cc) - 4 : 12;
    cv.sprite(cx0, a.headTop - map.length + ((sp && sp.gear && sp.gear.crownSink) || 0), map, null);
  }

  /** Render n animation frames (default 4). */
  function renderFrames(pet, opts) {
    opts = opts || {};
    var frames = [];
    for (var f = 0; f < (opts.frames || 4); f++) frames.push(render(pet, { stage: opts.stage, frame: f, powered: opts.powered, gearCap: opts.gearCap, gearOverride: opts.gearOverride }));
    return frames;
  }

  var GEAR_POOLS = { band: BANDS, armor: ARMORS, cape: CAPES, weapon: WEAPONS, crown: CROWNS };
  /** Human-readable trait labels for display. Pass a stage to include expression + visible gear. */
  function describe(pet, stage) {
    var d = {
      Tier: (TIERS[pet.tierIndex] || TIERS[0]).label,
      Species: (byId(SPECIES, pet.species) || {}).label,
      Pattern: (byId(PATTERNS, pet.pattern) || {}).label,
      Eyes: (byId(EYES, pet.eyes) || {}).label,
      Cheeks: byId(CHEEKS, cheeksId(pet)).label,
      Background: (byId(BACKGROUNDS, pet.background) || byId(BG_V2, pet.background) || {}).label
    };
    var spd = byId(SPECIES, pet.species);
    if (spd && spd.shades) {
      var wears = (pet.shades === true || pet.shades === false) ? pet.shades : Math.floor(parseInt(pet.dna.substr(62, 2), 16) * 100 / 256) < spd.shades.chance;
      d.Shades = wears ? (stage != null && !hasShades(pet, spd, clampStage(stage)) ? 'Black shades (off at this stage)' : 'Black shades') : 'None';
    }
    if (stage != null) {
      d.Stage = STAGES[clampStage(stage)];
      d.Expression = expressionFor(pet, stage) || '—';
      var g = gearFor(pet, stage);
      var spg = byId(SPECIES, pet.species) || {};
      d.Gear = g.length ? g.map(function (r) {
        var it = byId(GEAR_POOLS[r], pet[r]) || {};
        return it.label + (r === 'band' && it.type === 'headband' && spg.gear && spg.gear.noHeadband ? ' (worn as a neck scarf)' : '');
      }).join(', ') : 'None';
    }
    return d;
  }

  // Signature kits used for the cast art / galleries (Legendary = full kit).
  var CAST_KITS = {
    pepe: { band: 'red-headband', armor: 'gold', cape: 'royal', weapon: 'golden-sword', crown: 'jeweled-crown' },
    wojak: { band: 'red-scarf', armor: 'silver', cape: 'purple', weapon: 'staff', crown: 'laurel' },
    chud: { band: 'green-scarf', armor: 'iron', cape: 'green', weapon: 'axe', crown: 'silver-crown' },
    bobo: { shades: false, band: 'red-headband', armor: 'iron', cape: 'purple', weapon: 'wooden-sword', crown: 'gold-crown' },
    mumu: { band: 'gold-headband', armor: 'gold', cape: 'goldcape', weapon: 'spear', crown: 'gold-crown' },
    snibby: { band: 'blue-headband', armor: 'silver', cape: 'blue', weapon: 'trident', crown: 'silver-crown' },
    dodo: { band: 'purple-scarf', armor: 'silver', cape: 'royal', weapon: 'iron-sword', crown: 'jeweled-crown' },
    kevin: { band: 'white-scarf', armor: 'iron', cape: 'red', weapon: 'staff', crown: 'gold-crown' },
    peepo: { band: 'red-headband', armor: 'iron', cape: 'blue', weapon: 'wooden-sword', crown: 'gold-crown' },
    sarutobi: { band: 'gold-headband', armor: 'leather', cape: 'green', weapon: 'staff', crown: 'gold-crown' },
    doge: { band: 'red-scarf', armor: 'gold', cape: 'royal', weapon: 'golden-sword', crown: 'jeweled-crown' },
    lenny: { band: 'black-headband', armor: 'obsidian', cape: 'midnight', weapon: 'trident', crown: 'silver-crown' },
    nakamoto: { band: 'purple-scarf', armor: 'obsidian', cape: 'midnight', weapon: 'staff', crown: 'gold-crown' }
  };
  /** A character's canonical look at a tier, with its signature kit. */
  function characterPet(speciesId, opts) {
    opts = opts || {};
    var o = { species: speciesId, pattern: 'none', eyes: 'classic', cheeks: false,
      background: opts.background || 'solid', bgColor: opts.bgColor || '#2b1d3f', tier: opts.tier || 'legendary' };
    var kit = CAST_KITS[speciesId] || {};
    for (var k in kit) o[k] = kit[k];
    return generate({ blockHash: 'xcpets-cast', petId: speciesId, overrides: o });
  }

  /** Hash of the RGBA pixels — handy for cross-checking browser vs Node output. */
  function pixelHash(img) { return sha256Hex(Array.prototype.join.call(img.data, ',')); }

  return {
    VERSION: VERSION, SIZE: N, TIERS: TIERS, STAGES: STAGES, STAGE_MULT: STAGE_MULT, STAT_KEYS: STAT_KEYS, GEAR_RANKS: GEAR_RANKS,
    SPECIES: SPECIES, COMMUNITY_SPECIES: COMMUNITY_SPECIES, PATTERNS: PATTERNS, EYES: EYES,
    BANDS: BANDS, ARMORS: ARMORS, CAPES: CAPES, WEAPONS: WEAPONS, CROWNS: CROWNS, BACKGROUNDS: BACKGROUNDS, BG_V2: BG_V2, BG_V2_FROM_BLOCK: BG_V2_FROM_BLOCK, CHEEKS: CHEEKS, CHEEKS_V2_FROM_BLOCK: CHEEKS_V2_FROM_BLOCK, cheeksId: cheeksId, sunFrameColor: function (sp, body) { var c = sunFrameColor(sp, hex(body)); return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }, CHARKEY: CHARKEY,
    sha256Hex: sha256Hex, sha256Bytes: sha256Bytes, utf8Bytes: utf8Bytes, sfc32: sfc32,
    seedString: seedString, generate: generate, gearFor: gearFor, expressionFor: expressionFor, stats: stats,
    render: render, stageMap: stageMap, renderFrames: renderFrames, describe: describe, characterPet: characterPet, pixelHash: pixelHash
  };
});
