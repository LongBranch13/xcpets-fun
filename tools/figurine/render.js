/* FIGURINES, step 3 (Nov 24 2026): preview pictures of a figurine mesh, no dependencies.
 * A small z-buffer rasteriser (orthographic camera, flat shading) draws the same triangles that go to the printer,
 * so the preview shows exactly what will be printed. Used for the order sheet, the Telegram reply and the GitHub run.
 *   still(fig, { yaw: -30, size: 512 }) -> Img      turntable(fig, { frames: 24 }) -> GIF Buffer */
'use strict';
const path = require('path');
const ART = require(path.join(__dirname, '..', '..', 'hatchbot', 'art.js'));

function still(fig, o) {
  o = o || {};
  const S = o.size || 480, SS = 2, W = S * SS, H = S * SS, yaw = (o.yaw == null ? -28 : o.yaw) * Math.PI / 180, pitch = (o.pitch == null ? 16 : o.pitch) * Math.PI / 180;
  const m = fig.mesh, v = m.verts, nV = v.length / 3;
  /* centre on the model */
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < v.length; i += 3) for (let a = 0; a < 3; a++) { if (v[i + a] < mn[a]) mn[a] = v[i + a]; if (v[i + a] > mx[a]) mx[a] = v[i + a]; }
  const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2], rad = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  /* camera looks along +Y (into the model's front) after rotating the model by yaw about Z and tilting by pitch */
  const P = new Float64Array(nV * 3), sc = (W * 0.42) / rad, top = o.top || 0;
  const rot = (x, y, z) => { const x1 = x * cy - y * sy, y1 = x * sy + y * cy; return [x1, y1 * cp - z * sp, y1 * sp + z * cp]; };
  for (let i = 0; i < nV; i++) { const r = rot(v[i * 3] - c[0], v[i * 3 + 1] - c[1], v[i * 3 + 2] - c[2]); P[i * 3] = W / 2 + r[0] * sc; P[i * 3 + 1] = H / 2 + top * SS - r[2] * sc; P[i * 3 + 2] = r[1]; }
  const zb = new Float64Array(W * H).fill(1e9), col = new Uint8ClampedArray(W * H * 3);
  /* background: the game's night sky with a soft spotlight */
  const bg0 = o.bg0 || [24, 18, 46], bg1 = o.bg1 || [64, 40, 96];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = y / H, dx = (x - W / 2) / W, dy = (y - H * 0.55) / H, g = Math.max(0, 0.35 - Math.hypot(dx, dy)) * 1.6, j = (y * W + x) * 3;
    for (let a = 0; a < 3; a++) col[j + a] = bg0[a] + (bg1[a] - bg0[a]) * t + g * 120; }
  const L = (() => { const l = [-0.45, -0.75, 0.6], n = Math.hypot(...l); return l.map(x => x / n); })();
  const t = m.tris;
  for (let k = 0; k < t.length; k += 3) {
    const a = t[k] * 3, b = t[k + 1] * 3, d = t[k + 2] * 3, N = m.triN[k / 3], rn = rot(N[0], N[1], N[2]);
    if (rn[1] > 0.01) continue;                                  /* facing away */
    const base = fig.pal[m.triCol[k / 3]], wn = [N[0] * cy - N[1] * sy, N[0] * sy + N[1] * cy, N[2]];
    const lam = Math.max(0, -(wn[0] * L[0] + wn[1] * L[1]) * 1 + wn[2] * L[2]), sh = 0.55 + 0.5 * lam, rgb = base.map(x => Math.min(255, x * sh));
    const x0 = P[a], y0 = P[a + 1], z0 = P[a + 2], x1 = P[b], y1 = P[b + 1], z1 = P[b + 2], x2 = P[d], y2 = P[d + 1], z2 = P[d + 2];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) continue;
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2))), by0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2, j = y * W + x; if (z >= zb[j]) continue;
      zb[j] = z; col[j * 3] = rgb[0]; col[j * 3 + 1] = rgb[1]; col[j * 3 + 2] = rgb[2];
    }
  }
  /* dark outline where depth jumps (reads like the game's pixel outline) */
  const out = new ART.Img(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, edge = 0;
    for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) { const X = x * SS + xx, Y = y * SS + yy, j = Y * W + X; r += col[j * 3]; g += col[j * 3 + 1]; b += col[j * 3 + 2];
      const z = zb[j]; if (X + 1 < W && Math.abs(zb[j + 1] - z) > rad * 0.1) edge++; if (Y + 1 < H && Math.abs(zb[j + W] - z) > rad * 0.1) edge++; }
    const n = SS * SS, k = edge ? 0.7 : 1, i = (y * S + x) * 4;
    out.d[i] = r / n * k; out.d[i + 1] = g / n * k; out.d[i + 2] = b / n * k; out.d[i + 3] = 255;
  }
  if (o.caption) ART.text(out, o.caption, S / 2, 10, { z: Math.max(2, Math.round(S / 160)), c: [255, 240, 140], c2: [255, 170, 40] });
  if (o.footer) ART.text(out, o.footer, S / 2, S - 8 - 7 * Math.max(1, Math.round(S / 240)), { z: Math.max(1, Math.round(S / 240)), c: [255, 255, 255] });
  return out;
}

/** turntable(fig, o) -> GIF buffer: the figurine spinning once. */
function turntable(fig, o) {
  o = o || {}; const n = o.frames || 24, size = o.size || 320, fr = [], dl = [];
  for (let i = 0; i < n; i++) { fr.push(still(fig, Object.assign({}, o, { size, yaw: -i * 360 / n }))); dl.push(o.delay || 8); }
  return ART.gif(fr, dl, 1);
}

/** sheet(imgs) -> one Img with the pictures side by side. */
function sheet(imgs, gap) {
  gap = gap || 0; const W = imgs.reduce((s, im) => s + im.w, 0) + gap * (imgs.length - 1), H = Math.max(...imgs.map(im => im.h)), out = new ART.Img(W, H, [12, 10, 24]);
  let x0 = 0; for (const im of imgs) { for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const s = (y * im.w + x) * 4, d = (y * W + x0 + x) * 4; out.d[d] = im.d[s]; out.d[d + 1] = im.d[s + 1]; out.d[d + 2] = im.d[s + 2]; out.d[d + 3] = 255; } x0 += im.w + gap; }
  return out;
}

module.exports = { still, turntable, sheet };
