#!/usr/bin/env node
/* sale-cache-feed (2026-10-24): writes api/recent-events.json = the per-block Counterparty event lists for the last N blocks (default 60),
 * each stamped with its block hash, read from a full node (:4000). Only events that can change sale data are kept: any event naming a
 * numeric pet token (A + 17..20 digits) and every order / match / cancel / expiry event. The browser (js/v2-sales.js) uses a block's list
 * only if the stamped hash equals its own fresh chain read; anything else falls to a :4000 node, then the full read.
 * Usage: node tools/recent-events.js [--out api] [--blocks 60] [--node URL]... ; reuses entries of the existing file whose hash still matches.
 * Any failure: the old file is left alone and the exit code is 0 (the feed must never fail because of this optional file). */
'use strict';
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = opt('--out', 'api'), N = Math.min(200, Number(opt('--blocks', 60)) || 60);
const nodes = args.reduce((a, x, i) => (x === '--node' ? a.concat(args[i + 1]) : a), []);
const NODES = nodes.length ? nodes : ['https://api.counterparty.io:4000/v2', 'https://api.unspendablelabs.com:4000/v2'];
const KEEP_RE = /"A[1-9][0-9]{16,19}"/, KEEP_EV = /ORDER|MATCH|CANCEL|EXPIR|BTC_PAY/;
const keep = (e) => KEEP_EV.test(String(e.event || '')) || KEEP_RE.test(JSON.stringify(e));
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function getJ(u, tries = 7) {
  for (let n = 0; ; n++) {
    let ra = null;
    try { const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); if (r.status === 429 || r.status >= 500) { ra = Number(r.headers.get('retry-after')); throw new Error('HTTP ' + r.status); }
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.fatal = 1; throw e; } return await r.json(); }
    catch (e) { if (e.fatal || n + 1 >= tries) throw e; await wait(ra > 0 ? Math.min(ra, 30) * 1000 : 2000 * (n + 1)); }
  }
}
/* hashes of the newest N blocks in ONE request (/blocks is newest first), read before AND after the event lists: any change = reorg -> fail */
async function hashes(base) { const j = await getJ(base + '/blocks?limit=' + N), m = {}; (j.result || []).forEach((x) => { if (/^[0-9a-f]{64}$/.test(x.block_hash || '')) m[x.block_index] = x.block_hash; }); return m; }
async function onNode(base, prev) {
  const H = await hashes(base), tip = Math.max(...Object.keys(H).map(Number)); if (!(tip > 0)) throw new Error('no tip');
  const blocks = {}, list = []; for (let b = tip - N + 1; b <= tip; b++) { if (!H[b]) throw new Error('no hash for block ' + b); list.push(b); }
  let k = 0, reused = 0;
  async function one(b) {
    const h = H[b], p = prev && prev.blocks && prev.blocks[b];
    if (p && p.hash === h && p.complete === true) { blocks[b] = p; reused++; return; }
    let out = [], cur = null, pg = 0;
    do { const j = await getJ(base + '/blocks/' + b + '/events?limit=1000' + (cur ? '&cursor=' + encodeURIComponent(cur) : '')); if (!Array.isArray(j.result)) throw new Error('bad events ' + b);
      out = out.concat(j.result); cur = j.next_cursor; if (++pg > 50) throw new Error('too many event pages ' + b); } while (cur);
    blocks[b] = { hash: h, complete: true, total: out.length, events: out.filter(keep) };
    await wait(250); /* gentle: the public nodes answer 429 to bursts */
  }
  async function worker() { while (k < list.length) await one(list[k++]); }
  await Promise.all([worker(), worker()]);
  const H2 = await hashes(base); for (const b of list) if (H2[b] !== H[b]) throw new Error('block ' + b + ' changed while reading (reorg)');
  return { v: 1, generatedAt: new Date().toISOString(), node: base.replace(/^https?:\/\//, ''), from: tip - N + 1, tip, hash: H[tip], blocks, reused };
}
(async () => {
  const file = path.join(OUT, 'recent-events.json'); let prev = null; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { }
  for (const base of NODES) {
    try { const t0 = Date.now(), j = await onNode(base.replace(/\/+$/, ''), prev), reused = j.reused; delete j.reused;
      if (OUT === '-') { process.stdout.write(JSON.stringify(j) + '\n'); return; }
      fs.writeFileSync(file, JSON.stringify(j) + '\n'); console.log('recent-events: ' + j.from + '..' + j.tip + ' from ' + j.node + ' (' + reused + ' reused) in ' + (Date.now() - t0) + ' ms'); return; }
    catch (e) { console.error('recent-events: ' + base + ' failed: ' + e.message); }
  }
  console.log('recent-events: every node failed; file left unchanged');
})();
