'use strict';
/* Pet share cards (Nov 24 2026). X and Telegram build a link preview from the page's og:image without running any
 * JavaScript, so a shared pet link needs a real picture of that pet. The burn check service (checker.js) already holds
 * the newest world, so it draws the card here on request: the pet exactly as the site draws it (js/v2-render.js through
 * hatchbot/art.js, the same path HatchBot's pictures use) on a 1200x630 pixel card with its name, rarity, species, stage
 * and stats. Display only: it reads the world and never changes it.
 *
 *   const card = require('./card.js');
 *   card.draw(ctx, world, id)  -> { png: Buffer, meta: { id, name, title, line, dead } } or null when there is no such pet
 *
 * Sabo #1765 is never described as dead (owner rule). Bitcoin red is #e11d2e, never orange. */
const art = require('../../hatchbot/art.js');

const W = 600, H = 315, SCALE = 2; /* drawn at 600x315, saved 2x as 1200x630 (crisp pixels) */
const SABO = 1765;
const TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
const COL = {
  bg: [20, 18, 31], goldL: [255, 240, 170], panel: [11, 10, 18], gold: [245, 197, 24], goldD: [150, 112, 10], white: [255, 255, 255], soft: [205, 200, 225],
  dim: [120, 116, 140], barBg: [34, 32, 48], green: [96, 220, 90], greenD: [44, 130, 50], grey: [150, 150, 160]
};
const TIER_COL = [[205, 205, 215], [96, 220, 90], [90, 200, 255], [255, 201, 60]];
const STATS = [['vigor', 'VIGOR'], ['spark', 'SPARK'], ['grit', 'GRIT'], ['zoom', 'ZOOM'], ['luck', 'LUCK']];

