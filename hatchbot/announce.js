#!/usr/bin/env node
/* HatchBot announcer (Nov 22 2026). Runs in GitHub Actions (.github/workflows/hatchbot.yml) every 10 minutes.
 * It replays the game from api/boot.json with this repo's rule scripts, finds the cool things that happened since the
 * last run and posts them to the XCPETS Telegram group. Read-only for the game: it never signs or burns anything.
 *
 *   node hatchbot/announce.js --state FILE            post new events (needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
 *   node hatchbot/announce.js --state FILE --dry      print what it would post, send nothing (--art-out DIR also saves the pictures)
 *   --no-art                                          text only, no pictures
 *   --pics DIR                                        also draw stills of the pets the Cloudflare bot may post about (DIR/p/<id>.png)
 *   node hatchbot/announce.js --post "text"           post one game update (the "Post update" button)
 *   node hatchbot/announce.js --update NAME            post the prepared series hatchbot/updates/NAME.json (text + pet pictures)
 *
 * The first run with no state file records everything that already happened and posts nothing.
 * Posts never contain wallet addresses or prices. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; }, has = k => A.includes(k);
const DRY = has('--dry'), STATE = opt('--state');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '', CHAT = process.env.TELEGRAM_CHAT_ID || '';
const MAX_POSTS = 6; /* per run; anything beyond goes into one roundup post */
const n = x => Number(x).toLocaleString('en-US');
const TL = ['Common', 'Uncommon', 'Rare', 'Legendary'];

/* ---------------------------------------------------------------- XCPETS emoji (Nov 24 2026)
 * Pet names in posts end with their species' emoji ({pepe} tokens). HatchBot's XCPETS Emoji pack (hatchbot/stickers, workflow
 * telegram-packs) replaces the plain emoji with the pet's own pixel emoji wherever Telegram lets a bot use custom emoji: in a group
 * whose emoji pack is XCPETS Emoji, or anywhere once auto-config.json "custom_emoji" is true (bot owner has Telegram Premium). */
const PACK_ALL = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'stickers/pets.json'), 'utf8')).pets; } catch (e) { return []; } })();
const PACK_BY = {}; PACK_ALL.forEach(p => { if (p.look === 'no') PACK_BY[p.species] = p; });
let EMO = null; /* species -> custom_emoji_id when this chat shows HatchBot's custom emoji */
async function loadEmoji() {
  if (EMO || DRY || !TOKEN || !CHAT) return; EMO = {};
  try {
    const get1 = async (m, b) => (await (await fetch('https://api.telegram.org/bot' + TOKEN + '/' + m, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(20e3) })).json()); /* reads only, so a failed one is simply asked again (Nov 27 2026: one network blip turned the pixel emoji off for a whole series) */
    const get = async (m, b) => { for (let i = 0; ; i++) { try { return await get1(m, b); } catch (e) { if (i >= 2) throw e; await new Promise(r => setTimeout(r, 4000 * (i + 1))); } } };
    const me = await get('getMe', {}), name = 'xcpets_emoji_by_' + (me.result && me.result.username);
    let on = false; try { on = JSON.parse(fs.readFileSync(path.join(__dirname, 'auto-config.json'), 'utf8')).custom_emoji === true; } catch (e) {}
    if (!on) { const c = await get('getChat', { chat_id: CHAT }); on = !!(c.ok && c.result.custom_emoji_sticker_set_name === name); }
    if (!on) return;
    const set = await get('getStickerSet', { name });
    if (set.ok) PACK_ALL.forEach((p, i) => { const st = set.result.stickers[i]; if (p.look === 'no' && st && st.custom_emoji_id) EMO[p.species] = st.custom_emoji_id; });
    console.log('XCPETS custom emoji on for ' + Object.keys(EMO).length + ' species');
  } catch (e) { console.log('custom emoji check failed: ' + (e && e.message) + (e && e.cause ? ' ' + (e.cause.code || e.cause.message) : '')); }
}
/** emo(text): {pepe} tokens -> { text, entities } (custom emoji where allowed, the plain emoji otherwise). */
function emo(text) {
  let out = '', last = 0, m; const entities = [], re = /\{([a-z]+)\}/g;
  while ((m = re.exec(text))) { const p = PACK_BY[m[1]]; if (!p) continue; out += text.slice(last, m.index); last = re.lastIndex; const ch = p.emoji[0];
    if (EMO && EMO[m[1]]) entities.push({ type: 'custom_emoji', offset: out.length, length: ch.length, custom_emoji_id: EMO[m[1]] }); out += ch; }
  out += text.slice(last);
  return { text: out, entities: entities.length ? entities : null };
}
const petEmoji = sp => (PACK_BY[sp] ? ' {' + sp + '}' : '');

/* ---------------------------------------------------------------- Telegram */
function clean(t) { return String(t).replace(/\b(bc1|tb1)[a-z0-9]{8,}\b/gi, 'a player').replace(/\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g, 'a player'); }
/* Telegram calls that never got an answer (Nov 27 2026: update 1/4 of nov27-whats-new was lost). Node's fetch throws a TypeError
   ("fetch failed") with the reason in e.cause. When the connection was never made (DNS, refused, connect timeout, unreachable)
   Telegram never saw the request, so it is safe to wait and send again. Anything else (a reset or timeout after the upload)
   may have posted, so it is not resent (no double posts), but it is counted as a failure so the run goes red and a person checks. */
