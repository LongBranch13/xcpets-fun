/* FIGURINES, step 2 (Nov 24 2026): turn a pet's 2D sprite into a chunky, full-colour voxel figurine on a name plinth.
 *
 *   const V = require('./voxel.js');
 *   const fig = V.build(sprite, { heightMm: 75 });   // sprite from sprite.js petSprite()
 *   fig.stats                                        // size in mm, volume in cm3, colours, triangles
 *   V.objZip(fig) / V.threeMF(fig)                   // files a full-colour print service accepts
 *
 * How the shape is made:
 *  1. The pet's own pixels (no background) are cropped. Pixels that only touch at a corner get a filler pixel, and small
 *     floating bits (a halo, a sparkle) are joined to the body by the shortest bridge or dropped, so it prints as one piece.
 *  2. Each pixel becomes a column whose thickness grows with its distance from the outline (a puffy "pillow"), so the
 *     belly is thick and ears, hands and weapons are thinner. The front and back show the sprite's colours.
 *  3. The pet stands on a plinth in its rarity colour with its name on the front and "#id XCPETS.FUN" on the back.
 *  4. A clean-up pass fills any voxel that would leave an edge or corner touching only diagonally, so the mesh is a
 *     closed, watertight surface (every edge shared by exactly two triangles), which print services require.
 * Everything is built on a grid twice as fine as the sprite (F = 2) so the plinth lettering and the pillow steps are
 * half a pixel. Units are millimetres, Z is up. */
'use strict';
const zlib = require('zlib');
const path = require('path');
const ART = require(path.join(__dirname, '..', '..', 'hatchbot', 'art.js'));

const F = 2;                                   /* fine voxels per sprite pixel */
const TIER = [                                  /* plinth colours by rarity (Common, Uncommon, Rare, Legendary) */
  { name: 'Common', base: [92, 96, 112], rim: [160, 166, 184], text: [255, 255, 255] },
  { name: 'Uncommon', base: [38, 120, 58], rim: [110, 214, 110], text: [255, 255, 255] },
  { name: 'Rare', base: [34, 82, 190], rim: [100, 190, 255], text: [255, 255, 255] },
  { name: 'Legendary', base: [176, 104, 16], rim: [255, 214, 96], text: [255, 248, 210] }
];
const MYTHIC = { name: 'Mythic', base: [104, 46, 170], rim: [214, 160, 255], text: [255, 240, 140] };
const ZOMBIE = { name: 'Zombie', base: [40, 70, 44], rim: [150, 255, 60], text: [210, 255, 170] };
const OUTLINE = [16, 12, 24];

