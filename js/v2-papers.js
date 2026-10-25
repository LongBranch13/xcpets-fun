/* XCPETS Proof of Pet certificate (feature renamed from 'pedigree papers' by the owner; branch pet-papers; display only, no rule change, nothing signed). Port of previews/pet-papers/render_papers.py.
 * Papers exist only for a pet with a GAME-VERIFIED tied token: the replay's own binding (p.deed + w.deeds[p.deed], the pet:deed / mint tie the
 * rules accepted), pet alive, not released, not a community pet. A copycat token whose description points at t/<id>.json is never in w.deeds,
 * so it gets no papers, and the papers print the real asset name. Drawn pixel by pixel into an RGBA buffer with 1-bit Press Start 2P glyphs
 * (js/papers-font.js), so the browser card and the t/<id>.png badge written by tools/token-meta.js are the same pixels on every machine.
 * Node: require('./v2-papers.js') -> { info, render, scaleUp, LAYOUTS }. Browser: window.V2Papers + a 'Proof of Pet' card on pet.html. */
(function (root) {
  'use strict';
  var FONT = typeof module !== 'undefined' && module.exports ? require('./papers-font.js') : root.PapersFont;
  var BG = [26, 13, 31], PAPER = [244, 228, 188], INK = [43, 25, 40], GOLD = [255, 201, 60], DGOLD = [178, 120, 20], PINK = [255, 111, 181], RED = [170, 30, 40], DRED = [110, 15, 25], GRN = [60, 140, 70], MUT = [120, 95, 80], BAND = [232, 212, 165], SIGINK = [30, 40, 120];
  var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'], STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'], STAT_MAX = 31;
  var LAYOUTS = { desktop: { w: 400, h: 267, out: 3 }, phone: { w: 180, h: 400, out: 6 }, token: { w: 128, h: 128, out: 4 } };
  /* ---- tiny RGB canvas (PIL ImageDraw semantics: rectangles inclusive, nearest-neighbour everything) ---- */
  function Img(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); for (var i = 3; i < this.d.length; i += 4) this.d[i] = 255; }
  Img.prototype.pt = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; var i = (y * this.w + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; };
  Img.prototype.rect = function (x0, y0, x1, y1, c) { for (var y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (var x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.pt(x, y, c); };
  Img.prototype.line = function (pts, c) { for (var k = 0; k + 1 < pts.length; k++) { var x0 = pts[k][0], y0 = pts[k][1], x1 = pts[k + 1][0], y1 = pts[k + 1][1], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { this.pt(x0, y0, c); if (x0 === x1 && y0 === y1) break; var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } } };
  /* paste a w x h RGBA sprite scaled by s (nearest), alpha-blended like PIL paste(im, xy, mask=im) */
  Img.prototype.sprite = function (spr, sw, sh, s, ox, oy) { this.spr = { x: ox, y: oy, s: s, n: sw }; for (var y = 0; y < sh * s; y++) for (var x = 0; x < sw * s; x++) { var si = (((y / s) | 0) * sw + ((x / s) | 0)) * 4, a = spr[si + 3] == null ? 255 : spr[si + 3]; if (!a) continue;
    var X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue; var di = (Y * this.w + X) * 4;
    for (var ch = 0; ch < 3; ch++) this.d[di + ch] = Math.round((spr[si + ch] * a + this.d[di + ch] * (255 - a)) / 255); } };
  /* ---- text: 1-bit glyphs, anchors 'la' (left, ascender) and 'mt' (middle, top of ink) like PIL ---- */
  var gcache = {};
  function glyph(sz, ch) { var k = sz + ch; if (gcache[k]) return gcache[k]; var F = FONT[sz], s = F.g[ch] || F.g['?']; return (gcache[k] = s.split('.').map(function (h) { return parseInt(h, 16); })); }
  function clean(s) { return String(s == null ? '' : s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...').replace(/[^\x20-\x7e]/g, '?'); }
  function textW(s, sz) { return clean(s).length * FONT[sz].adv; }
  function text(im, x, y, s, sz, c, anchor) { sz = sz || 8; var F = FONT[sz]; s = clean(s); c = c || INK; var top = 0;
    if (anchor === 'mt') { x = x - Math.floor(s.length * F.adv / 2); top = F.h; for (var i = 0; i < s.length; i++) { var g = glyph(sz, s[i]); for (var r = 0; r < g.length; r++) if (g[r]) { top = Math.min(top, r); break; } } if (top === F.h) top = F.oy; y = y - (top - F.oy); }
    for (var j = 0; j < s.length; j++) { var G = glyph(sz, s[j]); for (var ry = 0; ry < G.length; ry++) { var row = G[ry]; if (!row) continue; for (var bx = 0; bx < F.w; bx++) if (row & (1 << bx)) im.pt(x + j * F.adv + bx, y + ry - F.oy, c); } } }
  /* fit(s, sizes, maxW) -> [text, size]: the first size that fits, else the smallest size cut with '...' */
  function fit(s, sizes, maxW) { s = clean(s); for (var i = 0; i < sizes.length; i++) if (textW(s, sizes[i]) <= maxW) return [s, sizes[i]]; var z = sizes[sizes.length - 1], n = Math.max(1, Math.floor(maxW / FONT[z].adv) - 3); return [s.slice(0, n) + '...', z]; }
  function ftext(im, x, y, s, sizes, maxW, c, anchor) { var f = fit(s, sizes, maxW); text(im, x, y, f[0], f[1], c, anchor); }
  /* ---- mockup pieces ---- */
  function border(im) { var W = im.w, H = im.h, x, y;
    im.rect(0, 0, W - 1, H - 1, BG); im.rect(3, 3, W - 4, H - 4, GOLD); im.rect(5, 5, W - 6, H - 6, DGOLD); im.rect(6, 6, W - 7, H - 7, PAPER);
    for (x = 10; x < W - 10; x += 6) { var cx = Math.floor(x / 6) % 2 ? PINK : GOLD; im.rect(x, 8, x + 2, 9, cx); im.rect(x, H - 10, x + 2, H - 9, cx); }
    for (y = 10; y < H - 10; y += 6) { var cy = Math.floor(y / 6) % 2 ? PINK : GOLD; im.rect(8, y, 9, y + 2, cy); im.rect(W - 10, y, W - 9, y + 2, cy); }
    [[8, 8], [W - 9, 8], [8, H - 9], [W - 9, H - 9]].forEach(function (q) { im.rect(q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4, GOLD); im.rect(q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2, PINK); im.pt(q[0], q[1], BG); }); }
  function seal(im, cx, cy, r) { var x, y, i;
    for (y = -r - 3; y < r + 4; y++) for (x = -r - 3; x < r + 4; x++) { var q = x * x + y * y; if (q <= (r + 2) * (r + 2) && (q <= r * r || (Math.abs(x) + Math.abs(y)) % 4 < 2)) im.pt(cx + x, cy + y, q > (r - 2) * (r - 2) ? DGOLD : GOLD); }
    im.rect(cx - r + 3, cy - 4, cx + r - 3, cy + 4, RED);
    for (i = 0; i < 4; i++) im.rect(cx - 5 + i, cy - 1 + i, cx - 4 + i, cy + i, GOLD);
    for (i = 0; i < 7; i++) im.rect(cx - 1 + i, cy + 2 - i, cx + i, cy + 3 - i, GOLD);
    [[-3, -9], [0, -11], [3, -9]].forEach(function (d) { im.rect(cx + d[0] - 1, cy + d[1] - 1, cx + d[0] + 1, cy + d[1] + 1, RED); });
    im.rect(cx - 6, cy + r + 2, cx - 3, cy + r + 9, RED); im.rect(cx + 3, cy + r + 2, cx + 6, cy + r + 9, RED); }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  function bar(im, x, y, lab, v, w) { text(im, x, y, pad(lab, 5), 8); var bx = x + 44; im.rect(bx, y, bx + w, y + 6, INK); im.rect(bx + 1, y + 1, bx + 1 + Math.floor((w - 2) * Math.min(v, STAT_MAX) / STAT_MAX), y + 5, PINK); text(im, bx + w + 4, y, String(v), 8); }
  function sig(im, x, y, w) { im.line([[x, y + 4], [x + 5, y - 1], [x + 8, y + 5], [x + 12, y], [x + 15, y + 4], [x + 19, y - 2], [x + 22, y + 5], [x + 27, y + 1], [x + 32, y + 4], [x + 38, y], [x + 44, y + 3]], SIGINK); im.line([[x, y + 8], [x + w, y + 8]], INK); }
  function n(v) { return Number(v || 0).toLocaleString('en-US'); }
  function short(s, a, b) { s = String(s || ''); return s.length > a + b + 3 ? s.slice(0, a) + '...' + s.slice(-b) : s; }
  function txShort(t) { t = String(t || ''); var m = /^([0-9a-f]+)(:\d+)?$/i.exec(t); return m ? short(m[1], 8, 5) + (m[2] || '') : short(t, 8, 5); }
  /* ---- data: info(w, p, V, opts) -> the facts printed on the papers, or null when the pet has no game-verified token ---- */
  function tieOf(w, p) { if (!w || !p || p.dead || p.released || p.community || (p.art && p.art.community) || !p.deed || !w.deeds) return null; var D = w.deeds[p.deed];
    if (!D || D.petId !== p.id || D.destroyed) return null; return { asset: p.deed, block: D.block, tx: D.tx, by: D.issuer, holder: D.holder }; }
  function genOf(w, p, seen) { if (!p || !p.parents || !p.parents.length) return 0; seen = seen || {}; if (seen[p.id]) return 0; seen[p.id] = 1; var g = 0;
    p.parents.forEach(function (id) { var q = w.byId[id]; g = Math.max(g, 1 + genOf(w, q, seen)); }); return g; }
  function info(w, p, V, o) { o = o || {}; var t = o.tie || tieOf(w, p); if (!t) return null; var sc = o.score || null;
    return { id: p.id, name: p.name, speciesLabel: o.speciesLabel || (V && V.speciesLabel ? V.speciesLabel(p.species) : p.species), tier: TIERS[p.tier] || String(p.tier || ''), score: sc ? sc.score : null, rank: sc ? sc.rank : null,
      stageName: p.stageName, generation: genOf(w, p), bornBlock: p.hatchBlock, bornTx: p.hatchTx, stats: STATS.map(function (k) { return [k, (p.stats || {})[k] || 0]; }),
      parents: (p.parents || []).map(function (id) { var q = w.byId[id]; return { id: id, name: q ? q.name : '' }; }), asset: t.asset, tiedBlock: t.block, tiedTx: t.tx, tiedBy: t.by }; }
  /* ---- layouts ---- */
  function rows(I) { return [['NAME', I.name], ['PET ID', '#' + I.id], ['SPECIES', I.speciesLabel], ['RARITY', I.tier + (I.score != null ? ' ' + I.score + (I.rank ? ' #' + I.rank : '') : '')], ['STAGE', I.stageName], ['GENERATION', String(I.generation)]]; }
  function lineage(I) { return I.parents.length ? { a: I.parents.map(function (q) { return '#' + q.id; }).join(' + '), b: I.parents.map(function (q) { return q.name; }).join(' + ') } : null; }
  function desktop(I, spr) { var W = 400, H = 267, im = new Img(W, H), y, L = rows(I), lin = lineage(I); border(im);
    text(im, W / 2, 16, 'OFFICIAL XCPETS', 8, DRED, 'mt'); text(im, W / 2, 27, 'PROOF OF PET', 16, INK, 'mt'); im.line([[20, 47], [W - 21, 47]], DGOLD);
    im.rect(18, 54, 117, 153, BG); if (spr) im.sprite(spr, 32, 32, 3, 20, 56);
    y = 56; L.forEach(function (r) { text(im, 128, y, pad(r[0] + ':', 12), 8, MUT); ftext(im, 128 + 8 * 12, y, r[1], [8, 6], 102); y += 11; });
    text(im, 128, y + 2, pad('LINEAGE:', 12), 8, MUT);
    if (lin) { ftext(im, 224, y + 2, lin.a, [8, 6], 102, GRN); ftext(im, 224, y + 12, lin.b, [6], 168, MUT); }
    else { text(im, 224, y + 2, 'Hatched from egg', 8, GRN); text(im, 224, y + 12, '(no parents)', 6, MUT); }
    seal(im, 350, 78, 18); text(im, 350, 110, 'VERIFIED', 6, DRED, 'mt');
    I.stats.forEach(function (s, i) { bar(im, 18, 164 + i * 11, s[0].toUpperCase(), s[1], 80); });
    var x = 190; text(im, x, 164, 'BIRTH', 8, DRED); text(im, x, 174, 'Hatched block ' + n(I.bornBlock), 6); text(im, x, 183, 'tx ' + txShort(I.bornTx), 6);
    text(im, x, 196, 'TIE', 8, DRED); text(im, x, 206, 'Tied block ' + n(I.tiedBlock), 6); text(im, x, 215, 'tx ' + txShort(I.tiedTx), 6);
    sig(im, 322, 190, 60); text(im, 322, 202, 'Gooby', 8); text(im, 322, 212, 'Registrar', 6, MUT);
    im.rect(12, H - 37, W - 13, H - 14, BAND); ftext(im, W / 2, H - 33, 'TOKEN ' + I.asset, [8, 7, 6], 370, INK, 'mt'); text(im, W / 2, H - 22, 'WHOEVER HOLDS THIS TOKEN OWNS THIS PET', 8, DRED, 'mt');
    return im; }
  function phone(I, spr) { var W = 180, H = 400, im = new Img(W, H), y, L = rows(I), lin = lineage(I); border(im);
    text(im, W / 2, 16, 'OFFICIAL XCPETS', 8, DRED, 'mt'); text(im, W / 2, 27, 'PROOF OF', 16, INK, 'mt'); text(im, W / 2, 45, 'PET', 16, INK, 'mt');
    im.rect(W / 2 - 34, 64, W / 2 + 33, 131, BG); if (spr) im.sprite(spr, 32, 32, 2, W / 2 - 32, 66); seal(im, W - 30, 120, 14);
    y = 140; L.slice(0, 5).forEach(function (r) { text(im, 16, y, r[0] + ':', 8, MUT); ftext(im, 16, y + 9, r[1], [8, 6], 150); y += 20; });
    y = 242; text(im, 16, y, 'LINEAGE:', 8, MUT); if (lin) ftext(im, 16, y + 9, lin.a, [8, 6], 150, GRN); else text(im, 16, y + 9, 'Hatched from egg', 8, GRN);
    y = 264; I.stats.forEach(function (s, i) { bar(im, 16, y + i * 10, s[0].toUpperCase(), s[1], 90); });
    y = 318; text(im, 16, y, 'BORN', 8, DRED); text(im, 56, y, 'blk ' + n(I.bornBlock), 8); text(im, 16, y + 10, 'TIED', 8, DRED); text(im, 56, y + 10, 'blk ' + n(I.tiedBlock), 8);
    sig(im, 16, y + 24, 60); text(im, 80, y + 26, 'Gooby, Reg.', 6);
    im.rect(12, H - 46, W - 13, H - 14, BAND); ftext(im, W / 2, H - 43, I.asset, [7, 6], 152, INK, 'mt');
    text(im, W / 2, H - 33, 'WHOEVER HOLDS THIS TOKEN', 6, DRED, 'mt'); text(im, W / 2, H - 24, 'OWNS THIS PET', 6, DRED, 'mt');
    return im; }
  function token(I, spr) { var W = 128, H = 128, im = new Img(W, H); border(im);
    text(im, W / 2, 13, 'OFFICIAL XCPETS', 6, DRED, 'mt'); text(im, W / 2, 21, 'PROOF OF PET', 8, INK, 'mt'); if (spr) im.sprite(spr, 32, 32, 2, 32, 32);
    ftext(im, W / 2, 100, ('#' + I.id + ' ' + I.name).toUpperCase(), [8, 6], 106, INK, 'mt'); ftext(im, W / 2, 110, (I.tier + ' ' + I.speciesLabel).toUpperCase(), [6], 106, MUT, 'mt');
    seal(im, 104, 84, 10); return im; }
  /** render(info, spriteRGBA32x32|null, 'desktop'|'phone'|'token') -> {w, h, data: RGBA} at 1 pixel per art pixel */
  function render(I, spr, layout) { var im = (layout === 'phone' ? phone : layout === 'token' ? token : desktop)(I, spr); return { w: im.w, h: im.h, data: im.d, spr: im.spr || null }; }
  /* looks-draw: paste the realistic looks (js/v2-looks.js, the same renderer as the live pet) over the sprite box at output resolution.
   * look = the pet's frame 0 from V2Render (carries the look info); still frame = V2Looks.bake defaults (t 1.3, fixed shine). */
  function withLooks(r, k, look, Lx) { var L = Lx || root.V2Looks; if (!look || !L || !r.spr || !L.info(look)) return r; var b = r.spr, N = b.n * b.s * k, img = L.bake(look, N); if (!img) return r;
    var d = new Uint8ClampedArray(r.data), ox = b.x * k, oy = b.y * k; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= r.w || Y >= r.h) continue; var si = (y * N + x) * 4, di = (Y * r.w + X) * 4, a = img[si + 3] / 255; if (!a) continue;
      d[di] = d[di] * (1 - a) + img[si] * a; d[di + 1] = d[di + 1] * (1 - a) + img[si + 1] * a; d[di + 2] = d[di + 2] * (1 - a) + img[si + 2] * a; d[di + 3] = 255; } return { w: r.w, h: r.h, data: d, spr: r.spr }; }
  function scaleUp(r, s, look) { if (look) return withLooks(scaleUp(r, s), s, look); var W = r.w * s, H = r.h * s, d = new Uint8ClampedArray(W * H * 4); for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var si = (((y / s) | 0) * r.w + ((x / s) | 0)) * 4, di = (y * W + x) * 4; d[di] = r.data[si]; d[di + 1] = r.data[si + 1]; d[di + 2] = r.data[si + 2]; d[di + 3] = 255; } return { w: W, h: H, data: d, spr: r.spr }; }
  var API = { withLooks: withLooks, info: info, tieOf: tieOf, render: render, scaleUp: scaleUp, LAYOUTS: LAYOUTS, genOf: genOf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.V2Papers = API;
  /* ---- pet.html card ---- */
  if (typeof document === 'undefined' || !document.body || document.body.getAttribute('data-v2page') !== 'pet') return;
  var css = document.createElement('style');
  css.textContent = '#petPapers{margin:14px 0}#petPapers .pp-cv{display:block;margin:8px auto;image-rendering:pixelated;image-rendering:crisp-edges;background:#1a0d1f;border-radius:0;max-width:100%;height:auto}' +
    '#petPapers .pp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}#petPapers .pp-note{text-align:center;margin:6px 0 0}';
  document.head.appendChild(css);
  var lastKey = '', scoreW = null, scoreR = null;
  function phoneMode() { return !!(root.matchMedia && root.matchMedia('(max-width:600px)').matches); }
  function frameOf(p, w) { var R = root.V2Render; if (!R) return null; try { var fr = (R.petFramesRaw || R.petFrames)(p, w, { noHunger: true }); var f = fr && fr[0]; return f && f.data && f.data.length === 4096 ? f : null; } catch (e) { return null; } }
  function spriteOf(p, w) { var f = frameOf(p, w); return f ? f.data : null; }
  function scoreOf(w, id) { if (!root.PetScore) return null; if (scoreW !== w) { try { scoreR = root.PetScore.compute(w); } catch (e) { scoreR = null; } scoreW = w; } return scoreR && scoreR.byId ? scoreR.byId[id] || null : null; }
  function toCanvas(r, c) { c.width = r.w; c.height = r.h; var x = c.getContext('2d'); x.putImageData(new ImageData(r.data, r.w, r.h), 0, 0); return c; }
  function cssSize(c, r, wrapW) { var k = Math.max(1, Math.min(r.w === 400 ? 2 : 3, Math.floor(wrapW / r.w))); c.style.width = (r.w * k) + 'px'; }
  /* liveTie: the replay's own binding when this page's world carries the DEX data (w.deeds); otherwise V2Rules.deedScan over the burns plus the
   * first issuance of each token named by a pet:deed burn for this pet (the same check, and the same data, as tools/token-meta.js 'verified').
   * Only this pet's deed assets are fetched (read-only GETs, once per tip). No answer / any error = no papers (never a guess). */
  var scan = {};
  function liveTie(w, p, V, M) { if (!p) return null; if (w.deeds && Object.keys(w.deeds).length) return tieOf(w, p);
    if (p.dead || p.released || p.community || (p.art && p.art.community) || !V.deedScan || !V.readBurns || !V.parseTag) return null;
    var S = M.state ? M.state() : {}, rows = S.rows || [], k = p.id + '@' + w.tip + '/' + rows.length, c = scan[k]; if (c && c !== 'busy') return c.t; if (c === 'busy') return null;
    var mine = [], all = {}; V.readBurns(rows).forEach(function (r) { var t; try { t = V.parseTag(r.tag); } catch (e) { t = null; } if (t && t.action === 'deed') { if (t.petId === p.id) mine.push(t.asset); (all[t.asset] = 1); } });
    /* mint-only ties (pre ACTIVATE_ONE_TIE_PATH_BLOCK) have no burn: the asset named in /t/<id>.json is a HINT only; deedScan verifies its first issuance */
    var CF = root.XCPETS_CONFIG || {}, API = (CF.read || [])[0] || 'https://api.xcp.fun/node/v2'; scan[k] = 'busy';
    var hint = fetch('t/' + p.id + '.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { return j && typeof j.asset === 'string' ? [j.asset] : []; }, function () { return []; });
    hint.then(function (h) { var assets = mine.concat(h.filter(function (a) { return !all[a]; })).filter(function (a, i, L) { return L.indexOf(a) === i; });
    if (!assets.length) { scan[k] = { t: null }; return; }
    Promise.all(assets.map(function (a) { return fetch(API + '/assets/' + a + '/issuances?verbose=true').then(function (r) { if (!r.ok) throw new Error('issuances ' + r.status); return r.json(); }).then(function (j) { return j.result || []; }); }))
      .then(function (L) { var iss = [].concat.apply([], L).filter(function (x) { return !x.status || x.status === 'valid'; }), o = V.deedScan(w, rows, { issuances: iss })[p.id] || null;
        scan[k] = { t: o && o.asset ? { asset: o.asset, block: o.block, tx: o.tx, by: o.by } : null }; paint(true); }, function () { scan[k] = { t: null }; }); });
    return null; }
  function paint(force) { var M = root.V2Mock, V = root.V2Rules; if (!M || !M.world || !V || !root.V2Render) return; var w; try { w = M.world(); } catch (e) { return; } if (!w || !w.byId) return;
    var id = Number(new URLSearchParams(location.search).get('id')), p = w.byId[id], facts = document.getElementById('facts'), el = document.getElementById('petPapers');
    var t = liveTie(w, p, V, M); if (!t || !facts) { if (el) el.remove(); lastKey = ''; return; }
    var lay = phoneMode() ? 'phone' : 'desktop', worn = (V.wornOf ? V.wornOf(w, id) : []).map(function (g) { return g.item; }).join(',');
    var key = [w.tip, id, t.asset, t.block, p.name, p.stage, JSON.stringify(p.stats), worn, lay, (p.flameLooks || []).join('+'), (p.questLooks || []).join('+')].join('|'); if (!force && key === lastKey && el) return; lastKey = key;
    var I = info(w, p, V, { tie: t, score: scoreOf(w, id) }), fr0 = frameOf(p, w), spr = fr0 ? fr0.data : null, r = render(I, spr, lay), hasLk = !!(fr0 && root.V2Looks && root.V2Looks.info(fr0));
    if (!el) { el = document.createElement('section'); el.id = 'petPapers'; el.setAttribute('aria-label', 'Proof of Pet');
      el.innerHTML = '<h2 class="sec" data-ico="star">Proof of Pet</h2><canvas class="pp-cv" role="img"></canvas><div class="pp-row"><button type="button" class="btn" id="ppDl">⬇ Download Proof of Pet (PNG)</button></div>' +
        '<p class="small muted pp-note">Drawn live from the chain replay for this pet\'s verified token. Whoever holds this token owns this pet.</p>';
      var anchor = document.getElementById('starveWarn') || facts; anchor.parentNode.insertBefore(el, anchor.nextSibling);
      el.querySelector('#ppDl').onclick = function () { var cur = el._pp; if (!cur) return; var big = scaleUp(cur.r, LAYOUTS[cur.lay].out, cur.look), c = toCanvas(big, document.createElement('canvas'));
        c.toBlob(function (b) { if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'xcpets-' + cur.id + '-proof-of-pet-' + cur.lay + '.png'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png'); }; }
    el._pp = { r: r, lay: lay, id: id, look: hasLk ? fr0 : null }; var c = el.querySelector('canvas'); toCanvas(hasLk ? scaleUp(r, LAYOUTS[lay].out, fr0) : r, c); if (hasLk) { c.style.imageRendering = 'auto'; c._lk = LAYOUTS[lay].out; } c.setAttribute('aria-label', 'Proof of Pet of #' + id + ' ' + p.name + ', token ' + t.asset); cssSize(c, r, el.clientWidth || 360); }
  setInterval(paint, 2000); setTimeout(paint, 300);
  var rt; root.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { paint(); }, 150); });
})(typeof window !== 'undefined' ? window : this);