function ensureDom(ctx) {
  if (!ctx.document) ctx.document = {};
  const d = ctx.document;
  d.getElementById = d.getElementById || (() => null); d.querySelector = d.querySelector || (() => null); d.querySelectorAll = d.querySelectorAll || (() => []);
  d.createElement = d.createElement || (() => ({ getContext: () => null, style: {}, setAttribute() {}, appendChild() {} }));
  d.documentElement = d.documentElement || { style: {} };
  ctx.addEventListener = ctx.addEventListener || (() => {});
}
function label(fn, v, dflt) { try { const s = fn ? fn(v) : ''; return s ? String(s) : dflt; } catch (e) { return dflt; } }
/** meta(ctx, p): the words on the card and in the link preview. */
function meta(ctx, p) {
  const V = ctx.V2Rules || {}, id = Number(p.id), dead = !!p.dead && id !== SABO;
  const tier = p.resurrected ? 'God' : (typeof p.tier === 'number' ? (TIERS[p.tier] || '') : String(p.tier || ''));
  const species = label(V.speciesLabel, p.species, typeof p.species === 'string' && p.species.indexOf('hyb') !== 0 ? p.species : 'Hybrid');
  const stage = label(V.stageLabelOf, p, '');
  const name = String(p.name || ('Pet #' + id)).slice(0, 40);
  const line = [tier, species, stage].filter(Boolean).join(' · ');
  return { id, name, title: name + ' #' + id, line, dead, tier: p.resurrected ? 4 : (p.tier | 0) };
}
/** frame 0 of the pet as the site draws it (its own background included), as { w, h, d } RGBA. */
function frame(ctx, w, p) {
  art.load(ctx);
  const R = ctx.V2Render, q = (p.stage | 0) === 0 ? Object.assign({}, p, { stage: 0 }) : p;
  const fr = R.petFramesRaw(q, w, { noHunger: true });
  if (!fr || !fr.length) return null;
  const a = fr[0].rareScene || fr[0];
  return { w: a.width || 32, h: a.height || 32, d: a.data };
}
/** left-aligned meme text that fits maxW (shrinks, then trims). Returns the height drawn. */
function textL(im, s, x, y, o) {
  o = Object.assign({ z: 3 }, o); let z = o.z; s = String(s || '');
  while (z > 1 && art.textW(s, z) > o.maxW) z--;
  while (s.length > 1 && art.textW(s, z) > o.maxW) s = s.slice(0, -1);
  const tw = art.textW(s, z);
  art.text(im, s, x + tw / 2, y, Object.assign({}, o, { z, line: 1 }));
  return 7 * z;
}
function box(im, x, y, w, h, c, t) { im.rect(x, y, w, t, c); im.rect(x, y + h - t, w, t, c); im.rect(x, y, t, h, c); im.rect(x + w - t, y, t, h, c); }
/** draw(ctx, w, id) -> { png, meta } | null */
function draw(ctx, w, id) {
  id = Number(id);
  const p = w && w.byId && w.byId[id];
  if (!p || !p.art) return null;
  ensureDom(ctx);
  const m = meta(ctx, p), im = new art.Img(W, H, COL.bg);
  /* card frame, like the pet page: gold edge on a near-black card */
  box(im, 4, 4, W - 8, H - 8, COL.gold, 3);
  box(im, 9, 9, W - 18, H - 18, COL.goldD, 1);
  /* the pet, nearest-neighbour, in a square on the left */
  const fr = frame(ctx, w, p), A = 251, ax = 26, ay = 32;
  im.rect(ax - 4, ay - 4, A + 8, A + 8, COL.panel); box(im, ax - 4, ay - 4, A + 8, A + 8, COL.gold, 2);
  if (fr) {
    const z = Math.max(1, Math.floor(A / Math.max(fr.w, fr.h))), dw = fr.w * z, dh = fr.h * z, ox = ax + ((A - dw) >> 1), oy = ay + ((A - dh) >> 1);
    for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
      const j = (y * fr.w + x) * 4, a = fr.d[j + 3] == null ? 255 : fr.d[j + 3]; if (!a) continue;
      let c = [fr.d[j], fr.d[j + 1], fr.d[j + 2]];
      if (m.dead) { const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; c = [l, l, l]; }
      im.rect(ox + x * z, oy + y * z, z, z, c, a / 255);
    }
  }
  /* words on the right */
  const tx = 300, tw = W - tx - 24; let y = 30;
  y += textL(im, m.name, tx, y, { z: 4, maxW: tw, c: COL.goldL, c2: COL.gold }) + 8;
  y += textL(im, '#' + m.id, tx, y, { z: 3, maxW: tw, c: COL.white }) + 10;
  y += textL(im, m.line.replace(/ \u00b7 /g, ' - '), tx, y, { z: 2, maxW: tw, c: TIER_COL[Math.min(3, m.tier)] || COL.soft }) + 6;
  if (m.dead) y += textL(im, 'IN LOVING MEMORY', tx, y, { z: 2, maxW: tw, c: COL.grey }) + 6;
  y += 8;
  const st = p.stats || {}; let total = 0;
  STATS.forEach(([k, lab]) => {
    const v = Math.max(0, st[k] | 0); total += v;
    textL(im, lab, tx, y, { z: 2, maxW: 70, c: COL.soft });
    const bx = tx + 72, bw = tw - 72 - 30, bf = Math.round(bw * Math.min(1, v / 40));
    im.rect(bx, y + 1, bw, 12, COL.barBg); im.rect(bx, y + 1, bf, 12, COL.green); im.rect(bx, y + 1, bf, 2, [180, 255, 160], 0.6); im.rect(bx, y + 11, bf, 2, COL.greenD);
    textL(im, String(v), bx + bw + 6, y, { z: 2, maxW: 26, c: COL.white });
    y += 19;
  });
  textL(im, 'TOTAL ' + total, tx, y + 2, { z: 2, maxW: tw, c: COL.gold });
  /* footer */
  textL(im, 'XCPETS.FUN', tx, H - 34, { z: 3, maxW: tw, c: COL.gold });
  return { png: art.png(im, SCALE), meta: m };
}
module.exports = { draw, meta, W: W * SCALE, H: H * SCALE };
