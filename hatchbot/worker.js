/* HatchBot (Cloudflare Worker). Telegram calls POST /tg for every message the bot can see.
 * Commands: /pet, /burns, /whosthat, /breed, /battle, /meme, /chainday, /season, /bug, /help (and /chatid). /rate stays removed (owner).
 * The old HatchBot commands were ported by Grok Bot on Nov 22 2026 and brought into the repo (owner: "yes on commands").
 * Also POST /e: page error reports from every xcpets.fun page (see pageError). POST /selftest: dry run of a command (secret key).
 * Bindings (set by .github/workflows/hatchbot-worker.yml): TELEGRAM_BOT_TOKEN, HB_TEST_KEY (secrets), BUGS (KV), DB (D1, hatchbot/schema.sql),
 * a cron every 2 minutes to reveal /whosthat rounds (D1 if the token may create it, otherwise KV). Read-only toward the game: it never signs, burns or touches wallets. */
import MEMES from './memes.json';
import CAPTIONS from './captions.json';
const TOKEN_IDS = MEMES.map(m => m.id); /* every pet with a 512x512 picture (hatchbot/build-memes.js) */

var SITE = "https://xcpets.fun";
var HELP = "\u{1F438} HatchBot commands\n/pet \xB7 a random pet (/pet 123, /pet <name>, /pet <species>)\n/burns \xB7 community burns and community pet progress\n/whosthat \xB7 guess the pet from its silhouette (reply to the photo)\n/breed \xB7 a real breed from the chain (/breed <pet>)\n/battle \xB7 a real arena battle (/battle <pet>)\n/meme \xB7 a random XCPETS meme\n/chainday \xB7 the current 144-block game day and blocks left\n/season \xB7 the current XCPETS season and its countdown\n/bug <what happened> \xB7 report a bug to the XCPETS team (pet numbers help!)\n/help \xB7 this list\n\nPlay at xcpets.fun";
var BOT_COMMANDS = [["pet", "Pet card: /pet, /pet 123, /pet <name>, /pet <species>"], ["burns", "Community burns and community pet progress"], ["whosthat", "Guess the pet from its silhouette"], ["breed", "A real breed from the chain (/breed <pet>)"], ["battle", "A real arena battle (/battle <pet>)"], ["meme", "A random XCPETS meme"], ["chainday", "Current 144-block game day and blocks left"], ["bug", "Report a bug to the XCPETS team"], ["help", "List HatchBot commands"]];
var LIMITS = { userCooldownMs: 5e3, maxPerHour: 30, memeChatMs: 15e3, roundMs: 60e3, lateS: 120, lateMaxS: 24 * 3600 };
var SORRY = "Sorry for the slow reply, I was offline for a bit.";
async function hookSecret(token) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hatchbot:" + token));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}
var FAKE_OK = () => new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { headers: { "content-type": "application/json" } });
async function tg(env, method, body) {
  if (env.__dry) { env.__dry.push({ method, body }); return FAKE_OK(); }
  return fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function tgForm(env, method, form, info) {
  if (env.__dry) { env.__dry.push({ method, body: info }); return FAKE_OK(); }
  return fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method, { method: "POST", body: form });
}
async function tipNow() {
  try {
    const r = await fetch("https://node.xcpets.fun/xp/v1/health", { cf: { cacheTtl: 30 } });
    const j = await r.json();
    if (j && j.coreHeight)
      return j.coreHeight;
  } catch (e) {
  }
  try {
    const r = await fetch("https://xcpets.fun/api/meta.json");
    const j = await r.json();
    if (j && j.blockHeight)
      return j.blockHeight;
  } catch (e) {
  }
  return null;
}
var pick = (a) => a[Math.floor(Math.random() * a.length)];
var fmt = (x) => Number(x).toLocaleString("en-US");
var fmt0 = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
var norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
var link = (id) => SITE + "/pet.html?id=" + id;
var short = (a) => a ? a.length > 12 ? a.slice(0, 6) + "\u2026" + a.slice(-4) : a : "unknown";
var capText = (t, n) => t.length > (n || 1e3) ? t.slice(0, (n || 1e3) - 1) + "\u2026" : t;

