/*! XCPETS gif.js: tiny animated-GIF encoder for pixel sprites (<= 256 colours). encode(frames[{data:RGBA}], w, h, {scale, delayCs}) -> Uint8Array */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.XcpetsGif = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function encode(frames, w, h, o) {
    o = o || {}; var S = o.scale || 8, delay = o.delayCs || 28, W = w * S, H = h * S, pal = [], idx = {}, out = [];
    function put(b) { out.push(b & 255); } function put16(v) { put(v); put(v >> 8); } function str(s) { for (var i = 0; i < s.length; i++) put(s.charCodeAt(i)); }
    var ix = frames.map(function (f) { var d = f.data, a = new Uint8Array(w * h);
      for (var p = 0; p < w * h; p++) { var k = d[p * 4] << 16 | d[p * 4 + 1] << 8 | d[p * 4 + 2]; if (idx[k] == null) { if (pal.length >= 256) { a[p] = 0; continue; } idx[k] = pal.length; pal.push(k); } a[p] = idx[k]; }
      return a; });
    while (pal.length < 256) pal.push(0);
    str('GIF89a'); put16(W); put16(H); put(0xF7); put(0); put(0);
    pal.forEach(function (k) { put(k >> 16); put(k >> 8); put(k); });
    put(0x21); put(0xFF); put(11); str('NETSCAPE2.0'); put(3); put(1); put16(0); put(0);
    ix.forEach(function (a) {
      put(0x21); put(0xF9); put(4); put(0x04); put16(delay); put(0); put(0);
      put(0x2C); put16(0); put16(0); put16(W); put16(H); put(0);
      var px = new Uint8Array(W * H); for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) px[y * W + x] = a[Math.floor(y / S) * w + Math.floor(x / S)];
      lzw(px);
    });
    put(0x3B); return new Uint8Array(out);
    function lzw(px) {
      var min = 8, clear = 256, eoi = 257, size = 9, next = 258, dict = new Map(), bits = 0, nb = 0, buf = [];
      function emit(c) { bits |= c << nb; nb += size; while (nb >= 8) { buf.push(bits & 255); bits >>>= 8; nb -= 8; } }
      put(min); emit(clear);
      var cur = px[0];
      for (var i = 1; i < px.length; i++) { var k = px[i], key = cur * 4096 + k, v = dict.get(key);
        if (v != null) { cur = v; continue; }
        emit(cur); if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; } else { emit(clear); dict.clear(); size = 9; next = 258; }
        cur = k; }
      emit(cur); emit(eoi); if (nb > 0) buf.push(bits & 255);
      for (var j = 0; j < buf.length; j += 255) { var n = Math.min(255, buf.length - j); put(n); for (var q = 0; q < n; q++) put(buf[j + q]); }
      put(0);
    }
  }
  return { encode: encode };
});
