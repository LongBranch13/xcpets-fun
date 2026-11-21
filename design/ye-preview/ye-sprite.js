/* YE art preview (review only). A 32px pet map in the same construction as the roster
 * (js/pet-core.js SPECIES maps): nearest-neighbour stages, ink outline, mythic gold rim,
 * and gear rows the live fitter reads. Not loaded by any page. Not in the species list,
 * the hatch pool, or the rules. The preview script injects this object in memory and
 * draws it with PetCore.render + V2Render.anatomyFramesWith.
 *
 * Flat-cel bust from the Heartless video: bold outline, flat colour blocks, a short
 * black flat-top, warm brown skin, brows and eyes (shades off is the default), a white
 * grin, a black jaw beard into a goatee, a light-grey varsity jacket (#A9B4C2) with a
 * white ribbed collar and white snaps, a teal V, and a light-blue block P. The black
 * shades are the removable Guise piece YE_SHADES, not baked into the face.
 *
 * Colour keys: b jacket (recolours on a hybrid), a the P, l the shirt, 1-4 skin and
 * hair and beard (stay put, so a Ye body still reads as Ye). No bitcoin orange.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YeSprite = factory();
})(this, function () {
  'use strict';
  /* 28x28 bust, centred. Mythic fills the frame. Adult keeps every row except 4, 13 and 23,
   * so the grin, the beard and the P are drawn on rows Adult still shows. */
  var W = 28, H = 28, g = [];
  for (var i = 0; i < H; i++) g.push(new Array(W).fill('.'));
  function put(x, y, ch) { if (y < 0 || y >= H || x < 0 || x >= W) return; g[y][x] = ch; }
  function fill(x0, x1, y, ch) { for (var x = x0; x <= x1; x++) put(x, y, ch); }
  function span(y, x0, x1, ch) { fill(x0, x1, y, ch); }
  /* flat black crop, same width as the forehead under it. No brim. */
  span(1, 8, 19, '3');
  span(2, 6, 21, '3');
  span(3, 5, 22, '3');
  span(5, 4, 23, '3');
  span(6, 4, 23, '2');
  span(6, 5, 8, '1'); span(6, 19, 22, '1');
  /* thick brows, then wide eyes with a skin bridge */
  span(7, 4, 23, '1');
  span(7, 6, 11, 'B'); span(7, 16, 21, 'B');
  span(8, 4, 23, '1'); span(9, 4, 23, '1'); span(10, 4, 23, '1');
  span(8, 6, 12, 'E'); span(8, 15, 21, 'E');
  span(9, 6, 12, 'E'); span(9, 15, 21, 'E');
  span(9, 9, 11, 'P'); span(9, 15, 17, 'P');
  span(10, 6, 12, 'E'); span(10, 15, 21, 'E');
  span(11, 4, 23, '1');
  span(12, 4, 23, '1');
  /* white grin. Beard sits on the jaw beside it, then under it as the goatee. */
  span(12, 9, 18, 'w'); span(12, 13, 14, 'm');
  span(12, 5, 7, '5'); span(12, 20, 22, '5');
  span(14, 4, 23, '1');
  span(14, 8, 19, 'w');
  span(14, 5, 7, '5'); span(14, 20, 22, '5');
  span(15, 4, 23, '5');
  span(15, 6, 9, '1'); span(15, 18, 21, '1');
  span(16, 6, 21, '5');
  span(16, 7, 10, '6'); span(16, 17, 20, '6');
  span(17, 9, 18, '6');
  /* ribbed collar: white, grey stripe, white. Shoulders wider than the head. */
  span(18, 2, 25, 'w');
  span(19, 2, 25, 'b');
  for (var xs = 2; xs <= 25; xs += 2) put(xs, 19, 'w');
  span(20, 2, 25, 'w');
  /* teal V, then the jacket. The P is outlined in ink so it separates from the grey. */
  span(21, 1, 26, 'b'); span(21, 1, 2, '7'); span(21, 25, 26, '7');
  span(21, 11, 16, 'l');
  span(22, 1, 26, 'b'); span(22, 1, 2, '8'); span(22, 25, 26, '7');
  span(22, 12, 15, 'l');
  function jacketRow(y) { span(y, 1, 26, 'b'); span(y, 1, 2, '8'); span(y, 24, 26, '7'); }
  jacketRow(23); jacketRow(24); jacketRow(25); jacketRow(26); jacketRow(27);
  /* block P, viewer's right. Rows 22, 24, 25, 26, 27 are the five Adult keeps. */
  var P = ['kaaaaak', 'kabbbak', 'kabbbak', 'kaaaaak', 'kabbbbk', 'kabbbbk'];
  [22, 23, 24, 25, 26, 27].forEach(function (y, i) {
    for (var dx = 0; dx < P[i].length; dx++) put(16 + dx, y, P[i].charAt(dx));
  });
  put(13, 25, 'w'); put(14, 25, 'w');
  put(13, 27, 'w'); put(14, 27, 'w');
  var MAP = g.map(function (row) { return row.join(''); });
  var YE = {
    id: 'ye',
    label: 'Ye',
    w: 0,
    t: 3,
    canon: { body: '#A9B4C2', accent: '#5EC8F7', belly: '#1A8F88' },
    outline: '#1A120C',
    eyeWhite: '#f7f4ee',
    eyeLid: false,
    sunFrame: '#f4f4ee',
    colors: {
      '1': '#A86B45',
      '2': '#C9956A',
      '3': '#16141A',
      '5': '#141218',
      '6': '#7A4E32',
      '7': '#7E8C9E',
      '8': '#D5DCE4'
    },
    /* band in the flat top. Armor on the jacket, under the beard and collar. */
    gear: { armor: [21, 26, 1], band: 3, scarf: 17, cape: 18, crownSink: 0, crownCol: 13 },
    pose: null,
    arc: [
      ['Cool', 'base', 'keep', 'base'],
      ['Steady', 'base', 'keep', 'base'],
      ['Smiling', 'base', 'keep', 'base'],
      ['Grinning', 'base', 'keep', 'base'],
      ['Legendary', 'base', 'keep', 'base']
    ],
    map: MAP
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