const NOT_SENT = /^(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT_TIMEOUT|UND_ERR_DNS)$/;
function neverSent(e) { const c = e && e.cause; return !!(c && (NOT_SENT.test(c.code || '') || (c.errors || []).some(x => NOT_SENT.test(x && x.code || '')))); }
function whyNot(e) { const c = e && e.cause; return (e && (e.name || e.message)) + (c ? ' ' + (c.code || c.message || '') : ''); }
let UNSURE = 0; /* posts that may or may not have landed: the run ends red so someone looks in the group */
/** tgFetch(method, opts): the fetch, with up to 4 resends when the request never left. Returns the response, or null when it is unknown whether it posted. */
async function tgFetch(method, mk) {
  for (let i = 0; ; i++) {
    try { return await fetch('https://api.telegram.org/bot' + TOKEN + '/' + method, mk()); }
    catch (e) {
      if (neverSent(e) && i < 4) { console.log('telegram ' + method + ' not sent (' + whyNot(e) + '): trying again in ' + (5 * (i + 1)) + ' s'); await new Promise(r => setTimeout(r, 5000 * (i + 1))); continue; }
      UNSURE++; console.log('::warning::telegram ' + method + ' no answer (' + whyNot(e) + '): it may have posted, so it is not sent again. Check the group.'); return null;
    }
  }
}
async function tg(method, body) {
  if (body.text) { const e = emo(body.text); body = Object.assign({}, body, { text: e.text }, e.entities ? { entities: e.entities } : {}); }
  if (DRY || !TOKEN || !CHAT) { console.log('--- ' + method + (DRY ? ' (dry)' : ' (no token/chat)') + '\n' + (body.text || body.caption || '')); return true; }
  for (let i = 0; i < 3; i++) {
    const r = await tgFetch(method, () => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ chat_id: CHAT }, body)), signal: AbortSignal.timeout(60e3) }));
    if (!r) return 'unsure';
    if (r.ok) return true;
    const j = await r.json().catch(() => ({}));
    if (r.status === 429 && j.parameters && j.parameters.retry_after) { await new Promise(res => setTimeout(res, (j.parameters.retry_after + 1) * 1000)); continue; }
    console.log('telegram ' + method + ' failed ' + r.status + ' ' + (j.description || '')); return false;
  }
  return false;
}
const say = text => tg('sendMessage', { text: clean(text), disable_web_page_preview: true });
/* Posts with a picture (Nov 23 2026): the pet drawn by the site's own renderer, as a short GIF for big moments (hatchbot/art.js).
 * A file upload (multipart), so Telegram never fetches anything from us. Any drawing or upload problem falls back to the plain text post. */
const ART_OUT = opt('--art-out'), NO_ART = has('--no-art');
/* Drawing GIFs is slow; past this point in a run, posts go out as text so the run finishes well inside the workflow's 15 minutes. */
const T_START = Date.now(), ART_BUDGET_MS = 7 * 60e3;
/* formBody(fields, field, file, name): a multipart body built by hand. Not FormData (Nov 26 2026): FormData turns every \n in a
   text field into \r\n, so each line break before a custom-emoji entity shifted its offset by one and Telegram refused the
   caption ("entity ... ends in a middle of a UTF-16 symbol"): the Legendary Mix picture fell back to plain text. */
function formBody(fields, field, file, name) {
  const b = '----xcpets' + Date.now().toString(36) + Math.random().toString(36).slice(2), parts = [];
  for (const k of Object.keys(fields)) parts.push(Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + String(fields[k]) + '\r\n', 'utf8'));
  parts.push(Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="' + field + '"; filename="' + String(name).replace(/["\r\n]/g, '') + '"\r\nContent-Type: application/octet-stream\r\n\r\n', 'utf8'), Buffer.from(file), Buffer.from('\r\n--' + b + '--\r\n', 'utf8'));
  return { body: Buffer.concat(parts), type: 'multipart/form-data; boundary=' + b };
}
async function tgFile(method, field, file, name, caption) {
  const ce = emo(caption); caption = ce.text;
  if (DRY || !TOKEN || !CHAT) { if (ART_OUT) { fs.mkdirSync(ART_OUT, { recursive: true }); const f = path.join(ART_OUT, String(++tgFile.n).padStart(2, '0') + '-' + name); fs.writeFileSync(f, file); console.log('--- ' + method + ' ' + f); } else console.log('--- ' + method + ' (' + file.length + ' bytes)'); console.log(caption); return true; }
  for (let i = 0; i < 3; i++) {
    const fb = formBody(Object.assign({ chat_id: CHAT, caption }, ce.entities ? { caption_entities: JSON.stringify(ce.entities) } : {}), field, file, name);
    const r = await tgFetch(method, () => ({ method: 'POST', headers: { 'content-type': fb.type }, body: fb.body, signal: AbortSignal.timeout(120e3) }));
    if (!r) return 'unsure';
    if (r.ok) return true;
    const j = await r.json().catch(() => ({}));
    if (r.status === 429 && j.parameters && j.parameters.retry_after) { await new Promise(res => setTimeout(res, (j.parameters.retry_after + 1) * 1000)); continue; }
    console.log('telegram ' + method + ' failed ' + r.status + ' ' + (j.description || '')); return false;
  }
  return false;
}
tgFile.n = 0;
async function post(ev, ctx, w) {
  const text = clean(ev.text);
  if (ev.art && ctx && !NO_ART && text.length <= 1000 && Date.now() - T_START < ART_BUDGET_MS) {
    let a = null; try { a = require('./art.js').event(ctx, w, ev.art); } catch (e) { console.log('art skipped for ' + ev.key + ': ' + (e && e.message)); }
    if (a) { const ok = a.type === 'photo' ? await tgFile('sendPhoto', 'photo', a.file, a.name, text) : await tgFile('sendAnimation', 'animation', a.file, a.name, text); if (ok) return true; }
  }
  return say(text);
}