/* /season: display-only schedule from data/seasons.json (same file as the site's season bar). "announce": false = a teaser line only. */
async function cmdSeason() {
  let cfg = null;
  try { const r = await fetch(SITE + "/data/seasons.json", { cf: { cacheTtl: 300, cacheEverything: true } }); if (r.ok) cfg = await r.json(); } catch (e) { }
  if (!cfg || !cfg.announce) return "\u{1F440} Seasons are coming to XCPETS. Stay tuned.";
  const b = await tipNow();
  if (!b) return "The chain is not answering right now. Try again in a minute.";
  const L = cfg.length || 4032, T = cfg.tease || 1008, S = cfg.seasons || [];
  const about = (n) => { const h = Math.round(n * 10 / 60); return h < 48 ? h + " h" : Math.floor(h / 24) + " days"; };
  const live = S.find((s) => b >= s.start && b < s.start + L);
  if (live) { const left = live.start + L - b; return (live.emoji || "") + " Season " + live.n + ": " + live.name + " is LIVE\nLimited " + live.egg + "s are out. Finale boss: " + live.boss + ".\nEnds in " + fmt(left) + " blocks (about " + about(left) + "), at block " + fmt(live.start + L) + ".\n\nPlay at xcpets.fun"; }
  const next = S.find((s) => b < s.start);
  if (next) { const left = next.start - b; return (next.emoji || "") + " Season " + next.n + ": " + next.name + "\n" + next.tagline + "\nStarts in " + fmt(left) + " blocks (about " + about(left) + "), at block " + fmt(next.start) + "." + (left <= T ? "\nLimited " + next.egg + "s drop at the start." : ""); }
  return "No season is running right now. The next one will be announced here.";
}
// ---------- game data (read-only, public feeds) ----------
var PETS = null, WORLD = null, ME = null;
var SPECIES = ["pepe", "wojak", "chud", "peepo", "doge", "bobo", "mumu", "sarutobi", "lenny", "snibby", "kevin", "dodo", "nakamoto", "wizard"];
var ALIAS = { satoshi: "nakamoto", bitcoinwizard: "wizard", saru: "sarutobi", crab: "snibby", moomoo: "mumu" };
function speciesOf(word) {
  const w = norm(word);
  if (!w) return null;
  if (ALIAS[w]) return ALIAS[w];
  if (SPECIES.includes(w)) return w;
  for (const s of SPECIES) if (w === s + "s" || w === s + "es") return s;
  return null;
}
async function loadPets() {
  if (PETS && Date.now() - PETS.at < 3e5) return PETS;
  const r = await fetch(SITE + "/api/pets.json", { cf: { cacheTtl: 120, cacheEverything: true } });
  if (!r.ok) throw new Error("pets.json HTTP " + r.status);
  const j = await r.json(), byId = new Map();
  for (const row of j.pets) byId.set(row[0], row);
  PETS = { at: Date.now(), tip: j.blockHeight, d: j.dict, c: j.cols, rows: j.pets, byId };
  return PETS;
}
// Turn a compact pets.json row into a readable pet. Sabo #1765 is never shown dead (owner rule).
function view(S, row) {
  if (!row) return null;
  const d = S.d, key = d.species[row[2]] || "?", label = d.speciesLabel[row[2]] || key;
  let status = d.status[row[8]] || "alive";
  if (row[0] === 1765) status = "alive";
  const st = row[15] || [], stats = {};
  (d.stat || ["vigor", "spark", "grit", "zoom", "luck"]).forEach((k, i) => stats[k] = st[i] || 0);
  return {
    id: row[0], name: row[1], species: key, speciesLabel: label, hybrid: /^hyb/.test(key),
    tier: d.tier[row[3]] || "Common", stage: d.stageName[row[6]] || "Egg", status,
    dead: status === "dead", released: status === "released", community: !!row[10],
    owner: d.owner[row[11]] || null, generation: row[12] || 0, parents: row[13] || null,
    gear: (row[14] || []).map((g) => g[2]), stats, wins: row[16] || 0, losses: row[17] || 0, hatchBlock: row[18]
  };
}
var aliveRow = (S, r) => (r[8] === 0 || r[0] === 1765) && !r[10];
function findRows(S, q) {
  q = String(q || "").trim();
  const m = /^#?\s*(\d{1,12})$/.exec(q);
  if (m) { const r = S.byId.get(Number(m[1])); return r ? [r] : []; }
  if (!/^[\p{L}\p{N} '\-.]{1,30}$/u.test(q)) return [];
  const n = norm(q);
  return S.rows.filter((r) => norm(r[1]) === n);
}
async function loadWorld() {
  if (WORLD && Date.now() - WORLD.at < 6e5) return WORLD;
  const base = "https://node.xcpets.fun";
  const latest = await (await fetch(base + "/xp/v1/world/latest.json", { cf: { cacheTtl: 60 } })).json();
  const rootUrl = base + String(latest.manifest || "").replace(/manifest\.json$/, "root.json");
  const r = await fetch(rootUrl, { cf: { cacheTtl: 600, cacheEverything: true } });
  if (!r.ok) throw new Error("world root HTTP " + r.status);
  let w = await r.json();
  const c = w.community || {}, tip = Number(w.tip), cur = c.current || null, stage = Number(c.petStage) || 0;
  const T = [0, 69e3, 834900, 2214900, 4146900, 6906900], STAGES = ["Egg", "Hatchling", "Juvenile", "Adult", "Elder", "Mythic"];
  const fed = Number(c[cur + "Fed"] != null ? c[cur + "Fed"] : (w[cur] || {}).fed || 0);
  const hi = stage < 5 ? T[stage + 1] : null, lo = T[stage] || 0;
  const NAMES = { wizard: "Bitcoin Wizard", kek: "Lord Kek", funtrump: "FUNTRUMP", homer: "Homer Pepe", rabbit: "White Rabbit" };
  const cold = Object.keys(NAMES).map((k) => { const x = w[k + "Mythic"]; return x && +x.block > 0 && +x.block <= tip ? { name: NAMES[k], block: +x.block, total: +x.total, feeders: +x.feeders } : null; }).filter(Boolean).sort((a, b) => b.block - a.block);
  const fights = (w.fights || []).filter((f) => f && f.winner != null).map((f) => ({ id: f.id, a: f.a, b: f.b, winner: f.winner, loser: f.loser, block: f.acceptBlock || f.block }));
  WORLD = { at: Date.now(), tip, burned: c.burned, feeds: c.feeds, current: cur, name: NAMES[cur] || c.petName || null, stageName: c.petStageName || STAGES[stage], fed: Math.floor(fed), next: hi ? Math.ceil(hi - fed - 1e-6) : null, nextName: hi ? STAGES[stage + 1] : null, pct: hi ? Math.min(100, 100 * (fed - lo) / (hi - lo)) : 100, latestCold: cold[0] || null, fights };
  w = null;
  return WORLD;
}
var TOKEN_SET = new Set(TOKEN_IDS);
var spriteUrl = (id) => SITE + "/t/" + id + ".png";
async function hasSprite(id) {
  if (!TOKEN_SET.has(id)) return false;
  try { const r = await fetch(spriteUrl(id), { method: "HEAD", cf: { cacheTtl: 3600 } }); return r.ok && /image\/png/.test(r.headers.get("content-type") || ""); } catch (e) { return false; }
}

// ---------- silhouette PNG (no Chrome): decode RGBA PNG, paint opaque pixels dark on a cream card ----------
async function zlib(u8, mode) {
  const s = new Blob([u8]).stream().pipeThrough(mode === "in" ? new DecompressionStream("deflate") : new CompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
var CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 4294967295; for (let i = 0; i < bytes.length; i++) c = CRC_T[(c ^ bytes[i]) & 255] ^ c >>> 8; return (c ^ 4294967295) >>> 0; }
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8); dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
async function silhouettePng(bytes) {
  const u = new Uint8Array(bytes), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  if (u[0] !== 137 || u[1] !== 80) throw new Error("not png");
  let p = 8, w = 0, h = 0, bd = 0, ct = 0, il = 0; const idat = [];
  while (p + 8 <= u.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]), data = u.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { const d2 = new DataView(data.buffer, data.byteOffset, data.byteLength); w = d2.getUint32(0); h = d2.getUint32(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === "IDAT") idat.push(data); else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bd !== 8 || ct !== 6 || il !== 0 || !w || !h || w > 1024 || h > 1024) throw new Error("unsupported png");
  let tot = 0; for (const c of idat) tot += c.length; const z = new Uint8Array(tot); let o = 0; for (const c of idat) { z.set(c, o); o += c.length; }
  const raw = await zlib(z, "in"), bpp = 4, stride = w * bpp, px = new Uint8Array(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++], row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[row + x - bpp] : 0, b = y ? px[row - stride + x] : 0, c = x >= bpp && y ? px[row - stride + x - bpp] : 0;
      let v = raw[rp + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += a + b >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[row + x] = v & 255;
    }
    rp += stride;
  }
  // Token images: 512px "proof of pet" cards (art box 96,116 size 256, name printed outside it) or 128px art only.
  const bx = w === 512 && h === 512 ? { x: 96, y: 116, s: 256 } : { x: 0, y: 0, s: Math.min(w, h) };
  const at = (x, y) => (y * w + x) * 4, cnt = new Map();
  for (let i = 0; i < bx.s; i++) for (const [x, y] of [[bx.x + i, bx.y], [bx.x + i, bx.y + bx.s - 1], [bx.x, bx.y + i], [bx.x + bx.s - 1, bx.y + i]]) {
    const q = at(x, y), k = px[q] >> 3 << 10 | px[q + 1] >> 3 << 5 | px[q + 2] >> 3; cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  let bk = 0, bn = -1; for (const [k, n] of cnt) if (n > bn) { bn = n; bk = k; }
  const bgR = (bk >> 10 & 31) << 3, bgG = (bk >> 5 & 31) << 3, bgB = (bk & 31) << 3;
  const on = (x, y) => { const q = at(bx.x + x, bx.y + y); if (px[q + 3] < 40) return false; const dr = px[q] - bgR, dg = px[q + 1] - bgG, db = px[q + 2] - bgB; return dr * dr + dg * dg + db * db > 2600; };
  // Solid silhouette: background = off-pixels reachable from the art box edge; everything else is the pet.
  const N = bx.s, outside = new Uint8Array(N * N), stack = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const i = y * N + x; if (outside[i] || on(x, y)) return; outside[i] = 1; stack.push(i); };
  for (let i = 0; i < N; i++) { push(i, 0); push(i, N - 1); push(0, i); push(N - 1, i); }
  while (stack.length) { const i = stack.pop(), x = i % N, y = i / N | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  const SC = bx.s <= 128 ? 3 : 1.5, S2 = Math.round(bx.s * SC), PAD = Math.round(S2 * 0.08), W = S2 + PAD * 2, H = W, out = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const r0 = y * (1 + W * 3); out[r0] = 0;
    for (let x = 0; x < W; x++) {
      const sx = Math.floor((x - PAD) / SC), sy = Math.floor((y - PAD) / SC), q = r0 + 1 + x * 3;
      const hit = x >= PAD && y >= PAD && sx < N && sy < N && !outside[sy * N + sx];
      if (hit) { out[q] = 28; out[q + 1] = 24; out[q + 2] = 40; } else { out[q] = 255; out[q + 1] = 236; out[q + 2] = 170; }
    }
  }
  const ih = new Uint8Array(13), id2 = new DataView(ih.buffer); id2.setUint32(0, W); id2.setUint32(4, H); ih[8] = 8; ih[9] = 2;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", await zlib(out, "out")), chunk("IEND", new Uint8Array(0))];
  return new Blob(parts, { type: "image/png" });
}

