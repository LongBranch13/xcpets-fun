/* HatchBot commands (Cloudflare Worker, Nov 22 2026). Telegram calls POST /tg for every message the bot can see.
 * Commands: /meme, /chainday, /help (and /chatid, to find the group id once). /rate was removed (owner).
 * Also POST /e: page error reports from every xcpets.fun page (see pageError below).
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

/* Page error reports (owner Nov 22 2026: "hatchbot worker"). Every xcpets.fun page carries a tiny reporter (tools/build-err-report.js)
 * that sends ONLY {k, m, f, l, c, b, p}: kind, message (addresses, long hex and emails already cut), script path, line, column,
 * build id, page path. No wallet, no query string, no IP is stored. Same error = one KV key per UTC day with a count, so the free
 * plan's daily write budget is not burned by one loud bug (each isolate writes a signature at most once per 10 minutes).
 * hatchbot/bugs-to-issues.js turns each finished day into one GitHub issue labelled 'page-errors' and deletes the keys. */
const ERR_SEEN = new Map();
function clip(v, n) { return String(v == null ? '' : v).replace(/\b(bc1|tb1)[a-z0-9]{20,90}\b/gi, '<addr>').replace(/\b[13mn2][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g, '<addr>').replace(/\b[0-9a-f]{40,}\b/gi, '<hex>').replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '<email>').slice(0, n); }
async function pageError(raw, env) {
  if (!env.BUGS) return;
  if (!raw || raw.length > 4000) return;
  let o; try { o = JSON.parse(raw); } catch (e) { return; }
  if (!o || typeof o !== 'object') return;
  const r = { k: o.k === 'rejection' ? 'rejection' : 'error', m: clip(o.m, 300), f: clip(o.f, 120), l: o.l | 0, c: o.c | 0, b: clip(o.b, 12), p: clip(o.p, 80) };
  if (!r.m) return;
  const sigTxt = [r.k, r.m, r.f, r.l, r.b].join('|'), d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sigTxt));
  const sig = Array.from(new Uint8Array(d).slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join('');
  const now = Date.now(), last = ERR_SEEN.get(sig) || 0, held = (ERR_SEEN.get(sig + ':n') || 0) + 1;
  if (now - last < 10 * 60 * 1000) { ERR_SEEN.set(sig + ':n', held); return; }
  ERR_SEEN.set(sig, now); ERR_SEEN.set(sig + ':n', 0); if (ERR_SEEN.size > 2000) ERR_SEEN.clear();
  const key = 'err:' + new Date(now).toISOString().slice(0, 10) + ':' + sig;
  let cur = null; try { cur = JSON.parse(await env.BUGS.get(key) || 'null'); } catch (e) { cur = null; }
  const pages = (cur && cur.pages) || []; if (pages.indexOf(r.p) < 0 && pages.length < 8) pages.push(r.p);
  await env.BUGS.put(key, JSON.stringify(Object.assign({}, r, { n: ((cur && cur.n) || 0) + held, pages, first: (cur && cur.first) || new Date(now).toISOString(), last: new Date(now).toISOString() })), { expirationTtl: 21 * 86400 });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/') return new Response('HatchBot is awake 🐸');
    if (req.method === 'POST' && url.pathname === '/e') {
      let raw = ''; try { raw = await req.text(); } catch (e) { raw = ''; }
      const job = pageError(raw, env).catch(e => console.log('page error report failed', e && e.message));
      if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
      return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (req.method === 'OPTIONS' && url.pathname === '/e') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
    if (req.method !== 'POST' || url.pathname !== '/tg') return new Response('not found', { status: 404 });
    if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== await hookSecret(env.TELEGRAM_BOT_TOKEN)) return new Response('forbidden', { status: 403 });
    let up = null; try { up = await req.json(); } catch (e) { return new Response('ok'); }
    const msg = up && (up.message || up.channel_post);
    if (msg && typeof msg.text === 'string' && msg.text.charAt(0) === '/') { try { await command(env, msg); } catch (e) { console.log('command failed', e && e.message); } }
    return new Response('ok'); /* always 200 so Telegram does not retry */
  }
};
