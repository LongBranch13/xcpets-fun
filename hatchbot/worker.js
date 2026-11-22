/* HatchBot commands (Cloudflare Worker, Nov 22 2026). Telegram calls POST /tg for every message the bot can see.
 * Commands: /meme, /chainday, /help (and /chatid, to find the group id once). /rate was removed (owner).
 * Secrets (set by .github/workflows/hatchbot-worker.yml): TELEGRAM_BOT_TOKEN. The webhook secret is derived from the token,
 * so nothing else has to be stored. Read-only: it never signs, burns or touches wallets. */
import MEMES from './memes.json';
import CAPTIONS from './captions.json';

const HELP = '🐸 HatchBot commands\n/meme · a random XCPETS meme\n/chainday · the current 144-block game day and blocks left\n/help · this list\n\nPlay at xcpets.fun';

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
