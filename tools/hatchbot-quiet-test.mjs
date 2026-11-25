#!/usr/bin/env node
/* HatchBot quiet limits (Nov 25 2026, Jake: "HatchBot is posting too many things"). No network, no replay, sends nothing.
 *   node tools/hatchbot-quiet-test.mjs
 * Checks: breeding waits for one Motel roundup every ~6 h, small news has a daily/hourly cap, big moments always post,
 * tokenized pets go out as one roundup every 6 h, and the Worker's limits are the quiet ones. */
import fs from 'fs';
import { createRequire } from 'module';
import * as W from '../hatchbot/auto.js';
const require = createRequire(import.meta.url);
const A = require('../hatchbot/announce.js');
const fails = []; const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fails.push(name); };

/* a tiny fake world: pets 1-4 parents, 10 a plain egg, 11 a hybrid egg */
const pet = (id, species) => ({ id, name: 'P' + id, species });
const w = { byId: { 1: pet(1, 'pepe'), 2: pet(2, 'doge'), 3: pet(3, 'pepe'), 4: pet(4, 'dodo'), 10: pet(10, 'pepe'), 11: pet(11, 'hybpepedoge') } };
const V = { petSpeciesLabel: p => p.species };
const breed = (k, at, ids, egg) => ({ key: k, at, prio: 2, text: '', motel: { ids, egg } });

{ /* Motel roundup */
  const S = {}, seen = new Set();
  let out = A.motelRoundup([breed('b1', 100, [1, 2], 10)], S, w, V, 100, seen);
  ok('first breed is held, not posted', out.length === 0 && S.motel.length === 1 && seen.has('b1'));
  out = A.motelRoundup([breed('b2', 120, [3, 4], 11)], S, w, V, 120, seen);
  ok('still held before 36 blocks', out.length === 0 && S.motel.length === 2);
  out = A.motelRoundup([], S, w, V, 136, seen);
  ok('one roundup after 36 blocks', out.length === 1 && /MOTEL ROUNDUP! 2 couples/.test(out[0].text) && S.motel.length === 0);
  ok('roundup names the new hybrid and shows its parents', /New hybrid: P11/.test(out[0].text) && /Hottest match: P3 #3/.test(out[0].text));
  ok('roundup has the breed GIF', out[0].art && out[0].art.kind === 'breed' && out[0].art.egg === 11);
  ok('roundup caption fits Telegram', out[0].text.length < 1000);
  out = A.motelRoundup([breed('b3', 140, [1, 2], 10)], S, w, V, 140, seen);
  ok('next breed waits for the next 6 hours', out.length === 0);
  out = A.motelRoundup([], S, w, V, 172, seen);
  ok('a lone breed still gets the IT\'S A MATCH text', out.length === 1 && /IT'S A MATCH/.test(out[0].text));
}
{ /* caps */
  const S = {}, seen = new Set(), H = 36e5, small = (k) => ({ key: k, at: 1, prio: 3, text: k }), big = (k) => ({ key: k, at: 1, prio: 5, text: k });
  let out = A.capSmall([small('a'), small('b'), small('c'), small('d'), big('M1')], S, seen, 0);
  ok('at most 3 small posts an hour', out.filter(e => e.prio < 4).length === 3 && seen.has('d'));
  ok('big moments always post', out.some(e => e.key === 'M1'));
  for (let h = 1; h < 6; h++) A.capSmall([small('x' + h), small('y' + h)], S, seen, h * H);
  out = A.capSmall([small('late'), big('M2')], S, seen, 6 * H);
  ok('at most 8 small posts a day', S.cap.length === 8 && !out.some(e => e.key === 'late') && out.some(e => e.key === 'M2'));
  out = A.capSmall([small('tomorrow')], S, seen, 30 * H);
  ok('the day cap resets after 24 hours', out.length === 1);
}
{ /* Legendary posts are gone */
  const src = fs.readFileSync(new URL('../hatchbot/announce.js', import.meta.url), 'utf8');
  ok('no Legendary hatch or haul posts', !/LEGENDARY HAUL|LEGENDARY HATCH/.test(src));
}
{ /* Worker: tokenized pets roundup + quiet limits */
  const T = (id) => ({ id, name: 'T' + id, asset: 'A' + id, tiedBlock: 900 + id, rarity: 'Rare', species: 'pepe' });
  const st = {}, H = 36e5;
  W.tiePosts({ ties: [T(1)] }, st, false, 0, 6); /* baseline */
  let r = W.tiePosts({ ties: [T(1), T(2), T(3)] }, st, false, 0, 6);
  ok('first tokenized batch posts as one roundup', r.posts.length === 1 && /2 PETS TOKENIZED/.test(r.posts[0].text) && r.posts[0].keys.length === 2);
  r = W.tiePosts({ ties: [T(1), T(2), T(3), T(4)] }, st, false, 1 * H, 6);
  ok('next tokenized pet waits for 6 hours', r.posts.length === 0 && st.tieQ.length === 1);
  r = W.tiePosts({ ties: [T(1), T(2), T(3), T(4), T(5)] }, st, false, 6 * H, 6);
  ok('roundup after 6 hours', r.posts.length === 1 && r.posts[0].keys.length === 2 && !W.violations(r.posts[0].text).length);
  const C = JSON.parse(fs.readFileSync(new URL('../hatchbot/auto-config.json', import.meta.url), 'utf8'));
  ok('Worker posts at most 8 a day, 3 an hour, 10 min apart', C.limits.max_per_day <= 8 && C.limits.max_per_hour <= 3 && C.limits.min_gap_s >= 600);
  ok('breeding news only from the Motel roundup', C.chain.hybrids === false && C.routines.motel_alert === false);
  ok('slash commands untouched (/rate stays off)', C.commands.rate === false);
}
console.log(fails.length ? '\n' + fails.length + ' FAILED' : '\nall passed');
process.exit(fails.length ? 1 : 0);
