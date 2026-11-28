/* HatchBot automatic posts for the Cloudflare Worker (review-only port of the old VPS HatchBot, Nov 22 2026).
 * Called from worker.js scheduled() on every cron run, and from POST /selftest for dry runs.
 * Every post type has its own switch in hatchbot/auto-config.json, plus the master switch "announce". All are OFF.
 * State lives in KV (binding HB_STATE, or BUGS with the "hb:" prefix): the first run with a switch on records the
 * current state and posts nothing. Read-only toward the game: public feeds only, never signs, burns or touches wallets.
 * Not ported (owner turned them off): HatchBot's own meme posts, Q&A/mention answers, the box video clip handoff.
 * Already posted by the GitHub Actions announcer (.github/workflows/hatchbot.yml + hatchbot/announce.js), so not
 * repeated here: halving and Fire Sale warnings, Pantheon seats, Legendary/Mythic gifts and swaps, raids, seasons, zombies. */
import * as FOMO from "./fomo.mjs"; /* one true urgency line under posts (Nov 24 2026, Jake: "have hatchbot create fomo") */
const SITE = "https://xcpets.fun", NODE = "https://node.xcpets.fun";
const TIER = ["Common", "Uncommon", "Rare", "Legendary"], STAGE = ["Egg", "Hatchling", "Juvenile", "Adult", "Elder", "Mythic"];
const CM_T = [0, 69e3, 834900, 2214900, 4146900, 6906900];
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const fmtD = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const KEY = "hb:auto:state";

