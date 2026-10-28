#!/usr/bin/env node
/* Feed all / Feed selected: cheapest plan for exactly the chosen pets (feedOptions), and the multi-burn dialog's Cancel.
 * Same live fixture as feed-all-test.js (api/boot.json cut at 973,357, wallet bc1qs88…j6n). Discards are browser-only (hiddenIds);
 * here they are modelled as every Common/Uncommon pet, like a "keep Rare+" wallet. */
'use strict';
const fs = require('fs'), path = require('path'), L = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const B = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'api', 'boot.json'), 'utf8')), CUT = 973357, ME = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const s = { rows: B.rows.filter(r => r.block_index <= CUT), hashes: B.hashes };
function world(gate, extra, tip) { const c = L.load(); c.V2Rules._setFeedAllActivation(gate); return { c, w: L.run(c, s, extra || [], tip || CUT) }; }
const T = 973400, a = world(T - 1, [], T - 1), V = a.c.V2Rules;
const mine = a.w.pets.filter(p => p.owner === ME && !p.dead && !p.released), hungry = mine.filter(p => p.hungry);
const disc = new Set(mine.filter(p => p.tier <= 1).map(p => p.id)), kept = hungry.filter(p => !disc.has(p.id));
const rnd = (k => () => (k = (k * 1103515245 + 12345) % 2147483648) / 2147483648)(71);
const skIds = q => [].concat(...q.map(x => { const t = V.parseTag(x.tag); return (x.setOnly || /^pet:f[xy]/.test(x.tag)) && !(t.un) ? (t.ex || t.ids || []) : []; }));
function replay(q, ids, name) {
  const rows = q.map(x => L.row(T, ME, x.amount, x.tag)), z = world(T - 1, rows, T + 1);
  const fed = [].concat(...z.w.log.filter(l => rows.some(r => r.tx_hash === l.tx) && l.kind === 'feed').map(l => l.petIds || (l.petId != null ? [l.petId] : []))).sort((x, y) => x - y);
  ok(fed.join() === ids.slice().sort((x, y) => x - y).join(), name + ': replay fed exactly the ' + ids.length + ' chosen pets (' + fed.length + ' fed)'); }
ok(typeof V.feedOptions === 'function', 'feedOptions exported');
ok(kept.length > 50 && disc.size > 50, 'fixture: ' + kept.length + ' kept hungry, ' + disc.size + ' discarded');
// 71 picked pets: never put an unpicked, non-discarded pet on the skip list
for (const [name, pick] of [['71 random kept', kept.slice().sort(() => rnd() - 0.5).slice(0, 71)], ['71 highest tier', kept.slice().sort((x, y) => y.tier - x.tier || x.id - y.id).slice(0, 71)], ['71 lowest-id kept', kept.slice(0, 71)]]) {
  const ids = pick.map(p => p.id), q = V.feedQueue(a.w, ME, ids, T, { canSkip: disc }), oldQ = V.feedQueue(a.w, ME, ids, T);
  ok(q.every(x => x.tag.length <= 34), name + ': ' + q.length + ' burns (' + q.filter(x => x.setOnly).length + ' setup), all tags <= 34 bytes');
  ok(skIds(q).every(id => disc.has(id)), name + ': only discarded pets go on the skip list');
  ok(q.length <= oldQ.length, name + ': no more burns than without the discard limit (' + q.length + ' vs ' + oldQ.length + ')');
  replay(q, ids, name);
  const q0 = V.feedQueue(a.w, ME, ids, T, { canSkip: [] });
  ok(q0.every(x => !x.setOnly) && skIds(q0).length === 0, name + ': with nothing discarded the pick needs no skip-list burn (' + q0.length + ' burns)');
  replay(q0, ids, name + ' (no skip)');
  ok(q.length <= q0.length, name + ': a pick never costs more burns than the plan with no skip list (' + q.length + ' vs ' + q0.length + ')'); }
// Feed all (kept only): setup vs fewest-now vs the 1-burn "including discarded" option
{ const ids = kept.map(p => p.id), o = V.feedOptions(a.w, ME, ids, T, { canSkip: disc, all: true });
  ok(o.best === o.sync || o.best === o.now, 'best is one of now/sync');
  ok(o.best === (o.sync && o.sync.length <= o.now.length + 3 ? o.sync : o.now), 'feed-all keeps the one-time setup when it costs at most 3 more burns now (' + (o.sync && o.sync.length) + ' vs ' + o.now.length + ')');
  ok(o.all && o.all.length === 1 && o.all[0].tag === 'pet:fa', 'Feed all including discarded = ONE pet:fa');
  ok(o.discardedFed > 0, '"including discarded" feeds ' + o.discardedFed + ' discarded pets too');
  replay(o.best, ids, 'Feed all kept (' + o.best.length + ' burns)');
  replay(o.now, ids, 'Feed all kept, fewest-now (' + o.now.length + ' burns)');
  replay(o.all, hungry.map(p => p.id), 'Feed all including discarded'); }
// one hungry pet above every chosen pet needs no skip entry
{ const top = kept[kept.length - 1], pick = kept.slice(0, kept.length - 1).map(p => p.id), q = V.feedQueue(a.w, ME, pick, T, { canSkip: [] });
  ok(skIds(q).indexOf(top.id) < 0, 'unchosen pet above the highest chosen id is not skip-listed');
  replay(q, pick, 'all kept but the highest'); }
// Cancel in the multi-burn dialog (static: js/v2.js is browser code)
{ const src = fs.readFileSync(path.join(L.ROOT, 'js', 'v2.js'), 'utf8');
  ok(/function cfCancel\(\)/.test(src), 'cfCancel exists');
  ok(/\$\('cfNo'\)\.onclick = cfCancel/.test(src), 'Cancel button calls cfCancel');
  ok(/Escape/.test(src) && /cfCancel\(\)/.test(src.slice(src.indexOf('Escape') - 300, src.indexOf('Escape') + 300)), 'Esc closes the dialog');
  ok(/confirmBox[\s\S]{0,200}target[\s\S]{0,120}cfCancel|target[\s\S]{0,120}confirmBox[\s\S]{0,200}cfCancel/.test(src), 'backdrop click closes the dialog');
  const yes = src.slice(src.indexOf("$('cfYes').onclick"), src.indexOf("$('cfYes').onclick") + 4000);
  ok(!/\$\('cfNo'\)\.disabled = true/.test(src), 'Cancel is never disabled while a wallet request is pending');
  ok(/gone\(\)/.test(yes) && /cfRun/.test(yes), 'signing run stops after Cancel (run token)');
  const body = src.slice(src.indexOf('function cfCancel()'), src.indexOf('function cfCancel()') + 900);
  ok(/pendingPlans = null/.test(body) && /saveResume\(null/.test(body) && /close\('confirmBox'\)/.test(body), 'Cancel resets plans, resume state and closes'); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