/* ------------------------------------------------------------------ 2D: the pet's pixels */
function crop(s) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('the sprite has no pet pixels');
  const w = x1 - x0 + 1, h = y1 - y0 + 1, on = new Uint8Array(w * h), col = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = (y + y0) * s.w + x + x0; if (s.mask[j]) { on[y * w + x] = 1; col[y * w + x] = [s.rgba[j * 4], s.rgba[j * 4 + 1], s.rgba[j * 4 + 2]]; } }
  /* cw / cy: where the crop sits in the original frame (the corner chip test uses the frame's corner) */
  return { w, h, on, col, cw: s.w - x0, cy: y0, sw: s.w };
}
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function nearCol(P, x, y) {
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < P.w && Y < P.h && P.on[Y * P.w + X]) return P.col[Y * P.w + X];
  }
  return OUTLINE;
}
/* pixels that only touch at a corner: fill one of the two empty pixels of that 2x2 block */
function fixCorners(P, notes) {
  let n = 0, again = true;
  while (again) {
    again = false;
    for (let y = 0; y + 1 < P.h; y++) for (let x = 0; x + 1 < P.w; x++) {
      const a = P.on[y * P.w + x], b = P.on[y * P.w + x + 1], c = P.on[(y + 1) * P.w + x], d = P.on[(y + 1) * P.w + x + 1];
      let fx = -1, fy = -1;
      if (a && d && !b && !c) { fx = x; fy = y + 1; } else if (b && c && !a && !d) { fx = x + 1; fy = y + 1; }
      if (fx < 0) continue;
      P.col[fy * P.w + fx] = nearCol(P, fx, fy); P.on[fy * P.w + fx] = 1; n++; again = true;
    }
  }
  if (n) notes.push(n + ' corner-touching pixel(s) filled so they print joined');
}
function components(P) {
  const lab = new Int32Array(P.w * P.h).fill(-1), comps = [];
  for (let i = 0; i < lab.length; i++) {
    if (!P.on[i] || lab[i] >= 0) continue;
    const id = comps.length, q = [i], cells = []; lab[i] = id;
    while (q.length) { const j = q.pop(); cells.push(j); const x = j % P.w, y = (j / P.w) | 0;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy, k = Y * P.w + X; if (X >= 0 && Y >= 0 && X < P.w && Y < P.h && P.on[k] && lab[k] < 0) { lab[k] = id; q.push(k); } } }
    comps.push(cells);
  }
  return { lab, comps };
}
/* join floating parts to the body with the shortest bridge of empty pixels (up to maxBridge), or drop them */
function joinIslands(P, notes, maxBridge) {
  for (let guard = 0; guard < 50; guard++) {
    const { lab, comps } = components(P);
    if (comps.length <= 1) return;
    let main = 0; comps.forEach((c, i) => { if (c.length > comps[main].length) main = i; });
    const other = comps.findIndex((c, i) => i !== main);
    const isl = comps[other];
    /* the little era / mutation chip the site paints in the top-right corner is a label, not part of the pet */
    const inCorner = P.sw >= 24 && isl.every(j => (j % P.w) >= P.cw - 8 && ((j / P.w) | 0) + P.cy < 8);
    if (inCorner && isl.length <= 40) { isl.forEach(j => { P.on[j] = 0; P.col[j] = null; }); notes.push('left out the corner badge (' + isl.length + ' px)'); continue; }
    if (isl.length < 3) { isl.forEach(j => { P.on[j] = 0; P.col[j] = null; }); notes.push('dropped a tiny floating speck (' + isl.length + ' px)'); continue; }
    /* BFS from the island through empty pixels until the body is reached */
    const prev = new Int32Array(P.w * P.h).fill(-2), q = []; let hit = -1;
    isl.forEach(j => { prev[j] = -1; q.push(j); });
    for (let qi = 0; qi < q.length && hit < 0; qi++) {
      const j = q[qi], x = j % P.w, y = (j / P.w) | 0;
      /* prefer going down first: a bridge under a floating part reads as a stand */
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const X = x + dx, Y = y + dy, k = Y * P.w + X;
        if (X < 0 || Y < 0 || X >= P.w || Y >= P.h || prev[k] !== -2) continue;
        prev[k] = j; if (P.on[k] && lab[k] === main) { hit = k; break; } if (!P.on[k]) q.push(k); }
    }
    const path = []; if (hit >= 0) for (let j = prev[hit]; j >= 0 && !(P.on[j] && lab[j] === other); j = prev[j]) path.push(j);
    if (hit < 0 || path.length > maxBridge) { isl.forEach(j => { P.on[j] = 0; P.col[j] = null; }); notes.push('dropped a floating part (' + isl.length + ' px) that was too far from the body'); continue; }
    const bc = path.length ? (() => { const j = path[path.length - 1]; return nearCol(P, j % P.w, (j / P.w) | 0); })() : OUTLINE;
    path.forEach(j => { P.on[j] = 1; P.col[j] = bc; });
    notes.push('joined a floating part (' + isl.length + ' px) with a ' + path.length + ' px bridge');
  }
}
/* distance (in pixels) from each pet pixel to the nearest empty pixel, 3-4 chamfer */
function distance(P) {
  const W = P.w + 2, H = P.h + 2, d = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const inn = x > 0 && y > 0 && x <= P.w && y <= P.h && P.on[(y - 1) * P.w + x - 1]; d[y * W + x] = inn ? 1e9 : 0; }
  const pass = (ys, xs, nb) => { for (const y of ys) for (const x of xs) { const i = y * W + x; if (!d[i]) continue; for (const [dx, dy, c] of nb) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const v = d[Y * W + X] + c; if (v < d[i]) d[i] = v; } } };
  const r = n => Array.from({ length: n }, (_, i) => i), rr = n => r(n).reverse();
  pass(r(H), r(W), [[-1, 0, 3], [0, -1, 3], [-1, -1, 4], [1, -1, 4]]);
  pass(rr(H), rr(W), [[1, 0, 3], [0, 1, 3], [1, 1, 4], [-1, 1, 4]]);
  const out = new Float64Array(P.w * P.h);
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) out[y * P.w + x] = d[(y + 1) * W + x + 1] / 3;
  return out;
}

