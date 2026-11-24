/* Wallet <-> Telegram links (owner Nov 24 2026: "if we have a list of wallets and try to connect x/telegram user names to them that
 * could make it easier for us to communicate player issues"). OPT-IN ONLY: a player links themselves, nothing is guessed or scraped.
 *
 * Flow: the player sends /link to HatchBot in a private chat -> HatchBot makes a one-time code (30 minutes) and a button to
 * xcpets.fun/link.html#c=<code>&h=<this worker's host> -> the page connects their wallet and asks it to sign one short message
 * that holds the code (free: nothing is spent, burned or broadcast) -> the page sends {code, address, signature} to POST /link ->
 * the worker checks the signature (hatchbot/verify-sig.mjs), saves the link and tells the player in Telegram.
 *
 * Stored (Cloudflare D1 'hatchbot', tables links + link_codes in hatchbot/schema.sql), PRIVATE: wallet, Telegram user id,
 * @username and first name, when it was linked, which wallet app signed. Never published on the site, in the group or in the repo.
 * /unlink removes it. Team only (admins: HATCHBOT_ADMIN_IDS secret, or the creator of the TELEGRAM_CHAT_ID group):
 *   /players          the list as a private CSV file (wallet, @username, first name, pets, linked)
 *   /players <text>   find a wallet or @username
 *   /tell <wallet or @username> <message>   HatchBot sends the player a private message from the team
 * /bug from a linked player includes their linked wallet (they are told so when linking). */
import { verifyMessage, decodeAddress } from './verify-sig.mjs';

export const SITE = 'https://xcpets.fun';
export const CODE_MS = 30 * 60 * 1000, MAX_WALLETS = 10;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* no 0/O, 1/I */
export const linkMessage = (code) => 'XCPETS HatchBot link code ' + code + '. Signing is free and spends nothing.';
export const shortAddr = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
const fmt = (n) => Number(n).toLocaleString('en-US');

export function newCode(rand) {
  const b = new Uint8Array(8); (rand || ((x) => crypto.getRandomValues(x)))(b);
  return Array.from(b, (x) => ALPHA[x % 32]).join('');
}
/* the host the page should answer to: this worker on workers.dev, or an xcpets.fun subdomain */
export function okHost(h) { return /^hatchbot\.[a-z0-9-]{1,63}\.workers\.dev$/.test(h) || /^[a-z0-9-]{1,63}\.xcpets\.fun$/.test(h); }
export function linkUrl(code, host) { return SITE + '/link.html#c=' + code + '&h=' + encodeURIComponent(host); }

async function q(env, sql, ...a) { return env.DB.prepare(sql).bind(...a); }
export async function walletsOf(env, tgId) {
  if (!env.DB) return [];
  try { const r = await (await q(env, 'SELECT wallet FROM links WHERE tg_id = ? ORDER BY at', String(tgId))).all(); return (r.results || []).map((x) => x.wallet); } catch (e) { return []; }
}

/* ---------- player commands ---------- */
export const LINK_INTRO = '\u{1F517} Link your wallet to HatchBot\n\n' +
  'Why: if something goes wrong with your pets, the XCPETS team can message you right here, and your /bug reports include your wallet so we can check it fast.\n\n' +
  'How: tap the button, connect your wallet on xcpets.fun and sign one short message. Signing is free: nothing is spent, burned or sent.\n\n' +
  'Private: only the XCPETS team can see which wallet is yours. It is never shown on the site or in the group. Send /unlink to remove it anytime.';

export async function cmdLink(env, msg, d) {
  const chat = msg.chat.id, from = msg.from || {};
  if (msg.chat.type !== 'private') {
    const me = await d.botUsername(env), url = me ? 'https://t.me/' + me + '?start=link' : null;
    return d.tg(env, 'sendMessage', Object.assign({ chat_id: chat, reply_to_message_id: msg.message_id, disable_web_page_preview: true,
      text: '\u{1F512} Wallet linking is private. Tap below and press Start in my chat.' }, url ? { reply_markup: { inline_keyboard: [[{ text: '\u{1F517} Link my wallet', url }]] } } : {}));
  }
  if (!env.DB) return d.reply('Wallet linking is not switched on yet. Please try again later.');
  if (!d.host || !okHost(d.host)) return d.reply('Wallet linking is not ready yet (the bot does not know its own address). Please try again in a few minutes.');
  const code = newCode(), now = Date.now();
  await (await q(env, 'DELETE FROM link_codes WHERE exp < ? OR tg_id = ?', now, String(from.id))).run();
  await (await q(env, 'INSERT INTO link_codes (code, tg_id, chat_id, username, first_name, exp) VALUES (?, ?, ?, ?, ?, ?)',
    code, String(from.id), String(chat), (from.username || '').slice(0, 40), (from.first_name || '').slice(0, 40), now + CODE_MS)).run();
  const have = await walletsOf(env, from.id);
  const text = LINK_INTRO + (have.length ? '\n\nLinked now: ' + have.map(shortAddr).join(', ') + '. Link another one below, or /unlink.' : '') + '\n\nThe button works for 30 minutes.';
  return d.tg(env, 'sendMessage', { chat_id: chat, text, disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: '\u{1F517} Prove my wallet on xcpets.fun', url: linkUrl(code, d.host) }]] } });
}

