/* Game server watch (Nov 24 2026, owner: "we can't have the game going down or the servers freezing"). Runs inside HatchBot's
 * Cloudflare cron (every 2 minutes, which unlike GitHub's cron really runs on time) and checks every 4 minutes:
 *   - does the game server (node.xcpets.fun/xp/v1/health) answer?
 *   - is its chain follower keeping up with the real chain (mempool.space, then blockstream.info)? Nov 23 2026 it sat at 977,257
 *     for hours while the chain moved on, and nothing noticed because every check compared the server with itself.
 *   - is the published world (the fast load) within 18 blocks of the chain?
 *   - is the burn feed (xcpets.fun/api/meta.json, what /burns and the site's first paint read) within 12 blocks of the chain?
 *     Nov 24 2026: the feed job stopped at 977,257 for 16 hours while the server and world were fine, and only a /burns
 *     reply showed it. World watch now also starts the GitHub backup feed by itself when the feed lags.
 * A problem seen on 2 checks in a row sends one Telegram alert, a reminder every hour while it lasts, and an all clear with how
 * long it lasted. Recipients: TELEGRAM_ALERT_CHAT_ID (secret, comma list) and private chats that sent /alerts to the bot.
 * Read-only: it only reads public URLs. Messages name block numbers only, never server details. */
export const NODE = "https://node.xcpets.fun", SITE = "https://xcpets.fun";
export const EVERY_MS = 4 * 60 * 1000;
export const FOLLOW_BEHIND_MAX = 3, WORLD_BEHIND_MAX = 18, FEED_BEHIND_MAX = 12, STUCK_STEP_S = 600, CONFIRM = 2, REMIND_MS = 60 * 60 * 1000, MAX_SUBS = 25;

async function timed(url, ms, as) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "hatchbot-serverwatch" }, cf: { cacheTtl: 0 } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return as === "text" ? await r.text() : await r.json(); } finally { clearTimeout(t); }
}
export async function readHealth(get) { try { return await (get || timed)(NODE + "/xp/v1/health?cb=" + Date.now(), 15000); } catch (e) { return null; } }
export async function readFeedTip(get) { try { const m = await (get || timed)(SITE + "/api/meta.json?cb=" + Date.now(), 15000); return Number(m && (m.blockHeight || m.tip)) || null; } catch (e) { return null; } }
export async function realHeight(get) {
  for (const u of ["https://mempool.space/api/blocks/tip/height", "https://blockstream.info/api/blocks/tip/height"]) {
    try { const n = parseInt(String(await (get || timed)(u, 10000, "text")).trim(), 10); if (n > 0) return n; } catch (e) { }
  }
  return null;
}
/* what is wrong right now: { code, text } or null */
export function judge(h, real, feedTip) {
  if (!h) return { code: "down", text: "The game server is not answering." };
  const tip = h.tip || 0, loop = h.loop || null;
  if (loop && loop.stepSec >= STUCK_STEP_S) return { code: "stuck", text: "The game server's chain follower is stuck (one step running " + Math.round(loop.stepSec / 60) + " min, at block " + tip + ")." };
  if (loop && loop.restarts1h >= 3) return { code: "crashloop", text: "The game server keeps restarting (" + loop.restarts1h + " times in the last hour, at block " + tip + "). Usually that's running out of memory." };
  if (real && tip && real - tip >= FOLLOW_BEHIND_MAX) return { code: "behind", text: "The game server stopped following the chain: block " + tip + ", the chain is at " + real + " (" + (real - tip) + " behind). New burns don't show." };
  const w = h.lastSnapshotTip || 0, top = Math.max(tip, real || 0);
  if (w && top - w > WORLD_BEHIND_MAX) return { code: "world", text: "The fast-load world is " + (top - w) + " blocks behind (world " + w + ", chain " + top + "). Players get the slow load." };
  if (feedTip && real && real - feedTip > FEED_BEHIND_MAX) return { code: "feed", text: "The burn feed is " + (real - feedTip) + " blocks behind (feed " + feedTip + ", chain " + real + "). /burns and the site's first load show old numbers; the game itself is fine." };
  return null;
}
function mins(ms) { const m = Math.round(ms / 60000); return m < 90 ? m + " min" : (Math.round(m / 6) / 10) + " h"; }

