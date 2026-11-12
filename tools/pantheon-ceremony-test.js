#!/usr/bin/env node
/* Pantheon ceremony tooling. Display only: the rules file MD5 stays f010ee1f723dcc3340a73da0a443eba3,
 * replay of snap-971786 matches origin/main (SAME), and the HatchBot text plus the X card use
 * the first and last lines of V2Pantheon.verse. The Telegram hook stays disabled and unwired.
 * Nothing is posted. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const RULES_MD5 = 'f010ee1f723dcc3340a73da0a443eba3';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const md5 = p => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');

ok(md5(path.join(ROOT, 'js/v2-rules.js')) === RULES_MD5, 'js/v2-rules.js MD5 is ' + RULES_MD5);

const { load } = require('./lib/load-rules');
const c = load(['js/v2-mythic-god.js', 'js/v2-pantheon.js']);
ok(c.V2Pantheon && typeof c.V2Pantheon.verse === 'function' && c.V2MythicGod && c.V2MythicGod.seatTitle(10) === 'Guardian of the Proof of Burn', 'verse and seat titles load');
const owner = 'bc1qexampleowneraddressshouldnotappearxx';
const seat = { n: 10, petId: 8033, name: 'Nefu', species: 'dodo', block: 983199, tx: 'seat-tx-10', owner: owner, eatenBy: 9, eatenAt: 974000 };
const w = { byId: { 9: { id: 9, name: 'Mine', species: 'pepe' } }, cem: { mg: { seats: [seat] } } };
const lines = c.V2Pantheon.verse(seat, w);
const book = (lines || []).join('\n');
ok(Array.isArray(lines) && lines.length === 12 && book.indexOf('Nefu') >= 0 && book.indexOf('tenth') >= 0 && book.indexOf('Guardian of the Proof of Burn') >= 0, 'V2Pantheon.verse returns the 12-line book for Nefu (' + (lines && lines.length) + ')');
const again = c.V2Pantheon.verse(seat, w);
ok(JSON.stringify(again) === JSON.stringify(lines), 'verse is stable for the same seat');

const HB = require('./hatchbot-pantheon');
ok(HB.WIRED === true && HB.DEFAULT.enabled === false && HB.envOn() === false, 'HatchBot pantheon hook is wired to the listener and disabled by default');
const msgs = HB.messages(w, { verse: (s, world) => c.V2Pantheon.verse(s, world), title: n => c.V2MythicGod.seatTitle(n), species: s => c.V2Rules.speciesLabel(s) });
ok(msgs.length === 1 && msgs[0].text.indexOf(lines[0]) >= 0 && msgs[0].text.indexOf(lines[11]) >= 0, 'announcement first and last lines equal V2Pantheon.verse');
ok(msgs[0].text.indexOf('Nefu the Dodo') >= 0 && msgs[0].text.indexOf('Seat 10 of XXI') >= 0 && msgs[0].text.indexOf('Guardian of the Proof of Burn') >= 0 && msgs[0].text.indexOf('Book 10') >= 0 && msgs[0].text.indexOf('xcpets.fun/pantheon.html') >= 0, 'announcement names the pet, seat, title, book and page');
ok(msgs[0].text.indexOf(owner) < 0 && HB.guard(msgs[0].text) && !/bc1|tb1|https?:|www\.|@\w/.test(msgs[0].text), 'announcement has no wallet address and passes the send-guard');
ok(msgs[0].key === 'pantheon-10-seat-tx-10', 'dedupe key is the seat and its tx');

(async () => {
  const off = await HB.send(msgs[0].text, { enabled: true, token: 'nope', chat: 'nope' });
  ok(off.sent === false && off.reason === 'disabled', 'send stays disabled without HATCHBOT_PANTHEON=1 even if enabled is passed');
  const offTick = await HB.tick({ w: w, enabled: true, verse: () => lines, title: () => 'T', species: () => 'Dodo', send: async () => { throw new Error('should not send'); } });
  ok(offTick.reason === 'disabled' && offTick.posted.length === 0, 'tick does not post while the env flag is off');

  process.env.HATCHBOT_PANTHEON = '1';
  let nSend = 0;
  const first = await HB.tick({ w: w, enabled: true, seen: [], verse: () => lines, title: () => c.V2MythicGod.seatTitle(10), species: () => 'Dodo', send: async () => { nSend++; return { sent: true }; } });
  ok(first.posted.length === 1 && first.posted[0] === msgs[0].key && nSend === 1, 'tick posts a new seat once');
  const second = await HB.tick({ w: w, enabled: true, seen: first.seen, verse: () => lines, title: () => 'T', species: () => 'Dodo', send: async () => { nSend++; return { sent: true }; } });
  ok(second.posted.length === 0 && second.skipped.indexOf(msgs[0].key) >= 0 && nSend === 1, 'the same seat tx is not posted again');
  const bad = await HB.send('hello bc1qexampleowneraddressshouldnotappearxx', { enabled: true, token: 't', chat: 'c' });
  ok(bad.sent === false && bad.reason === 'send-guard', 'send-guard refuses a wallet address');

  /* seats already filled on the first enabled look are recorded and not announced. Only a seat that appears after that is posted, once. */
  const sentB = [];
  const optB = { verse: s => s.n === 11 ? ['Book eleven begins.', 'Book eleven ends.'] : lines, title: () => 'Guardian of the Proof of Burn', species: () => 'Dodo', send: async t => { sentB.push(t); return { sent: true }; } };
  const base1 = await HB.tick(Object.assign({ w: w, enabled: true }, optB));
  ok(base1.reason === 'baseline' && base1.posted.length === 0 && sentB.length === 0 && base1.seen.indexOf('pantheon-10-seat-tx-10') >= 0, 'first look records the seat already filled and does not announce it');
  const base2 = await HB.tick(Object.assign({ w: w, enabled: true, store: { baseline: true, keys: base1.seen } }, optB));
  ok(base2.posted.length === 0 && sentB.length === 0, 'that seat is not announced on the next look');
  const seat2 = { n: 11, petId: 8034, name: 'Nefu', species: 'dodo', block: 984000, tx: 'seat-tx-11', owner: owner, eatenBy: 9, eatenAt: 983000 };
  const w2 = { byId: w.byId, cem: { mg: { seats: [seat, seat2] } } };
  const base3 = await HB.tick(Object.assign({ w: w2, enabled: true, store: { baseline: true, keys: base1.seen } }, optB));
  ok(base3.posted.length === 1 && base3.posted[0] === 'pantheon-11-seat-tx-11' && sentB.length === 1 && sentB[0].indexOf(owner) < 0 && sentB[0].indexOf('Book eleven begins.') >= 0 && sentB[0].indexOf('Book eleven ends.') >= 0 && !/bc1/.test(sentB[0]), 'only the new seat is announced, with its verse lines and no wallet');
  const base4 = await HB.tick(Object.assign({ w: w2, enabled: true, store: { baseline: true, keys: base3.seen } }, optB));
  ok(base4.posted.length === 0 && sentB.length === 1, 'the new seat is not announced twice');

  const Listen = require('./hatchbot-listen');
  ok(Listen.CONFIG_KEY === 'enabled' && Listen.ENV === 'HATCHBOT_PANTHEON', 'listener gates on HATCHBOT_PANTHEON and config key enabled');
  const dir = fs.mkdtempSync(path.join(process.env.XCPETS_TEST_TMP || '/tmp', 'pn-hb-'));
  const seenFile = path.join(dir, 'seen.json');
  let nL = 0;
  const sendL = async t => { nL++; if (/bc1|tb1/.test(t)) throw new Error('address in post'); return { sent: true }; };
  const l1 = await Listen.run({ w: w, enabled: true, seenFile: seenFile, config: { enabled: true, token: 't', chat: 'c' }, verse: () => lines, title: () => 'T', species: () => 'Dodo', send: sendL });
  const saved = JSON.parse(fs.readFileSync(seenFile, 'utf8'));
  ok(l1.reason === 'baseline' && nL === 0 && saved.baseline === true && saved.keys.indexOf('pantheon-10-seat-tx-10') >= 0, 'listener writes the filled seats and does not post them');
  const l2 = await Listen.run({ w: w, enabled: true, seenFile: seenFile, config: { enabled: true, token: 't', chat: 'c' }, verse: () => lines, title: () => 'T', species: () => 'Dodo', send: sendL });
  ok(l2.posted.length === 0 && nL === 0, 'listener does not announce the baselined seat');
  const l3 = await Listen.run({ w: w2, enabled: true, seenFile: seenFile, config: { enabled: true, token: 't', chat: 'c' }, verse: s => s.n === 11 ? ['Book eleven begins.', 'Book eleven ends.'] : lines, title: () => 'T', species: () => 'Dodo', send: sendL });
  ok(l3.posted.length === 1 && l3.posted[0] === 'pantheon-11-seat-tx-11' && nL === 1, 'listener posts only the new seat');
  const l4 = await Listen.run({ w: w2, enabled: true, seenFile: seenFile, config: { enabled: true, token: 't', chat: 'c' }, verse: s => s.n === 11 ? ['Book eleven begins.', 'Book eleven ends.'] : lines, title: () => 'T', species: () => 'Dodo', send: sendL });
  ok(l4.posted.length === 0 && nL === 1, 'listener does not post that seat again');
  delete process.env.HATCHBOT_PANTHEON;
  const l5 = await Listen.run({ w: w2, enabled: true, seenFile: seenFile, config: { enabled: true, token: 't', chat: 'c' }, send: sendL });
  ok(l5.reason === 'disabled' && nL === 1, 'listener posts nothing without HATCHBOT_PANTHEON=1');
  process.env.HATCHBOT_PANTHEON = '1';
  const l6 = await Listen.run({ w: w2, enabled: false, seenFile: seenFile, config: { enabled: false, token: 't', chat: 'c' }, send: sendL });
  ok(l6.reason === 'disabled' && nL === 1, 'listener posts nothing unless config enabled is true');
  delete process.env.HATCHBOT_PANTHEON;

  const Card = require('./pantheon-card');
  const sprite = new Uint8ClampedArray(32 * 32 * 4);
  for (let i = 0; i < sprite.length; i += 4) { sprite[i] = 10; sprite[i + 1] = 200; sprite[i + 2] = 30; sprite[i + 3] = 255; }
  const card = Card.renderCard({ seat: 10, title: c.V2MythicGod.seatTitle(10), line0: lines[0], line1: lines[11], sprite: sprite, scale: 1 });
  ok(card.png[0] === 137 && card.png[1] === 80 && card.png[2] === 78 && card.png[3] === 71, 'card is a PNG');
  ok(card.w === 640 && card.h === 360, 'card size ' + card.w + 'x' + card.h);
  let green = 0; for (let i = 0; i < card.rgba.length; i += 4) if (card.rgba[i + 1] === 200 && card.rgba[i] === 10) green++;
  ok(green > 1000, 'card draws the seated pet sprite (' + green + ' px)');
  const blank = Card.renderCard({ seat: 10, title: 'Other', line0: 'nope', line1: 'nope', sprite: sprite, scale: 1 });
  ok(!card.png.equals(blank.png), 'seat title and book lines change the card');
  const out = path.join(process.env.XCPETS_TEST_TMP || '/tmp', 'pantheon-card.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Card.renderCard({ seat: 10, title: c.V2MythicGod.seatTitle(10), line0: lines[0], line1: lines[11], scale: 2 }).png);
  ok(fs.statSync(out).size > 1000, 'wrote ' + out);

  require('./lib/fixtures').ensure(['snap-971786.json']);
  const snap = path.join(ROOT, 'tools/snapshots/snap-971786.json');
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools/replay-check.js'), '--compare', 'origin/main', '--snap', snap], { cwd: ROOT, encoding: 'utf8', timeout: 180000, maxBuffer: 8e6 });
  const replayOut = (r.stdout || '') + (r.stderr || '');
  ok(r.status === 0 && /\bSAME\b/.test(replayOut) && !/\bDIFF\b/.test(replayOut), 'replay unchanged vs origin/main (' + (replayOut.trim().split('\n').pop() || r.error || 'no output') + ')');

  console.log('pantheon-ceremony-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL', e && e.stack || e); process.exit(1); });