/* ---------------------------------------------------------------- guard (port of the old send-guard + owner rules) */
const ALLOWED_LINK = /(?:https:\/\/)?xcpets\.fun(?:\/[A-Za-z0-9._~\/?=&#%+<>-]*)?/gi;
const RULES = [
  [/\b(bc1|tb1)[a-z0-9]{6,}|\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/i, "wallet address"],
  [/\b(price|prices|pump\w*|dump\w*|moon\w*|invest\w*|profit\w*|roi|worth|valu(e|ation)|chart|market ?cap|mcap|buy|sell\w*|exchange|usd|dollars?|bullish|bearish|gains?|lambo|floor)\b|\$\s?\d|\d\s?(x|\u00D7)\b/i, "price wording"],
  [/\b(seed( phrase)?|private key|mnemonic|dm me|airdrop|giveaway)\b/i, "scam-shaped"],
  [/(^|\s)@\w/, "@mention"],
  [/\bhome\b|st[a]rt ?9|\.[o]nion\b|127\.0\.0\.1|localhost|:\d{4,5}\b/i, "connection details"],
  [/\bg\W?m[o0]n[e]y\b/i, "banned name"],
  [/bitcoin(?:'s)? (?:is )?orange/i, "Bitcoin is red"],
];
export function violations(text) {
  const out = [];
  if (typeof text !== "string" || !text.trim()) return ["empty"];
  if (text.length > 1000) out.push("over 1000 chars");
  const rest = text.replace(ALLOWED_LINK, " ");
  if (/https?:\/\/|t\.me\/|www\.|\b[a-z0-9-]+\.(fun|com|io|org|net|xyz|me|gg|app|co)\b/i.test(rest)) out.push("link other than xcpets.fun");
  for (const [re, why] of RULES) if (re.test(text)) out.push(why);
  return out;
}
const noQuotes = (t) => String(t).replace(/"/g, "\u201D");

/* ---------------------------------------------------------------- time (America/Chicago) */
export function ctParts(ms) {
  const o = {};
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
  return { date: o.year + "-" + o.month + "-" + o.day, h: +o.hour % 24, m: +o.minute, s: +o.second, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday) };
}
export function ctDayStart(ms) { const p = ctParts(ms); return ms - ((p.h * 60 + p.m) * 60 + p.s) * 1000 - (ms % 1000); }

/* ---------------------------------------------------------------- data (public feeds only) */
async function getJson(url, ttl) {
  const r = await fetch(url, { cf: { cacheTtl: ttl == null ? 60 : ttl, cacheEverything: true } });
  if (!r.ok) throw new Error(url.replace(/\?.*/, "") + " HTTP " + r.status);
  return r.json();
}
/* recent-events.json is ~100 MB, far over a Worker's 128 MB memory, so it is never parsed whole.
   Stream it and JSON.parse only the blocks above `after` (and only ones that mention a tied asset). */
export async function scanRecentEvents(after, wanted) {
  const r = await fetch(SITE + "/api/recent-events.json", { cf: { cacheTtl: 30, cacheEverything: true } });
  if (!r.ok || !r.body) throw new Error("recent-events HTTP " + r.status);
  const rd = r.body.getReader(), dec = new TextDecoder(), QB = /["\\]/g, blocks = {};
  let inStr = false, esc = false, rec = false, sb = "", lastStr = null, depth = 0, inBlocks = false, key = 0, cap = 0, parts = null, tip = 0, head = "";
  const finish = (txt) => { if (!wanted || wanted.some((x) => txt.includes(x)) || txt.slice(0, 300).indexOf('"complete":true') < 0) { try { blocks[key] = JSON.parse(txt); } catch (e) { blocks[key] = null; } } else blocks[key] = { complete: true, events: [] }; };
  for (;;) {
    const { done, value } = await rd.read();
    const ch = value ? dec.decode(value, { stream: !done }) : (done ? dec.decode() : "");
    if (head.length < 2048) { head += ch.slice(0, 2048); const m = /"tip":(\d+)/.exec(head); if (m) tip = +m[1]; }
    let i = 0, cs = cap === 1 ? 0 : -1; const n = ch.length;
    while (i < n) {
      if (inStr) {
        if (esc) { esc = false; i++; continue; }
        QB.lastIndex = i; const m = QB.exec(ch);
        if (!m) { if (rec) sb += ch.slice(i); i = n; break; }
        if (m[0] === "\\") { if (rec) sb += ch.slice(i, m.index + 1); esc = true; i = m.index + 1; continue; }
        if (rec) lastStr = sb + ch.slice(i, m.index);
        inStr = false; i = m.index + 1; continue;
      }
      const c = ch.charCodeAt(i);
      if (c === 34) { inStr = true; rec = cap === 0 && depth <= 2; sb = ""; }
      else if (c === 123 || c === 91) {
        depth++;
        if (depth === 2 && c === 123 && lastStr === "blocks") inBlocks = true;
        else if (inBlocks && depth === 3) { key = +lastStr; if (key > after) { cap = 1; cs = i; parts = []; } else cap = 2; }
      } else if (c === 125 || c === 93) {
        if (inBlocks && depth === 3) { if (cap === 1) { parts.push(ch.slice(cs, i + 1)); finish(parts.join("")); parts = null; cs = -1; } cap = 0; }
        else if (inBlocks && depth === 2) inBlocks = false;
        depth--;
      }
      i++;
    }
    if (cap === 1 && cs >= 0) parts.push(ch.slice(cs));
    if (done) break;
  }
  return { tip, blocks };
}
export async function loadMeta() { return getJson(SITE + "/api/meta.json", 30); }
export async function loadPets() {
  const j = await getJson(SITE + "/api/pets.json", 120), d = j.dict, rows = j.pets;
  return { tip: j.blockHeight, d, rows, maxId: rows.length ? rows[rows.length - 1][0] : 0 };
}
/* compact pet from a pets.json row; Sabo #1765 is never shown dead (owner rule) */
export function petOf(P, row) {
  if (!row) return null;
  const key = P.d.species[row[2]] || "?", st = row[0] === 1765 ? "alive" : (P.d.status[row[8]] || "alive");
  return { id: row[0], name: row[1], species: key, label: String(P.d.speciesLabel[row[2]] || key).replace(/ \(hybrid\)$/, ""), hy: /^hyb/.test(key), tier: row[3] | 0, stage: row[6] | 0,
    status: st, community: !!row[10], owner: row[11], parents: row[13] || null, wins: row[16] || 0, losses: row[17] || 0, born: row[18], lastFed: row[19], death: row[20], score: row[4], rank: row[5], gear: (row[14] || []).length, stats: row[15] || [] };
}
function rowById(P, id) { /* rows are sorted by id: binary search */
  let lo = 0, hi = P.rows.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1, v = P.rows[m][0]; if (v === id) return P.rows[m]; if (v < id) lo = m + 1; else hi = m - 1; }
  return null;
}
export async function loadWorld() {
  const latest = await getJson(NODE + "/xp/v1/world/latest.json", 30);
  let w = await getJson(NODE + String(latest.manifest || "").replace(/manifest\.json$/, "root.json"), 600);
  const c = w.community || {}, cur = c.current || null;
  const out = { tip: +w.tip, cm: { current: cur, name: c.petName || cur, stage: +c.petStage || 0, stageName: c.petStageName || STAGE[+c.petStage || 0], fed: +(c[cur + "Fed"] || 0), burned: +c.burned || 0 },
    fights: (w.fights || []).filter((f) => f && f.status === "done" && f.winner != null).map((f) => ({ id: f.id, a: f.a, b: f.b, winner: f.winner, loser: f.loser, block: f.acceptBlock || f.block, tx: f.acceptTx || f.tx, spoils: f.spoils })),
    everMythic: w.everMythic || {}, mythicOwners: w.mythicOwners || {}, owners: null };
  w = null;
  return out;
}
const loadTies = () => getJson(SITE + "/api/ties.json", 60);

/* ---------------------------------------------------------------- wording (old HatchBot templates, Oct-Nov 2026) */
function h32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function choose(arr, seed, st, type) {
  let i = h32(String(seed)) % arr.length;
  if (st && st.lastTpl && st.lastTpl[type] === i && arr.length > 1) i = (i + 1) % arr.length;
  if (st) { st.lastTpl = st.lastTpl || {}; st.lastTpl[type] = i; }
  return arr[i];
}
function list(names, max) { max = max || 5; const shown = names.slice(0, max), more = names.length - shown.length; let s = shown.length <= 1 ? shown.join("") : shown.slice(0, -1).join(", ") + (more ? ", " : " and ") + shown[shown.length - 1]; if (more) s += " and " + more + " more"; return s; }
const nm = (p) => p ? "#" + p.id + " " + p.name : "a pet";
const nmHy = (p) => p ? (p.hy ? "#" + p.id + " " + p.name + " the " + p.label : nm(p)) : "a pet";
const plink = (p) => p ? "\nxcpets.fun/pet.html?id=" + p.id : "";
const an = (s) => /^[AEIOU]/i.test(s) ? "an" : "a";
export const T = {
  firstPlayerMythic: [(p, x) => `\u2728 ${p} just reached Mythic, and it's their keeper's very first! What a moment \u{1F389}${x}`, (p, x) => `\u{1F31F} First Mythic for this keeper: ${p} made it all the way! Snacks well spent \u2728${x}`],
  mythic: [(p, x) => `\u2728 ${p} just hit Mythic! Fully grown and glowing \u{1F31F}${x}`, (p, x) => `\u{1F31F} Another Mythic joins the ranks: ${p}! Well fed, well loved \u2728${x}`],
  hybrid: [(l, n, m) => `\u{1F9EC} New hybrid${n > 1 ? "s" : ""} bred: ${l}!${m} ${n > 1 ? "Their eggs are" : "The egg is"} waiting for a first meal \u{1F95A}`, (l, n, m) => `\u{1F95A}\u{1F9EC} Breeding pen news: ${l} just arrived as ${n > 1 ? n + " brand-new hybrid eggs" : "a brand-new hybrid egg"}!${m}`, (l, n, m) => `\u{1F9EA} Breeding lab update: ${l} ${n > 1 ? "are" : "is"} here!${m} Never seen a mix like ${n > 1 ? "these" : "this one"} \u{1F9EC}`],
  hatch: [(l) => `\u{1F95A}\u2728 Hatch highlights: ${l}! Lucky eggs today \u{1F340}`, (l) => `\u{1F389} The eggs were generous: ${l}!`, (l) => `\u2728 Shiny ones out of the shell: ${l}! Congrats, keepers \u{1F95A}`],
  battle: [(w, l, sp) => `\u2694\uFE0F ${w} beat ${l} in the arena${sp ? " and walked off with the " + sp : ""}! GG \u{1F94A}`, (w, l, sp) => `\u{1F94A} Battle result: ${w} wins against ${l}${sp ? " and takes the " + sp : ""}. Someone get ${l.replace(/^#\d+ /, "")} an ice pack \u{1F9CA}`, (w, l, sp) => `\u{1F3C6} ${w} takes the W over ${l}${sp ? " (loot: " + sp + ")" : ""}! The arena is heating up \u2694\uFE0F`],
  streak: [(w, n, l) => `\u{1F525} ${w} is on a ${n}-win streak! Latest victim: ${l}. Who's brave enough to try next? \u2694\uFE0F`, (w, n, l) => `\u2694\uFE0F\u{1F525} ${n} wins in a row for ${w} (just beat ${l})! Arena champion energy \u{1F3C6}`],
  cmStage: [(c, s) => `\u{1F451}\u2728 ${c}, the community pet, just grew into ${an(s)} ${s}! Every burn feeds the community pet, so this one's on all of us \u{1F49C}`, (c, s) => `\u{1F451} Big news: ${c}, the community pet, reached the ${s} stage! Thanks to every keeper who burned along the way \u2728`],
  cmMythic: [(c) => `\u{1F451}\u{1F31F} ${c}, the community pet, is MYTHIC! Every single burn in the game helped get here. What a team \u{1F49C}\u2728`],
  burn: [(a) => `\u{1F525} ${fmt(a)} XCPETS burned playing the game so far! That's ${fmt(a / 1e6)}M of the 100M supply turned into hatches, meals, rolls and battles \u{1F95A}`, (a) => `\u{1F525}\u{1F525} Milestone: ${fmt(a)} XCPETS have now been burned for pets. ${fmt(a / 1e6)}M down, all of it gameplay \u{1F3AE}`],
  count: [(m, p) => `\u{1F95A} ${fmt(m)} pets have hatched in XCPETS!${p ? " Number " + fmt(m) + " is " + p + "." : ""} Welcome to the world, little ones \u{1F389}`, (m, p) => `\u{1F389} Pet #${fmt(m)} just hatched${p ? ": say hi to " + p.replace(/^#\d+ /, "") : ""}! The XCPETS world keeps growing \u{1F95A}`],
};
const parentsOf = (P, p) => { const ps = (p.parents || []).filter((x) => x != null), pn = (id) => { const r = rowById(P, id); return (r ? r[1] + " " : "") + "#" + id; }; return ps.length >= 2 ? "\nParents: " + pn(ps[0]) + " \u00D7 " + pn(ps[1]) : ""; };
const cmName = (meta, W) => { const c = meta && meta.community && meta.community.current; if (c && c.name) return (c.the ? "The " : "") + c.name; return W && W.cm && W.cm.name ? W.cm.name : "the community pet"; };

/* ---------------------------------------------------------------- chain events (diff of two looks) */
export function chainEvents(P, W, meta, st, C) {
  const ev = [], ch = C.chain || {}, L = C.limits;
  /* new pets since the last look (pets.json is sorted by id) */
  if (P && st.maxId != null) {
    for (let i = P.rows.length - 1; i >= 0 && P.rows[i][0] > st.maxId; i--) {
      const p = petOf(P, P.rows[i]); if (p.community) continue;
      if (p.hy && p.parents) ev.push({ type: "hybrid", key: "hybrid:" + p.id, block: p.born, pet: p, par: parentsOf(P, p) });
      else if (p.parents) ev.push({ type: "bred", key: "bred:" + p.id, block: p.born, pet: p });
      if (p.species === "nakamoto") ev.push({ type: "nakamoto", key: "nakamoto:" + p.id, block: p.born, pet: p });
      else if (p.tier === 3 && !p.hy) ev.push({ type: "legendary", key: "legendary:" + p.id, block: p.born, pet: p });
    }
  }
  if (W && st.wt != null) {
    /* Mythics: everMythic[id] = block it first reached Mythic; first for the keeper when it is that keeper's first Mythic block */
    for (const id in W.everMythic) {
      const b = +W.everMythic[id]; if (!(b > st.wt && b <= W.tip)) continue;
      const p = P ? petOf(P, rowById(P, +id)) : null; if (!p || p.community || p.status !== "alive") continue;
      const addr = P.d.owner[p.owner], first = addr != null && +W.mythicOwners[addr] === b;
      ev.push({ type: "mythic", key: "mythic:" + id, block: b, pet: p, firstForPlayer: first, ownerKey: String(p.owner) });
    }
    /* battles finished since the last look, with the winner's streak */
    const done = W.fights.slice().sort((x, y) => (x.block || 0) - (y.block || 0) || x.id - y.id);
    for (const f of done) {
      if (!(f.block > st.wt)) continue;
      let streak = 0; for (const g of done) if ((g.a === f.winner || g.b === f.winner) && g.block <= f.block) streak = g.winner === f.winner ? streak + 1 : 0;
      const sp = Array.isArray(f.spoils) ? f.spoils.map((s) => s && (s.name || s.item || s)).filter((s) => typeof s === "string")[0] : (typeof f.spoils === "string" ? f.spoils : null);
      ev.push({ type: "battle", key: "fight:" + (f.tx || f.id), block: f.block, winner: P ? petOf(P, rowById(P, f.winner)) : { id: f.winner, name: "" }, loser: P ? petOf(P, rowById(P, f.loser)) : { id: f.loser, name: "" }, spoil: sp, streak });
    }
    /* community pet stage (only the current community pet, never anything about earlier ones) */
    if (st.cm && W.cm.current && st.cm.current === W.cm.current && W.cm.stage > st.cm.stage)
      ev.push({ type: "cm", key: "cm:" + W.cm.current + ":" + W.cm.stage, block: W.tip, stage: W.cm.stage, stageName: STAGE[W.cm.stage] || W.cm.stageName, name: cmName(meta, W) });
  }
  if (meta) {
    const step = L.burn_step || 1e6, a = Math.floor((st.burned || 0) / step), b = Math.floor((+meta.burnedXCPETS || 0) / step);
    if (st.burned != null && b > a && a > 0) ev.push({ type: "burn", key: "burn:" + b * step, block: meta.blockHeight, amount: b * step });
    /* Pets hatched so far = the newest pet number (P.maxId), not meta.totalPets: totalPets only counts pets still in the
       world (sacrificed, ground, eaten and discarded pets drop out), so it ran ~47k behind and posted 160,000 when the game
       was past 206,000 (Nov 23 2026). st.hatched is new: the first look after this change only records it. */
    const cs = L.pet_count_step || 1e4, ka = Math.floor((st.hatched || 0) / cs), kb = Math.floor(((P && P.maxId) || 0) / cs);
    if (st.hatched != null && kb > ka && ka > 0) { const r = rowById(P, kb * cs); ev.push({ type: "count", key: "hatched:" + kb * cs, block: r ? r[18] : P.tip, milestone: kb * cs, pet: r ? "#" + r[0] + " " + r[1] : null }); }
  }
  const want = { hybrid: ch.hybrids, bred: ch.hybrids, nakamoto: ch.hatch_highlights, legendary: ch.hatch_highlights, mythic: ch.mythic, battle: ch.battles, cm: ch.community_stage, burn: ch.burn_milestone, count: ch.pet_count_milestone };
  return ev.filter((e) => C.__all || want[e.type] === true);
}
/* Legendary hatches come ~4 per 144-egg case, so they wait for a digest at most every N hours (Nakamotos go out right away) */
export function holdLegendaries(events, st, nowMs, hours) {
  st.legend = st.legend || [];
  const lg = events.filter((e) => e.type === "legendary"), rest = events.filter((e) => e.type !== "legendary");
  for (const e of lg) if (!st.legend.find((x) => x.key === e.key)) st.legend.push({ type: e.type, key: e.key, block: e.block, pet: { id: e.pet.id, name: e.pet.name, label: e.pet.label } });
  const due = st.lastLegend == null || nowMs - st.lastLegend >= (hours || 3) * 3600e3;
  if (st.legend.length && due) { const out = rest.concat(st.legend); st.legend = []; st.lastLegend = nowMs; return out; }
  return rest;
}
export function batch(events, st) {
  const by = (t) => events.filter((e) => e.type === t), posts = [], seedOf = (es) => es.map((e) => e.key).join("|");
  const groups = new Map(); by("mythic").forEach((e) => { if (!groups.has(e.ownerKey)) groups.set(e.ownerKey, []); groups.get(e.ownerKey).push(e); });
  for (const es of groups.values()) {
    es.sort((a, b) => a.pet.id - b.pet.id);
    const lead = es.find((e) => e.firstForPlayer) || es[0], rest = es.filter((e) => e !== lead);
    const extra = rest.length ? " And " + (rest.length === 1 ? nm(rest[0].pet) : list(rest.map((e) => nm(e.pet)), 4)) + " went Mythic right along with it!" : "";
    const tpl = lead.firstForPlayer ? T.firstPlayerMythic : T.mythic;
    posts.push({ type: lead.firstForPlayer ? "mythic_first_player" : "mythic", prio: 0, keys: es.map((e) => e.key), block: lead.block, photoId: lead.pet.id, text: choose(tpl, seedOf(es), st, lead.firstForPlayer ? "fpm" : "my")(nmHy(lead.pet), extra) + plink(lead.pet) });
  }
  const hy = by("hybrid");
  if (hy.length) {
    const bred = by("bred").length, more = bred ? ` (Plus ${bred} more bred ${bred === 1 ? "baby" : "babies"}.)` : "";
    posts.push({ type: "hybrids", prio: 1, keys: hy.concat(by("bred")).map((e) => e.key), block: Math.max(...hy.map((e) => e.block)), photoId: hy[0].pet.id, photoWait: true, text: choose(T.hybrid, seedOf(hy), st, "hy")(list(hy.map((e) => nmHy(e.pet)), 4), hy.length, more) + (hy.length === 1 ? (hy[0].par || "") + plink(hy[0].pet) : "") });
  }
  const nk = by("nakamoto"), lg = by("legendary");
  if (nk.length || lg.length) {
    const parts = [];
    if (nk.length) parts.push((nk.length === 1 ? "a Nakamoto, " : nk.length + " Nakamotos, ") + list(nk.map((e) => nm(e.pet)), 3) + " (that's 1 in 777)");
    if (lg.length) parts.push(lg.length === 1 ? "a Legendary " + lg[0].pet.label + ", " + nm(lg[0].pet) : lg.length + " Legendaries" + (lg.length > 4 ? " including " : " (") + list(lg.slice(0, 4).map((e) => nm(e.pet) + " the " + e.pet.label), 4) + (lg.length > 4 ? "" : ")"));
    posts.push({ type: "hatch_highlights", prio: 1, keys: nk.concat(lg).map((e) => e.key), block: Math.max(...nk.concat(lg).map((e) => e.block)), photoId: nk.concat(lg)[0].pet.id, photoWait: true, text: choose(T.hatch, seedOf(nk.concat(lg)), st, "ht")(parts.join(" and ")) });
  }
  const bt = by("battle");
  if (bt.length > 2) posts.push({ type: "battles", prio: 1, keys: bt.map((e) => e.key), block: Math.max(...bt.map((e) => e.block)), photoId: bt[bt.length - 1].winner.id, text: "\u2694\uFE0F Busy arena! " + list(bt.map((e) => nm(e.winner) + " beat " + nm(e.loser)), 4) + ". GG all round \u{1F94A}" });
  else for (const e of bt) {
    const w = nm(e.winner), l = nm(e.loser), sp = e.spoil && !violations(e.spoil).length ? e.spoil : null;
    posts.push({ type: e.streak >= 3 ? "win_streak" : "battle", prio: 1, keys: [e.key], block: e.block, photoId: e.winner.id, text: e.streak >= 3 ? choose(T.streak, e.key, st, "stk")(w, e.streak, l) : choose(T.battle, e.key, st, "bt")(w, l, sp) });
  }
  for (const e of by("cm")) posts.push({ type: "community_stage", prio: e.stageName === "Mythic" ? 0 : 1, keys: [e.key], block: e.block, text: e.stageName === "Mythic" ? T.cmMythic[0](e.name) : choose(T.cmStage, e.key, st, "cm")(e.name, e.stageName) });
  const bu = by("burn"); if (bu.length) { const e = bu[bu.length - 1]; posts.push({ type: "burn_milestone", prio: 1, keys: bu.map((x) => x.key), block: e.block, text: choose(T.burn, e.key, st, "bu")(e.amount) }); }
  const co = by("count"); if (co.length) { const e = co[co.length - 1]; posts.push({ type: "pet_count_milestone", prio: 1, keys: co.map((x) => x.key), block: e.block, photoWait: !!e.pet, text: T.count[1](e.milestone, e.pet) + (e.pet ? "\nxcpets.fun/pet.html?id=" + e.milestone : ""), photoId: e.pet ? e.milestone : undefined }); }
  return posts;
}

/* ---------------------------------------------------------------- ties (pet tokenized) */
export function tieText(t) {
  const desc = [t.rarity, t.speciesLabel || t.species].filter(Boolean).join(" ");
  return (`\u{1F517} PET TOKENIZED: ${t.name} #${t.id} is now tied to its own token!\n` + `${desc ? "A " + desc + (t.stage ? " (" + t.stage + ")" : "") + ". " : ""}Token: ${t.asset}\n` +
    `Whoever holds the token owns the pet in the game.\nPet page: https://xcpets.fun/pet.html?id=${t.id}\nProof of Pet: https://xcpets.fun/t/${t.id}.png`).slice(0, 1000);
}
export function tiePosts(ties, st, all, nowMs, hours) {
  const keys = (ties.ties || []).map((t) => ({ t, k: "tie:" + t.id + ":" + t.asset }));
  if (!st.ties) { st.ties = keys.map((x) => x.k); return { baseline: keys.length, posts: [] }; }
  const seen = new Set(st.ties), posts = [];
  for (const { t, k } of keys) {
    if (seen.has(k)) continue;
    if (keys.some((o) => o.t.id === t.id && o.k !== k && seen.has(o.k))) { st.ties.push(k); continue; } /* a re-tie of a pet already announced: skip */
    st.ties.push(k); posts.push({ type: "tie", prio: 1, keys: [k], block: +t.tiedBlock, text: tieText(t), photo: SITE + "/t/" + t.id + ".png", t });
  }
  if (st.ties.length > 6000) st.ties = st.ties.slice(-6000);
  if (all) return { posts };
  return { posts: tieDigest(posts, st, nowMs == null ? Date.now() : nowMs, hours) };
}
/* Tokenized pets (Nov 25 2026, Jake: "HatchBot is posting too many things"): 27 pets were tokenized in one day, one post each.
   They now wait and go out as ONE roundup at most every `hours` hours (limits.ties_digest_hours, default 6). */
export function tieDigest(posts, st, nowMs, hours) {
  st.tieQ = st.tieQ || [];
  for (const p of posts) if (!st.tieQ.find((x) => x.k === p.keys[0])) st.tieQ.push({ k: p.keys[0], id: p.t.id, name: p.t.name, asset: p.t.asset, text: p.text, block: p.block });
  if (st.tieQ.length > 60) st.tieQ = st.tieQ.slice(-60);
  const due = st.lastTie == null || nowMs - st.lastTie >= (hours || 6) * 3600e3;
  if (!st.tieQ.length || !due) return [];
  const q = st.tieQ; st.tieQ = []; st.lastTie = nowMs;
  if (q.length === 1) return [{ type: "tie", prio: 1, keys: [q[0].k], block: q[0].block, text: q[0].text, photo: SITE + "/t/" + q[0].id + ".png" }];
  const text = ("\u{1F517} " + q.length + " PETS TOKENIZED! " + list(q.map((x) => x.name + " #" + x.id), 8) + " just got tied to their own tokens.\n" +
    "Whoever holds a pet's token owns the pet in the game.\nProof of Pet: https://xcpets.fun/t/" + q[0].id + ".png").slice(0, 1000);
  return [{ type: "ties", prio: 1, keys: q.map((x) => x.k), block: Math.max(...q.map((x) => x.block || 0)), text, photo: SITE + "/t/" + q[0].id + ".png" }];
}

/* ---------------------------------------------------------------- Spam City (token listings, sales, gifts) */
const BURN = /^1CounterpartyXXXXXXXXXXXXXXXUWLpVr$/;
const amt = (q, asset) => { const n = Number(q) / 1e8; return (n >= 1 ? Math.round(n).toLocaleString("en-US") : String(+n.toFixed(8))) + " " + asset; };
export function scDetect(block, events, pet) {
  const out = [], matched = new Set();
  for (const e of events) if (e.event === "ORDER_MATCH") { matched.add(e.params.tx0_hash); matched.add(e.params.tx1_hash); }
  for (const e of events) {
    const p = e.params || {};
    if (e.event === "ORDER_MATCH" && p.status !== "expired") {
      let s = null;
      if (pet(p.forward_asset)) s = { asset: p.forward_asset, qty: p.forward_quantity, payAsset: p.backward_asset, pay: p.backward_quantity };
      else if (pet(p.backward_asset)) s = { asset: p.backward_asset, qty: p.backward_quantity, payAsset: p.forward_asset, pay: p.forward_quantity };
      if (s && Number(s.qty) >= 1) out.push(Object.assign({ type: "sale", key: "sale:" + p.id, block, pet: pet(s.asset) }, s));
    } else if (e.event === "OPEN_ORDER" && p.status !== "invalid" && Number(p.give_quantity) >= 1 && pet(p.give_asset) && !matched.has(p.tx_hash)) {
      out.push({ type: "listing", key: "list:" + p.tx_hash, block, asset: p.give_asset, payAsset: p.get_asset, ask: p.get_quantity, pet: pet(p.give_asset) });
    } else if (/^(SEND|ENHANCED_SEND|MPMA_SEND)$/.test(e.event) && (p.status || "valid") === "valid" && Number(p.quantity) >= 1 && p.source !== p.destination && !BURN.test(p.destination || "") && pet(p.asset)) {
      out.push({ type: "gift", key: "gift:" + p.tx_hash + ":" + p.asset, block, asset: p.asset, pet: pet(p.asset) });
    }
  }
  return out;
}
export function scText(ev) {
  const t = ev.pet, who = t.name + " #" + t.id, d0 = [t.rarity, t.speciesLabel || t.species].filter(Boolean).join(" "), d = d0 ? d0 + (t.stage ? " (" + t.stage + ")" : "") : "";
  const links = `\nPet page: https://xcpets.fun/pet.html?id=${t.id}\nProof of Pet: https://xcpets.fun/t/${t.id}.png`;
  let s;
  if (ev.type === "sale") s = `\u{1F6D2} SOLD IN SPAM CITY: ${who} has a new owner!\n${d ? d + ". " : ""}Paid ${amt(ev.pay, ev.payAsset)}.\nThe token moved, so the pet moved with it. Treat ${t.name} well! \u{1F43E}`;
  else if (ev.type === "listing") s = `\u{1F39F} NEW IN SPAM CITY: ${who} is up for grabs!\n${d ? d + ". " : ""}Asking ${amt(ev.ask, ev.payAsset)}.\nWhoever fills the order gets the token, and the pet comes with it.`;
  else s = `\u{1F381} GIFTED IN SPAM CITY: ${who} just got wrapped up and handed to a new keeper!\n${d ? d + ". " : ""}No XCPETS changed hands, just a kind keeper.\nHolding the token = owning the pet. \u{1F49D}`;
  return (s + links).slice(0, 1000);
}
export async function spamCity(st, ties, all) {
  const map = {}; for (const t of ties.ties || []) map[t.asset] = t;
  const feed = await scanRecentEvents(st.sc ? st.sc.last : Infinity, Object.keys(map)), tip = +feed.tip;
  if (!tip) return { posts: [], note: "no feed tip" };
  if (!st.sc) { st.sc = { last: tip, posted: [] }; return { posts: [], baseline: tip }; }
  if (tip <= st.sc.last) return { posts: [] };
  const pet = (a) => map[a] || null, seen = new Set(st.sc.posted), posts = [];
  let budget = all ? 99 : 3, done = st.sc.last;
  for (let n = st.sc.last + 1; n <= Math.min(tip, st.sc.last + 30); n++) {
    const b = feed.blocks && feed.blocks[n];
    if (!b || b.complete === false || !Array.isArray(b.events)) { /* never treat an unreadable block as empty: wait, but give up after ~1 hour */
      st.sc.miss = st.sc.miss || {}; st.sc.miss[n] = (st.sc.miss[n] || 0) + 1; if (st.sc.miss[n] < 6) break; delete st.sc.miss[n]; done = n; continue; }
    const evs = scDetect(n, b.events, pet).filter((e) => !seen.has(e.key)), take = evs.slice(0, budget);
    for (const e of take) { seen.add(e.key); st.sc.posted.push(e.key); posts.push({ type: "spamcity_" + e.type, prio: 1, keys: [e.key], block: n, text: scText(e), photo: SITE + "/t/" + e.pet.id + ".png" }); }
    budget -= take.length; if (take.length < evs.length) break;
    done = n;
  }
  st.sc.last = done; if (st.sc.posted.length > 3000) st.sc.posted = st.sc.posted.slice(-3000);
  return { posts };
}

/* ---------------------------------------------------------------- warnings: game data behind / caught up */
export async function chainTip() {
  const tips = [];
  try { const h = await getJson(NODE + "/xp/v1/health", 0); if (h && h.coreHeight) tips.push(+h.coreHeight); } catch (e) {}
  try { const r = await fetch("https://mempool.space/api/blocks/tip/height"); if (r.ok) tips.push(+(await r.text())); } catch (e) {}
  return tips.length ? Math.max(...tips) : null;
}
export function lagPosts(meta, tip, st, C) {
  const W = C.warnings || {}, lag = tip && meta ? tip - meta.blockHeight : null, out = [];
  if (lag == null) return out;
  st.lag = st.lag || { state: "ok", n: 0 };
  if (lag >= (W.lag_blocks || 12)) { st.lag.n++; if (st.lag.state === "ok" && st.lag.n >= 2) { st.lag.state = "behind"; st.lag.since = meta.blockHeight; out.push({ type: "warning_feed_lag", prio: 0, keys: ["lag:" + meta.blockHeight], block: meta.blockHeight, text: "Heads up, keepers: our game data is catching up, so new hatches, feeds and Spam City ties may take a while to show on the site. Your burns are safe on chain and will all count once it catches up. Please don't repeat a burn. We'll post as soon as everything is current." }); } }
  else { st.lag.n = 0; if (st.lag.state === "behind" && lag <= (W.caught_up_blocks || 3)) { st.lag.state = "ok"; out.push({ type: "warning_caught_up", prio: 0, keys: ["caughtup:" + meta.blockHeight], block: meta.blockHeight, text: "Game data is caught up. The XCPETS feed is current again at block " + fmt(meta.blockHeight) + ", so hatches, feeds and Spam City ties from the last few hours now show on the site. Your burns were always safe on chain. Please don't repeat a burn: a second burn is a separate burn." }); } }
  return out;
}

/* ---------------------------------------------------------------- routines (pet of the day, fight night, motel, leaderboard) */
const ROUTINES = { pet_of_day: { hour_ct: 12, max_per_day: 1 }, fight_night: { hour_ct: 20, max_per_day: 1 }, motel_alert: { max_per_day: 6, min_gap_min: 120 }, leaderboard: { weekday: 0, hour_ct: 18, max_per_day: 1 } };
const QUIET = { start: 10, end: 21 };
function topPets(P, n) { /* the ⭐ Pet Score from api/pets.json (its rarityScore column is PetScore.compute on the full replay, the number the site's ⭐ chip shows; Nov 28 2026: posts said "Rarity Score", which on the site is the 💎 trait rarity, a different number) */
  const out = [];
  for (const r of P.rows) { if (r[10] || r[4] == null || !(r[8] === 0 || r[0] === 1765)) continue; out.push(r); }
  out.sort((a, b) => b[4] - a[4] || a[0] - b[0]);
  return out.slice(0, n).map((r) => petOf(P, r));
}
export function routinePosts(P, W, st, C, nowMs, force) {
  const R = C.routines || {}, t = ctParts(nowMs), out = [];
  st.rt = st.rt || { sent: {}, perDay: {}, last: {} };
  const ok = (name) => {
    if (!force && R[name] !== true) return false; if (force) return true;
    const c = ROUTINES[name];
    if (c.hour_ct != null && t.h !== c.hour_ct) return false;
    if (c.weekday != null && t.wd !== c.weekday) return false;
    if (c.hour_ct == null && (t.h < QUIET.start || t.h >= QUIET.end)) return false;
    if (((st.rt.perDay[name] || {})[t.date] || 0) >= c.max_per_day) return false;
    if (c.min_gap_min && st.rt.last[name] && nowMs - st.rt.last[name] < c.min_gap_min * 60e3) return false;
    return true;
  };
  const push = (name, key, text, photoId, photoWait) => { if (st.rt.sent[key] && !force) return; out.push({ type: name, prio: 2, keys: [key], routine: name, block: P ? P.tip : 0, text, photoId, photoWait }); };
  if (P && ok("pet_of_day")) {
    const top = topPets(P, 50), recent = new Set(st.rt.potd || []), pool = top.filter((p) => !recent.has(p.id)), p = (pool.length ? pool : top)[h32(t.date) % (pool.length || top.length || 1)];
    if (p) push("pet_of_day", "potd:" + t.date, "\u{1F31F} Pet of the Day: " + p.name + " #" + p.id + ", " + an(TIER[p.tier]) + " " + TIER[p.tier] + " " + p.label + " with a \u2B50 Pet Score of " + p.score + " (rank #" + fmt(p.rank) + "). Give it a wave!\nxcpets.fun/pet.html?id=" + p.id, p.id);
  }
  if (P && W && ok("fight_night")) {
    const fs24 = W.fights.filter((x) => x.block > W.tip - 144);
    if (fs24.length) push("fight_night", "fn:" + t.date, "\u{1F94A} Fight Night at X Circus Kekimus: " + fs24.length + " fight" + (fs24.length > 1 ? "s" : "") + " today.\n" + fs24.slice(-8).map((x) => "#" + x.winner + " beat #" + x.loser).join("\n") + "\nLosers wear a black eye for 72 blocks.", fs24[fs24.length - 1].winner);
  }
  if (P && ok("motel_alert")) {
    const b = []; for (let i = P.rows.length - 1; i >= 0 && P.rows[i][18] > P.tip - 36; i--) { const p = petOf(P, P.rows[i]); if (p.parents && p.id > (st.rt.motelMax || 0) && !(p.hy && (C.chain || {}).hybrids === true)) b.push(p); } /* hybrid eggs already get the Breeding pen post */
    if (b.length) {
      const c = b[0], ps = c.parents.filter((x) => x != null), pn = (id) => { const r = rowById(P, id); return (r ? r[1] + " " : "") + "#" + id; };
      const from = ps.length >= 2 ? ", from " + pn(ps[0]) + " \u00D7 " + pn(ps[1]) : ps.length === 1 ? ", from " + pn(ps[0]) : "";
      push("motel_alert", "motel:" + c.id, "\u{1F95A} New arrival at the No-Tail Motel: " + c.name + " #" + c.id + " (" + c.label + ")" + from + (b.length > 1 ? ". Plus " + (b.length - 1) + " more egg" + (b.length > 2 ? "s" : "") + " checked out." : "."), c.id, true);
      if (!force) st.rt.motelMax = c.id;
    }
  }
  if (P && ok("leaderboard")) {
    const top = topPets(P, 5);
    if (top.length) push("leaderboard", "lb:" + t.date, "\u{1F3C5} Weekly \u2B50 Pet Score top 5:\n" + top.map((p, i) => (i + 1) + ". " + p.name + " #" + p.id + " " + p.score).join("\n"), top[0].id);
  }
  return out;
}
function routineSent(st, it, nowMs) {
  const t = ctParts(nowMs); st.rt.sent[it.keys[0]] = nowMs; (st.rt.perDay[it.routine] = st.rt.perDay[it.routine] || {})[t.date] = ((st.rt.perDay[it.routine] || {})[t.date] || 0) + 1; st.rt.last[it.routine] = nowMs;
  if (it.routine === "pet_of_day" && it.photoId) st.rt.potd = (st.rt.potd || []).concat([it.photoId]).slice(-14);
  for (const k of Object.keys(st.rt.sent)) if (nowMs - st.rt.sent[k] > 30 * 864e5) delete st.rt.sent[k];
  for (const r of Object.keys(st.rt.perDay)) for (const d of Object.keys(st.rt.perDay[r])) if (d < ctParts(nowMs - 7 * 864e5).date) delete st.rt.perDay[r][d];
}

/* ---------------------------------------------------------------- daily recap (8 AM CT, the previous CT day) */
async function blockAtTime(unix) { const r = await fetch("https://mempool.space/api/v1/mining/blocks/timestamp/" + Math.floor(unix)); if (!r.ok) throw new Error("mempool " + r.status); return (await r.json()).height; }
const decTag = (h) => { try { return new TextDecoder().decode(Uint8Array.from((h || "").match(/../g) || [], (x) => parseInt(x, 16))); } catch (e) { return ""; } };
export function prevDay(nowMs) { const end = ctDayStart(nowMs); return [ctDayStart(end - 3600e3), end]; }
/* Recap kinds: the 2nd part of each burn tag, grouped into the fun lines below. */
const RECAP_GRAVE = { alt: "altar", ar: "altar", altg: "altar", seance: "seance", sr: "seance", resurrect: "rise", raise: "rise", rpl: "zmeal", rr: "zmeal", rplg: "zmeal", zfeed: "zmeal", zr: "zmeal", zfm: "zmeal" };
const RECAP_VIBES = ["Absolute cinema \u{1F3AC}", "The chain never sleeps \u{1F440}", "Certified degen activity \u{1F9EA}", "The pets were NOT quiet \u{1F4E3}", "Another day in pet paradise \u{1F334}", "Somebody check on the cemetery \u{1F47B}", "Peak pet behavior \u{1F525}"];
/* Pet pictures (Nov 23 2026): t/<id>.png on the site exists only for tokenized pets, so most posts went out as text.
   The GitHub Actions announcer now also draws every pet the bot may post about (top pets, new eggs, Mythics, fighters)
   into the public branch hatchbot-art (p/<id>.png). picUrl returns the first picture that exists, or null. */
const ART_RAW = "https://raw.githubusercontent.com/LongBranch13/xcpets-fun/hatchbot-art/p/";
async function urlOk(u) { try { const r = await fetch(u, { method: "HEAD", cf: { cacheTtl: 120 } }); return r.ok; } catch (e) { return false; } }
export async function picUrl(id) {
  if (id == null) return null;
  for (const u of [SITE + "/t/" + id + ".png", ART_RAW + id + ".png"]) if (await urlOk(u)) return u;
  return null;
}
async function hasThumb(id) { return !!(await picUrl(id)); }
export async function recapFor(day, P, W, meta, boot) {
  const dayStartMs = day[0], hStart = await blockAtTime(day[0] / 1000), hEnd = await blockAtTime(day[1] / 1000);
  if (P.tip < hEnd || +boot.tip < hEnd) return { wait: "feed behind the end of the day (feed " + Math.min(P.tip, +boot.tip) + ", day ends " + hEnd + ")" };
  let hPrev = null; try { hPrev = await blockAtTime((day[0] - 864e5) / 1000); } catch (e) { hPrev = null; }
  const inR = (b) => b > hStart && b <= hEnd;
  let burns = 0, sats = 0n, big = 0n, prevSats = 0n; const wallets = new Map(), kinds = {};
  for (const r of boot.rows) {
    if (r.status !== "valid") continue;
    const q = BigInt(r.quantity);
    if (hPrev != null && r.block_index > hPrev && r.block_index <= hStart) prevSats += q;
    if (!inR(r.block_index)) continue;
    burns++; sats += q; if (q > big) big = q;
    const w = wallets.get(r.source) || { sats: 0n, n: 0 }; w.sats += q; w.n++; wallets.set(r.source, w);
    const k = decTag(r.tag).split(":")[1] || "other"; kinds[k] = (kinds[k] || 0) + 1;
  }
  let hatched = 0, bred = 0, died = 0, fed = 0, best = null; const deadIds = [];
  for (const r of P.rows) {
    if (r[10]) continue;
    if (inR(r[18])) { if (r[13]) bred++; else hatched++; if (r[4] != null && (!best || r[3] > best[3] || (r[3] === best[3] && r[4] > best[4]))) best = r; }
    if (r[8] === 1 && r[0] !== 1765 && inR(r[20])) { died++; deadIds.push(r[0]); }
    if (inR(r[19])) fed++;
  }
  const myIds = Object.keys(W.everMythic).filter((id) => inR(+W.everMythic[id])).map(Number), mythics = myIds.length;
  const myPets = myIds.map((id) => petOf(P, rowById(P, id))).filter(Boolean).sort((a, b) => (b.score || 0) - (a.score || 0));
  const label = new Date(dayStartMs + 12 * 3600e3).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "short", day: "numeric" });
  const dayName = (ms) => new Date(ms + 12 * 3600e3).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long" });
  const cm = cmName(meta, W), L = ["☀️ GM! XCPETS daily recap for " + label, ""];
  const f8 = (v) => { const i = v / 100000000n, r = (v % 100000000n).toString().padStart(8, "0").replace(/0+$/, ""); return i.toLocaleString("en-US") + (r ? "." + r.slice(0, 2) : ""); };
  const whole = (v) => (v / 100000000n).toLocaleString("en-US");
  const pl = (n, one, many) => fmt(n) + " " + (n === 1 ? one : (many || one + "s"));
  const g = (ks) => ks.reduce((a, k) => a + (kinds[k] || 0), 0);
  /* the burn line: total XCPETS, then how it compares with the day before */
  if (burns) {
    let vs = "";
    if (hPrev != null && prevSats > 0n) { const pct = Number((sats - prevSats) * 1000n / prevSats) / 10; vs = Math.abs(pct) < 1 ? " (same as " + dayName(day[0] - 864e5) + ")" : pct > 0 ? " (\u{1F53A} " + fmt(pct) + "% more than " + dayName(day[0] - 864e5) + ")" : " (\u{1F53B} " + fmt(-pct) + "% less than " + dayName(day[0] - 864e5) + ")"; }
    L.push("\u{1F525} " + whole(sats) + " XCPETS burned" + vs);
    L.push("\u{1F9FE} " + pl(burns, "burn") + " from " + pl(wallets.size, "wallet"));
    const top = [...wallets.values()].sort((a, b) => (b.sats > a.sats ? 1 : b.sats < a.sats ? -1 : 0))[0];
    if (top && wallets.size > 1) L.push("\u{1F40B} Whale of the day burned " + whole(top.sats) + " XCPETS in " + pl(top.n, "burn") + " (" + fmt(Number(top.sats * 100n / sats)) + "% of the whole day)");
  }
  if (hatched + bred) L.push("\u{1F95A} " + fmt(hatched + bred) + " new pets (" + fmt(hatched) + " hatched, " + fmt(bred) + " bred)" + (sats > 0n ? ", so " + fmt(Number(sats / 100000000n) / (hatched + bred)) + " XCPETS burned per new pet" : ""));
  if (best && (best[3] | 0) >= 2) { const b = petOf(P, best); L.push("\u{1F48E} Rarest newborn: " + b.name + " #" + b.id + ", " + an(TIER[b.tier]) + " " + TIER[b.tier] + " " + b.label); }
  if (mythics) L.push("✨ " + pl(mythics, "new Mythic") + (myPets[0] ? (mythics === 1 ? ": " : ", led by ") + myPets[0].name + " #" + myPets[0].id + " the " + myPets[0].label : ""));
  if (fed) L.push("\u{1F356} " + pl(fed, "pet") + " got a meal");
  if (died) L.push("\u{1FAA6} " + (died === 1 ? "1 pet" : fmt(died) + " pets") + " passed on to the Pet Cemetery, so keep those bowls full");
  const gv = {}; for (const k in kinds) if (RECAP_GRAVE[k]) gv[RECAP_GRAVE[k]] = (gv[RECAP_GRAVE[k]] || 0) + kinds[k];
  const grave = [[gv.altar, "altar offering"], [gv.seance, "séance"], [gv.rise, "pet back from the dead", "pets back from the dead"], [gv.zmeal, "zombie snack"]].filter((x) => x[0]).map((x) => pl(x[0], x[1], x[2]));
  if (grave.length) L.push("\u{1F9DF} Graveyard shift: " + grave.join(", "));
  const action = [[g(["raid"]), "raid hit"], [g(["grind"]), "pet thrown in the Meat Grinder", "pets thrown in the Meat Grinder"], [g(["dip"]), "pool dip"], [g(["roll", "spin", "usespin"]), "gear spin"]].filter((x) => x[0]).map((x) => pl(x[0], x[1], x[2]));
  if (action.length) L.push("\u{1F4A5} " + action.join(", "));
  if (W.cm.current) { const s = W.cm.stage, hi = s < 5 ? CM_T[s + 1] : null; L.push("\u{1F451} " + cm + " is " + an(STAGE[s]) + " " + STAGE[s] + (hi ? ", " + fmt(Math.max(0, hi - W.cm.fed)) + " XCPETS of snacks to " + STAGE[s + 1] : "")); }
  const extra = [["quest", kinds.quest], ["fight", (kinds.fight || 0) + (kinds.accept || 0) + (kinds.rumble || 0)], ["WAGMI", kinds.wagmi], ["pet token", kinds.deed]].filter((x) => x[1]).map((x) => fmt(x[1]) + " " + x[0] + (x[1] === 1 ? "" : "s"));
  if (extra.length) L.push("⚔️ " + extra.join(", "));
  if (big > 0n) L.push("\u{1F3C6} Biggest single burn: " + f8(big) + " XCPETS");
  L.push("", RECAP_VIBES[h32(label) % RECAP_VIBES.length] + " Go feed your pets \u{1F49B}");
  let text = noQuotes(L.join("\n"));
  if (text.length > 999) { const tail = "\n\nGo feed your pets \u{1F49B}"; text = text.slice(0, 999 - tail.length).replace(/\n[^\n]*$/, "") + tail; }
  /* picture: the day's star pet (top new Mythic, else the rarest newborn) when the site has its picture */
  let photoId = null;
  for (const id of myPets.slice(0, 3).map((p) => p.id).concat(best ? [best[0]] : [])) if (await hasThumb(id)) { photoId = id; break; }
  return { text, photoId, blocks: [hStart + 1, hEnd], counts: { burns, sats: String(sats), prevSats: String(prevSats), wallets: wallets.size, hatched, bred, fed, mythics, died, kinds } };
}

/* ---------------------------------------------------------------- FOMO (hatchbot/fomo.mjs)
 * Posts that celebrate something (hybrids, battles, milestones, Spam City, routines) get one short, true urgency line:
 * community pet % to Mythic + raiser prizes, the next feature gate, pets hatched so far. Never on warnings or the recap. */
const NO_FOMO = /^(warning_|recap|feed_lag)/;
export function withFomo(posts, s) {
  for (const p of posts) if (p && p.text && !NO_FOMO.test(p.type || "")) p.text = FOMO.add(p.text, s, (p.keys && p.keys[0]) || p.type + p.text.length, 1000);
  return posts;
}
const fomoState = (W, P, st) => ({ tip: Math.max(W ? W.tip : 0, P ? P.tip : 0, st.wt || 0), cm: W ? { current: W.cm.current, fed: W.cm.fed } : (st.cmFed ? { current: st.cmFed.current, fed: st.cmFed.fed } : null), hatched: (P && P.maxId) || st.hatched || 0 });

/* ---------------------------------------------------------------- state + sending */
const kv = (env) => env.HB_STATE || env.BUGS || null;
async function loadState(env) { const K = kv(env); if (!K) return null; try { return JSON.parse(await K.get(KEY) || "null") || {}; } catch (e) { return {}; } }
async function saveState(env, st) { const K = kv(env); if (!K || env.__dry) return; await K.put(KEY, JSON.stringify(st)); }
function enqueue(st, posts, nowMs) {
  st.q = st.q || [];
  for (const p of posts) {
    const v = violations(p.text);
    if (v.length) { (st.blocked = st.blocked || []).push({ type: p.type, why: v.join("; "), at: nowMs }); st.blocked = st.blocked.slice(-20); continue; }
    st.q.push(Object.assign({ at: nowMs }, p));
  }
}
export async function claimPost(env, it) {
  if (!env.DB || env.__dry) return true;
  const k = "post:" + (it.keys && it.keys[0] ? it.keys[0] : it.type + ":" + String(it.text).slice(0, 80));
  try {
    const r = await env.DB.prepare("INSERT OR IGNORE INTO kv(k, v) VALUES (?, ?)").bind(k, String(Date.now())).run();
    if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM kv WHERE k LIKE 'post:%' AND CAST(v AS INTEGER) < ?").bind(Date.now() - 30 * 864e5).run();
    return !(r && r.meta && r.meta.changes === 0);
  } catch (e) { console.log("claim failed", e && e.message); return true; }
}
async function sendOne(env, it, tg) {
  const chat = env.TELEGRAM_CHAT_ID; if (!chat) throw new Error("no TELEGRAM_CHAT_ID");
  if (it.photo) { const r = await tg(env, "sendPhoto", { chat_id: chat, photo: it.photo, caption: it.text }); if (r.ok) return r; }
  if (it.photoId) { const u = it.photoUrl || await picUrl(it.photoId); if (u) { const r = await tg(env, "sendPhoto", { chat_id: chat, photo: u + (u.startsWith(ART_RAW) ? "?v=" + Math.floor(Date.now() / 36e5) : ""), caption: it.text }); if (r.ok) return r; } }
  return tg(env, "sendMessage", { chat_id: chat, text: it.text, disable_web_page_preview: true });
}
async function drain(env, st, C, nowMs, tg) {
  const L = C.limits; st.sent = (st.sent || []).filter((t) => nowMs - t < 864e5);
  st.q = (st.q || []).filter((it) => nowMs - it.at < (L.expire_hours || 6) * 3600e3).sort((a, b) => (a.prio - b.prio) || (a.at - b.at));
  if (!st.q.length) return 0;
  if (st.sent.length >= L.max_per_day) return 0;
  if (st.sent.filter((t) => nowMs - t < 3600e3).length >= L.max_per_hour) return 0;
  if (st.sent.length && nowMs - Math.max(...st.sent) < (L.min_gap_s || 30) * 1000) return 0;
  /* a brand-new pet's picture is drawn by the next announcer run (a minute or two after the feed): wait up to 20 min for it */
  let pick = -1;
  for (let i = 0; i < st.q.length && i < 6; i++) {
    const x = st.q[i];
    if (!(x.photoId && x.photoWait && !x.photo) || nowMs - x.at >= 20 * 60e3) { pick = i; break; }
    x.photoUrl = await picUrl(x.photoId); if (x.photoUrl) { pick = i; break; }
  }
  if (pick < 0) return 0;
  const it = st.q.splice(pick, 1)[0]; st.sent.push(nowMs); /* at most once: counted before sending */
  /* KV (the queue's home) is only eventually consistent, so two cron runs a minute apart can both see an item as new
     (Breeding pen news posted twice, Nov 23 2026). D1 is consistent: claim the post's key there first, skip it if taken. */
  if (!(await claimPost(env, it))) { await saveState(env, st); return 0; }
  if (it.routine) routineSent(st, it, nowMs);
  await saveState(env, st);
  try { const r = await sendOne(env, it, tg); if (!r.ok) console.log("auto post failed", it.type, r.status); } catch (e) { console.log("auto post error", it.type, e && e.message); }
  return 1;
}
const anyOn = (C) => Object.values(C.chain || {}).some((v) => v === true) || C.ties === true || C.spamcity === true || (C.warnings || {}).feed_lag === true || Object.values(C.routines || {}).some((v) => v === true) || C.recap === true;

/* One cron run. Posts at most one queued item per run (cron is every 2 minutes); looks at the chain every watch_every_min. */
export async function autoTick(env, C, tg, nowMs, opt) {
  nowMs = nowMs || Date.now();
  if (C.announce !== true || !anyOn(C)) return { off: true };
  if (!kv(env)) return { off: "no KV binding" };
  const st = await loadState(env), res = {};
  if (!st.lastWatch || nowMs - st.lastWatch >= (C.limits.watch_every_min || 10) * 60e3 - 5e3) {
    st.lastWatch = nowMs;
    try { Object.assign(res, await watch(st, C, nowMs, opt)); } catch (e) { res.error = String(e && e.message || e); console.log("auto watch failed", res.error); }
    enqueue(st, res.posts || [], nowMs); res.queued = (res.posts || []).length; delete res.posts;
    await saveState(env, st);
  }
  res.sent = await drain(env, st, C, nowMs, tg);
  return res;
}
/* Look at the feeds once and return new posts. First look for each part records the state and posts nothing. */
export async function watch(st, C, nowMs, opt) {
  opt = opt || {};
  const ch = C.chain || {}, wantChain = C.__all || Object.values(ch).some((v) => v === true), wantRt = C.__all || Object.values(C.routines || {}).some((v) => v === true);
  const out = { posts: [] }, meta = await loadMeta();
  const needP = wantChain || wantRt || C.recap === true, needW = wantChain || (C.routines || {}).fight_night === true || C.recap === true || C.__all;
  let P = null, W = null;
  if (needW) W = await loadWorld(); /* world first: its big root.json is dropped before pets.json is parsed (Worker memory is 128 MB) */
  if (needP) P = await (opt.pets || loadPets)(); /* opt.pets lets worker.js share its cached pet list instead of holding two copies */
  if (wantChain) {
    const first = st.maxId == null;
    if (first) out.baseline = "chain at pets " + P.tip + " / world " + (W && W.tip);
    else if (!(P.tip < (st.pt || 0))) {
      let ev = chainEvents(P, W, meta, st, C);
      if (!opt.noStale) ev = ev.filter((e) => e.block == null || Math.max(P.tip, W ? W.tip : 0) - e.block <= (C.limits.stale_blocks || 36));
      out.posts.push(...batch(holdLegendaries(ev, st, nowMs, C.limits.legendary_digest_hours), st));
    }
    st.maxId = Math.max(st.maxId || 0, P.maxId); st.pt = P.tip;
    if (W) { st.wt = Math.max(st.wt || 0, W.tip); st.cm = { current: W.cm.current, stage: W.cm.stage }; st.cmFed = { current: W.cm.current, fed: W.cm.fed }; }
    st.burned = +meta.burnedXCPETS || st.burned || 0; st.pets = +meta.totalPets || st.pets || 0; st.hatched = Math.max(st.hatched || 0, P.maxId || 0);
  }
  if (C.ties === true || C.spamcity === true || C.__all) {
    const ties = await loadTies();
    if (C.ties === true || C.__all) { const r = tiePosts(ties, st, opt.all, nowMs, C.limits.ties_digest_hours); out.posts.push(...r.posts); if (r.baseline != null) out.tiesBaseline = r.baseline; }
    if (C.spamcity === true || C.__all) { try { const r = await spamCity(st, ties, opt.all); out.posts.push(...r.posts); if (r.baseline) out.spamcityBaseline = r.baseline; } catch (e) { out.spamcityError = e.message; } }
  }
  if ((C.warnings || {}).feed_lag === true || C.__all) out.posts.push(...lagPosts(meta, await chainTip(), st, C));
  if (wantRt) {
    const rp = routinePosts(P, W, st, C, nowMs, opt.forceRoutines);
    if (!st.rtInit && !opt.forceRoutines) { st.rtInit = nowMs; rp.forEach((x) => { st.rt.sent[x.keys[0]] = nowMs; }); out.routinesBaseline = rp.length; } /* first look: posts nothing */
    else out.posts.push(...rp);
  }
  if (C.recap === true) {
    const p = ctParts(nowMs);
    if (!st.recapInit) { st.recapInit = nowMs; st.recapDay = p.date; out.recapBaseline = p.date; } /* first look: the first recap is the next morning */
    if (p.h >= (C.recap_hour_ct || 8) && p.h < 12 && st.recapDay !== p.date) {
      const boot = await getJson(SITE + "/api/boot.json", 60), r = await recapFor(prevDay(nowMs), P, W, meta, boot);
      if (r.text) { st.recapDay = p.date; out.posts.push({ type: "recap", prio: 0, keys: ["recap:" + p.date], block: r.blocks[1], text: r.text, photoId: r.photoId || undefined }); }
      else out.recapWait = r.wait;
    }
  }
  if (C.fomo !== false) withFomo(out.posts, fomoState(W, P, st));
  return out;
}

/* ---------------------------------------------------------------- dry run (POST /selftest {"auto":"preview"}): never sends, never writes state.
 * Pretends the last look was `back` blocks ago, so every post type shows what it would have said about real recent data.
 * Milestones and the community stage are forced one step back so their wording shows too (marked sample). */
export async function preview(C, opts) {
  opts = opts || {}; const back = Math.max(1, Math.min(+opts.back || 144, 1000)), now = opts.now || Date.now(), out = [];
  const add = (posts, note) => (C.fomo !== false ? withFomo(posts, fomoState(W, P, {})) : posts).forEach((p) => out.push({ type: p.type, note: note || "", photo: p.photo || (p.photoId ? SITE + "/t/" + p.photoId + ".png" : null), text: p.text, chars: p.text.length, violations: violations(p.text) }));
  const meta = await loadMeta(), W = await loadWorld(), P = await ((opts && opts.pets) || loadPets)(), ties = await loadTies(), Call = Object.assign({}, C, { __all: true });
  let maxId = 0; for (const r of P.rows) if (r[18] <= P.tip - back && r[0] > maxId) maxId = r[0];
  const st = { maxId, pt: P.tip - back, wt: W.tip - back, cm: { current: W.cm.current, stage: W.cm.stage }, burned: +meta.burnedXCPETS, pets: +meta.totalPets, hatched: P.maxId };
  add(batch(holdLegendaries(chainEvents(P, W, meta, st, Call), st, now, 0), st), "real events in the last " + back + " blocks");
  const st2 = { maxId: P.maxId, pt: P.tip, wt: W.tip, cm: { current: W.cm.current, stage: Math.max(0, W.cm.stage - 1) }, burned: +meta.burnedXCPETS - (C.limits.burn_step || 1e6), pets: +meta.totalPets - (C.limits.pet_count_step || 1e4), hatched: P.maxId - (C.limits.pet_count_step || 1e4) };
  add(batch(chainEvents(P, W, meta, st2, Call), st2), "sample: milestone/stage wording with live numbers");
  const lastF = W.fights.slice().sort((a, b) => b.block - a.block)[0];
  if (lastF) { const st3 = { maxId: P.maxId, pt: P.tip, wt: lastF.block - 1, cm: st.cm, burned: st.burned, pets: st.pets }; add(batch(chainEvents(P, W, meta, st3, Call).filter((e) => e.type === "battle"), st3), "sample: the latest real arena battle (block " + lastF.block + ")"); }
  const tst = { ties: (ties.ties || []).filter((t) => +t.tiedBlock <= ties.lastBlock - back).map((t) => "tie:" + t.id + ":" + t.asset) };
  add(tiePosts(ties, tst, true).posts.slice(0, 3), "ties in the last " + back + " blocks (first 3)");
  try { const sst = { sc: { last: meta.blockHeight - Math.min(back, 59), posted: [] } }; add((await spamCity(sst, ties, true)).posts.slice(0, 5), "Spam City in the last " + Math.min(back, 59) + " blocks (the feed keeps ~60)"); } catch (e) { out.push({ type: "spamcity", error: e.message }); }
  if (!out.some((p) => /^spamcity_/.test(p.type || ""))) { const t = (ties.ties || [])[ties.ties.length - 1]; if (t) ["listing", "sale", "gift"].forEach((k) => add([{ type: "spamcity_" + k, text: scText({ type: k, pet: t, ask: 50000000000, pay: 50000000000, payAsset: "XCPETS" }), photo: SITE + "/t/" + t.id + ".png" }], "sample wording (no Spam City trades in the feed window), real tied pet, made-up amount")); }
  const lagC = { warnings: { lag_blocks: 12, caught_up_blocks: 3 } };
  add(lagPosts({ blockHeight: meta.blockHeight }, meta.blockHeight + 20, { lag: { state: "ok", n: 1 } }, lagC), "sample: feed 20 blocks behind");
  add(lagPosts({ blockHeight: meta.blockHeight }, meta.blockHeight, { lag: { state: "behind", n: 3 } }, lagC), "sample: caught up");
  out.push({ type: "feed_lag_now", note: "live check", lag: (await chainTip()) - meta.blockHeight });
  add(routinePosts(P, W, {}, C, now, true), "routines, forced now (normally at their CT hour)");
  try { const boot = await getJson(SITE + "/api/boot.json", 60), r = await recapFor(prevDay(now), P, W, meta, boot); if (r.text) add([{ type: "recap", text: r.text, photoId: r.photoId }], "recap for the previous CT day, blocks " + r.blocks.join("-")); else out.push({ type: "recap", wait: r.wait }); } catch (e) { out.push({ type: "recap", error: e.message }); }
  return { tips: { meta: meta.blockHeight, pets: P.tip, world: W.tip }, communityPet: cmName(meta, W), posts: out };
}