// ---------- state (D1) ----------
/* /whosthat rounds: in D1 when the deploy could create it, otherwise in the BUGS KV namespace ('round:<chat>', expires by itself). */
async function roundGet(env, chat) {
  if (env.DB) return (await dbq(env, "SELECT * FROM rounds WHERE chat_id = ?", String(chat))).first();
  if (!env.BUGS) return null;
  try { return JSON.parse(await env.BUGS.get("round:" + chat) || "null"); } catch (e) { return null; }
}
async function roundPut(env, g) {
  if (env.DB) return (await dbq(env, "INSERT OR REPLACE INTO rounds(chat_id, pet_id, species, name, ends, started) VALUES (?, ?, ?, ?, ?, ?)", g.chat_id, g.pet_id, g.species, g.name, g.ends, g.started)).run();
  if (env.BUGS) return env.BUGS.put("round:" + g.chat_id, JSON.stringify(g), { expirationTtl: 3600 });
}
async function roundDel(env, chat) {
  if (env.DB) { const r = await (await dbq(env, "DELETE FROM rounds WHERE chat_id = ?", String(chat))).run(); return !(r && r.meta && r.meta.changes === 0); }
  if (!env.BUGS) return false;
  const had = await env.BUGS.get("round:" + chat); if (!had) return false;
  await env.BUGS.delete("round:" + chat); return true;
}
async function roundsDue(env) {
  if (env.DB) return ((await env.DB.prepare("SELECT * FROM rounds WHERE ends <= ? LIMIT 20").bind(Date.now()).all()).results) || [];
  if (!env.BUGS) return [];
  const keys = ((await env.BUGS.list({ prefix: "round:", limit: 20 })).keys) || [], due = [];
  for (const k of keys) { try { const g = JSON.parse(await env.BUGS.get(k.name) || "null"); if (g && g.ends <= Date.now()) due.push(g); } catch (e) { } }
  return due;
}
async function dbq(env, sql, ...args) { if (!env.DB) return null; return env.DB.prepare(sql).bind(...args); }
var COOL = new Map(); /* without D1: a 5 s per-person cooldown kept in this worker's memory */
async function rateCheck(env, userId, chatId, cmd, now) {
  if (env.__dry) return null;
  if (!env.DB) { const t = COOL.get(String(userId)) || 0; if (now - t < LIMITS.userCooldownMs) return "user_cooldown_5s"; COOL.set(String(userId), now); if (COOL.size > 5000) COOL.clear(); return null; }
  try {
    const last = await (await dbq(env, "SELECT MAX(ts) AS t FROM hits WHERE user_id = ?", String(userId))).first();
    if (last && last.t && now - last.t < LIMITS.userCooldownMs) return "user_cooldown_5s";
    const hr = await (await dbq(env, "SELECT COUNT(*) AS n FROM hits WHERE ts > ?", now - 36e5)).first();
    if (hr && hr.n >= LIMITS.maxPerHour) return "hourly_cap";
    if (cmd === "meme") { const m = await (await dbq(env, "SELECT MAX(ts) AS t FROM hits WHERE chat_id = ? AND cmd = 'meme'", String(chatId))).first(); if (m && m.t && now - m.t < LIMITS.memeChatMs) return "meme_chat_15s"; }
  } catch (e) { console.log("rate check failed", e && e.message); }
  return null;
}
async function rateHit(env, userId, chatId, cmd, now) {
  if (!env.DB || env.__dry) return;
  try { await env.DB.batch([env.DB.prepare("INSERT INTO hits(ts, user_id, chat_id, cmd) VALUES (?, ?, ?, ?)").bind(now, String(userId), String(chatId), cmd), env.DB.prepare("DELETE FROM hits WHERE ts < ?").bind(now - 72e5)]); } catch (e) { console.log("rate hit failed", e && e.message); }
}
async function botUsername(env) {
  if (ME) return ME;
  if (env.__dry) return null;
  try { const j = await (await tg(env, "getMe", {})).json(); if (j && j.ok) ME = j.result.username; } catch (e) {}
  return ME;
}