/* ------------------------------------------------------------------ 3D grid */
function Grid(nx, ny, nz) { this.nx = nx; this.ny = ny; this.nz = nz; this.c = new Int32Array(nx * ny * nz).fill(-1); }
Grid.prototype.i = function (x, y, z) { return (z * this.ny + y) * this.nx + x; };
Grid.prototype.get = function (x, y, z) { return x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz ? -1 : this.c[this.i(x, y, z)]; };
Grid.prototype.set = function (x, y, z, v) { if (x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz) this.c[this.i(x, y, z)] = v; };

/* For every lattice vertex, the filled cubes around it and the empty cubes around it must each be face-connected
 * (a "well-composed" voxel set). Then the boundary is a closed 2-manifold. OKV[mask] says whether a 2x2x2 pattern passes. */
const OKV = (() => {
  const t = new Uint8Array(256), adj = b => [b ^ 1, b ^ 2, b ^ 4];
  const conn = (m, want) => { const cells = []; for (let b = 0; b < 8; b++) if (((m >> b) & 1) === want) cells.push(b); if (cells.length <= 1) return true;
    const seen = new Set([cells[0]]), q = [cells[0]]; while (q.length) { const b = q.pop(); for (const n of adj(b)) if (((m >> n) & 1) === want && !seen.has(n)) { seen.add(n); q.push(n); } } return seen.size === cells.length; };
  for (let m = 0; m < 256; m++) t[m] = conn(m, 1) && conn(m, 0) ? 1 : 0;
  return t;
})();
function makeManifold(G) {
  let filled = 0;
  for (let round = 0; round < 200; round++) {
    let bad = 0;
    for (let z = -1; z < G.nz; z++) for (let y = -1; y < G.ny; y++) for (let x = -1; x < G.nx; x++) {
      let m = 0;
      for (let b = 0; b < 8; b++) if (G.get(x + (b & 1), y + ((b >> 1) & 1), z + ((b >> 2) & 1)) >= 0) m |= 1 << b;
      if (OKV[m]) continue;
      bad++;
      /* fill the empty cube (inside the grid) that has the most filled face-neighbours in this window */
      let best = -1, bestN = -1;
      for (let b = 0; b < 8; b++) {
        if ((m >> b) & 1) continue;
        const X = x + (b & 1), Y = y + ((b >> 1) & 1), Z = z + ((b >> 2) & 1);
        if (X < 0 || Y < 0 || Z < 0 || X >= G.nx || Y >= G.ny || Z >= G.nz) continue;
        const n = ((m >> (b ^ 1)) & 1) + ((m >> (b ^ 2)) & 1) + ((m >> (b ^ 4)) & 1);
        if (n > bestN) { bestN = n; best = b; }
      }
      if (best < 0) continue;
      const X = x + (best & 1), Y = y + ((best >> 1) & 1), Z = z + ((best >> 2) & 1);
      let col = -1;
      for (const [dx, dy, dz] of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0]]) { const v = G.get(X + dx, Y + dy, Z + dz); if (v >= 0) { col = v; break; } }
      if (col < 0) for (let b = 0; b < 8; b++) if ((m >> b) & 1) { col = G.get(x + (b & 1), y + ((b >> 1) & 1), z + ((b >> 2) & 1)); break; }
      G.set(X, Y, Z, col); filled++;
    }
    if (!bad) return filled;
  }
  throw new Error('could not make the shape watertight');
}

