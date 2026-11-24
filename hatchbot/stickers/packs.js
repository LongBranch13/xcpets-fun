/* HatchBot's Telegram packs (Nov 24 2026): a sticker pack and a custom emoji pack of every XCPETS pet species,
 * drawn from the game's own sprites (hatchbot/stickers/make-images.py). Run by the telegram-packs workflow.
 *
 * Creates (or refreshes in place) two packs owned by the group owner and made by HatchBot:
 *   t.me/addstickers/xcpets_pets_by_<bot>   regular stickers, 512x512
 *   t.me/addemoji/xcpets_emoji_by_<bot>     custom emoji, 100x100
 * Then tries to make the sticker pack the group's sticker set (setChatStickerSet; needs HatchBot as admin with
 * "Change group info" and a group Telegram allows a sticker set for). Bots cannot set a group's emoji pack: the owner does that in Telegram.
 *
 * Env: TELEGRAM_BOT_TOKEN (required), TELEGRAM_CHAT_ID (the group; its creator becomes the owner), OWNER_ID (optional override),
 * DRY=1 (print the plan, call nothing that writes). Never touches wallets or the game. */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = __dirname;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_CHAT_ID, DRY = process.env.DRY === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(method, params, files) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    if (files) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(params)) fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
      for (const [k, f] of Object.entries(files)) fd.append(k, new Blob([fs.readFileSync(f)], { type: 'image/png' }), path.basename(f));
      res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', body: fd });
    } else {
      res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) });
    }
    const j = await res.json().catch(() => ({ ok: false, description: 'HTTP ' + res.status }));
    if (j.ok) return j.result;
    const wait = j.parameters && j.parameters.retry_after;
    if (wait) { console.log(`  Telegram asks to wait ${wait}s`); await sleep((wait + 1) * 1000); continue; }
    const e = new Error(`${method}: ${j.description}`); e.tg = j; throw e;
  }
  throw new Error(method + ': too many retries');
}

const MANIFEST = JSON.parse(fs.readFileSync(path.join(DIR, 'pets.json'), 'utf8')).pets;
/* sticker pack: grouped by species (bare, some gear, full gear); emoji pack: manifest order (every species bare first) */
const ORDER = [...new Set(MANIFEST.map(p => p.file.replace(/-(no|some|full)-gear\.png$/, '')))];
const BY_SPECIES = ORDER.flatMap(sp => ['no', 'some', 'full'].map(l => MANIFEST.find(p => p.file === `${sp}-${l}-gear.png`)).filter(Boolean));

function input(p, kind, key) {
  return { sticker: 'attach://' + key, format: 'static', emoji_list: p.emoji.slice(0, 20), keywords: p.keywords.slice(0, 20) };
}

async function syncPack(owner, name, title, type, list, sub) {
  const file = p => path.join(DIR, sub, p.file);
  let set = null;
  try { set = await call('getStickerSet', { name }); } catch (e) { if (!/STICKERSET_INVALID|not found/i.test(e.message)) throw e; }
  console.log(`\n${title} (${name}): ${set ? set.stickers.length + ' stickers now' : 'new pack'}, ${list.length} wanted`);
  if (DRY) return;
  let i = 0;
  if (!set) {
    const first = list.slice(0, 50), files = {};
    first.forEach((p, k) => { files['s' + k] = file(p); });
    await call('createNewStickerSet', { user_id: String(owner), name, title, sticker_type: type, stickers: first.map((p, k) => input(p, type, 's' + k)) }, files);
    console.log(`  created with ${first.length}`); i = first.length;
  } else {
    /* refresh in place: replace each existing sticker in its position, so links people saved keep working */
    for (; i < Math.min(list.length, set.stickers.length); i++) {
      await call('replaceStickerInSet', { user_id: String(owner), name, old_sticker: set.stickers[i].file_id, sticker: input(list[i], type, 's') }, { s: file(list[i]) });
      if (i % 10 === 9) console.log(`  replaced ${i + 1}`);
      await sleep(250);
    }
    for (const extra of set.stickers.slice(list.length)) { await call('deleteStickerFromSet', { sticker: extra.file_id }); await sleep(250); }
  }
  for (; i < list.length; i++) {
    await call('addStickerToSet', { user_id: String(owner), name, sticker: input(list[i], type, 's') }, { s: file(list[i]) });
    if (i % 10 === 9) console.log(`  added ${i + 1}`);
    await sleep(250);
  }
  set = await call('getStickerSet', { name });
  console.log(`  done: ${set.stickers.length} stickers`);
  return set;
}

