#!/usr/bin/env node
/* HatchBot gift + swap hook (pet-gift branch). NOT ENABLED, NOT WIRED INTO THE LISTENER, NEVER RUN BY THE SITE, does not touch the laptop bot.
 * messages(w) -> announcement texts for gifts and swaps of LEGENDARY or MYTHIC pets only (owner decision); no addresses, no player numbers,
 * no prices, no links, no @mentions. send(text, cfg) posts ONLY when cfg.enabled === true plus a token + chat; the default is disabled.
 *   node tools/hatchbot-gifts.js --print [snap-file-name]   (prints texts from a replay with the gate lowered; sends nothing) */
'use strict';
const DEFAULT = { enabled: false, token: null, chat: null };
const big = g => g && (g.mythic || g.tier >= 3);
function label(w, id) { const p = w.byId[id]; if (!p) return '#' + id; const m = !!p.mythicCare || p.stage >= 5; return (m ? 'Mythic' : 'Legendary') + ' ' + (p.name || p.species) + ' #' + id; }
function messages(w) { const out = [], swaps = {};
  (w.giftLog || []).forEach(g => { const p = w.byId[g.petId] || {}, m = !!p.mythicCare || p.stage >= 5; if (!(m || g.tier >= 3)) return;
    if (g.swap) { (swaps[g.swap] = swaps[g.swap] || []).push(g); return; }
    out.push({ key: 'gift-' + g.tx + '-' + g.petId, at: g.block, text: '🎁 A ' + label(w, g.petId) + ' was just gifted to a new keeper' + (g.gear ? ', gear and all' : '') + '!' }); });
  Object.keys(swaps).forEach(n => { const X = (w.swaps || [])[n - 1]; if (!X) return; out.push({ key: 'swap-' + X.doneTx, at: X.doneBlock, text: '🔁 Pet swap! ' + label(w, X.mine) + ' and ' + label(w, X.theirs) + ' traded homes.' }); });
  return out; }
function guard(t) { return !/(bc1|\b[13][a-km-zA-HJ-NP-Z1-9]{25,}|https?:|www\.|@\w|\d\s*x\b|price|sats?\b)/i.test(t); }
async function send(text, cfg) { cfg = Object.assign({}, DEFAULT, cfg || {}); if (cfg.enabled !== true || !cfg.token || !cfg.chat) return { sent: false, reason: 'disabled' };
  if (!guard(text)) return { sent: false, reason: 'send-guard' };
  const r = await fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.chat, text }) }); return { sent: r.ok }; }
module.exports = { DEFAULT, messages, guard, send, big };
if (require.main === module && process.argv.includes('--print')) { const { load, snap, run } = require('./lib/load-rules'); const c = load(), S = snap(process.argv[3]); const w = run(c, S, [], S.tip); messages(w).forEach(m => console.log(m.text)); console.log('(sends nothing; enabled=' + DEFAULT.enabled + ')'); }
