#!/usr/bin/env node
/* HatchBot announcer (Nov 22 2026). Runs in GitHub Actions (.github/workflows/hatchbot.yml) every 10 minutes.
 * It replays the game from api/boot.json with this repo's rule scripts, finds the cool things that happened since the
 * last run and posts them to the XCPETS Telegram group. Read-only for the game: it never signs or burns anything.
 *
 *   node hatchbot/announce.js --state FILE            post new events (needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
 *   node hatchbot/announce.js --state FILE --dry      print what it would post, send nothing (--art-out DIR also saves the pictures)
 *   --no-art                                          text only, no pictures
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
const MAX_POSTS = 8; /* per run; anything beyond goes into one roundup post */
const n = x => Number(x).toLocaleString('en-US');
const TL = ['Common', 'Uncommon', 'Rare', 'Legendary'];

/* ---------------------------------------------------------------- Telegram */
function clean(t) { return String(t).replace(/\b(bc1|tb1)[a-z0-9]{8,}\b/gi, 'a player').replace(/\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g, 'a player'); }
async function tg(method, body) {
  if (DRY || !TOKEN || !CHAT) { console.log('--- ' + method + (DRY ? ' (dry)' : ' (no token/chat)') + '\n' + (body.text || body.caption || '')); return true; }
  for (let i = 0; i < 3; i++) {
    const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ chat_id: CHAT }, body)) });
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
async function tgFile(method, field, file, name, caption) {
  if (DRY || !TOKEN || !CHAT) { if (ART_OUT) { fs.mkdirSync(ART_OUT, { recursive: true }); const f = path.join(ART_OUT, String(++tgFile.n).padStart(2, '0') + '-' + name); fs.writeFileSync(f, file); console.log('--- ' + method + ' ' + f); } else console.log('--- ' + method + ' (' + file.length + ' bytes)'); console.log(caption); return true; }
  for (let i = 0; i < 3; i++) {
    const fd = new FormData(); fd.append('chat_id', CHAT); fd.append('caption', caption); fd.append(field, new Blob([file]), name);
    const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/' + method, { method: 'POST', body: fd });
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
  if (ev.art && ctx && !NO_ART && text.length <= 1000) {
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
  let sp = p.species; try { sp = V.speciesLabel(p.species); } catch (e) {}
  return (p.name || 'Pet') + ' #' + id + (sp ? ' the ' + sp : ''); }
const link = id => 'xcpets.fun/pet.html?id=' + id;
const isMythic = p => !!p && (p.mythicCare || p.stage >= 5);

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
      if (big) add(k, x.block, "💘 IT'S A MATCH! " + petName(w, ids[0], V) + ' and ' + petName(w, ids[1], V) + " checked into Gooby's Motel and made an egg" + (egg ? ' (#' + egg + ')' : '') + '! 🥚 Big genes incoming.' + (egg ? '\n' + link(egg) : ''), 2, { kind: 'breed', ids: ids.slice(0, 2), egg: egg ? +egg : null }); }
    else if (x.kind === 'mzfull') add(k, x.block, '💀 FULL POWER! ' + petName(w, +id, V) + ' just maxed out its zombie power. Nobody is safe. 🧟\n' + link(id), 3, { kind: 'rage', id: +id, color: 'green' });
  });
  /* 2) Legendary hatches (one post per pet, or one roundup when a big egg case drops several) */
  const leg = w.pets.filter(p => p && p.hatchBlock > from && p.hatchBlock <= tip && (p.tier | 0) >= 3 && !p.community);
  if (leg.length > 3) add('hatch-leg-' + leg.map(p => p.id).join('.').slice(0, 120), leg[0].hatchBlock, '🌟🌟🌟 LEGENDARY HAUL! ' + leg.length + ' Legendary pets just hatched: ' + leg.slice(0, 10).map(p => petName(w, p.id, V)).join(', ') + (leg.length > 10 ? ' and more' : '') + '. Somebody is on a HEATER! 🔥', 3, { kind: 'lineup', ids: leg.slice(0, 6).map(p => p.id) });
  else leg.forEach(p => add('hatch-leg-' + p.id, p.hatchBlock, '🌟 LEGENDARY HATCH!! ' + petName(w, p.id, V) + ' just cracked out of its egg! Odds: tiny. Vibes: immaculate. 🐣✨\n' + link(p.id), 3, { kind: 'hatch', id: p.id }));
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