export async function cmdUnlink(env, msg, args, d) {
  if (msg.chat.type !== 'private') return d.reply('Send /unlink to me in a private chat.');
  if (!env.DB) return d.reply('Wallet linking is not switched on yet.');
  const id = String(msg.from && msg.from.id), have = await walletsOf(env, id);
  if (!have.length) return d.reply('No wallet is linked to you. Nothing to remove.');
  const a = String(args || '').trim();
  const drop = a ? have.filter((w) => w.toLowerCase().startsWith(a.toLowerCase()) || w.toLowerCase().endsWith(a.toLowerCase())) : have;
  if (!drop.length) return d.reply('None of your linked wallets matches "' + a.slice(0, 20) + '". Linked: ' + have.map(shortAddr).join(', '));
  for (const w of drop) await (await q(env, 'DELETE FROM links WHERE wallet = ? AND tg_id = ?', w, id)).run();
  return d.reply('\u{1F5D1} Removed ' + drop.map(shortAddr).join(', ') + '. HatchBot no longer knows ' + (drop.length > 1 ? 'these wallets are' : 'this wallet is') + ' yours.' + (drop.length < have.length ? ' Still linked: ' + have.filter((w) => !drop.includes(w)).map(shortAddr).join(', ') : ''));
}

/* ---------- team (admin) ---------- */
let CREATOR = null;
export async function isAdmin(env, userId, d) {
  if (!userId) return false;
  const ids = String(env.HATCHBOT_ADMIN_IDS || '').split(/[\s,]+/).filter(Boolean);
  if (ids.includes(String(userId))) return true;
  const group = String(env.TELEGRAM_CHAT_ID || '').split(',')[0].trim();
  if (!group || env.__dry) return false;
  if (CREATOR && Date.now() - CREATOR.at < 6 * 3600e3) return CREATOR.id === String(userId);
  try {
    const j = await (await d.tg(env, 'getChatAdministrators', { chat_id: group })).json();
    const c = j && j.ok && j.result.find((m) => m.status === 'creator');
    CREATOR = { id: c ? String(c.user.id) : '', at: Date.now() };
    return CREATOR.id === String(userId);
  } catch (e) { return false; }
}
const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function playersCsv(rows, pets) {
  const head = ['wallet', 'telegram', 'first_name', 'pets_alive', 'linked_utc', 'signed_with'];
  return [head.join(',')].concat(rows.map((r) => [r.wallet, r.username ? '@' + r.username : '', r.first_name, pets ? (pets(r.wallet) ?? '') : '', new Date(r.at).toISOString().slice(0, 16).replace('T', ' '), r.how].map(csvCell).join(','))).join('\n') + '\n';
}
async function allLinks(env) { const r = await (await q(env, 'SELECT * FROM links ORDER BY at')).all(); return r.results || []; }
function findLinks(rows, t) {
  t = String(t || '').trim().replace(/^@/, '').toLowerCase(); if (!t) return [];
  return rows.filter((r) => r.wallet.toLowerCase() === t || (t.length >= 4 && (r.wallet.toLowerCase().startsWith(t) || r.wallet.toLowerCase().endsWith(t))) || (r.username || '').toLowerCase() === t);
}

export async function cmdPlayers(env, msg, args, d) {
  if (msg.chat.type !== 'private' || !(await isAdmin(env, msg.from && msg.from.id, d))) return null; /* silent for everyone else */
  if (!env.DB) return d.reply('No storage (D1) yet.');
  const rows = await allLinks(env);
  let pets = null; try { pets = await d.petCounter(); } catch (e) { pets = null; }
  if (args) {
    const f = findLinks(rows, args);
    return d.reply(f.length ? f.map((r) => r.wallet + '\n  ' + (r.username ? '@' + r.username : '(no @username)') + ' \xB7 ' + (r.first_name || '') + (pets ? ' \xB7 ' + fmt(pets(r.wallet) || 0) + ' pets alive' : '') + ' \xB7 linked ' + new Date(r.at).toISOString().slice(0, 10)).join('\n\n') : 'Nobody linked matches "' + String(args).slice(0, 40) + '".');
  }
  if (!rows.length) return d.reply('No player has linked a wallet yet. Players link with /link in my private chat.');
  const players = new Set(rows.map((r) => r.tg_id)).size;
  return d.sendFile(env, msg.chat.id, 'xcpets-linked-players.csv', playersCsv(rows, pets),
    '\u{1F465} ' + rows.length + ' linked wallet' + (rows.length === 1 ? '' : 's') + ' from ' + players + ' player' + (players === 1 ? '' : 's') + '. Private: please do not post this file.\nFind one: /players bc1p… or /players @name\nMessage one: /tell <wallet or @name> <message>');
}