async function main() {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const me = await call('getMe', {});
  let owner = process.env.OWNER_ID && process.env.OWNER_ID.trim();
  if (!owner && CHAT) {
    const admins = await call('getChatAdministrators', { chat_id: CHAT });
    const c = admins.find(a => a.status === 'creator');
    if (c) { owner = c.user.id; console.log(`Owner of the packs: the group's creator (${c.user.first_name})`); }
  }
  if (!owner) throw new Error('No owner: set TELEGRAM_CHAT_ID (the group) or type your Telegram user id in the workflow box');
  let stickers = `xcpets_pets_by_${me.username}`, emoji = `xcpets_emoji_by_${me.username}`;
  /* Replace in place (Jake, Nov 24 2026: "cant we just replace them"): when the group already uses a sticker or emoji pack that
     HatchBot made earlier (name ends _by_<bot>), refresh THAT pack with the new pets, so the group keeps its pack and nobody
     has to change a setting. Packs made with @Stickers by a person cannot be changed by a bot; those are left alone. */
  const mine = n => !!n && n.toLowerCase().endsWith('_by_' + me.username.toLowerCase());
  const inPlace = [];
  if (CHAT) {
    try {
      const chat = await call('getChat', { chat_id: CHAT });
      console.log(`Group sticker pack now: ${chat.sticker_set_name || 'none'} | group emoji pack now: ${chat.custom_emoji_sticker_set_name || 'none'}`);
      if (mine(chat.sticker_set_name) && chat.sticker_set_name !== stickers) { stickers = chat.sticker_set_name; inPlace.push('stickers'); }
      if (mine(chat.custom_emoji_sticker_set_name) && chat.custom_emoji_sticker_set_name !== emoji) { emoji = chat.custom_emoji_sticker_set_name; inPlace.push('emoji'); }
      if (chat.sticker_set_name && !mine(chat.sticker_set_name)) console.log('The group sticker pack was not made by HatchBot, so it cannot be refreshed in place.');
      if (chat.custom_emoji_sticker_set_name && !mine(chat.custom_emoji_sticker_set_name)) console.log('The group emoji pack was not made by HatchBot, so it cannot be refreshed in place.');
    } catch (e) { console.log('getChat: ' + e.message); }
  }
  if (inPlace.length) console.log('Refreshing the group\'s own ' + inPlace.join(' and ') + ' pack in place.');
  try {
    await syncPack(owner, stickers, 'XCPETS Pets', 'regular', BY_SPECIES, 'sticker');
    if (inPlace.includes('stickers') && !DRY) { try { await call('setStickerSetTitle', { name: stickers, title: 'XCPETS Pets' }); } catch (e) { console.log('  title: ' + e.message); } }
    const em = await syncPack(owner, emoji, 'XCPETS Emoji', 'custom_emoji', MANIFEST, 'emoji');
    if (inPlace.includes('emoji') && !DRY) { try { await call('setStickerSetTitle', { name: emoji, title: 'XCPETS Emoji' }); } catch (e) { console.log('  title: ' + e.message); } }
    if (em) { try { await call('setCustomEmojiStickerSetThumbnail', { name: emoji, custom_emoji_id: em.stickers[0].custom_emoji_id }); } catch (e) { console.log('  thumbnail: ' + e.message); } }
  } catch (e) {
    if (/PEER_ID_INVALID|USER_ID_INVALID|user not found|bot was blocked/i.test(e.message))
      throw new Error(e.message + '\nThe pack owner must open a private chat with @' + me.username + ' and press Start once, then run this again.');
    throw e;
  }
  const links = `Stickers: https://t.me/addstickers/${stickers}\nEmoji: https://t.me/addemoji/${emoji}`;
  console.log('\n' + links);
  if (CHAT && !DRY) {
    try {
      const chat = await call('getChat', { chat_id: CHAT });
      if (chat.sticker_set_name === stickers) console.log('The group already uses the XCPETS Pets sticker pack.');
      else { await call('setChatStickerSet', { chat_id: CHAT, sticker_set_name: stickers }); console.log('The group sticker pack is now XCPETS Pets.'); }
      console.log('Group emoji pack: ' + (chat.custom_emoji_sticker_set_name || 'none') + (chat.custom_emoji_sticker_set_name === emoji ? ' (XCPETS Emoji, HatchBot can post these emojis in the group)' : ' (the group owner sets this in Telegram)'));
    } catch (e) { console.log('Could not set the group sticker pack: ' + e.message + ' (HatchBot needs to be an admin with "Change group info"; small groups may need boosts)'); }
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### XCPETS Telegram packs\n\n- [XCPETS Pets stickers](https://t.me/addstickers/${stickers})\n- [XCPETS Emoji](https://t.me/addemoji/${emoji})\n`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
