/* The robot's referee (tools/playtest): replays the whole chain with the real rules engine in Node (the same full replay the game
 * server runs, no fast-page shortcuts) and answers what the page should be showing: every price at the next block (halvings and Fire
 * Sales included), whether a Fire Sale is on, and the test wallet's pets (alive, zombies, graves). The page's own numbers are compared
 * against this, so a fast-page gap (missing table, stale price) shows up as a difference instead of hiding behind the page's own math.
 * Runs in a worker thread so the rig keeps serving pages while it replays (~1-2 min). */
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
if (isMainThread) {
  module.exports = function truth(input) {
    return new Promise((res, rej) => {
      const w = new Worker(__filename, { workerData: input, resourceLimits: { maxOldGenerationSizeMb: 5000 } });
      w.once('message', res); w.once('error', rej); w.once('exit', c => { if (c) rej(new Error('oracle exited ' + c)); });
    });
  };
} else {
  const S = require(path.join(__dirname, '../sync-server/snapshot'));
  const { rows, hashes, tip, dex, me } = workerData;
  const t0 = Date.now();
  const ctx = S.workerFns();
  const w = S.replayWorld(ctx, rows, hashes, tip, dex);
  const R = ctx.self.V2Rules;
  const b = tip + 1, costs = R.costsAt(w, b), sale = R.saleAt(w, b);
  const isZ = p => !!(p && (p.zombie || p.z || p.risen));
  const mine = w.pets.filter(p => p.owner === me && !p.released);
  /* Nov 28 2026: a page's own checks and previews (feed check, Grinder, spins...) look at pets at the NEXT block (rules liveAt at tip + 1), so a
   * pet that starves at the next chain-day turn shows dead there one block early (Evan, 977,884: 135 never-fed hatchlings). Count both. */
  const nextDead = new Set(mine.filter(p => { if (p.dead) return false; const c = Object.assign({}, p); R._liveAt(w, c, b); return !!c.dead; }).map(p => p.id));
  const out = {
    tip, ms: Date.now() - t0, costs, sale: sale ? { arm: sale.arm } : null, fire: R.fireInfo ? (() => { try { return JSON.parse(JSON.stringify(R.fireInfo(w, tip))); } catch (e) { return null; } })() : null,
    pets: w.pets.length,
    me: { all: mine.length, alive: mine.filter(p => !p.dead).length, dead: mine.filter(p => p.dead).length, zombies: mine.filter(isZ).length, hd: mine.filter(p => p.hd === me).length, listed: mine.filter(p => !p.dead && !(p.hd === me && !isZ(p))).length, listedNext: mine.filter(p => !p.dead && !nextDead.has(p.id) && !(p.hd === me && !isZ(p))).length, fedAtTip: mine.filter(p => p.lastFed === tip).length, burned: (w.burnedBy || {})[me] || 0,
      ids: mine.filter(p => !p.dead).map(p => p.id), newest: mine.slice().sort((a, c) => c.id - a.id).slice(0, 2000).map(p => ({ id: p.id, born: p.born || p.block || 0, species: p.species, stage: p.stage })) },
  };
  parentPort.postMessage(JSON.parse(JSON.stringify(out)));
}
