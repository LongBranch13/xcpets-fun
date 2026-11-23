/* Post the daily recap (yesterday, Central time) to Telegram right now, by hand.
 * The Cloudflare Worker (hatchbot/auto.js) posts it by itself every morning at 8 AM CT; this is for a repost after a recap change.
 *   node hatchbot/post-recap.mjs --dry     prints the recap, sends nothing
 *   node hatchbot/post-recap.mjs           posts it (needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
 * GitHub: Actions > hatchbot > Run workflow > recap: yes. Read-only toward the game: public feeds only. */
import * as A from "./auto.js";
const dry = process.argv.includes("--dry");
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + " HTTP " + r.status); return r.json(); };
const [meta, W, P, boot] = await Promise.all([A.loadMeta(), A.loadWorld(), A.loadPets(), get("https://xcpets.fun/api/boot.json")]);
const r = await A.recapFor(A.prevDay(Date.now()), P, W, meta, boot);
if (!r.text) { console.log("No recap yet: " + r.wait); process.exit(1); }
console.log(r.text + "\n\n(" + r.text.length + " chars, picture: " + (r.photoId ? "pet #" + r.photoId : "none") + ", blocks " + r.blocks.join("-") + ")");
const bad = A.violations(r.text);
if (bad.length) { console.log("Blocked by the post guard: " + bad.join("; ")); process.exit(1); }
if (dry) process.exit(0);
const tok = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
if (!tok || !chat) { console.log("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set: nothing posted."); process.exit(1); }
const tg = async (method, body) => { const x = await fetch("https://api.telegram.org/bot" + tok + "/" + method, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return x.json(); };
let res = r.photoId ? await tg("sendPhoto", { chat_id: chat, photo: "https://xcpets.fun/t/" + r.photoId + ".png", caption: r.text }) : null;
if (!res || !res.ok) res = await tg("sendMessage", { chat_id: chat, text: r.text, disable_web_page_preview: true });
console.log(res.ok ? "Posted." : "Telegram said no: " + (res.description || "unknown"));
process.exit(res.ok ? 0 : 1);
