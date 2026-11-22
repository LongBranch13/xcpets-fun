#!/usr/bin/env node
/* HatchBot announcer (Nov 22 2026). Runs in GitHub Actions (.github/workflows/hatchbot.yml) every 10 minutes.
 * It replays the game from api/boot.json with this repo's rule scripts, finds the cool things that happened since the
 * last run and posts them to the XCPETS Telegram group. Read-only for the game: it never signs or burns anything.
 *
 *   node hatchbot/announce.js --state FILE            post new events (needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
 *   node hatchbot/announce.js --state FILE --dry      print what it would post, send nothing
 *   node hatchbot/announce.js --post "text"           post one game update (the "Post update" button)
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
  return { V, w, tip: boot.tip };
}

/* ---------------------------------------------------------------- events */
function petName(w, id, V) { const p = w.byId[id]; if (!p) return '#' + id;
  let sp = p.species; try { sp = V.speciesLabel(p.species); } catch (e) {}
  return (p.name || 'Pet') + ' #' + id + (sp ? ' the ' + sp : ''); }
const link = id => 'xcpets.fun/pet.html?id=' + id;
const isMythic = p => !!p && (p.mythicCare || p.stage >= 5);

/* Every event has a stable key, the block it happened at and its text. Old keys are never posted twice. */
function collect(V, w, tip, from) {
  const out = [], add = (key, at, text, prio) => out.push({ key, at, text, prio: prio || 1 });
  /* 1) log lines worth a post */
  (w.log || []).forEach(x => { if (!x || x.block <= from) return; const m = String(x.msg || ''), id = (m.match(/#(\d+)/) || [])[1], k = x.kind + '-' + (x.tx || '') + '-' + x.block + '-' + (id || '');
    if (x.kind === 'raise') add(k, x.block, '🧟 RISE! ' + petName(w, +id, V) + ' clawed its way out of the grave as a zombie' + ((m.match(/\(([\d.]+) times/) || [])[1] ? ' at ' + m.match(/\(([\d.]+) times/)[1] + ' times its death power' : '') + '.\n' + link(id), 3);
    else if (x.kind === 'resurrect') add(k, x.block, '😇 MIRACLE! ' + petName(w, +id, V) + ' is ALIVE again with a halo.\n' + link(id), 4);
    else if (x.kind === 'unleash') add(k, x.block, '🩸 UNLEASHED! Zombie ' + petName(w, +id, V) + ' is starving and has been let loose. In 6 blocks it eats one of its owner\'s Mythics...\n' + link(id), 4);
    else if (x.kind === 'mgmeal') { const ids = (m.match(/#(\d+)/g) || []).map(s => +s.slice(1)); add(k, x.block, '💜 A Mythic was devoured! Zombie ' + petName(w, ids[0], V) + ' ate ' + petName(w, ids[1], V) + '. The zombie is cured forever, and the Mythic now rests in a Mythic grave, waiting for a seance.\n' + link(ids[1]), 5); }
    else if (x.kind === 'hunt' && /won|defeated|beat/i.test(m)) add(k, x.block, '⚔️ Zombie hunt! ' + clean(m).slice(0, 200), 2);
    else if (x.kind === 'breed') { const egg = (m.match(/Egg #(\d+)/) || [])[1]; const ids = (m.match(/#(\d+)/g) || []).map(s => +s.slice(1));
      const big = ids.slice(0, 2).some(i => w.byId[i] && ((w.byId[i].tier | 0) >= 3 || isMythic(w.byId[i])));
      if (big) add(k, x.block, '🥚 Love is in the swamp! ' + petName(w, ids[0], V) + ' and ' + petName(w, ids[1], V) + ' made an egg' + (egg ? ' (#' + egg + ')' : '') + '.', 2); }
    else if (x.kind === 'mzfull') add(k, x.block, '💀 ' + petName(w, +id, V) + ' stands at FULL zombie power.\n' + link(id), 3);
  });
  /* 2) Legendary hatches (one post per pet, or one roundup when a big egg case drops several) */
  const leg = w.pets.filter(p => p && p.hatchBlock > from && p.hatchBlock <= tip && (p.tier | 0) >= 3 && !p.community);
  if (leg.length > 3) add('hatch-leg-' + leg.map(p => p.id).join('.').slice(0, 120), leg[0].hatchBlock, '🌟 LEGENDARY HATCHES! ' + leg.length + ' Legendary pets just hatched: ' + leg.slice(0, 10).map(p => petName(w, p.id, V)).join(', ') + (leg.length > 10 ? ' and more' : '') + '.', 3);
  else leg.forEach(p => add('hatch-leg-' + p.id, p.hatchBlock, '🌟 LEGENDARY HATCH! ' + petName(w, p.id, V) + ' just cracked out of its egg.\n' + link(p.id), 3));
  /* 3) the existing HatchBot hooks: halvings + fire sales, Legendary/Mythic gifts and swaps, Pantheon seats */
  try { require(path.join(ROOT, 'tools/hatchbot-warnings.js')).events(w, tip, V).forEach(e => add(e.id, tip, e.text, 5)); } catch (e) { console.log('warnings hook skipped: ' + e.message); }
  try { require(path.join(ROOT, 'tools/hatchbot-gifts.js')).messages(w).forEach(e => { if (e.at > from) add(e.key, e.at, e.text, 2); }); } catch (e) { console.log('gifts hook skipped: ' + e.message); }
  try { require(path.join(ROOT, 'tools/hatchbot-pantheon.js')).messages(w).forEach(e => add(e.key, e.at, e.text, 5)); } catch (e) { console.log('pantheon hook skipped: ' + e.message); }
  return out;
}
/* Mythics are found by comparing the list with the last run (a pet can reach Mythic without a log line). */
function newMythics(V, w, st) { const now = w.pets.filter(p => p && isMythic(p) && !p.dead && !p.community).map(p => p.id);
  const old = new Set(st.mythics || []), fresh = st.mythics ? now.filter(id => !old.has(id)) : [];
  st.mythics = now; return fresh.map(id => ({ key: 'mythic-' + id, at: w.tip, prio: 5, text: '👑 A NEW MYTHIC! ' + petName(w, id, V) + ' has reached Mythic.\n' + link(id) })); }

/* ---------------------------------------------------------------- main */
async function main() {
  if (opt('--post') != null) { const t = opt('--post').trim(); if (!t) throw new Error('empty update'); const ok = await tg('sendMessage', { text: '📣 XCPETS update\n\n' + t, disable_web_page_preview: true }); process.exit(ok ? 0 : 1); }
  if (!STATE) throw new Error('--state FILE is required');
  const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : null, first = !st, S = st || { v: 1, posted: [] };
  const t0 = Date.now(), { V, w, tip } = replay(); console.log('replayed to block ' + tip + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
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
  for (const p of posts) { const ok = await say(p.text); if (ok || DRY) { seen.add(p.key); (p.keys || []).forEach(k => seen.add(k)); } await new Promise(r => setTimeout(r, 1200)); }
  S.tip = tip; S.posted = Array.from(seen).slice(-5000); S.at = new Date().toISOString();
  if (!DRY) fs.writeFileSync(STATE, JSON.stringify(S));
  console.log('posted ' + posts.length + ' (block ' + from + ' -> ' + tip + ')');
}
main().catch(e => { console.error(e); process.exit(1); });