/* ------------------------------------------------------------------ build */
function textMask(s, maxW) {
  /* the meme font from hatchbot/art.js at zoom 1, white on black, read back as a bitmap */
  const im = new ART.Img(Math.max(8, maxW), 9, [0, 0, 0]);
  ART.text(im, s, im.w / 2, 1, { z: 1, c: [255, 255, 255], o: [0, 0, 0] });
  let x0 = 1e9, x1 = -1;
  const on = (x, y) => im.d[(y * im.w + x) * 4] > 200;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (on(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (x1 < 0) return { w: 0, h: 7, on: () => false };
  return { w: x1 - x0 + 1, h: 7, on: (x, y) => on(x + x0, y + 1) };
}
function fitText(s, maxW) { s = String(s || '').toUpperCase(); let t = textMask(s, 400); while (s.length > 1 && t.w > maxW) { s = s.slice(0, -1); t = textMask(s, 400); } return t; }

function build(sprite, opt) {
  opt = opt || {};
  const notes = [], info = sprite.info || {};
  const P = crop(sprite);
  fixCorners(P, notes);
  joinIslands(P, notes, opt.maxBridge || 3);
  fixCorners(P, notes);
  const D = distance(P);
  /* the sprite's dark outline stays on the front and back faces; the sides of the column take the colour of the
   * nearest inner (non-outline) pixel, so from the side the pet looks like a painted toy rather than a black blob */
  const luma = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const side = P.col.map((c, i) => {
    if (!c || luma(c) > 45) return c;
    let best = null, bd = 1e9; const x = i % P.w, y = (i / P.w) | 0;
    for (let yy = Math.max(0, y - 3); yy <= Math.min(P.h - 1, y + 3); yy++) for (let xx = Math.max(0, x - 3); xx <= Math.min(P.w - 1, x + 3); xx++) {
      const q = P.col[yy * P.w + xx]; if (!q || luma(q) <= 45) continue; const d = (xx - x) * (xx - x) + (yy - y) * (yy - y); if (d < bd) { bd = d; best = q; } }
    return best ? best.map(v => Math.round(v * 0.8)) : c;
  });

  /* pillow thickness, in fine voxels (half of the full thickness) */
  const maxHalfPx = opt.maxHalfPx || Math.max(2, Math.min(6, Math.round(Math.max(P.w, P.h) * 0.16)));
  const minHalfPx = opt.minHalfPx || 1, R = maxHalfPx * 1.6;
  const half = new Int32Array(P.w * P.h);
  let hMax = 0;
  for (let i = 0; i < half.length; i++) if (P.on[i]) {
    const t = Math.min(D[i], R) / R, k = Math.sqrt(1 - (1 - t) * (1 - t));
    half[i] = Math.max(minHalfPx * F, Math.round(F * (minHalfPx + (maxHalfPx - minHalfPx) * k)));
    if (half[i] > hMax) hMax = half[i];
  }

  /* plinth */
  const look = info.zombie ? ZOMBIE : (info.stage | 0) >= 5 ? MYTHIC : (TIER[info.tier | 0] || TIER[0]);
  const marginF = 2 * F, nameT0 = fitText(info.name || 'PET', 1000);
  const plinthW = Math.max(P.w * F + 2 * marginF, Math.min(nameT0.w + 6, Math.round(P.w * F * 1.7) + 2 * marginF));
  const nameT = fitText(info.name || 'PET', plinthW - 4);
  const full = textMask('#' + sprite.id + ' XCPETS.FUN', 400), backT2 = full.w <= plinthW - 4 ? full : fitText('#' + sprite.id, plinthW - 4);
  const plinthH = 11, plinthD = 2 * hMax + 2 * marginF;
  const nx = plinthW, nz = plinthD, ny = plinthH + P.h * F, G = new Grid(nx, ny, nz);
  const pal = [], palIx = new Map(), cid = c => { const k = (c[0] << 16) | (c[1] << 8) | c[2]; if (!palIx.has(k)) { palIx.set(k, pal.length); pal.push([c[0], c[1], c[2]]); } return palIx.get(k); };
  const cBase = cid(look.base), cRim = cid(look.rim), cText = cid(look.text), cShadow = cid(OUTLINE);
  for (let y = 0; y < plinthH; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    /* chamfer the four vertical edges and the top edge by one fine voxel */
    const ex = x === 0 || x === nx - 1, ez = z === 0 || z === nz - 1;
    if (ex && ez) continue;
    if (y === plinthH - 1 && (ex || ez)) continue;
    G.set(x, y, z, (y === plinthH - 1 || y === plinthH - 2) ? cRim : y === 0 ? cShadow : cBase);
  }
  /* lettering, painted on the front (z = nz-1) and back (z = 0) faces: text rows 2..8 from the bottom, with a drop shadow */
  const paint = (T, z, mirror) => {
    const x0 = Math.round((nx - T.w) / 2), yTop = 8;
    for (let ty = 0; ty < 7; ty++) for (let tx = 0; tx < T.w; tx++) if (T.on(tx, ty)) {
      const X = mirror ? nx - 1 - (x0 + tx) : x0 + tx, Y = yTop - ty;
      const sx = mirror ? X - 1 : X + 1; if (G.get(sx, Y - 1, z) === cBase) G.set(sx, Y - 1, z, cShadow);
      G.set(X, Y, z, cText);
    }
  };
  paint(nameT, nz - 1, false); paint(backT2, 0, true);

  /* the pet: pixel (px, py) (py = 0 at the top) -> fine columns, standing on the plinth, centred */
  const ox = Math.round((nx - P.w * F) / 2), zc = nz / 2;
  for (let py = 0; py < P.h; py++) for (let px = 0; px < P.w; px++) {
    const i = py * P.w + px; if (!P.on[i]) continue;
    const c = cid(P.col[i]), cs = cid(side[i]), hh = half[i], z0 = Math.round(zc - hh), z1 = Math.round(zc + hh);
    for (let fy = 0; fy < F; fy++) for (let fx = 0; fx < F; fx++) {
      const X = ox + px * F + fx, Y = plinthH + (P.h - 1 - py) * F + fy;
      for (let z = z0; z < z1; z++) G.set(X, Y, z, z === z0 || z === z1 - 1 ? c : cs);
    }
  }
  const added = makeManifold(G);
  if (added) notes.push(added + ' fine voxel(s) added so the surface is watertight');

  const mm = opt.voxelMm || (opt.heightMm || 75) / ny;      /* size of one fine voxel */
  const mesh = toMesh(G, mm);
  let vox = 0; for (let i = 0; i < G.c.length; i++) if (G.c[i] >= 0) vox++;
  const stats = {
    pixelMm: +(mm * F).toFixed(3), voxelMm: +mm.toFixed(3),
    widthMm: +(nx * mm).toFixed(1), depthMm: +(nz * mm).toFixed(1), heightMm: +(ny * mm).toFixed(1),
    volumeCm3: +(vox * mm * mm * mm / 1000).toFixed(1), thinnestMm: +(2 * minHalfPx * F * mm).toFixed(1),
    colors: pal.length, triangles: mesh.tris.length / 3, plinth: look.name
  };
  return { id: sprite.id, info, grid: G, pal, mesh, stats, notes, mm };
}

/* ------------------------------------------------------------------ mesh (welded, one quad per exposed voxel face) */
const FACES = [ /* normal, then the 4 corner offsets counter-clockwise seen from outside */
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
];
function toMesh(G, mm) {
  /* grid (x right, y up, z towards the viewer) -> print space (X right, Y away from the viewer, Z up), millimetres */
  const vIx = new Map(), verts = [], tris = [], triCol = [], triN = [];
  const vid = (x, y, z) => { const k = (x * 4096 + y) * 4096 + z; let i = vIx.get(k); if (i == null) { i = verts.length / 3; vIx.set(k, i); verts.push(x * mm, (G.nz - z) * mm, y * mm); } return i; };
  for (let z = 0; z < G.nz; z++) for (let y = 0; y < G.ny; y++) for (let x = 0; x < G.nx; x++) {
    const c = G.c[G.i(x, y, z)]; if (c < 0) continue;
    for (const f of FACES) {
      if (G.get(x + f.n[0], y + f.n[1], z + f.n[2]) >= 0) continue;
      const q = f.v.map(o => vid(x + o[0], y + o[1], z + o[2]));
      /* corners are counter-clockwise seen from outside in grid space; (x, y, z) -> (x, -z, y) keeps handedness */
      tris.push(q[0], q[1], q[2], q[0], q[2], q[3]); triCol.push(c, c);
      const N = [f.n[0], -f.n[2], f.n[1]]; triN.push(N, N);
    }
  }
  return { verts, tris, triCol, triN };
}

/** checkMesh(mesh) -> { edges, open, nonManifold }: every undirected edge must be used by exactly two triangles, once each way. */
function checkMesh(mesh) {
  const E = new Map(), t = mesh.tris;
  for (let i = 0; i < t.length; i += 3) for (let k = 0; k < 3; k++) {
    const a = t[i + k], b = t[i + (k + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a, e = E.get(key) || { n: 0, d: 0 };
    e.n++; e.d += a < b ? 1 : -1; E.set(key, e);
  }
  let open = 0, nonManifold = 0, flipped = 0;
  for (const e of E.values()) { if (e.n === 1) open++; else if (e.n > 2) nonManifold++; else if (e.d !== 0) flipped++; }
  /* signed volume: positive when the normals point outwards */
  let vol = 0; const v = mesh.verts;
  for (let i = 0; i < t.length; i += 3) { const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    vol += (v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c])) / 6; }
  return { edges: E.size, open, nonManifold, flipped, volumeCm3: +(vol / 1000).toFixed(2) };
}

/* ------------------------------------------------------------------ exports */
const hex = c => c.map(v => ('0' + v.toString(16)).slice(-2)).join('').toUpperCase();
const n6 = v => (Math.round(v * 1e4) / 1e4).toString();

/** printPalette(pal, opt): the colours sent to the printer. Full-colour printers lay ink on a white or clear base, so dark
 * colours come out lighter and greyer than on screen (Shapeways warns black prints as grey). Unless opt.deepBlacks is false:
 * colours darker than luma 22 become pure black, darks up to luma 90 are pushed darker on a curve, and every colour gets
 * 12% more saturation so it does not look washed out. Previews keep the game's own colours. */
function printPalette(pal, opt) {
  if (opt && opt.deepBlacks === false) return pal;
  return pal.map(c => {
    const L = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    if (L < 22) return [0, 0, 0];
    const k = L < 90 ? Math.pow((L - 22) / 68, 1.35) * 90 / L : 1;
    return c.map(v => { const d = v * k, s = d + (d - L * k) * 0.12; return Math.max(0, Math.min(255, Math.round(s))); });
  });
}

/** palette texture: each colour is a 16x16 block on a 16-wide grid; UVs point at block centres. */
function paletteTexture(pal) {
  const cols = 16, rows = Math.max(1, Math.ceil(pal.length / cols)), B = 16, W = cols * B, H = Math.max(B, rows * B);
  const img = { w: W, h: H, d: new Uint8ClampedArray(W * H * 4) };
  for (let i = 0; i < img.d.length; i += 4) img.d[i + 3] = 255;
  pal.forEach((c, k) => { const bx = (k % cols) * B, by = ((k / cols) | 0) * B; for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { const j = ((by + y) * W + bx + x) * 4; img.d[j] = c[0]; img.d[j + 1] = c[1]; img.d[j + 2] = c[2]; } });
  const uv = pal.map((c, k) => [((k % cols) * B + B / 2) / W, 1 - (((k / cols) | 0) * B + B / 2) / H]);
  return { png: ART.png(img, 1), uv, W, H };
}

/** OBJ + MTL + PNG texture (the format JLC3DP and most full-colour services list first). Returns { 'name.obj': str, ... }. */
function objFiles(fig, base, opt) {
  const T = paletteTexture(printPalette(fig.pal, opt)), m = fig.mesh, out = [];
  out.push('# XCPETS figurine of pet #' + fig.id + ' (' + (fig.info.name || '') + '), units: millimetres, Z up');
  out.push('mtllib ' + base + '.mtl', 'o pet_' + fig.id);
  for (let i = 0; i < m.verts.length; i += 3) out.push('v ' + n6(m.verts[i]) + ' ' + n6(m.verts[i + 1]) + ' ' + n6(m.verts[i + 2]));
  T.uv.forEach(([u, v]) => out.push('vt ' + n6(u) + ' ' + n6(v)));
  out.push('usemtl pet');
  for (let i = 0; i < m.tris.length; i += 3) { const t = m.triCol[i / 3] + 1; out.push('f ' + (m.tris[i] + 1) + '/' + t + ' ' + (m.tris[i + 1] + 1) + '/' + t + ' ' + (m.tris[i + 2] + 1) + '/' + t); }
  const mtl = ['# XCPETS figurine colours', 'newmtl pet', 'Ka 1 1 1', 'Kd 1 1 1', 'Ks 0 0 0', 'd 1', 'illum 1', 'map_Kd ' + base + '.png'].join('\n') + '\n';
  return { [base + '.obj']: out.join('\n') + '\n', [base + '.mtl']: mtl, [base + '.png']: T.png };
}

/** 3MF with a colour per triangle (core-spec basematerials), the format JLC3DP uploads directly and slicers open. */
function threeMF(fig, opt) {
  const m = fig.mesh, v = [], t = [];
  for (let i = 0; i < m.verts.length; i += 3) v.push('<vertex x="' + n6(m.verts[i]) + '" y="' + n6(m.verts[i + 1]) + '" z="' + n6(m.verts[i + 2]) + '"/>');
  for (let i = 0; i < m.tris.length; i += 3) t.push('<triangle v1="' + m.tris[i] + '" v2="' + m.tris[i + 1] + '" v3="' + m.tris[i + 2] + '" pid="1" p1="' + m.triCol[i / 3] + '"/>');
  const mats = printPalette(fig.pal, opt).map((c, k) => '<base name="c' + k + '" displaycolor="#' + hex(c) + '"/>').join('');
  const model = '<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    '<metadata name="Title">XCPETS #' + fig.id + ' ' + String(fig.info.name || '').replace(/[<&"]/g, '') + '</metadata><metadata name="Designer">xcpets.fun</metadata>' +
    '<resources><basematerials id="1">' + mats + '</basematerials><object id="2" type="model" pid="1" pindex="0"><mesh><vertices>' + v.join('') + '</vertices><triangles>' + t.join('') + '</triangles></mesh></object></resources>' +
    '<build><item objectid="2"/></build></model>\n';
  return zip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>\n',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>\n',
    '3D/3dmodel.model': model
  });
}

