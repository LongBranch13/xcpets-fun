#!/usr/bin/env node
/* HatchBot Pantheon hook. NOT ENABLED, NOT WIRED INTO THE LISTENER, NEVER RUN BY THE SITE, does not touch the laptop bot.
 * messages(w) -> one announcement per filled seat. No wallet addresses. send() posts ONLY when BOTH are set:
 *   HATCHBOT_PANTHEON=1   (env flag; unset means disabled)
 *   cfg.enabled === true  plus a token and a chat
 * The default is disabled. Dedupe is the seat key (seat number + tx): tick() skips keys already in seen.
 *   node tools/hatchbot-pantheon.js --print   (prints one example text from V2Pantheon.verse; sends nothing)
 */
'use strict';
const DEFAULT = { enabled: false, token: null, chat: null };
const ENV = 'HATCHBOT_PANTHEON';
function envOn() { return process.env[ENV] === '1'; }
function engine() {
  if (engine.c) return engine.c;
  const { load } = require('./lib/load-rules');
  const c = load(['js/v2-mythic-god.js', 'js/v2-pantheon.js']);
  if (!c.V2Pantheon || typeof c.V2Pantheon.verse !== 'function') throw new Error('V2Pantheon.verse did not load');
  engine.c = c;
  return c;
}
function seatsOf(w, opts) { if (opts && opts.seats) return opts.seats; const M = w && w.cem && w.cem.mg; return (M && M.seats) || []; }
function noAddr(s, fallback) { s = String(s == null ? '' : s); if (/(bc1|tb1|\b[13][a-km-zA-HJ-NP-Z1-9]{25,})/i.test(s)) return fallback; return s; }
function textFor(seat, lines, title, species) {
  const name = noAddr(seat.name, '#' + seat.petId) || ('#' + seat.petId);
  const sp = noAddr(species, 'pet') || 'pet';
  const t = noAddr(title, 'a Pantheon seat') || 'a Pantheon seat';
  const first = lines[0] || '', last = lines.length ? lines[lines.length - 1] : '';
  return '✨ A Mythic God has risen! ' + name + ' the ' + sp + ' took Seat ' + seat.n + ' of XXI: ' + t + '. HomerPepe has written Book ' + seat.n + ' of the Pantheon Odyssey. xcpets.fun/pantheon.html\n' + first + '\n' + last;
}
/* guard: the only link allowed is the bare xcpets.fun path. No wallet, no http, no @, no price talk. */
function guard(t) { return typeof t === 'string' && t.length > 0 && t.length <= 1000 && !/(bc1|tb1|\b[13][a-km-zA-HJ-NP-Z1-9]{25,}|https?:|www\.|@\w|\d\s*x\b|price|sats?\b)/i.test(t); }
function messages(w, opts) {
  opts = opts || {};
  const c = (!opts.verse || !opts.title || !opts.species) ? engine() : null;
  const verse = opts.verse || c.V2Pantheon.verse;
  const titleOf = opts.title || (n => c.V2MythicGod.seatTitle(n));
  const speciesOf = opts.species || (s => { try { return c.V2Rules.speciesLabel(s); } catch (e) { return s; } });
  return seatsOf(w, opts).filter(s => s && s.n).map(seat => {
    const lines = verse(seat, w) || [];
    const text = textFor(seat, lines, titleOf(seat.n), speciesOf(seat.species));
    return { key: 'pantheon-' + seat.n + '-' + (seat.tx || ''), at: seat.block || 0, text: text, lines: lines };
  });
}
async function send(text, cfg) {
  cfg = Object.assign({}, DEFAULT, cfg || {});
  if (!envOn() || cfg.enabled !== true || !cfg.token || !cfg.chat) return { sent: false, reason: 'disabled' };
  if (!guard(text)) return { sent: false, reason: 'send-guard' };
  const r = await fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.chat, text: text, disable_web_page_preview: true }) });
  return { sent: r.ok, status: r.status };
}
/* tick: post each new seat once. seen = keys already posted. A failed or refused send is not marked seen. */
async function tick(o) {
  o = o || {};
  if (!envOn() || o.enabled !== true) return { sent: false, posted: [], skipped: [], reason: 'disabled' };
  const seen = new Set(o.seen || []), posted = [], skipped = [];
  const deliver = o.send || (t => send(t, o.cfg));
  for (const m of messages(o.w, o)) {
    if (seen.has(m.key)) { skipped.push(m.key); continue; }
    if (!guard(m.text)) { skipped.push(m.key); continue; }
    let r; try { r = await deliver(m.text); } catch (e) { continue; }
    if (r && r.sent === false) continue;
    seen.add(m.key); posted.push(m.key);
  }
  return { sent: posted.length > 0, posted: posted, skipped: skipped, seen: [...seen] };
}
module.exports = { DEFAULT, ENV, WIRED: false, messages, guard, send, tick, textFor, envOn };
if (require.main === module && process.argv.includes('--print')) {
  const c = engine();
  const seat = { n: 10, petId: 8033, name: 'Nefu', species: 'dodo', block: 983199, tx: 'example', owner: 'bc1qexampleowneraddressshouldnotappear', eatenBy: 9, eatenAt: 974000 };
  const w = { byId: { 9: { id: 9, name: 'Mine', species: 'pepe' } }, cem: { mg: { seats: [seat] } } };
  messages(w).forEach(m => console.log(m.text));
  console.log('(sends nothing; HATCHBOT_PANTHEON=' + (process.env[ENV] || '') + '; enabled=' + DEFAULT.enabled + '; wired=' + module.exports.WIRED + ')');
}