/* ---------------------------------------------------------------- replay */
function engine() {
  const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of SCRIPTS) {
    if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; }
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
function replay() {
  const ctx = engine(), V = ctx.V2Rules, boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
  const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
  const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {});
  const w = V.replay(rows, hashes, [], { tip: boot.tip, live: ctx.LiveEngine.RealCore, dex: boot.dex });
  return { V, w, tip: boot.tip, ctx };
}

/* ---------------------------------------------------------------- events */
function petName(w, id, V) { const p = w.byId[id]; if (!p) return '#' + id;
  let sp = p.species; try { sp = (V.petSpeciesLabel ? V.petSpeciesLabel(p) : V.speciesLabel(p.species)); } catch (e) {}
  return (p.name || 'Pet') + ' #' + id + (sp ? ' the ' + sp : '') + petEmoji(p.species); }
const link = id => 'xcpets.fun/pet.html?id=' + id;
const isMythic = p => !!p && (p.mythicCare || p.stage >= 5);

/* Community pet hand-off posts (Nov 24 2026): the log kind each community pet's Cold Storage writes (V2Rules COMMUNITY_HANDOFF), and the line for the pet that takes over. */
const COLD_POST = { homercold: { id: 'homer', name: 'Homer Pepe', emoji: '🍩', eggs: 'Homer Pepe', banner: 'HOMER PEPE IS MYTHIC' },
  rabbitcold: { id: 'rabbit', name: 'The White Rabbit', emoji: '🐇⌚', eggs: 'White Rabbit', banner: 'WHITE RABBIT IS MYTHIC' },
  groypcold: { id: 'groyper', name: 'Groyper', emoji: '🐸', eggs: 'Groyper', banner: 'GROYPER IS MYTHIC' } };
