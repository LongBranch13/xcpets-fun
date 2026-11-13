/* YE art preview (review only). A 32px pet map in the same construction as the roster
 * (js/pet-core.js SPECIES maps): nearest-neighbour stages, ink outline, mythic gold rim,
 * and gear rows the live fitter reads. Not loaded by any page. Not in the species list,
 * the hatch pool, or the rules. The preview script injects this object in memory and
 * draws it with PetCore.render + V2Render.anatomyFramesWith.
 *
 * Reads: dark skin, crisp black hairline, short black goatee, white smile, light-grey
 * varsity jacket, white striped collar, white snaps, light-blue "P" on the wearer's
 * left chest (viewer's right), teal shirt. The black shades are NOT baked in. They are
 * the signature Guise piece YE_SHADES, drawn by the live eye fitter, so they come off.
 *
 * Colour keys: b jacket (recolours on a hybrid), a the P, l the shirt, 1-4 skin and
 * hair and beard (stay put, so a Ye body still reads as Ye). No bitcoin orange.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YeSprite = factory();
})(this, function () {
  'use strict';
  /* 22 wide, 26 tall. Two empty rows on top so a hat fits in the frame
   * (feet sit on canvas row 28, so a 26-row map starts at canvas y=2). */
  var W = 22, H = 26, g = [];
  for (var i = 0; i < H; i++) g.push(new Array(W).fill('.'));
  function put(x, y, ch) { if (ch === '.') return; if (y < 0 || y >= H || x < 0 || x >= W) throw new Error('Ye pixel off the map ' + x + ',' + y); g[y][x] = ch; }
  function stamp(x, y, rows) { rows.forEach(function (row, dy) { for (var dx = 0; dx < row.length; dx++) put(x + dx, y + dy, row.charAt(dx)); }); }
  function fill(x0, x1, y, ch) { for (var x = x0; x <= x1; x++) put(x, y, ch); }
  /* round black hair cap */
  stamp(5, 2, ['..333333..', '.33333333.', '3333333333', '3333333333']);
  /* crisp hairline: one solid hair row, then skin. No fade. */
  fill(3, 18, 6, '3');
  fill(2, 19, 7, '1'); fill(3, 18, 7, '1');
  /* forehead, then two big eyes with a skin bridge so the fitter sees two lenses */
  fill(2, 19, 8, '1');
  stamp(3, 9, [
    '1EEEE1..1EEEE1',
    '1EPPPE..EPPPE1',
    '1EEEE1..1EEEE1'
  ]);
  fill(2, 19, 12, '1');
  /* white smile, ink mouth under it, short goatee that does not cover the teeth */
  stamp(6, 13, [
    '1wwwwwwww1',
    'wwmmmmmmww',
    '.55555555.',
    '..555555..',
    '...5555...'
  ]);
  /* white-striped collar, teal shirt in the opening, grey jacket */
  for (var xc = 2; xc <= 19; xc++) put(xc, 18, xc % 2 ? 'w' : '9');
  fill(2, 19, 19, 'b');
  fill(8, 13, 19, 'l');
  fill(2, 19, 20, 'b');
  fill(7, 14, 20, 'l');
  /* jacket body, white snaps down the middle, big P on the wearer's left (viewer's right) */
  for (var yj = 21; yj <= 23; yj++) { fill(2, 19, yj, 'b'); put(2, yj, '7'); put(19, yj, '7'); }
  [21, 23].forEach(function (y) { put(10, y, 'w'); put(11, y, 'w'); });
  stamp(13, 20, [
    'aaaa.',
    'a..a.',
    'aaaa.',
    'a....'
  ]);
  /* teal hem under the jacket, two shoes */
  fill(6, 15, 24, 'l');
  put(4, 25, '4'); put(5, 25, '4'); put(16, 25, '4'); put(17, 25, '4');
  var MAP = g.map(function (row) { return row.join(''); });
  /* Hatchling is 0.62 of this map (14 x 16). A hand grid keeps the eyes, goatee and P,
   * which the plain downscale turns into noise. Same keys, so gear still finds them. */
  var SMALL1 = [
    '....333333....',
    '...33333333...',
    '..3311111113..',
    '..31EE1..EE13.',
    '..31PP1..PP13.',
    '..31111111113.',
    '...1wwwwww13..',
    '...115555513..',
    '....9w9w9w9...',
    '...9bbllllb9..',
    '..9bbbllPPb9..',
    '..bbbbPwwbbb..',
    '..7bbPPbbbb7..',
    '..7bbbbbbbb7..',
    '...llllllll...',
    '....4....4....'
  ];
  SMALL1.forEach(function (row, i) {
    if (row.length !== 14) throw new Error('Ye hatchling row ' + i + ' is ' + row.length);
  });
  if (SMALL1.length !== 16) throw new Error('Ye hatchling height ' + SMALL1.length);
  var YE = {
    id: 'ye',
    label: 'Ye',
    w: 0,
    t: 3,
    canon: { body: '#d5d8e0', accent: '#5ec8f5', belly: '#14b8b0' },
    outline: '#1a1020',
    eyeWhite: '#f7f4ee',
    eyeLid: true,
    sunFrame: '#f4f4ee',
    colors: {
      '1': '#4a2c1c',
      '2': '#6b4030',
      '3': '#101014',
      '4': '#1a1020',
      '5': '#0c0a0e',
      '7': '#8b929e',
      '9': '#f7f8fb'
    },
    /* band sits in the hair, above the eye rows (9-11). Armor is the jacket only.
       crownSink 0: a crown rests on the hair, not down across the shades. */
    gear: { armor: [20, 24, 1], band: 4, scarf: 18, cape: 19, crownSink: 0, crownCol: 11 },
    pose: null,
    arc: [
      ['Cool', 'base', 'keep', 'base'],
      ['Steady', 'base', 'keep', 'base'],
      ['Smiling', 'base', 'keep', 'base'],
      ['Grinning', 'base', 'keep', 'base'],
      ['Legendary', 'base', 'keep', 'base']
    ],
    map: MAP,
    small: { 1: SMALL1 }
  };
  /* Signature Guise. Installed onto BonusGear.DEFS by the preview only.
   * s:'glasses' is the live eye fitter: frame, lenses on the real eyes, bridge, short arms.
   * The top lens row is white (the glint). The rest is black. wide:2 makes them wide. */
  var YE_SHADES = {
    id: 'ye-shades',
    slot: 'face',
    tier: 3,
    label: 'Black shades',
    at: 'eyes',
    map: ['nnnn.nnnn', 'nZZZnZZZn', '.nZnnnZn.'],
    origin: 'ye',
    exclusive: true,
    species: 'ye',
    kind: 'face',
    sig: true,
    legendary: true,
    /* Top lens row is the white glint. drop:1 adds a black row under short eyes
     * (Pepe) so the glint does not become the whole lens. */ 
    v2eye: { s: 'glasses', f: 'n', l: ['w', 'Z'], drop: 1, up: 0, wide: 1 }
  };
  return { SPECIES: YE, SHADES: YE_SHADES, STAGES: ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'] };
});