/* ---------------------------------------------------------------- main */
async function main() {
  if (opt('--update') != null) { /* a prepared update series (hatchbot/updates/<name>.json): { posts: [{ text, art? }] }, posted in order with its pictures */
    const f = path.resolve(ROOT, 'hatchbot/updates', path.basename(opt('--update')).replace(/\.json$/, '') + '.json');
    const U = JSON.parse(fs.readFileSync(f, 'utf8')), posts = (U.posts || []).filter(x => x && x.text);
    if (!posts.length) throw new Error('no posts in ' + f);
    if (!DRY && posts.some(x => /\{[A-Z_]+\}/.test(x.text))) throw new Error('unfilled placeholder in ' + f + ' (e.g. {OPEN}): fill it in before posting');
    const needArt = !NO_ART && posts.some(x => x.art), R = needArt ? replay() : null; let bad = 0;
    for (const x of posts) { const ok = await post({ key: 'update', text: x.text, art: x.art || null }, R && R.ctx, R && R.w); if (!ok && !DRY) bad++; await new Promise(r => setTimeout(r, 2500)); }
    process.exit(bad ? 1 : 0); }
  if (opt('--post') != null) { const t = opt('--post').trim(); if (!t) throw new Error('empty update'); const ok = await tg('sendMessage', { text: '📣 XCPETS update\n\n' + t, disable_web_page_preview: true }); process.exit(ok ? 0 : 1); }
  if (!STATE) throw new Error('--state FILE is required');
  const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : null, first = !st, S = st || { v: 1, posted: [] };
  const t0 = Date.now(), { V, w, tip, ctx } = replay(); console.log('replayed to block ' + tip + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  if (S.tip && tip <= S.tip) { console.log('no new blocks since ' + S.tip); return; }
  const from = S.tip || tip, seen = new Set(S.posted || []);
  let ev = collect(V, w, tip, first ? tip : from).concat(newMythics(V, w, S)).filter(e => !seen.has(e.key));
  if (first) { /* baseline: remember what already happened, post nothing */
    collect(V, w, tip, 0).forEach(e => seen.add(e.key)); ev = [];
    console.log('first run: baseline recorded, nothing posted');
  }
  ev.sort((a, b) => a.at - b.at || b.prio - a.prio);
  let posts = ev;
  if (ev.length > MAX_POSTS) { const keep = ev.slice().sort((a, b) => b.prio - a.prio).slice(0, MAX_POSTS - 1), rest = ev.filter(e => keep.indexOf(e) < 0);
    posts = keep.sort((a, b) => a.at - b.at).concat([{ key: 'roundup-' + tip, at: tip, text: '📜 Also in the last few blocks: ' + rest.length + ' more cool moments. See them all at xcpets.fun/live.html', keys: rest.map(e => e.key) }]); }
  for (const p of posts) { const ok = await post(p, ctx, w); if (ok || DRY) { seen.add(p.key); (p.keys || []).forEach(k => seen.add(k)); } await new Promise(r => setTimeout(r, 1200)); }
  S.tip = tip; S.posted = Array.from(seen).slice(-5000); S.at = new Date().toISOString();
  if (!DRY) fs.writeFileSync(STATE, JSON.stringify(S));
  console.log('posted ' + posts.length + ' (block ' + from + ' -> ' + tip + ')');
}
main().catch(e => { console.error(e); process.exit(1); });
