/* XCPETS v2: inscription REGISTRY, rebuilt from the chain by every visitor (no server). 2026-10-15.
 * DISCOVERY: every XCPETS inscription's reveal pays its output 0 to the pet OWNER's address (the address the game already knows from the
 *   owner's XCPETS burns). So the game scans the txs of the (few) pet-owner addresses on a public Esplora API (mempool.space), newest first,
 *   down to ACTIVATE_INSCRIBE_BLOCK only, and keeps txs whose input 0 witness is [sig, leaf, control block] with an ord envelope tagged
 *   metaprotocol "xcpets" (tag 7) + CBOR metadata {p:'xcpets', v:1, pet, b, f, s, g} (tag 5) + content type image/png.
 *   (Why not an ordinals indexer API: Hiro's Ordinals API is gone (HTTP 410) and ordinals.com has its JSON API disabled; neither is needed.)
 * VALIDATION (all must hold, else the inscription gets no number):
 *   1. envelope is exactly our layout; content type image/png; metadata well-formed;
 *   2. the reveal is confirmed at height H with meta.b < H <= meta.b + MAX_AGE (art rendered from the chain at most ~1 day before);
 *   3. every input of the commit tx was paid by the owner address (the owner funded it) and reveal output 0 pays the owner address;
 *   4. at block meta.b the pet exists, is alive and is owned by that address;
 *   5. the PNG decodes and its pixels are EXACTLY the pet's deterministic render (chain replayed to meta.b + the declared worn gear g,
 *      frame f, name stamp s) at one integer scale. A fake / edited / other pet's image fails here.
 * NUMBERING: valid inscriptions ordered by (block height, tx index in block), numbered 1, 2, 3...; per-pet count likewise. Unconfirmed = pending, no number.
 * Pure: deps are injected (fetch, mempoolApi, expected(meta) -> { owner(address), frame } | { error }, inflate). Browser: window.V2InscribeReg; node: require(...). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory; else root.V2InscribeReg = factory;
})(typeof self !== 'undefined' ? self : this, function (Tx) {
  'use strict';
  var MAX_AGE = 144, MAX_PAGES = 40;
  /* ---- PNG decode (8-bit, non-interlaced; colour types 2, 3, 6) ---- */
  function u32(b, i) { return ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]; }
  function decodePNG(b, inflate) {
    var sig = [137, 80, 78, 71, 13, 10, 26, 10]; for (var s = 0; s < 8; s++) if (b[s] !== sig[s]) return Promise.reject(new Error('not a PNG'));
    var i = 8, w, h, ct, pal = null, idat = [], n = 0;
    while (i + 8 <= b.length) { var len = u32(b, i), t = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]), d = b.subarray(i + 8, i + 8 + len); i += 12 + len;
      if (t === 'IHDR') { w = u32(d, 0); h = u32(d, 4); if (d[8] !== 8 || d[12] !== 0) return Promise.reject(new Error('PNG: 8-bit non-interlaced only')); ct = d[9]; if ([2, 3, 6].indexOf(ct) < 0) return Promise.reject(new Error('PNG: colour type ' + ct)); }
      else if (t === 'PLTE') pal = d; else if (t === 'IDAT') { idat.push(d); n += d.length; } else if (t === 'acTL') return Promise.reject(new Error('PNG: animated')); else if (t === 'IEND') break; }
    if (!w || !h || w > 4096 || h > 4096) return Promise.reject(new Error('PNG: bad size'));
    var z = new Uint8Array(n), o = 0; idat.forEach(function (x) { z.set(x, o); o += x.length; });
    return Promise.resolve(inflate(z)).then(function (raw) { var bpp = ct === 2 ? 3 : ct === 6 ? 4 : 1, stride = w * bpp, out = new Uint8ClampedArray(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride), p = 0;
      if (raw.length < h * (stride + 1)) throw new Error('PNG: short data');
      for (var y = 0; y < h; y++) { var f = raw[p++]; for (var x = 0; x < stride; x++) { var a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0, v = raw[p++], r;
          if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + up; else if (f === 3) r = v + ((a + up) >> 1); else if (f === 4) { var pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); } else throw new Error('PNG: filter ' + f);
          cur[x] = r & 255; }
        for (var q = 0; q < w; q++) { var k = (y * w + q) * 4;
          if (ct === 3) { var pi = cur[q] * 3; if (!pal || pi + 2 >= pal.length) throw new Error('PNG: palette index'); out[k] = pal[pi]; out[k + 1] = pal[pi + 1]; out[k + 2] = pal[pi + 2]; out[k + 3] = 255; }
          else { out[k] = cur[q * bpp]; out[k + 1] = cur[q * bpp + 1]; out[k + 2] = cur[q * bpp + 2]; out[k + 3] = ct === 6 ? cur[q * bpp + 3] : 255; } }
        var tmp = prev; prev = cur; cur = tmp; }
      return { w: w, h: h, data: out }; }); }
  /** pixelsMatch(img, frame): img is frame scaled by ONE integer k >= 1 (nearest neighbour), RGB exact. */
  function pixelsMatch(img, f) { if (!img || !f || img.w % f.w || img.h % f.h) return false; var k = img.w / f.w; if (img.h / f.h !== k || k < 1) return false;
    for (var y = 0; y < img.h; y++) for (var x = 0; x < img.w; x++) { var i = (y * img.w + x) * 4, j = (((y / k) | 0) * f.w + ((x / k) | 0)) * 4;
      if (img.data[i] !== f.data[j] || img.data[i + 1] !== f.data[j + 1] || img.data[i + 2] !== f.data[j + 2]) return false; }
    return true; }
  function hexToBytes(h) { return Tx.hex.decode(h); }
  /** candidate(tx, owner): mempool.space tx JSON -> parsed XCPETS reveal or null */
  function candidate(tx, owner) { try { var v = tx.vin && tx.vin[0]; if (!v || tx.vin.length !== 1 || !v.witness || v.witness.length !== 3) return null;
      var e = Tx.parseEnvelope(hexToBytes(v.witness[1])); if (e.metaprotocol !== Tx.META_PROTOCOL || e.contentType !== 'image/png' || !e.meta || e.meta.p !== Tx.META_PROTOCOL) return null;
      var o0 = tx.vout && tx.vout[0]; if (!o0 || o0.scriptpubkey_address !== owner) return null;
      return { id: tx.txid + 'i0', revealTxid: tx.txid, commitTxid: v.txid, owner: owner, meta: e.meta, body: e.body, confirmed: !!(tx.status && tx.status.confirmed), height: tx.status && tx.status.block_height || null, blockHash: tx.status && tx.status.block_hash || null }; }
    catch (err) { return null; } }
  function Registry(d) { this.d = d; this.F = d.fetch; this.api = d.mempoolApi; this.idx = {}; this.cache = d.cache || {}; }
  Registry.prototype.json = function (p) { return this.F(this.api + p).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + p); return r.json(); }); };
  /** scan(addr): all candidate reveals paying addr, newest first, down to fromBlock */
  Registry.prototype.scan = function (addr) { var self = this, out = [], from = this.d.fromBlock || 0, pages = 0;
    function take(l) { l.forEach(function (t) { var c = candidate(t, addr); if (c) out.push(c); }); }
    function chain(last) { if (++pages > MAX_PAGES) return out; return self.json('/address/' + addr + '/txs/chain/' + last).then(function (l) { take(l); var z = l[l.length - 1];
      if (l.length < 25 || !z || (z.status && z.status.block_height < from)) return out; return chain(z.txid); }); }
    return this.json('/address/' + addr + '/txs').then(function (l) { take(l); var conf = l.filter(function (t) { return t.status && t.status.confirmed; }), z = conf[conf.length - 1];
      if (conf.length < 25 || !z || z.status.block_height < from) return out; return chain(z.txid); }); };
  Registry.prototype.txIndex = function (c) { var self = this; if (!c.blockHash) return Promise.resolve(null);
    var p = this.idx[c.blockHash] || (this.idx[c.blockHash] = this.json('/block/' + c.blockHash + '/txids'));
    return p.then(function (ids) { var k = ids.indexOf(c.revealTxid); return k < 0 ? null : k; }); };
  /** validate(c) -> { ok, reason } */
  Registry.prototype.validate = function (c) { var self = this, m = c.meta, d = this.d;
    function no(r) { return { ok: false, reason: r }; }
    if (!m || m.v !== 1 || !Number.isSafeInteger(m.pet) || m.pet <= 0 || !Number.isSafeInteger(m.b) || !Number.isSafeInteger(m.f) || ['top', 'bottom', 'none'].indexOf(m.s) < 0 || !Array.isArray(m.g)) return Promise.resolve(no('bad metadata'));
    if (c.confirmed && !(m.b < c.height && c.height <= m.b + MAX_AGE)) return Promise.resolve(no('render block ' + m.b + ' not within ' + MAX_AGE + ' blocks before the reveal (' + c.height + ')'));
    if (d.fromBlock && m.b < d.fromBlock) return Promise.resolve(no('rendered before inscriptions opened'));
    return this.json('/tx/' + c.commitTxid).then(function (ct) {
      if (!ct.vin.length || !ct.vin.every(function (v) { return v.prevout && v.prevout.scriptpubkey_address === c.owner; })) return no('commit was not funded by the pet owner');
      var ex = d.expected(m); if (!ex || ex.error) return no((ex && ex.error) || 'pet not found at block ' + m.b);
      if (ex.owner !== c.owner) return no('pet #' + m.pet + ' was not owned by ' + c.owner + ' at block ' + m.b);
      return decodePNG(c.body, d.inflate).then(function (img) { return pixelsMatch(img, ex.frame) ? { ok: true } : no('art does not match pet #' + m.pet + '\'s render'); }, function (e) { return no('bad PNG: ' + e.message); });
    }); };
  /** build(addresses) -> { list: [{n, perPet, id, petId, height, txIndex, ...}], pending: [...], invalid: [...] } */
  Registry.prototype.build = function (addresses) { var self = this, all = [], seen = {};
    return Promise.all(addresses.map(function (a) { return self.scan(a).then(function (l) { l.forEach(function (c) { if (!seen[c.id]) { seen[c.id] = 1; all.push(c); } }); }, function (e) { all.err = (all.err || []).concat(a + ': ' + e.message); }); }))
      .then(function () { return Promise.all(all.map(function (c) { var k = c.id + (c.confirmed ? ':' + c.height : ':u'), hit = self.cache[k];
        var v = hit ? Promise.resolve(hit) : self.validate(c).then(function (r) { if (c.confirmed) self.cache[k] = r; return r; }, function (e) { return { ok: false, reason: 'lookup failed: ' + e.message, transient: true }; });
        return v.then(function (r) { c.valid = r.ok; c.reason = r.reason; c.transient = r.transient; return c.confirmed && r.ok ? self.txIndex(c).then(function (k) { c.txIndex = k; }) : null; }); })); })
      .then(function () { var ok = all.filter(function (c) { return c.valid && c.confirmed && c.txIndex != null; }).sort(function (a, b) { return a.height - b.height || a.txIndex - b.txIndex; }), per = {};
        ok.forEach(function (c, i) { c.n = i + 1; per[c.meta.pet] = (per[c.meta.pet] || 0) + 1; c.perPet = per[c.meta.pet]; c.petId = c.meta.pet; });
        return { list: ok, pending: all.filter(function (c) { return !c.confirmed && c.valid; }), invalid: all.filter(function (c) { return !c.valid; }), errors: all.err || [] }; }); };
  return { MAX_AGE: MAX_AGE, decodePNG: decodePNG, pixelsMatch: pixelsMatch, candidate: candidate, Registry: Registry };
});
