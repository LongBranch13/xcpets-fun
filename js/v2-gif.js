/* XCPGif (wizard-story-short P7/P9, 2026-10-21; display only): tiny animated GIF89a encoder for a pet's dancing sprite.
 * XCPGif.petGif(p, w, scale=8) -> Blob 'image/gif' of the pet's own V2Render.petFrames (the same frames the site animates, 300 ms each, looping),
 * nearest-neighbour upscaled. Pixel art has few colours, so one global palette (<=256) with plain LZW; no dithering. */
(function (root) {
  'use strict';
  function lzw(ix, minSize) { var clear = 1 << minSize, eoi = clear + 1, out = [], cur = 0, nb = 0, size = minSize + 1, dict, next;
    function emit(c) { cur |= c << nb; nb += size; while (nb >= 8) { out.push(cur & 255); cur >>>= 8; nb -= 8; } }
    function reset() { dict = new Map(); next = eoi + 1; size = minSize + 1; }
    reset(); emit(clear); var w = ix[0];
    for (var i = 1; i < ix.length; i++) { var k = ix[i], key = w * 4096 + k, v = dict.get(key);
      if (v !== undefined) { w = v; continue; } emit(w); if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; } else { emit(clear); reset(); } w = k; }
    emit(w); emit(eoi); if (nb > 0) out.push(cur & 255); return out; }
  function encode(frames, W, H, delayCs) { var pal = new Map(), cols = [], idx = frames.map(function (f) { var a = new Array(W * H);
      for (var i = 0; i < W * H; i++) { var c = (f[i * 4] << 16) | (f[i * 4 + 1] << 8) | f[i * 4 + 2], j = pal.get(c); if (j === undefined) { if (cols.length >= 256) j = 0; else { j = cols.length; cols.push(c); pal.set(c, j); } } a[i] = j; } return a; });
    var bits = 1; while ((1 << bits) < Math.max(2, cols.length)) bits++; var n = 1 << bits, B = [];
    function s(x) { for (var i = 0; i < x.length; i++) B.push(x.charCodeAt(i)); } function u16(v) { B.push(v & 255, (v >> 8) & 255); }
    s('GIF89a'); u16(W); u16(H); B.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0);
    for (var i = 0; i < n; i++) { var c = cols[i] || 0; B.push((c >> 16) & 255, (c >> 8) & 255, c & 255); }
    B.push(0x21, 0xff, 11); s('NETSCAPE2.0'); B.push(3, 1, 0, 0, 0);
    idx.forEach(function (a) { B.push(0x21, 0xf9, 4, 0); u16(delayCs); B.push(0, 0); B.push(0x2c); u16(0); u16(0); u16(W); u16(H); B.push(0);
      var ms = Math.max(2, bits), d = lzw(a, ms); B.push(ms); for (var o = 0; o < d.length; o += 255) { var ch = d.slice(o, o + 255); B.push(ch.length); for (var q = 0; q < ch.length; q++) B.push(ch[q]); } B.push(0); });
    B.push(0x3b); return new Uint8Array(B); }
  function petGif(p, w, scale) { var R = root.V2Render, S = scale || 8, fr = R.petFrames(p, w), N = 32 * S;
    var big = fr.map(function (f) { var d = f.data, o = new Uint8Array(N * N * 4); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var si = (((y / S) | 0) * 32 + ((x / S) | 0)) * 4, di = (y * N + x) * 4; o[di] = d[si]; o[di + 1] = d[si + 1]; o[di + 2] = d[si + 2]; o[di + 3] = 255; } return o; });
    return new Blob([encode(big, N, N, 30)], { type: 'image/gif' }); }
  root.XCPGif = { encode: encode, petGif: petGif };
})(typeof window !== 'undefined' ? window : globalThis);
