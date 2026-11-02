/* XCPETS Pet Cemetery loop: small 8-bit badges (Oct 29 2026), drawn from pixel maps as crisp SVG so they stay sharp at any size.
 * Same palette as the cemetery scene and altar: outline #16141f, stone greys, zombie green #7dff6a, candle gold #ffc93c.
 * halo (resurrected), feral (red eyes), hunted (grave with a stake), dust (crumbled grave), hunter (Zombie Hunter badge),
 * candle (open altar), shovel (raise), easy / medium / hard (raise difficulty skulls). UI only; never read by replay. */
(function () {
  'use strict';
  var PAL = { k: '#16141f', s: '#9a9ea8', S: '#c8ccd4', d: '#525560', g: '#7dff6a', G: '#3c8a34', y: '#ffc93c', Y: '#fff3b0', r: '#ff4d4d', R: '#8a1c1c', b: '#6a4a2a', B: '#3e2a18', w: '#e9e3d0', W: '#ffffff', p: '#b07cff', o: '#ff9a3c', m: '#7c808c', e: '#2a1d14' };
  var MAP = {
    halo: ['............', '...YYYYYY...', '..Y......Y..', '.Y.yyyyyy.Y.', '..Y......Y..', '...YYYYYY...', '............', '....kkkk....', '...kwwwwk...', '...kwkwkk...', '...kwwwwk...', '....kwwk....'],
    feral: ['............', '..kk....kk..', '.kGGk..kGGk.', '.kggkkkkggk.', 'kgggggggggk.', 'kgrRgggrRgk.', 'kgrrgggrrgk.', 'kggggkggggk.', '.kgkwkwkgk..', '.kggggggk...', '..kkkkkk....', '............'],
    hunted: ['.....kk.....', '....kbbk....', '..kkkbbkkk..', '.kSSSbbsssk.', '.kSkkbbkksk.', '.kSSSbbsssk.', '.kSsssbsssk.', '.kSssbbsssk.', '.kSsssssssk.', 'kkkkkkkkkkkk', 'kBBbBBBbBBBk', '.kkkkkkkkkk.'],
    dust: ['............', '............', '............', '.....m......', '...m...s....', '.....ss.m...', '....sSss....', '...ssmSss...', '..ssSssmss..', '.sSssmssSss.', 'kkkkkkkkkkkk', '............'],
    hunter: ['...kkkkkk...', '..kyyyyyyk..', '.kyYkkkkyyk.', '.kykWWWWkyk.', '.kykWkkWkyk.', '.kykWWWWkyk.', '.kyykWWkyyk.', '..kyykkyyk..', '...kyyyyk...', '....kRRk....', '...kR..Rk...', '...kk..kk...'],
    candle: ['.....k......', '....kyk.....', '....kYk.....', '...kyYyk....', '....kyk.....', '....kwk.....', '...kwwwk....', '...kwwmk....', '...kwwmk....', '...kwwmk....', '..kkkkkkk...', '..kmmmmmk...'],
    shovel: ['.........kk.', '........kbk.', '.......kbk..', '......kbk...', '.....kbk....', '..kkkbk.....', '.kSSkk......', 'kSSSSk......', 'kSSSSk......', 'kSsSk.......', '.kkk........', '............'],
    easy: ['............', '...kkkkkk...', '..kgggggGk..', '.kgggggggGk.', '.kgkkggkkGk.', '.kgkkggkkGk.', '.kgggkkggGk.', '..kggggggk..', '...kgkgkk...', '...kkkkk....', '............', '............'],
    medium: ['............', '...kkkkkk...', '..kyyyyyok..', '.kyyyyyyyok.', '.kykkyykkok.', '.kykkyykkok.', '.kyyykkyyok.', '..kyyyyyyk..', '...kykykk...', '...kkkkk....', '............', '............'],
    hard: ['..k......k..', '..kk.kk.kk..', '..krkkkkrk..', '.krrrrrrrRk.', '.krkkrrkkRk.', '.krkkrrkkRk.', '.krrrkkrrRk.', '..krrrrrrk..', '...krkrkk...', '...kkkkk....', '............', '............']
  };
  var CACHE = {};
  function svg(name) { if (CACHE[name]) return CACHE[name]; var m = MAP[name]; if (!m) return ''; var h = m.length, w = m[0].length, r = [];
    m.forEach(function (row, y) { for (var x = 0; x < row.length; x++) { var c = PAL[row[x]]; if (c) r.push('<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>'); } });
    return (CACHE[name] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">' + r.join('') + '</svg>'); }
  function url(name) { return 'data:image/svg+xml,' + encodeURIComponent(svg(name)); }
  /** img(name, size, label): an <img> tag for the badge (size in CSS px; whole multiples of 12 stay crisp). */
  function img(name, size, label) { size = size || 24; return '<img class="cem-art cem-art-' + name + '" src="' + url(name) + '" width="' + size + '" height="' + size + '" alt="' + (label || '') + '"' + (label ? '' : ' aria-hidden="true"') + ' style="image-rendering:pixelated;vertical-align:middle">'; }
  window.V2CemArt = { img: img, url: url, svg: svg, names: Object.keys(MAP) };
})();
