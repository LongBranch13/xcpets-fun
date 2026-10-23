#!/usr/bin/env node
/* HatchBot Rug Me hook (rug-me branch). NOT ENABLED, NOT WIRED INTO THE LISTENER, NEVER RUN BY THE SITE. Modeled on hatchbot-firesale.js.
 * messages(w, ad) -> { ad, match } announcement texts for one Rug Me ad (from the replayed world). due(w, posted, tip) -> unposted messages,
 * deduped by key ('rugme-ad-<tx>' / 'rugme-match-<tx>'). send(text, cfg) posts to Telegram ONLY when cfg.enabled === true with a token + chat;
 * the default is disabled, so calling it does nothing. Copy rules: no prices or trading talk, 'times' never digit+x, no creepy copy, <= 1,000 chars.
 * The owner must approve before this is wired or enabled. It never runs on the live HatchBot.
 *   node tools/hatchbot-rugme.js --print [--snap FILE]   (prints the texts from a replay; sends nothing) */
'use strict';
const DEFAULT = { enabled: false, token: null, chat: null };
const TIER = ['Common', 'Uncommon', 'Rare', 'Legendary'], STAGE = ['Egg', 'Baby', 'Kid', 'Teen', 'Adult', 'Elder', 'Mythic'];
const clip = t => (t.length > 1000 ? t.slice(0, 997) + '…' : t);
function who(V, p) { return '#' + p.id + ' ' + (p.name || '') + ' (' + (TIER[p.tier] || '') + ' ' + (V.speciesLabel ? V.speciesLabel(p.species) : p.species) + ' ' + (STAGE[p.stage] || '') + ')'; }
function messages(V, w, ad) { const P = w.byId[ad.pet]; if (!P) return null; const n = x => Number(x).toLocaleString('en-US'), out = {};
  out.ad = { key: 'rugme-ad-' + ad.tx, at: ad.block, text: clip('💘 NEW RUG ME AD 💘\n' + who(V, P) + ' is down to breed.' + (V.dtbOn && V.dtbOn(P, ad.block + 1) ? ' (DTB)' : '') +
    '\nWants: ' + V.reqText(ad.req) + '\nOpen until block ' + n(ad.block + V.AD_WINDOW) + '. Swipe right in the motel to shoot your shot.\nxcpets.com/play.html') };
  if (ad.state === 'taken' && ad.taken) { const T = w.byId[ad.taken.pet], K = w.byId[ad.taken.kid];
    out.match = { key: 'rugme-match-' + ad.taken.tx, at: ad.taken.block, text: clip("🥚 IT'S A MATCH 🥚\n" + who(V, P) + ' and ' + (T ? who(V, T) : '#' + ad.taken.pet) + ' got rugged together.' +
      (K ? '\nEgg #' + K.id + ' goes to the poster.' : '') + '\nNobody saw this coming. Everybody saw this coming.\nxcpets.com/play.html') }; }
  return out; }
function due(V, w, posted, tip) { const out = []; (w.ads || []).forEach(a => { const m = messages(V, w, a); if (!m) return;
  [m.ad, m.match].forEach(x => { if (x && tip >= x.at && tip - x.at <= 144 && !(posted && posted.has(x.key))) out.push(x); }); }); return out; }
async function send(text, cfg) { cfg = Object.assign({}, DEFAULT, cfg || {}); if (cfg.enabled !== true || !cfg.token || !cfg.chat) return { sent: false, reason: 'disabled' };
  const r = await fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: cfg.chat, text, disable_web_page_preview: true }) });
  return { sent: r.ok, status: r.status }; }
module.exports = { messages, due, send, DEFAULT };
if (require.main === module && process.argv.includes('--print')) { const { load, snap, run } = require('./lib/load-rules'); const c = load(), S = snap(), w = run(c, S, [], S.tip);
  console.log(JSON.stringify((w.ads || []).map(a => messages(c.V2Rules, w, a)), null, 1) || '(no ads: Rug Me is not open in this replay)'); }
