/* Fire Sale part of hatchbot-warnings-test (fire-sales branch). Fake send only. */
'use strict';
module.exports = async ({ ok, H, V, guard, mk, fake, T }) => {
  const s = { arm: 973500, start: 973506, end: 973542 }, w = { kek: { fed: 1 }, fire: { sales: [s] } }, r = mk(), f = fake();
  let x = await H.tick(T({ w, tip: 973499, rate: r, send: f.send })); ok(x.posted.length === 0, 'fire: nothing before the warning block');
  x = await H.tick(T({ w, tip: 973500, rate: r, send: f.send })); ok(x.posted.join() === 'HB-FIRESALE-WARN-973500' && /starts in 6 blocks/.test(f.sent[0]), 'fire: warning phase posts "starts in 6 blocks"');
  x = await H.tick(T({ w, tip: 973503, rate: r, send: f.send })); ok(x.posted.length === 0, 'fire: warning posted once');
  x = await H.tick(T({ w, tip: 973506, rate: r, send: f.send })); ok(x.posted.join() === 'HB-FIRESALE-START-973500' && /69% off/.test(f.sent[1]), 'fire: sale live posts once, says 69% off');
  x = await H.tick(T({ w, tip: 973542, rate: r, send: f.send })); ok(x.posted.length === 0 && f.sent.length === 2, 'fire: nothing after the sale ends');
  { const r2 = mk(), f2 = fake(); x = await H.tick(T({ w, tip: 973510, rate: r2, send: f2.send })); ok(f2.sent.length === 1 && x.skipped.join() === 'HB-FIRESALE-WARN-973500', 'fire: late watcher posts only "live", warning skipped'); }
  { const r3 = mk(), f3 = fake(); x = await H.tick(T({ w: { kek: { fed: 6216210 }, fire: { sales: [s] } }, tip: 973500, rate: r3, send: f3.send })); ok(f3.sent.length === 2, 'fire + halving warnings at the same tick both post (different kinds)'); }
};
