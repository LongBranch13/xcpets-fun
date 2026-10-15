/* v2 background variety (2026-10-14, DEMO working build). pet-core.js is untouched: pets hatched AFTER the v2 cutoff (block 971,500) whose
 * pet-core background is one of the repetitive 'btc' / 'xcp' / 'bxmix' / 'solid' patterns get a variant picked deterministically from their DNA
 * (FNV-1a of 'XCPETS:bg:v3:' + dna; no randomness at render time). Only background pixels (and the ground shadow) are repainted, in the same
 * faint low-contrast pixel style, so sprites never clash. Hooked in v2-render.js petFrames (post-cutoff branch only). */
(function (root) {
  'use strict';
  var GLYPH = { btc: ['####.', '.#..#', '.###.', '.#..#', '####.'], xcp: ['.###.', '#.#.#', '##.##', '#.#.#', '.###.'] };
  var HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
  function hex(c) { c = String(c || '#000000').replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  var W = [255, 255, 255], K = [0, 0, 0];
  function hash(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  // paint(x, y, frame, base, h) -> colour. 'keep' variants leave pet-core's pixels (btc) or use the Counterparty logo override (cplogo / bxmix).
  var V = [
    { id: 'btc', label: 'Bitcoin', w: 6, keep: 'btc' },
    { id: 'cplogo', label: 'Counterparty', w: 6, keep: 'xcp' },
    { id: 'bxmix', label: 'Bitcoin + Counterparty', w: 5, keep: 'bxmix' },
    { id: 'plain', label: 'Plain', w: 8, paint: function (x, y, f, b) { return b; } },
    { id: 'stars', label: 'Stars', w: 8, paint: function (x, y, f, b, h) { var k = ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ h) >>> 3) % 37; return k === 0 ? mix(b, W, (x + y + f) % 3 ? 0.26 : 0.16) : k === 18 ? mix(b, W, 0.12) : mix(b, K, 0.2); } },
    { id: 'checker', label: 'Checker', w: 8, paint: function (x, y, f, b) { return ((x >> 2) + (y >> 2)) % 2 ? mix(b, W, 0.07) : b; } },
    { id: 'scanlines', label: 'Scanlines', w: 7, paint: function (x, y, f, b) { return y % 3 === 0 ? mix(b, K, 0.28) : b; } },
    { id: 'sky', label: 'Gradient sky', w: 8, paint: function (x, y, f, b) { return mix(mix(b, [0x6a, 0x9c, 0xff], 0.28), mix(b, [0xff, 0x9a, 0x6a], 0.22), Math.floor(y / 4) / 7); } },
    { id: 'chain', label: 'Chain links', w: 7, paint: function (x, y, f, b) { var gx = x % 8, gy = y % 8, ring = (gy === 2 || gy === 5) ? gx >= 1 && gx <= 4 : (gx === 1 || gx === 4) && gy > 2 && gy < 5; var ring2 = (gy === 2 || gy === 5) ? gx >= 4 && gx <= 7 && ((y >> 3) % 2) : false; return ring || ring2 ? mix(b, [0xff, 0xd0, 0x60], 0.18) : b; } },
    { id: 'blocks', label: 'Blocks', w: 7, paint: function (x, y, f, b) { var gx = x % 8, gy = y % 8; return gx === 0 || gy === 0 ? mix(b, K, 0.25) : gx === 1 || gy === 1 ? mix(b, W, 0.08) : b; } },
    { id: 'flames', label: 'Flames', w: 7, paint: function (x, y, f, b) { var t = 31 - y, hgt = 7 + ((x * 5 + f * 3) % 7) - Math.abs((x % 6) - 3); return t < hgt - 3 ? mix(b, [0xff, 0x60, 0x20], 0.22) : t < hgt ? mix(b, [0xff, 0xb0, 0x30], 0.14) : b; } },
    { id: 'hearts', label: 'Hearts', w: 7, paint: function (x, y, f, b) { var gx = x % 10 - 2, gy = y % 10 - 2; return gx >= 0 && gx < 5 && gy >= 0 && gy < 5 && HEART[gy].charAt(gx) === '#' ? mix(b, [0xff, 0x5c, 0x9a], 0.2) : b; } },
    { id: 'waves', label: 'Waves', w: 7, paint: function (x, y, f, b) { var ph = [0, 1, 1, 0, -1, -1][(x + f) % 6]; return (y + ph + 8) % 6 === 0 ? mix(b, [0x5c, 0xc8, 0xff], 0.2) : b; } }
  ];
  var TOTAL = V.reduce(function (s, v) { return s + v.w; }, 0);
  var SWAP = { btc: 1, xcp: 1, bxmix: 1, solid: 1 };
  function variantFor(art) { if (!art || !SWAP[art.background]) return null; var h = hash('XCPETS:bg:v3:' + (art.dna || art.seed || art.species + art.bgColor)), r = h % TOTAL;
    for (var i = 0; i < V.length; i++) { if (r < V[i].w) return V[i]; r -= V[i].w; } return V[0]; }
  // the colour pet-core painted at (x, y) for this art's background (btc/xcp/bxmix glyph grid or plain)
  function origBg(bg, base, x, y) { if (bg === 'solid') return base; var gx = x % 10, gy = y % 10, cell = (Math.floor(x / 10) + Math.floor(y / 10)) % 2, kind = bg === 'bxmix' ? (cell ? 'xcp' : 'btc') : bg;
    if (gx >= 2 && gx <= 6 && gy >= 2 && gy <= 6 && GLYPH[kind][gy - 2].charAt(gx - 2) === '#') return mix(base, hex(kind === 'btc' ? '#f7931a' : '#33d6ff'), 0.22); return base; }
  function eq(d, i, c) { return d[i] === c[0] && d[i + 1] === c[1] && d[i + 2] === c[2]; }
  function apply(img, art, frame, cpLogo, force) {
    var v = force || variantFor(art); if (!v) return cpLogo ? cpLogo(img, art) : img;
    if (v.keep) { if (v.keep === art.background) return v.keep === 'btc' ? img : cpLogo(img, art);
      var a2 = Object.assign({}, art, { background: v.keep }), out = apply1(img, art, function (x, y, b) { return origBg(v.keep, b, x, y); }); return v.keep === 'btc' ? out : cpLogo(out, a2); }
    var h = hash('XCPETS:bgph:' + (art.dna || '')) % 97; return apply1(img, art, function (x, y, b) { return v.paint(x, y, frame || 0, b, h); });
  }
  function apply1(img, art, col) { var base = hex(art.bgColor), d = new Uint8ClampedArray(img.data), n = img.width || 32;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) { var i = (y * n + x) * 4, o = origBg(art.background, base, x, y), c = null;
      if (eq(d, i, o)) c = col(x, y, base); else if (eq(d, i, mix(o, K, 0.4))) c = mix(col(x, y, base), K, 0.4);
      if (c) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } }
    return Object.assign({}, img, { data: d }); }
  var API = { VARIANTS: V, variantFor: variantFor, apply: apply, hash: hash };
  root.V2Bg = API; if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
