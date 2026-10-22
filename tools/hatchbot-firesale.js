#!/usr/bin/env node
/* HatchBot Fire Sale hook (fire-sales branch). NOT ENABLED, NOT WIRED INTO THE LISTENER, NEVER RUN BY THE SITE.
 * messages(sale, tip) -> the two announcement texts (warning + start). send(text, cfg) posts to Telegram ONLY when cfg.enabled === true and a
 * token + chat are given; the default config is disabled, so calling it does nothing. Copy rule: no price / trading talk (discounts on burns only),
 * and 'half' in words (HatchBot's send-guard trips on digit+x). The owner must approve before this is wired or enabled.
 *   node tools/hatchbot-firesale.js --print [--snap FILE]   (prints the texts for the current/next sale from a replay; sends nothing) */
'use strict';
const DEFAULT = { enabled: false, token: null, chat: null };
function messages(sale, tip) { if (!sale) return null; const n = x => Number(x).toLocaleString('en-US'), left = Math.max(1, sale.start - (tip == null ? sale.arm : tip));
  return {
    warning: { key: 'firesale-warn-' + sale.arm, at: sale.arm, text: '🚨 FIRE SALE INCOMING 🚨\nCaptain Dan is yelling: a Fire Sale starts in ' + left + ' block' + (left === 1 ? '' : 's') + ' (block ' + n(sale.start) + ', about ' + (left >= 6 ? 'an hour' : left * 10 + ' minutes') + '). For 36 blocks every burn is 69% off: hatch, spin, meals, community feeding, fight, breed.\nxcpets.fun/play.html' },
    start: { key: 'firesale-start-' + sale.arm, at: sale.start, text: '🔥🔥 FIRE SALE IS ON 🔥🔥\nEVERYTHING MUST BURN! Every burn is 69% off (meals and community feeding too) until block ' + n(sale.end) + '.\nxcpets.fun/play.html' } }; }
/** due(fireInfo, posted) -> the messages whose block has come and that weren't posted yet (posted = set of keys). */
function due(fi, posted, tip) { const out = []; (fi.sales || []).slice(-2).forEach(s => { const m = messages(s, tip); [m.warning, m.start].forEach(x => { if (tip >= x.at && tip < s.end && !(posted && posted.has(x.key))) out.push(x); }); }); return out; }
async function send(text, cfg) { cfg = Object.assign({}, DEFAULT, cfg || {}); if (cfg.enabled !== true || !cfg.token || !cfg.chat) return { sent: false, reason: 'disabled' };
  const r = await fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.chat, text, disable_web_page_preview: true }) });
  return { sent: r.ok, status: r.status }; }
module.exports = { messages, due, send, DEFAULT };
if (require.main === module && process.argv.includes('--print')) { const { load, snap, run } = require('./lib/load-rules'); const c = load(), S = snap(), w = run(c, S, [], S.tip), fi = c.V2Rules.fireInfo(w, S.tip);
  const s = fi.live || fi.warning || fi.last || { arm: S.tip, start: S.tip + 6, end: S.tip + 42 }; console.log(JSON.stringify(messages(s), null, 1)); }