export async function cmdTell(env, msg, rest, d) {
  if (msg.chat.type !== 'private' || !(await isAdmin(env, msg.from && msg.from.id, d))) return null;
  if (!env.DB) return d.reply('No storage (D1) yet.');
  const m = /^(\S+)\s+([\s\S]{2,})$/.exec(String(rest || '').trim());
  if (!m) return d.reply('Use: /tell <wallet or @username> <message>\nExample: /tell bc1pfv…3gqd Your missing zombies are back, reload My Pets.');
  const f = findLinks(await allLinks(env), m[1]), who = [...new Set(f.map((r) => r.tg_id))];
  if (!f.length) return d.reply('Nobody linked matches ' + m[1] + '.');
  if (who.length > 1) return d.reply('That matches ' + who.length + ' players. Use the full wallet.');
  const r = f[0], wal = f.map((x) => shortAddr(x.wallet)).join(', ');
  const res = await d.tg(env, 'sendMessage', { chat_id: r.tg_id, disable_web_page_preview: true,
    text: '\u{1F4EC} A message from the XCPETS team about your wallet ' + wal + ':\n\n' + m[2].slice(0, 3000) + '\n\nYou get this because you linked your wallet with /link. /unlink stops it.' });
  let ok = false; try { const j = await res.json(); ok = !!(j && j.ok); } catch (e) { ok = !!(res && res.ok); }
  return d.reply(ok ? '✅ Sent to ' + (r.username ? '@' + r.username : r.first_name || 'the player') + ' (' + wal + ').' : '⚠️ Telegram would not deliver it (the player may have blocked HatchBot).');
}

/* ---------- POST /link from xcpets.fun/link.html ---------- */
const CORS = { 'access-control-allow-origin': SITE, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'vary': 'origin' };
const J = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS) });
export function linkPreflight() { return new Response(null, { status: 204, headers: CORS }); }

export async function linkPost(req, env, d) {
  if (!env.DB) return J({ ok: false, why: 'Wallet linking is not switched on yet.' }, 503);
  let b; try { const t = await req.text(); if (t.length > 3000) throw 0; b = JSON.parse(t); } catch (e) { return J({ ok: false, why: 'Bad request.' }, 400); }
  const code = String(b.c || '').toUpperCase(), addr0 = String(b.a || '').trim(), addr = /^bc1/i.test(addr0) ? addr0.toLowerCase() : addr0, sig = String(b.s || '').trim(), app = String(b.w || '').replace(/[^A-Za-z ]/g, '').slice(0, 20);
  if (!/^[A-Z2-9]{8}$/.test(code)) return J({ ok: false, why: 'This link is broken. Send /link to HatchBot again.' }, 400);
  if (!decodeAddress(addr)) return J({ ok: false, why: 'That is not a Bitcoin address HatchBot can check.' }, 400);
  const now = Date.now(), row = await (await q(env, 'SELECT * FROM link_codes WHERE code = ?', code)).first();
  if (!row || row.exp < now) return J({ ok: false, why: 'This link has expired. Send /link to HatchBot again for a fresh one.' }, 410);
  const v = verifyMessage(addr, linkMessage(code), sig);
  if (!v.ok) return J({ ok: false, why: 'The signature did not check out (' + v.why + '). Nothing was saved.' }, 400);
  const have = await walletsOf(env, row.tg_id);
  if (!have.includes(addr) && have.length >= MAX_WALLETS) return J({ ok: false, why: 'You already have ' + MAX_WALLETS + ' wallets linked. /unlink one first.' }, 400);
  const prev = await (await q(env, 'SELECT tg_id FROM links WHERE wallet = ?', addr)).first();
  await (await q(env, 'INSERT OR REPLACE INTO links (wallet, tg_id, username, first_name, at, how) VALUES (?, ?, ?, ?, ?, ?)',
    addr, row.tg_id, row.username || '', row.first_name || '', now, (app ? app + ' ' : '') + v.how)).run();
  await (await q(env, 'DELETE FROM link_codes WHERE code = ?', code)).run();
  /* the wallet moved to whoever proved it last: tell the old Telegram account */
  if (prev && prev.tg_id !== row.tg_id) try { await d.tg(env, 'sendMessage', { chat_id: prev.tg_id, text: 'ℹ️ Your wallet ' + shortAddr(addr) + ' was just linked to another Telegram account by someone who signed with it, so HatchBot moved it there. If that was not you, tell the XCPETS team.' }); } catch (e) { }
  let n = null; try { const pc = await d.petCounter(); n = pc ? pc(addr) : null; } catch (e) { n = null; }
  try { await d.tg(env, 'sendMessage', { chat_id: row.chat_id, disable_web_page_preview: true,
    text: '✅ Linked! ' + shortAddr(addr) + ' is yours' + (n != null ? ' (' + fmt(n) + ' pet' + (n === 1 ? '' : 's') + ' alive)' : '') + '.\nThe XCPETS team can now reach you here about your pets, and /bug reports include this wallet. /unlink removes it anytime.' }); } catch (e) { }
  return J({ ok: true, name: row.first_name || '', short: shortAddr(addr), pets: n });
}
