/* HatchBot commands (Cloudflare Worker, Nov 22 2026). Telegram calls POST /tg for every message the bot can see.
 * Commands: /meme, /chainday, /help (and /chatid, to find the group id once). /rate was removed (owner).
 * Secrets (set by .github/workflows/hatchbot-worker.yml): TELEGRAM_BOT_TOKEN. The webhook secret is derived from the token,
 * so nothing else has to be stored. Read-only: it never signs, burns or touches wallets. */
import MEMES from './memes.json';
import CAPTIONS from './captions.json';

const HELP = '🐸 HatchBot commands\n/meme · a random XCPETS meme\n/chainday · the current 144-block game day and blocks left\n/bug <what happened> · report a bug to the XCPETS team (pet numbers help!)\n/help · this list\n\nPlay at xcpets.fun';

async function hookSecret(token) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hatchbot:' + token));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}
async function tg(env, method, body) {
  return fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
async function tipNow() {
  try { const r = await fetch('https://node.xcpets.fun/xp/v1/health', { cf: { cacheTtl: 30 } }); const j = await r.json(); if (j && j.coreHeight) return j.coreHeight; } catch (e) {}
  try { const r = await fetch('https://xcpets.fun/api/meta.json'); const j = await r.json(); if (j && j.blockHeight) return j.blockHeight; } catch (e) {}
  return null;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = x => Number(x).toLocaleString('en-US');

async function command(env, msg) {
  const chat = msg.chat.id, text = String(msg.text || '').trim(), cmd = (text.split(/\s+/)[0] || '').toLowerCase().replace(/@.*$/, '');
  const reply = t => tg(env, 'sendMessage', { chat_id: chat, text: t, reply_to_message_id: msg.message_id, disable_web_page_preview: true });
  if (cmd === '/help' || cmd === '/start') return reply(HELP);
  if (cmd === '/chatid') return reply('This chat id is ' + chat);
  if (cmd === '/chainday') {
    const b = await tipNow(); if (!b) return reply('The chain is not answering right now. Try again in a minute.');
    const day = Math.floor(b / 144), left = 144 - (b % 144);
    return reply('📅 Chain day ' + fmt(day) + ' · block ' + fmt(b) + '\n' + left + ' block' + (left === 1 ? '' : 's') + ' left today (about ' + (left * 10 >= 90 ? Math.round(left * 10 / 60) + ' h' : left * 10 + ' min') + ')');
  }
  if (cmd === '/bug') {
    /* Bug reports (owner Nov 22 2026). Saved to KV; the hatchbot GitHub job turns each into a public GitHub issue (first name only). */
    if (!env.BUGS) return reply('Bug reports are not switched on yet. Please tell the team in the chat for now.');
    const body = text.replace(/^\/bug(@\S+)?\s*/i, '').trim(), quoted = msg.reply_to_message && (msg.reply_to_message.text || msg.reply_to_message.caption) || '';
    if (body.length < 5 && !quoted) return reply('Tell me what went wrong after /bug, for example:\n/bug the seance button stays grey on grave #100790');
    const who = (msg.from && msg.from.id) || 0, rk = 'rate:' + who, n = +(await env.BUGS.get(rk) || 0);
    if (n >= 5) return reply('Thanks! You have sent 5 reports this hour. Please wait a little before sending more.');
    await env.BUGS.put(rk, String(n + 1), { expirationTtl: 3600 });
    const key = 'bug:' + Date.now() + ':' + msg.message_id;
    await env.BUGS.put(key, JSON.stringify({ text: body.slice(0, 3000), quoted: String(quoted).slice(0, 1500), name: (msg.from && msg.from.first_name || 'A player').slice(0, 40), at: new Date((msg.date || Date.now() / 1000) * 1000).toISOString(), photo: !!(msg.reply_to_message && msg.reply_to_message.photo) }), { expirationTtl: 14 * 86400 });
    return reply('🐞 Thanks, got it! Your report is logged for the XCPETS team (it shows on GitHub with your first name only).');
  }
  if (cmd === '/meme') {
    const p = pick(MEMES), cap = pick(CAPTIONS).replace(/\{name\}/g, p.name);
    return tg(env, 'sendPhoto', { chat_id: chat, photo: 'https://xcpets.fun/t/' + p.id + '.png', caption: cap + '\n#' + p.id + ' · xcpets.fun/pet.html?id=' + p.id, reply_to_message_id: msg.message_id });
  }
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/') return new Response('HatchBot is awake 🐸');
    if (req.method !== 'POST' || url.pathname !== '/tg') return new Response('not found', { status: 404 });
    if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== await hookSecret(env.TELEGRAM_BOT_TOKEN)) return new Response('forbidden', { status: 403 });
    let up = null; try { up = await req.json(); } catch (e) { return new Response('ok'); }
    const msg = up && (up.message || up.channel_post);
    if (msg && typeof msg.text === 'string' && msg.text.charAt(0) === '/') { try { await command(env, msg); } catch (e) { console.log('command failed', e && e.message); } }
    return new Response('ok'); /* always 200 so Telegram does not retry */
  }
};
