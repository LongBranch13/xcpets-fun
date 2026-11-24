/* FIGURINES, step 1 (Nov 24 2026): a pet's sprite exactly as the site draws it (its gear, hybrid look, stage, zombie look).
 * Replays the game from api/boot.json with this repo's rule scripts (the same engine as hatchbot/announce.js), then draws
 * the pet with hatchbot/art.js spriteSet (js/v2-render.js petFramesRaw, the call t/<id>.png and HatchBot use) and keeps
 * frame 0 with the mask of the pet's own pixels (no background). Display only: it reads the world and never changes it.
 *
 *   const { loadWorld, petSprite } = require('./sprite.js');
 *   const W = loadWorld();                 // ~2 min, ~2 GB
 *   const s = petSprite(W, 205424);        // { id, w, h, rgba: [...], mask: [...], info: {...} }
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const ART = require(path.join(ROOT, 'hatchbot/art.js'));

/* same script list and window shim as hatchbot/announce.js engine() */
function engine() {
  const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of SCRIPTS) {
    if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; }
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

/** loadWorld(bootFile?) -> { ctx, V, w, tip }: the whole game replayed to the feed's tip. */
function loadWorld(bootFile) {
  const ctx = engine(), V = ctx.V2Rules, boot = JSON.parse(fs.readFileSync(bootFile || path.join(ROOT, 'api/boot.json'), 'utf8'));
  const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
  const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {});
  const w = V.replay(rows, hashes, [], { tip: boot.tip, live: ctx.LiveEngine.RealCore, dex: boot.dex });
  /* ?mythic=off: draw Mythics without the glowing aura (js/v2-render.js MYTH_URL). The aura is a light effect around the pet,
   * and printed solid it turns into a thick gold or white slab; the plinth shows the Mythic colours instead. */
  ctx.location.search = '?mythic=off';
  ART.load(ctx);
  return { ctx, V, w, tip: boot.tip };
}

function label(V, fn, v) { try { return V[fn](v); } catch (e) { return v; } }

/** petSprite(W, id, opt) -> sprite record, or throws with a plain reason. opt.stage draws another stage. */
function petSprite(W, id, opt) {
  opt = opt || {};
  const p = W.w.byId[id];
  if (!p) throw new Error('pet #' + id + ' does not exist (yet) at block ' + W.tip);
  if (!p.art) throw new Error('pet #' + id + ' has no art to draw');
  const S = ART.spriteSet(W.ctx, W.w, p, opt.stage != null ? { stage: opt.stage } : ((p.stage | 0) === 0 ? { stage: 0 } : null));
  if (!S || !S.length) throw new Error('pet #' + id + ' could not be drawn');
  const f = S[0];
  let gear = [];
  try { gear = (W.ctx.V2Render.worn(W.w, p.id) || []).map(g => String(g.item || '')).filter(Boolean); } catch (e) { /* gear names are only a label */ }
  return {
    id: p.id, w: f.w, h: f.h, rgba: Array.from(f.d), mask: Array.from(f.m), tip: W.tip,
    info: {
      name: p.name || 'PET', species: p.species, speciesLabel: label(W.V, 'speciesLabel', p.species), tier: p.tier, stage: p.stage | 0,
      stageName: p.stageName || '', owner: p.owner || '', zombie: !!(p.zombie || p.undead), dead: !!p.dead, hybrid: !!p.hybrid, gear
    }
  };
}

module.exports = { engine, loadWorld, petSprite, ROOT };