/** minimal ZIP writer (deflate), no dependencies. files: { name: string | Buffer } */
function zip(files) {
  const crcT = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c; }
  const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const local = [], central = []; let off = 0;
  for (const name of Object.keys(files)) {
    const raw = Buffer.isBuffer(files[name]) ? files[name] : Buffer.from(files[name], 'utf8'), comp = zlib.deflateRawSync(raw, { level: 9 }), nb = Buffer.from(name, 'utf8'), c = crc(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(0, 10); h.writeUInt16LE(0x5921, 12);
    h.writeUInt32LE(c, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nb.length, 26); h.writeUInt16LE(0, 28);
    local.push(h, nb, comp);
    const e = Buffer.alloc(46); e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt16LE(0x0800, 8); e.writeUInt16LE(8, 10); e.writeUInt16LE(0, 12); e.writeUInt16LE(0x5921, 14);
    e.writeUInt32LE(c, 16); e.writeUInt32LE(comp.length, 20); e.writeUInt32LE(raw.length, 24); e.writeUInt16LE(nb.length, 28); e.writeUInt32LE(off, 42);
    central.push(e, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); const n = Object.keys(files).length;
  end.writeUInt16LE(n, 8); end.writeUInt16LE(n, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(local.concat([cd, end]));
}

module.exports = { printPalette, build, toMesh, checkMesh, objFiles, threeMF, zip, paletteTexture, OKV, F };