/* store: { get(k) -> string|null, put(k, v) } */
export function storeOf(env) {
  if (env.DB) return {
    get: async (k) => { const r = await env.DB.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first(); return r ? r.v : null; },
    put: async (k, v) => { await env.DB.prepare("INSERT OR REPLACE INTO kv(k, v) VALUES (?, ?)").bind(k, v).run(); } };
  const kv = env.HB_STATE || env.BUGS;
  if (kv) return { get: (k) => kv.get(k), put: (k, v) => kv.put(k, v) };
  return null;
}
async function getJ(store, k, d) { try { const v = await store.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
export async function recipients(env, store) {
  const fixed = String(env.TELEGRAM_ALERT_CHAT_ID || "").split(",").map(s => s.trim()).filter(Boolean);
  const subs = store ? await getJ(store, "sw:subs", []) : [];
  return Array.from(new Set(fixed.concat(subs.map(String))));
}
/* /alerts in a private chat: turn server alerts on or off for that chat */
export async function toggleAlerts(env, chatId) {
  const store = storeOf(env); if (!store) return "Alerts need the bot's storage, which isn't set up.";
  const subs = (await getJ(store, "sw:subs", [])).map(String), id = String(chatId), i = subs.indexOf(id);
  if (i >= 0) { subs.splice(i, 1); await store.put("sw:subs", JSON.stringify(subs)); return "🔕 Game server alerts are off for this chat. Send /alerts again to turn them back on."; }
  if (subs.length >= MAX_SUBS) return "The alert list is full.";
  subs.push(id); await store.put("sw:subs", JSON.stringify(subs));
  return "🔔 Game server alerts are on. I'll message you here within about 10 minutes if the game server stops answering, freezes or falls behind the chain, and again when it's fine. Send /alerts again to turn them off.";
}
/* /status: one short answer for anyone */
export async function statusText(get) {
  const [h, real, feed] = await Promise.all([readHealth(get), realHeight(get), readFeedTip(get)]);
  const bad = judge(h, real, feed);
  const line = h ? "Game server at block " + (h.tip || "?") + (real ? " (chain " + real + ")" : "") + ", fast-load world at " + (h.lastSnapshotTip || "?") + (feed ? ", burn feed at " + feed : "") + "." : "";
  return (bad ? "⚠️ " + bad.text : "✅ The game server is up and following the chain.") + (line ? "\n" + line : "");
}
/* one cron step. tg(env, method, body). Returns what it did (for logs and tests). */
export async function serverWatch(env, tg, now, opts) {
  now = now || Date.now(); opts = opts || {};
  const store = opts.store || storeOf(env); if (!store) return { off: "no storage" };
  const st = await getJ(store, "sw:state", { at: 0, bad: null, seen: 0, since: 0, alertedAt: 0, alerted: false });
  if (!opts.force && now - (st.at || 0) < EVERY_MS - 20000) return { skip: true };
  const [h, real, feed] = await Promise.all([readHealth(opts.get), realHeight(opts.get), readFeedTip(opts.get)]);
  const bad = judge(h, real, feed), out = { bad: bad && bad.code, sent: 0 };
  st.at = now;
  const send = async (text) => { for (const chat of await recipients(env, store)) { try { const r = await tg(env, "sendMessage", { chat_id: chat, text, disable_web_page_preview: true }); if (!r || r.ok !== false) out.sent++; } catch (e) { } } };
  if (bad) {
    if (st.bad) st.seen = (st.seen || 0) + 1; else { st.seen = 1; st.since = now; }
    st.bad = bad.code;
    if (st.seen >= CONFIRM && !st.alerted) {
      await send("🚨 XCPETS: " + bad.text + "\nIt has lasted about " + mins(now - st.since + EVERY_MS) + (bad.code === "feed" ? ". World watch starts the backup feed on GitHub by itself within about 15 minutes." : ". The server restarts a stuck follower by itself within about 10 minutes; if it's still bad after 25 minutes, it gets rebooted automatically."));
      st.alerted = true; st.alertedAt = now; out.alert = true;
    } else if (st.alerted && now - st.alertedAt >= REMIND_MS) {
      await send("⏳ XCPETS, still happening (" + mins(now - st.since) + "): " + bad.text); st.alertedAt = now; out.remind = true;
    }
  } else {
    if (st.alerted) { await send("✅ XCPETS: the game server is fine again (block " + ((h && h.tip) || "?") + "). The problem lasted about " + mins(now - st.since) + "."); out.clear = true; }
    st.bad = null; st.seen = 0; st.since = 0; st.alerted = false; st.alertedAt = 0;
  }
  await store.put("sw:state", JSON.stringify(st));
  return out;
}