// ---------- sending helpers ----------
async function sendCard(env, chat, replyTo, text, ids) {
  const urls = [];
  for (const id of ids || []) if (await hasSprite(id)) urls.push(spriteUrl(id));
  const base = { chat_id: chat };
  if (replyTo) base.reply_to_message_id = replyTo;
  if (urls.length === 1) {
    const r = await tg(env, "sendPhoto", Object.assign({}, base, { photo: urls[0], caption: capText(text, 1e3) }));
    if (r.ok) return r;
  } else if (urls.length > 1) {
    const media = urls.slice(0, 10).map((u, i) => i === 0 ? { type: "photo", media: u, caption: capText(text, 1e3) } : { type: "photo", media: u });
    const r = await tg(env, "sendMediaGroup", Object.assign({}, base, { media }));
    if (r.ok) return r;
  }
  return tg(env, "sendMessage", Object.assign({}, base, { text: capText(text), disable_web_page_preview: true }));
}

// ---------- ported commands (old HatchBot, Oct-Nov 2026) ----------
var STAT_NAMES = [["vigor", "Vigor"], ["spark", "Spark"], ["grit", "Grit"], ["zoom", "Zoom"], ["luck", "Luck"]];
function petCard(S, p, lead) {
  const L = [];
  if (lead) L.push(lead);
  L.push("#" + p.id + " " + p.name + (p.dead ? " (in the Pet Cemetery)" : p.released ? " (released)" : ""));
  L.push("Species: " + p.speciesLabel);
  L.push("Stage: " + p.stage + " \xB7 Rarity: " + p.tier);
  L.push(STAT_NAMES.map(([k, n]) => n + " " + (p.stats[k] || 0)).join(" \xB7 ") + " (power " + STAT_NAMES.reduce((a, [k]) => a + (p.stats[k] || 0), 0) + ")");
  L.push("Gear (" + p.gear.length + "): " + (p.gear.length ? p.gear.join(", ") : "none worn"));
  if (p.parents && p.parents.length) L.push("Parents: " + p.parents.map((id) => "#" + id + " " + ((S.byId.get(id) || [])[1] || "?")).join(" \xD7 "));
  if (p.wins || p.losses) L.push("Arena record: " + p.wins + "-" + p.losses);
  L.push("Owner: " + short(p.owner));
  L.push(link(p.id));
  return capText(L.join("\n"));
}
var PET_HELP = "Pet cards from xcpets.fun:\n/pet: a random pet\n/pet 16822 or /pet #16822: that pet number\n/pet <name>: a pet with that name (e.g. /pet Pori)\n/pet <species>: a random pet of that species (Pepe, Wojak, Chud, Peepo, Doge, Bobo, Mumu, Sarutobi, Lenny, Snibby, KEVIN, Dodo, Nakamoto, Wizard)";
async function cmdPet(env, S, args) {
  const q = String(args || "").trim();
  if (/^help$/i.test(q)) return { text: PET_HELP };
  let row, lead = "", pool;
  const m = /^#?\s*(\d{1,12})$/.exec(q), sp = q ? speciesOf(q) : null;
  if (!q) row = pick(S.rows.filter((r) => aliveRow(S, r)));
  else if (m) { row = S.byId.get(Number(m[1])); if (!row) return { text: "There's no pet #" + fmt0(m[1]) + " yet. Pets go up to #" + fmt0(S.rows.length ? S.rows[S.rows.length - 1][0] : 0) + ". Try /pet for a random one." }; }
  else if (sp) {
    const si = S.d.species.indexOf(sp);
    pool = S.rows.filter((r) => r[2] === si && aliveRow(S, r)); if (!pool.length) pool = S.rows.filter((r) => r[2] === si);
    if (!pool.length) return { text: "No " + sp + " pets have hatched yet. Try /pet for a random one." };
    row = pick(pool); lead = "Random " + (S.d.speciesLabel[si] || sp) + " (1 of " + fmt0(pool.length) + "):";
  } else if (/^[\p{L}\p{N} '\-.]{1,30}$/u.test(q)) {
    pool = findRows(S, q);
    if (!pool.length) return { text: "I couldn't find a pet or species called \"" + q.slice(0, 30) + "\". Try /pet 123, /pet Pori, /pet dodo, or /pet help." };
    const live = pool.filter((r) => aliveRow(S, r)); row = pick(live.length ? live : pool);
    if (pool.length > 1) lead = fmt0(pool.length) + " pets are named " + row[1] + ". Here's one (use /pet <number> for a specific one):";
  } else return { text: "I didn't get that. Try /pet, /pet 123, /pet Pori or /pet dodo. /pet help lists them all." };
  const p = view(S, row);
  return { text: petCard(S, p, lead), ids: [p.id] };
}
async function cmdBreed(env, S, args) {
  let kids = S.rows.filter((r) => r[13] && r[13].length === 2);
  if (String(args || "").trim()) {
    const f = findRows(S, args);
    if (!f.length) return { text: "I couldn't find that pet. Try /breed 4104 or /breed with no number." };
    const ids = new Set(f.map((r) => r[0]));
    kids = kids.filter((k) => ids.has(k[0]) || k[13].some((x) => ids.has(x)));
    if (!kids.length) return { text: (f.length === 1 ? "#" + f[0][0] + " " + f[0][1] : "That pet") + " hasn't been in a breed yet." };
  }
  if (!kids.length) return { text: "No breeds on chain yet." };
  const k = view(S, pick(kids)), A = view(S, S.byId.get(k.parents[0])), B = view(S, S.byId.get(k.parents[1]));
  if (!A || !B) return { text: "That breed's parents are missing from the feed right now. Try again in a bit." };
  return { text: ["\u{1F49E} Real breed, block " + fmt0(k.hatchBlock) + ":", "#" + A.id + " " + A.name + " (" + A.speciesLabel + ", " + A.tier + ") \xD7 #" + B.id + " " + B.name + " (" + B.speciesLabel + ", " + B.tier + ")", "= #" + k.id + " " + k.name + " (" + k.speciesLabel + ", " + k.tier + ", now " + k.stage + ")" + (k.hybrid ? " \u{1F9EC} hybrid!" : ""), link(k.id)].join("\n"), ids: [A.id, B.id, k.id] };
}
async function cmdBattle(env, S, W, args) {
  let fs = W.fights;
  if (String(args || "").trim()) {
    const f = findRows(S, args);
    if (!f.length) return { text: "I couldn't find that pet. Try /battle 42 or /battle with no number." };
    const ids = new Set(f.map((r) => r[0]));
    fs = fs.filter((x) => ids.has(x.a) || ids.has(x.b));
    if (!fs.length) return { text: (f.length === 1 ? "#" + f[0][0] + " " + f[0][1] : "That pet") + " hasn't fought in the arena yet." };
  }
  if (!fs.length) return { text: "No arena battles on chain yet." };
  const f = pick(fs), Wn = view(S, S.byId.get(f.winner)), Ls = view(S, S.byId.get(f.loser)), A = view(S, S.byId.get(f.a)), B = view(S, S.byId.get(f.b));
  if (!Wn || !Ls || !A || !B) return { text: "That battle's pets are missing from the feed right now. Try again in a bit." };
  const intro = pick(["LADIES AND GENTLEMEN, LET'S GET READY TO RUMBLLLE!", "OH MY! WHAT A MATCH THIS WAS, FOLKS!", "BAH GAWD! LOOK AT THIS ONE FROM THE ARCHIVES!"]);
  return { text: ["\u{1F94A} " + intro, "In this corner: #" + A.id + " " + A.name + " the " + A.speciesLabel + "! And in THAT corner: #" + B.id + " " + B.name + " the " + B.speciesLabel + "!", "Block " + fmt0(f.block) + "... and #" + Wn.id + " " + Wn.name + " WINS IT! " + Ls.name + " walks home with a black eye!", link(Wn.id)].join("\n"), ids: [f.a, f.b] };
}
async function cmdBurns(env) {
  let W = null, meta = null;
  try { W = await loadWorld(); } catch (e) { console.log("world load failed", e && e.message); }
  try { meta = await (await fetch(SITE + "/api/meta.json", { cf: { cacheTtl: 60 } })).json(); } catch (e) {}
  if (!W && !meta) return { text: "I could not refresh the community status right now. Please try again shortly. " + SITE };
  const L = [];
  if (W) {
    L.push("\u{1F525} Community burns: " + fmt0(W.burned) + " XCPETS (" + fmt0(W.feeds) + " community feeds).");
    if (W.latestCold) L.push("\u{1F9CA} " + W.latestCold.name + " reached Mythic at block " + fmt0(W.latestCold.block) + " (" + fmt0(W.latestCold.total) + " fed, " + fmt0(W.latestCold.feeders) + " feeders) and went into Cold Storage.");
    if (W.current && W.stageName) L.push("Current community pet: " + (W.name || "the community pet") + ", " + W.stageName + ", " + fmt0(W.fed) + " fed" + (W.nextName ? ", " + fmt0(W.next) + " more to " + W.nextName + " (" + Number(W.pct || 0).toFixed(1) + "%)" : "") + ".");
    if (meta && meta.blockHeight - W.tip > 12) L.push("\u26A0\uFE0F Last good snapshot; the latest data refresh is behind.");
    L.push("As of block " + fmt0(W.tip) + ". " + SITE);
  } else {
    L.push("\u{1F525} Total XCPETS burned: " + fmt0(meta.burnedXCPETS) + " (" + fmt0(meta.burns) + " burns).");
    const c = meta.community || {};
    if (c.current && c.current.name) L.push("Current community pet: " + c.current.name + ".");
    L.push("As of block " + fmt0(meta.blockHeight) + ". " + SITE);
  }
  return { text: L.join("\n") };
}
async function cmdWhosthat(env, S, chat, replyTo) {
  const now = Date.now();
  {
    const g = await roundGet(env, chat);
    if (g && g.ends > now) return { text: "A round is already running! Reply to the silhouette photo with the species or name. Answer is revealed in " + Math.max(1, Math.round((g.ends - now) / 1e3)) + "s." };
    if (g) await revealRound(env, g, "\u23F0 Time's up on the last round!");
  }
  const pool = TOKEN_IDS.filter((id) => { const r = S.byId.get(id); return r && aliveRow(S, r) && !/^hyb/.test(S.d.species[r[2]] || ""); });
  for (let tries = 0; tries < 6 && pool.length; tries++) {
    const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    let blob;
    try { const r = await fetch(spriteUrl(id), { cf: { cacheTtl: 3600 } }); if (!r.ok) continue; blob = await silhouettePng(await r.arrayBuffer()); } catch (e) { console.log("silhouette failed", id, e && e.message); continue; }
    const p = view(S, S.byId.get(id)), text = "\u2753 WHO'S THAT PET? First to REPLY to this photo with its species or name wins. " + Math.round(LIMITS.roundMs / 1e3) + " seconds!";
    await roundPut(env, { chat_id: String(chat), pet_id: id, species: p.species, name: norm(p.name), ends: now + LIMITS.roundMs, started: now });
    const form = new FormData();
    form.append("chat_id", String(chat)); form.append("caption", text);
    if (replyTo) form.append("reply_to_message_id", String(replyTo));
    form.append("photo", blob, "whosthat.png");
    const r = await tgForm(env, "sendPhoto", form, { caption: text, silhouetteBytes: blob.size, answerId: env.__dry ? id : void 0 });
    if (!r.ok) await roundDel(env, chat);
    return { sent: true };
  }
  return { text: "Couldn't draw a silhouette right now. Try /whosthat again in a bit." };
}
async function revealRound(env, g, lead) {
  await roundDel(env, g.chat_id);
  let p = null;
  try { const S = await loadPets(); p = view(S, S.byId.get(g.pet_id)); } catch (e) {}
  const text = (lead || "\u23F0 Time's up!") + " It was #" + g.pet_id + (p ? " " + p.name + " the " + p.speciesLabel : "") + ".\n" + link(g.pet_id);
  return sendCard(env, g.chat_id, null, text, [g.pet_id]);
}
async function checkGuess(env, msg) {
  if (!env.DB && !env.BUGS) return false;
  const chat = msg.chat.id, text = String(msg.text || "");
  const g = await roundGet(env, chat);
  if (!g) return false;
  if (g.ends <= Date.now()) { await revealRound(env, g); return true; }
  const words = text.split(/\s+/), hit = words.some((w) => speciesOf(w) === g.species || norm(w) === norm(g.species) || norm(w) === g.name) || norm(text) === g.name;
  if (!hit) return false;
  if (!await roundDel(env, chat)) return false;
  const who = msg.from && msg.from.username ? "@" + msg.from.username : msg.from && msg.from.first_name || "Someone";
  let p = null;
  try { const S = await loadPets(); p = view(S, S.byId.get(g.pet_id)); } catch (e) {}
  await sendCard(env, chat, msg.message_id, "\u{1F389} " + who + " got it! It's #" + g.pet_id + (p ? " " + p.name + " the " + p.speciesLabel : "") + ". Bragging rights are yours.\n" + link(g.pet_id), [g.pet_id]);
  return true;
}

async function command(env, msg) {
  const chat = msg.chat.id, text = String(msg.text || "").trim();
  const m = /^\/([a-z]+)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(text);
  if (!m) return null;
  if (m[2]) { const me = await botUsername(env); if (me && m[2].toLowerCase() !== me.toLowerCase()) return null; }
  const cmd = "/" + m[1].toLowerCase(), args = (m[3] || "").trim().slice(0, 60), name = cmd.slice(1);
  const KNOWN = ["/help", "/start", "/chatid", "/chainday", "/season", "/meme", "/pet", "/burns", "/whosthat", "/breed", "/battle", "/bug"];
  if (!KNOWN.includes(cmd)) return null;
  const now = Date.now(), age = msg.date ? Math.floor(now / 1e3) - msg.date : 0, late = age > LIMITS.lateS;
  if (late && (age > LIMITS.lateMaxS || ["/meme", "/chainday", "/season", "/whosthat"].includes(cmd))) return null;
  const lim = await rateCheck(env, msg.from && msg.from.id || chat, chat, name, now);
  if (lim) { console.log("rate limited", lim, cmd); return null; }
  await rateHit(env, msg.from && msg.from.id || chat, chat, name, now);
  const pre = late ? SORRY + "\n" : "";
  const reply = (t) => tg(env, "sendMessage", { chat_id: chat, text: capText(pre + t, 4e3), reply_to_message_id: msg.message_id, disable_web_page_preview: true });
  if (cmd === "/help" || cmd === "/start")
    return reply(HELP);
  if (cmd === "/chatid")
    return reply("This chat id is " + chat);
  if (cmd === "/chainday") {
    const b = await tipNow();
    if (!b)
      return reply("The chain is not answering right now. Try again in a minute.");
    const day = Math.floor(b / 144), left = 144 - b % 144;
    return reply("\u{1F4C5} Chain day " + fmt(day) + " \xB7 block " + fmt(b) + "\n" + left + " block" + (left === 1 ? "" : "s") + " left today (about " + (left * 10 >= 90 ? Math.round(left * 10 / 60) + " h" : left * 10 + " min") + ")");
  }
  if (cmd === "/season") return reply(await cmdSeason());
  if (cmd === "/bug") {
    if (!env.BUGS)
      return reply("Bug reports are not switched on yet. Please tell the team in the chat for now.");
    const body = text.replace(/^\/bug(@\S+)?\s*/i, "").trim(), quoted = msg.reply_to_message && (msg.reply_to_message.text || msg.reply_to_message.caption) || "";
    if (body.length < 5 && !quoted)
      return reply("Tell me what went wrong after /bug, for example:\n/bug the seance button stays grey on grave #100790");
    const who = msg.from && msg.from.id || 0, rk = "rate:" + who, n = +(await env.BUGS.get(rk) || 0);
    if (n >= 5)
      return reply("Thanks! You have sent 5 reports this hour. Please wait a little before sending more.");
    await env.BUGS.put(rk, String(n + 1), { expirationTtl: 3600 });
    const key = "bug:" + Date.now() + ":" + msg.message_id;
    await env.BUGS.put(key, JSON.stringify({ text: body.slice(0, 3e3), quoted: String(quoted).slice(0, 1500), name: (msg.from && msg.from.first_name || "A player").slice(0, 40), at: new Date((msg.date || Date.now() / 1e3) * 1e3).toISOString(), photo: !!(msg.reply_to_message && msg.reply_to_message.photo) }), { expirationTtl: 14 * 86400 });
    return reply("\u{1F41E} Thanks, got it! Your report is logged for the XCPETS team (it shows on GitHub with your first name only).");
  }
  if (cmd === "/meme") {
    const p = pick(MEMES), cap = pick(CAPTIONS).replace(/\{name\}/g, p.name);
    return tg(env, "sendPhoto", { chat_id: chat, photo: "https://xcpets.fun/t/" + p.id + ".png", caption: cap + "\n#" + p.id + " \xB7 xcpets.fun/pet.html?id=" + p.id, reply_to_message_id: msg.message_id });
  }
  if (cmd === "/burns") { const r = await cmdBurns(env); return reply(r.text); }
  let S;
  try { S = await loadPets(); } catch (e) { console.log("pets load failed", e && e.message); return reply("I couldn't load the pet list right now. Try again in a minute. " + SITE); }
  let r;
  if (cmd === "/pet") r = await cmdPet(env, S, args);
  else if (cmd === "/breed") r = await cmdBreed(env, S, args);
  else if (cmd === "/battle") {
    let W; try { W = await loadWorld(); } catch (e) { console.log("world load failed", e && e.message); return reply("I couldn't load the arena right now. Try again in a minute."); }
    r = await cmdBattle(env, S, W, args);
  } else if (cmd === "/whosthat") r = await cmdWhosthat(env, S, chat, msg.message_id);
  if (!r || r.sent) return null;
  if (r.ids) return sendCard(env, chat, msg.message_id, pre + r.text, r.ids);
  return reply(r.text);
}
async function handleUpdate(env, up) {
  const msg = up && (up.message || up.channel_post);
  if (!msg || typeof msg.text !== "string") return;
  if (msg.text.charAt(0) === "/") return command(env, msg);
  // /whosthat guesses: in groups (privacy mode) Telegram only delivers replies to the bot; in DMs any text.
  const isReplyToBot = msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.is_bot;
  if (isReplyToBot || msg.chat.type === "private") return checkGuess(env, msg);
}
async function scheduled(env) {
  for (const g of await roundsDue(env)) { try { await revealRound(env, g); } catch (e) { console.log("reveal failed", e && e.message); } }
  if (env.DB) try {
    const k = "menu_v3", done = await env.DB.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first();
    if (!done) {
      const r = await tg(env, "setMyCommands", { commands: BOT_COMMANDS.map(([command2, description]) => ({ command: command2, description })) });
      if (r.ok) await env.DB.prepare("INSERT OR REPLACE INTO kv(k, v) VALUES (?, ?)").bind(k, new Date().toISOString()).run();
    }
  } catch (e) { console.log("menu set failed", e && e.message); }
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

const worker = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/")
      return new Response("HatchBot is awake \u{1F438}");
    if (req.method === "POST" && url.pathname === "/e") {
      let raw = ""; try { raw = await req.text(); } catch (e) { raw = ""; }
      const job = pageError(raw, env).catch((e) => console.log("page error report failed", e && e.message));
      if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
    }
    // Dry-run self test: runs a command without sending anything to Telegram. Needs the private HB_TEST_KEY secret.
    if (req.method === "POST" && url.pathname === "/selftest") {
      if (!env.HB_TEST_KEY || req.headers.get("X-HB-Test") !== env.HB_TEST_KEY) return new Response("not found", { status: 404 });
      const E = Object.create(env); E.__dry = [];
      const body = await req.json().catch(() => ({}));
      const t0 = Date.now(); let err = null;
      try { await handleUpdate(E, { message: { message_id: 1, date: Math.floor(Date.now() / 1e3), chat: { id: body.chat || 0, type: "private" }, from: { id: 0, first_name: "Test" }, text: String(body.text || "/help"), reply_to_message: body.reply ? { from: { is_bot: true } } : void 0 } }); } catch (e) { err = String(e && e.stack || e); }
      return new Response(JSON.stringify({ ms: Date.now() - t0, err, out: E.__dry }), { headers: { "content-type": "application/json" } });
    }
    if (req.method !== "POST" || url.pathname !== "/tg")
      return new Response("not found", { status: 404 });
    if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== await hookSecret(env.TELEGRAM_BOT_TOKEN))
      return new Response("forbidden", { status: 403 });
    let up = null;
    try {
      up = await req.json();
    } catch (e) {
      return new Response("ok");
    }
    try {
      await handleUpdate(env, up);
    } catch (e) {
      console.log("command failed", e && e.message);
    }
    return new Response("ok");
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduled(env).catch((e) => console.log("scheduled failed", e && e.message)));
  }
};
export default worker;
