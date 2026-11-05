#!/usr/bin/env node
/* carry-fix-1105 dry run (dev tooling only, read-only): reads the CURRENT burns/tip/hashes/sale data with tools/api-feed.js liveInput
 * (public GETs only, writes nothing), replays twice: ACTIVATE_CARRYPICK_BLOCK at its placeholder and moved to the current tip
 * ("gate were now"), and also moved to 0 (as if the fix had always applied), and lists every breed carry that differs. */
'use strict';
/* box egress blocks the Counterparty nodes: with XCP_SOCKS=host:port every fetch goes through curl over that SOCKS proxy (same tunnel tools/lib/xcp-api.js uses) */
if (process.env.XCP_SOCKS) { const cp = require('child_process'); globalThis.fetch = async (u, o) => { u = String(u && u.url || u);
  const r = cp.spawnSync('curl', ['-sS', '-m', '120', '--socks5-hostname', process.env.XCP_SOCKS, '-w', '\n%{http_code}', '-H', 'user-agent: xcpets-carry-dryrun', u], { encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new TypeError('fetch failed: ' + (r.stderr || '').trim()); const i = r.stdout.lastIndexOf('\n'); return new Response(r.stdout.slice(0, i), { status: +r.stdout.slice(i + 1) || 599 }); }; }
const F = require('./api-feed.js');
(async () => {
  const ctx = F.context(), V = ctx.V2Rules, E = ctx.LiveEngine, G0 = V.ACTIVATE_CARRYPICK_BLOCK;
  const input = await F.liveInput(ctx), rows = input.rows.filter(r => r.block_index <= input.tip), H = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, input.hashes);
  const run = g => { V._setCarryPick(g); try { return V.replay(rows, H, [], { tip: input.tip, live: E && E.RealCore, dex: input.dex || undefined }); } finally { V._setCarryPick(G0); } };
  const list = w => { const o = {}; w.pets.forEach(p => (p.carried || []).forEach((c, i) => { o[p.id + '#' + i] = c; })); return o; };
  const base = list(run(G0)), now = list(run(input.tip)), ever = list(run(0));
  const diff = (a, b) => [...new Set(Object.keys(a).concat(Object.keys(b)))].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => ({ key: k, old: a[k] || null, new: b[k] || null }));
  const n = Object.keys(base).length, sh = Object.values(base).filter(c => V.shardsOn(c.block)).length;
  console.log('tip ' + input.tip + '  rows ' + rows.length + '  carries ' + n + ' (' + sh + ' made with shards on, from block ' + V.ACTIVATE_QUEST_SHARDS_BLOCK + ')');
  const d1 = diff(base, now), d2 = diff(base, ever);
  console.log('gate = tip (' + input.tip + '): ' + d1.length + ' past carries change'); d1.forEach(x => console.log('  ' + JSON.stringify(x)));
  console.log('gate = 0 (if the fix had always applied): ' + d2.length + ' carries would differ'); d2.forEach(x => console.log('  ' + JSON.stringify(x)));
})().catch(e => { console.error('dry run failed: ' + (e && e.stack || e)); process.exit(1); });