const COLD_POST_NEXT = { rabbit: '🐇 The White Rabbit is the new community pet. Every burn feeds him!', groyper: '🐸 GROYPER floats in on a lily pad: he is community pet #7. Every burn feeds him. Comfy.' };
/* Every event has a stable key, the block it happened at and its text. Old keys are never posted twice. */
function collect(V, w, tip, from) {
  const out = [], add = (key, at, text, prio, art) => out.push({ key, at, text, prio: prio || 1, art: art || null });
  /* 1) log lines worth a post */
  (w.log || []).forEach(x => { if (!x || x.block <= from) return; const m = String(x.msg || ''), id = (m.match(/#(\d+)/) || [])[1], k = x.kind + '-' + (x.tx || '') + '-' + x.block + '-' + (id || '');
    if (x.kind === 'raise') add(k, x.block, "🧟 IT'S ALIVE!! " + petName(w, +id, V) + ' just CLAWED its way out of the grave' + ((m.match(/\(([\d.]+) times/) || [])[1] ? ' at ' + m.match(/\(([\d.]+) times/)[1] + ' times its death power' : '') + '. The swamp has a new zombie. Guard your Mythics. 💀\n' + link(id), 3, { kind: 'rise', id: +id, mythic: /Mythic zombie/.test(m) });
    else if (x.kind === 'resurrect') { /* the rules log a failed try under the same kind ("...turned to dust forever"), so read the outcome */
      if (/failed|dust/i.test(m)) add(k, x.block, '💨 NOOOO! ' + petName(w, +id, V) + ' almost came back... but the resurrection FAILED. Dust forever. Press F. 🪦\n' + link(id), 3, { kind: 'dust', id: +id });
      else if (/ALIVE again/.test(m)) add(k, x.block, '😇 MIRACLE IN THE SWAMP! ' + petName(w, +id, V) + ' is ALIVE again, halo and all! Death was just a phase. ✨\n' + link(id), 4, { kind: 'miracle', id: +id }); }
    else if (x.kind === 'unleash') add(k, x.block, '🩸 UNLEASHED! Zombie ' + petName(w, +id, V) + ' is STARVING and off the leash. In 6 blocks it eats one of its owner\'s Mythics... RUN. 🏃💨\n' + link(id), 4, { kind: 'rage', id: +id });
    else if (x.kind === 'mgmeal') { const ids = (m.match(/#(\d+)/g) || []).map(s => +s.slice(1)); add(k, x.block, '💜 OM NOM NOM. Zombie ' + petName(w, ids[0], V) + ' just DEVOURED the Mythic ' + petName(w, ids[1], V) + '! The zombie is cured forever, and the Mythic rests in a Mythic grave, waiting for a seance... 👻\n' + link(ids[1]), 5, { kind: 'devour', ids: ids.slice(0, 2) }); }
    else if (x.kind === 'hunt' && /won|defeated|beat/i.test(m)) add(k, x.block, '⚔️ ZOMBIE HUNT! ' + clean(m).slice(0, 200) + ' 🎯', 2, { kind: 'banner', top: 'ZOMBIE HUNT!', bottom: 'THE HUNTER WINS', color: 'green' });
    else if (x.kind === 'breed') { const egg = (m.match(/Egg #(\d+)/) || [])[1]; const ids = (m.match(/#(\d+)/g) || []).map(s => +s.slice(1));
      const big = ids.slice(0, 2).some(i => w.byId[i] && ((w.byId[i].tier | 0) >= 3 || isMythic(w.byId[i])));
      if (big) { add(k, x.block, '', 2); out[out.length - 1].motel = { ids: ids.slice(0, 2), egg: egg ? +egg : null }; } } /* held for the Motel roundup (motelRoundup) */
    else if (COLD_POST[x.kind]) { const P = COLD_POST[x.kind], tot0 = (m.match(/\((\d+) burned\)/) || [])[1], tot = tot0 && Number(tot0).toLocaleString('en-US'), cur = w.community && w.community.current, nx = cur && cur !== P.id && COLD_POST_NEXT[cur]; /* community pet -> Cold Storage (Nov 24 2026: the hand-off used to post nothing) */
      add(k, x.block, '🧊 MYTHIC! ' + P.name + ' just hit Mythic' + (tot ? ' with ' + tot + ' XCPETS burned by the community' : '') + ' and went into COLD STORAGE. ' + P.emoji + '\n🥚 ' + P.eggs + ' eggs now hatch (1 in 777) and can breed.\n✂️ Burn costs halve 6 blocks from now.' + (nx ? '\n' + nx : '') + '\nxcpets.fun', 5, { kind: 'banner', top: 'COLD STORAGE!', bottom: P.banner, color: 'cyan' }); }
    else if (x.kind === 'grant' && /^XCPETS:raisers:/.test(x.tx || '')) add(k, x.block, '🎁 RAISER PRIZES! ' + clean(m) + '. Check your gear! 🎉\nxcpets.fun', 4, { kind: 'banner', top: 'RAISER PRIZES!', bottom: 'THANKS FOR FEEDING HIM', color: 'gold' });
    else if (x.kind === 'crumble' && x.gone) { let sp = x.species || ''; try { sp = V.speciesLabel(x.species); } catch (e) {} /* the pet left the world (crumble = gone forever), so its name comes from the log line */
      add(k, x.block, '💨 GONE FOREVER. Zombie ' + (x.name || 'Pet') + ' #' + x.petId + (sp ? ' the ' + sp : '') + petEmoji(x.species) + ' went unfed and crumbled to dust. No grave. No seance. No coming back. Feed your zombies! Press F. 🪦', 3); }
    else if (x.kind === 'mzfull') add(k, x.block, '💀 FULL POWER! ' + petName(w, +id, V) + ' just maxed out its zombie power. Nobody is safe. 🧟\n' + link(id), 3, { kind: 'rage', id: +id, color: 'green' });
  });
  /* 2a) mutants (weird-looks-1128): about 1 in 100 breeds (1 in 5 for a Jackpot Egg), only 5 in the whole game by Nov 28 2026, so every one posts (prio 4).
     Twins that both mutate post once. */
  (w.pets || []).forEach(p => { if (!p || !p.mutation || !(p.hatchBlock > from) || p.hatchBlock > tip || p.dead || p.released) return; const tw = p.twinOf != null && w.byId[p.twinOf];
    if (tw && tw.mutation && tw.id < p.id) return; let lab = p.mutation.kind === 'glitch' ? 'Glitch mutation' : 'mutation'; try { if (V.mutationLabel) lab = V.mutationLabel(p.mutation); } catch (e) {}
    const both = tw && tw.mutation, odds = p.jackpot ? 'a Jackpot Egg (1 in 5)' : 'a breed (about 1 in 100)';
    add('mutant-' + p.id, p.hatchBlock, '🧬 MUTATION!! ' + petName(w, p.id, V) + (both ? ' and its twin ' + petName(w, tw.id, V) + ' both' : '') + ' hatched with a ' + lab.replace(/^\w/, c => c.toLowerCase()) + ' out of ' + odds + '. ' + (p.mutation.kind === 'glitch' ? 'The pixels are BROKEN and it loves it. 👾' : 'A colour no other pet has. 🎨') + '\n' + link(p.id), 4, { kind: 'hatch', id: p.id }); });
  /* 2) Legendary hatches: no posts since Nov 25 2026 (Jake: "Legendary haul can go"). Legendaries are common now (4,566 of the
     57,185 pets born on Nov 24 2026), so they were a third of HatchBot's ~90 posts a day. Season legends below still post. */
  /* 2b) raids: boss appears, HP milestones (50%, 25%, 10%), defeated or escaped */
  (w.raids || []).forEach(R => { const B = V.raidBossById ? V.raidBossById(R.boss) : null, nm = B ? B.name : 'The boss', url = '\nxcpets.fun/raid.html', f = n => Number(n).toLocaleString('en-US'), art = B && B.art, ra = o => Object.assign({ kind: 'raid', art, bottom: nm }, o);
    if (R.open > from && R.open <= tip) add('raid-open-' + R.n, R.open, '👹 RAID BOSS INCOMING! ' + nm + ' has appeared with ' + f(R.hp) + ' HP! You have 3 days to take it down.' + (R.v2 ? ' Every feed, breed and hatch hits it too.' : '') + ' ALL HANDS! ⚔️' + url, 4, ra({ phase: 'open', bottom: nm + ': ' + f(R.hp) + ' HP' }));
    const live = R.killBlock == null && tip <= R.end, pct = R.hp ? R.left / R.hp * 100 : 100;
    if (live) [50, 25, 10].forEach(m => { if (pct <= m) add('raid-hp-' + R.n + '-' + m, tip, (m === 10 ? '🩸 FINISH HIM! ' : m === 25 ? '🔥 IT\'S BLEEDING! ' : '⚔️ HALFWAY THERE! ') + nm + ' is down to ' + Math.max(1, Math.ceil(pct)) + '% HP (' + f(R.left) + ' left). ' + f(R.end - tip + 1) + ' blocks to finish it!' + url, m === 10 ? 4 : 3, ra({ phase: 'hit', pct: pct / 100, bottom: Math.max(1, Math.ceil(pct)) + '% HP LEFT' })); });
    if (R.killBlock != null && R.killBlock > from) { const who = R.killPet != null ? petName(w, R.killPet, V) : 'a community burn'; add('raid-kill-' + R.n, R.killBlock, '💥💥 ' + nm + ' IS DEFEATED!! The killing blow came from ' + who + '! GG swamp. 🏆 Rewards count in 6 blocks.' + url, 5, ra({ phase: 'kill' })); }
    if (R.result === 'escaped' && R.decided != null && R.decided > from && (R.order.length || R.chipTotal)) add('raid-esc-' + R.n, R.decided, '💨 NOOO! ' + nm + ' escaped with ' + f(R.left) + ' HP left. It will be back... Next boss in a few days. 👀' + url, 2, ra({ phase: 'escape', pct: R.hp ? R.left / R.hp : 0.2 })); });
  /* 2c) seasons: legend pulls, egg supply milestones, the season result */
  Object.values(w.seasons || {}).forEach(Z => { const sup = V.SEASON ? V.SEASON.SUPPLY : 690, url = '\nxcpets.fun';
    (Z.legends || []).forEach(id => { const p = w.byId[id]; if (p && p.hatchBlock > from) add('season-legend-' + id, p.hatchBlock, '👑 SEASON LEGEND!! ' + petName(w, id, V) + ' hatched from a Season ' + Z.n + ' egg. That is a 1 in ' + (V.SEASON ? V.SEASON.LEGEND_ODDS : 690) + ' pull! 🤯\n' + link(id), 5, { kind: 'hatch', id, top: 'SEASON LEGEND!' }); });
    if (!Z.settled) [[sup / 2, '50'], [sup * 3 / 4, '75'], [sup - 10, 'last10'], [sup, 'soldout']].forEach(([n, k]) => { if (Z.sold >= n) add('season-supply-' + Z.n + '-' + k, tip, k === 'soldout' ? '🚨 SOLD OUT!! All ' + sup + ' Season ' + Z.n + ' eggs are GONE. Breeding is the only way to get the trait now. 🥚🔒' + url : k === 'last10' ? '⏳ LAST CALL! Only ' + (sup - Z.sold) + ' Season ' + Z.n + ' eggs left! Grab one before they are gone forever. 🏃' + url : '🥚 GOING FAST! ' + (sup - Z.sold) + ' of ' + sup + ' Season ' + Z.n + ' eggs left. 🔥' + url, k === 'soldout' ? 5 : 3,
      { kind: 'banner', top: k === 'soldout' ? 'SOLD OUT!' : k === 'last10' ? 'LAST CALL!' : 'GOING FAST!', bottom: k === 'soldout' ? 'ALL ' + sup + ' SEASON ' + Z.n + ' EGGS ARE GONE' : (sup - Z.sold) + ' SEASON ' + Z.n + ' EGGS LEFT', color: k === 'soldout' ? 'red' : 'gold' }); });
    if (Z.settled && Z.decided > from) { const ch = (Z.champions || []).map((a, i) => ['🥇', '🥈', '🥉'][i] + ' ' + clean(a) + ' (' + Z.pts[a] + ' pts)').join('  '); add('season-end-' + Z.n, Z.decided, '🏆🏆 SEASON ' + Z.n + ' IS OVER! ' + Object.keys(Z.tiers || {}).length + ' players reached a reward tier, ' + Z.sold + ' season eggs hatched.' + (ch ? '\nChampions: ' + ch : '') + ' GG! 🎉' + url, 5, { kind: 'banner', top: 'SEASON ' + Z.n + ' OVER!', bottom: 'ALL HAIL THE CHAMPIONS', color: 'gold' }); } });
  /* 3) the existing HatchBot hooks: halvings + fire sales, Legendary/Mythic gifts and swaps, Pantheon seats */
  try { require(path.join(ROOT, 'tools/hatchbot-warnings.js')).events(w, tip, V).forEach(e => add(e.id, tip, e.text, 5, /fire/.test(e.kind || '') ? { kind: 'banner', top: 'FIRE SALE!', bottom: 'XCPETS.FUN', color: 'orange' } : { kind: 'banner', top: 'HALVING!', bottom: 'EVERY BURN COSTS HALF', color: 'gold' })); } catch (e) { console.log('warnings hook skipped: ' + e.message); }
  try { require(path.join(ROOT, 'tools/hatchbot-gifts.js')).messages(w).forEach(e => { if (e.at > from) add(e.key, e.at, e.text, 2, /^swap/.test(e.key) ? { kind: 'banner', top: 'PET SWAP!', bottom: 'A DEAL WAS STRUCK', color: 'cyan' } : { kind: 'banner', top: 'GIFTED!', bottom: 'A PET FOUND A NEW KEEPER', color: 'pink' }); }); } catch (e) { console.log('gifts hook skipped: ' + e.message); }
  try { require(path.join(ROOT, 'tools/hatchbot-pantheon.js')).messages(w).forEach(e => add(e.key, e.at, e.text, 5, { kind: 'banner', top: 'PANTHEON!', bottom: 'A NEW GOD TAKES A SEAT', color: 'purple' })); } catch (e) { console.log('pantheon hook skipped: ' + e.message); }
  return out;
}
/* Mythics are found by comparing the list with the last run (a pet can reach Mythic without a log line). */
function newMythics(V, w, st) { const now = w.pets.filter(p => p && isMythic(p) && !p.dead && !p.community).map(p => p.id);
  const old = new Set(st.mythics || []), fresh = st.mythics ? now.filter(id => !old.has(id)) : [];
  st.mythics = now; return fresh.map(id => ({ key: 'mythic-' + id, at: w.tip, prio: 5, text: '👑 A NEW MYTHIC HAS RISEN! ' + petName(w, id, V) + ' just hit Mythic. Bow down. 🙇\n' + link(id), art: { kind: 'shine', id, halo: false } })); }


/* ---------------------------------------------------------------- pet pictures for the Cloudflare bot (Nov 23 2026)
 * The Worker (hatchbot/auto.js) cannot draw pets, and t/<id>.png only exists for tokenized pets, so Pet of the Day,
 * breeding news, milestones, battles and the recap went out as text. Each run draws a still of every pet the Worker
 * may post about into DIR/p/<id>.png; the workflow publishes DIR on the hatchbot-art branch (never main). */
function drawPics(w, ctx, tip, dir) {
  const t0 = Date.now(), art = require('./art.js'), out = path.join(dir, 'p'); fs.mkdirSync(out, { recursive: true });
  let rows = []; try { rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/pets.json'), 'utf8')).pets || []; } catch (e) { console.log('pics: no pets.json: ' + e.message); }
  const want = new Map(), addId = (id, why) => { id = +id; if (id > 0 && !want.has(id)) want.set(id, why); };
  const alive = rows.filter(r => !r[10] && r[4] != null && (r[8] === 0 || r[0] === 1765)).sort((a, b) => b[4] - a[4] || a[0] - b[0]);
  alive.slice(0, 60).forEach(r => addId(r[0], 'top'));                                   /* Pet of the Day pool + weekly top 5 */
  const recent = rows.filter(r => r[18] > tip - 300);
  recent.filter(r => r[13] || (r[3] | 0) >= 3 || r[0] % 10000 === 0).forEach(r => addId(r[0], 'new'));   /* bred/hybrid eggs, Legendaries, milestone pets */
  recent.slice().sort((a, b) => (b[3] | 0) - (a[3] | 0) || (b[4] || 0) - (a[4] || 0)).slice(0, 20).forEach(r => addId(r[0], 'rare')); /* recap: rarest newborns */
  Object.keys(w.everMythic || {}).forEach(id => { if (+w.everMythic[id] > tip - 300) addId(id, 'mythic'); });
  (w.fights || []).forEach(f => { if (f && f.winner != null && (f.acceptBlock || f.block) > tip - 160) { addId(f.winner, 'fight'); addId(f.loser, 'fight'); } });
  let n = 0, bad = 0;
  for (const [id] of want) {
    if (Date.now() - t0 > 4 * 60e3) { console.log('pics: time is up, ' + (want.size - n - bad) + ' left for the next run'); break; }
    try {
      const p = w.byId[id]; if (!p || !p.art) { bad++; continue; }
      art.load(ctx); const S = art.spriteSet(ctx, w, p, (p.stage | 0) === 0 ? { stage: 0 } : null); if (!S || !S.length) { bad++; continue; }
      const nm = String(p.name || 'PET').toUpperCase().slice(0, 14) + ' #' + id;
      fs.writeFileSync(path.join(out, id + '.png'), art.png(art._scenes.lineup([S], { top: nm }), 4)); n++;
    } catch (e) { bad++; }
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ tip, at: new Date().toISOString(), ids: Array.from(want.keys()) }));
  console.log('pics: drew ' + n + ' pet pictures (' + bad + ' skipped) in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}
/* ---------------------------------------------------------------- quieter HatchBot (Nov 25 2026, Jake: "HatchBot is posting too many things")
 * On Nov 24 2026 HatchBot posted about 90 times: ~30 Legendary hatches, ~30 "IT'S A MATCH!" (nearly every breed has a Mythic
 * parent, so every breed was "big"), plus the Worker's own posts. Now:
 *  - breeding: one Motel roundup at most every MOTEL_BLOCKS blocks (~6 h), with the breed GIF and the new hybrids' names;
 *  - small news (prio below BIG): at most CAP_DAY a day and CAP_HOUR an hour; the rest is skipped (never posted later);
 *  - big moments (prio BIG and up: Mythics, Cold Storage, halvings, Fire Sales, raid boss in/killed, season legends, Pantheon,
 *    miracles, unleashed zombies, Mythics devoured) always post right away. */
const MOTEL_BLOCKS = 36, CAP_DAY = 8, CAP_HOUR = 3, BIG = 4;
const isHybrid = p => !!p && /^hyb/.test(String(p.species || ''));
function motelRoundup(ev, S, w, V, tip, seen) {
  const mo = ev.filter(e => e.motel), rest = ev.filter(e => !e.motel);
  S.motel = S.motel || [];
  mo.forEach(e => { seen.add(e.key); if (!S.motel.some(x => x.key === e.key)) S.motel.push({ key: e.key, at: e.at, ids: e.motel.ids, egg: e.motel.egg }); });
  if (S.motel.length > 400) S.motel = S.motel.slice(-400);
  if (S.motelAt == null) S.motelAt = tip;
  if (!S.motel.length || tip - S.motelAt < MOTEL_BLOCKS) return rest;
  const q = S.motel, hy = q.filter(x => x.egg && isHybrid(w.byId[x.egg])), star = hy[0] || q[q.length - 1];
  S.motel = []; S.motelAt = tip;
  const art = { kind: 'breed', ids: star.ids, egg: star.egg };
  let text;
  if (q.length === 1) text = "💘 IT'S A MATCH! " + petName(w, star.ids[0], V) + ' and ' + petName(w, star.ids[1], V) + " checked into Gooby's Motel and made an egg" + (star.egg ? ' (#' + star.egg + ')' : '') + '! 🥚 Big genes incoming.' + (star.egg ? '\n' + link(star.egg) : '');
  else text = "💘 MOTEL ROUNDUP! " + q.length + " couples checked into Gooby's No-Tail Motel and made eggs. 🥚\n🔥 Hottest match: " + petName(w, star.ids[0], V) + ' + ' + petName(w, star.ids[1], V) +
    (hy.length ? '\n🧬 New hybrid' + (hy.length > 1 ? 's' : '') + ': ' + hy.slice(0, 5).map(x => petName(w, x.egg, V)).join(', ') + (hy.length > 5 ? ' and ' + (hy.length - 5) + ' more' : '') : '') +
    '\nBig genes incoming. xcpets.fun';
  rest.push({ key: 'motel-' + tip, at: tip, prio: 2, text, art, capFree: true });
  return rest;
}
function capSmall(ev, S, seen, nowMs) {
  S.cap = (S.cap || []).filter(t => nowMs - t < 864e5);
  const out = [], skipped = [];
  for (const e of ev) {
    if (e.prio >= BIG) { out.push(e); continue; }
    const hour = S.cap.filter(t => nowMs - t < 36e5).length;
    if (e.capFree || (S.cap.length < CAP_DAY && hour < CAP_HOUR)) { out.push(e); S.cap.push(nowMs); }
    else { seen.add(e.key); skipped.push(e.key); }
  }
  if (skipped.length) console.log('quiet limits: skipped ' + skipped.length + ' small posts (' + skipped.slice(0, 5).join(', ') + ')');
  return out;
}
/* ---------------------------------------------------------------- main */
async function main() {
  await loadEmoji();
  if (opt('--update') != null) { /* a prepared update series (hatchbot/updates/<name>.json): { posts: [{ text, art? }] }, posted in order with its pictures */
    const f = path.resolve(ROOT, 'hatchbot/updates', path.basename(opt('--update')).replace(/\.json$/, '') + '.json');
    const U = JSON.parse(fs.readFileSync(f, 'utf8')), posts = (U.posts || []).filter(x => x && x.text);
    if (!posts.length) throw new Error('no posts in ' + f);
    if (!DRY && posts.some(x => /\{[A-Z_]+\}/.test(x.text))) throw new Error('unfilled placeholder in ' + f + ' (e.g. {OPEN}): fill it in before posting');
    const needArt = !NO_ART && posts.some(x => x.art), R = needArt ? replay() : null; let bad = 0;
    for (const [i, x] of posts.entries()) { const u0 = UNSURE, ok = await post({ key: 'update', text: x.text, art: x.art || null }, R && R.ctx, R && R.w); if (!ok && !DRY) bad++;
      console.log('post ' + (i + 1) + '/' + posts.length + ': ' + (!ok ? 'FAILED' : UNSURE > u0 ? 'UNSURE (check the group)' : 'sent')); await new Promise(r => setTimeout(r, 2500)); }
    process.exit(bad || UNSURE ? 1 : 0); }
  if (opt('--post') != null) { const t = opt('--post').trim(); if (!t) throw new Error('empty update'); const ok = await tg('sendMessage', { text: '📣 XCPETS update\n\n' + t, disable_web_page_preview: true }); process.exit(ok && !UNSURE ? 0 : 1); }
  if (!STATE) throw new Error('--state FILE is required');
  const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : null, first = !st, S = st || { v: 1, posted: [] };
  const t0 = Date.now(), { V, w, tip, ctx } = replay(); console.log('replayed to block ' + tip + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  const PICS = opt('--pics'), pics = () => { if (PICS) try { drawPics(w, ctx, tip, PICS); } catch (e) { console.log('pics failed: ' + (e && e.message)); } };
  if (S.tip && tip <= S.tip) { console.log('no new blocks since ' + S.tip); pics(); return; }
  const from = S.tip || tip, seen = new Set(S.posted || []);
  let ev = collect(V, w, tip, first ? tip : from).concat(newMythics(V, w, S)).filter(e => !seen.has(e.key));
  if (first) { /* baseline: remember what already happened, post nothing */
    collect(V, w, tip, 0).forEach(e => seen.add(e.key)); ev = [];
    console.log('first run: baseline recorded, nothing posted');
  }
  ev.sort((a, b) => a.at - b.at || b.prio - a.prio);
  if (!first) ev = capSmall(motelRoundup(ev, S, w, V, tip, seen), S, seen, Date.now());
  let posts = ev;
  if (ev.length > MAX_POSTS) { const keep = ev.slice().sort((a, b) => b.prio - a.prio).slice(0, MAX_POSTS - 1), rest = ev.filter(e => keep.indexOf(e) < 0);
    posts = keep.sort((a, b) => a.at - b.at).concat([{ key: 'roundup-' + tip, at: tip, text: '📜 Also in the last few blocks: ' + rest.length + ' more cool moments. See them all at xcpets.fun/live.html', keys: rest.map(e => e.key) }]); }
  /* Each event posts at most once (Nov 23 2026 double posts): it is written to memory BEFORE it is sent, and memory is
     saved after every post, so a run that crashes, hangs or is cancelled halfway never posts the same thing again. */
  const save = () => { S.posted = Array.from(seen).slice(-5000); S.at = new Date().toISOString(); if (!DRY) fs.writeFileSync(STATE, JSON.stringify(S)); };
  const sent = new Set();
  /* FOMO (Nov 24 2026, hatchbot/fomo.mjs): one true urgency line under each event post (community pet % to Mythic and raiser
     prizes, the next feature gate, pets hatched so far). Off with auto-config.json "fomo": false. Never on hand-written update series. */
  let fomoOn = true; try { fomoOn = JSON.parse(fs.readFileSync(path.join(__dirname, 'auto-config.json'), 'utf8')).fomo !== false; } catch (e) {}
  if (fomoOn) try { const F = await import('./fomo.mjs'), c = w.community || {}, cur = c.current || null;
    const s = { tip, cm: cur ? { current: cur, fed: +(c[cur + 'Fed'] || 0) } : null, hatched: w.pets.reduce((m, p) => (p && p.id > m ? p.id : m), 0) };
    posts.forEach(p => { p.text = F.add(p.text, s, p.key, 1000); }); } catch (e) { console.log('fomo skipped: ' + (e && e.message)); }
  for (const p of posts) {
    if (seen.has(p.key) || sent.has(p.text)) continue;
    seen.add(p.key); (p.keys || []).forEach(k => seen.add(k)); sent.add(p.text); save();
    await post(p, ctx, w); await new Promise(r => setTimeout(r, 1200));
  }
  S.tip = tip; save();
  pics();
  console.log('posted ' + posts.length + ' (block ' + from + ' -> ' + tip + ')');
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
else module.exports = { collect, replay, motelRoundup, capSmall, formBody, emo, tg, tgFile, unsure: () => UNSURE }; /* for tools/hatchbot-quiet-test.js, hatchbot-caption-test.js, hatchbot-send-retry-test.js */
