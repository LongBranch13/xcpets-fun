#!/usr/bin/env node
/* HatchBot never loses a post to a network blip, and never double posts (Nov 27 2026). No network, sends nothing.
 *   node tools/hatchbot-send-retry-test.js
 * Update 1/4 of nov27-whats-new was lost: the runner could not reach Telegram ("fetch failed", TypeError), and announce.js treated
 * every fetch error as "it may have posted", so it neither resent it nor turned the run red. Now a request that never left
 * (DNS, refused, connect timeout) is sent again, and one that may have landed is not resent but makes the run go red. */
process.env.TELEGRAM_BOT_TOKEN = 'test-token'; process.env.TELEGRAM_CHAT_ID = '-1';
const A = require('../hatchbot/announce.js');
const fails = []; const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fails.push(name); };
const netErr = code => { const e = new TypeError('fetch failed'); e.cause = Object.assign(new Error(code), { code }); return e; };
const res = (status, body) => new Response(JSON.stringify(body || { ok: status === 200 }), { status });
function stub(plan) { let n = 0; global.fetch = async () => { const s = plan[Math.min(n++, plan.length - 1)]; if (s instanceof Error) throw s; return res(s); }; return () => n; }
(async () => {
  let calls = stub([netErr('ENOTFOUND'), 200]);
  let r = await A.tgFile('sendAnimation', 'animation', Buffer.from([1, 2, 3]), 'a.gif', 'hi {pepe}');
  ok('picture: a request that never left is sent again and posts', r === true && calls() === 2);
  ok('picture: a resend that worked leaves the run green', A.unsure() === 0);
  calls = stub([netErr('UND_ERR_CONNECT_TIMEOUT'), 200]);
  r = await A.tg('sendMessage', { text: 'hello' });
  ok('text: a connect timeout is sent again and posts', r === true && calls() === 2);
  calls = stub([netErr('ECONNRESET'), 200]);
  r = await A.tgFile('sendPhoto', 'photo', Buffer.from([1]), 'p.png', 'x');
  ok('picture: a reset after sending is NOT sent again (no double post)', calls() === 1);
  ok('picture: ...and is not posted again as text either', r === 'unsure');
  ok('picture: ...and turns the run red', A.unsure() === 1);
  calls = stub([Object.assign(new Error('timeout'), { name: 'TimeoutError' })]);
  r = await A.tg('sendMessage', { text: 'x' });
  ok('text: a timeout is not sent again and turns the run red', r === 'unsure' && calls() === 1 && A.unsure() === 2);
  calls = stub([400]);
  r = await A.tg('sendMessage', { text: 'x' });
  ok('text: Telegram refusing it is a plain failure', r === false && calls() === 1);
  if (fails.length) { console.log(fails.length + ' FAILED'); process.exit(1); }
  console.log('all passed');
})().catch(e => { console.error(e); process.exit(1); });
