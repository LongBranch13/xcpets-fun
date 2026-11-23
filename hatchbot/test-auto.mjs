/* Local test of hatchbot/auto.js against the live public feeds. Sends nothing: Telegram and KV are mocked.
 *   node hatchbot/test-auto.mjs [back-blocks]     prints every post type (preview) and runs a full tick cycle */
import fs from "fs";
import * as A from "./auto.js";
const C = JSON.parse(fs.readFileSync(new URL("./auto-config.json", import.meta.url), "utf8"));
const back = +(process.argv[2] || 144);
const fails = []; const ok = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails.push(name); };
const sent = [];
const tg = async (env, method, body) => { sent.push({ method, body }); return { ok: true, status: 200 }; };
const store = new Map(), KV = { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } };
const env = { HB_STATE: KV, TELEGRAM_CHAT_ID: "-100test" };

/* 1) guard */
ok("guard blocks wallet addresses", A.violations("hi bc1qexampleexampleexampleexample0").length > 0);
ok("guard blocks connection details and the banned name", ["at home", ["st", "art9 box"].join(""), "abc." + "on" + "ion", ["g", "-m0ney"].join("")].every((t) => A.violations(t).length));
ok("guard allows xcpets.fun links", A.violations("See https://xcpets.fun/pet.html?id=42").length === 0);
ok("guard blocks other links", A.violations("see example.com").length > 0);

/* 2) everything off: no fetch, no state */
ok("all switches off: nothing runs", (await A.autoTick(env, C, tg)).off === true && store.size === 0);

/* 3) preview: every post type from live data */
const t0 = Date.now(), pv = await A.preview(C, { back });
console.log("\n=== preview (back " + back + " blocks) in " + (Date.now() - t0) + " ms, tips " + JSON.stringify(pv.tips) + ", community pet: " + pv.communityPet);
for (const p of pv.posts) console.log("\n--- " + p.type + (p.note ? "  [" + p.note + "]" : "") + (p.photo ? "  photo " + p.photo : "") + (p.violations && p.violations.length ? "  VIOLATIONS " + p.violations.join(";") : "") + (p.chars ? "  (" + p.chars + " chars)" : "") + "\n" + (p.text || JSON.stringify(p)));
ok("no preview post breaks the guard", pv.posts.every((p) => !p.violations || !p.violations.length));
const rc = pv.posts.find((p) => p.type === "recap");
if (rc && rc.text) {
  ok("recap starts with the date line", /^\u2600\uFE0F GM! XCPETS daily recap for \w+day, \w{3} \d{1,2}\n/u.test(rc.text));
  ok("recap ends with Go feed your pets", rc.text.endsWith("Go feed your pets \u{1F49B}"));
  ok("recap under 1,000 chars", rc.text.length < 1000);
  ok("recap has no ASCII double quotes", !rc.text.includes('"'));
  ok("recap names the live community pet", rc.text.includes(pv.communityPet));
}
const all = pv.posts.map((p) => p.text || "").join("\n");
ok("no wallet address in any post", !/\b(bc1|tb1)[a-z0-9]{6,}/i.test(all));

/* 4) full tick cycle with every switch on: first run records state and posts nothing */
const ON = JSON.parse(JSON.stringify(C)); ON.announce = true; for (const k in ON.chain) ON.chain[k] = true; ON.ties = true; ON.spamcity = true; ON.warnings.feed_lag = true; for (const k in ON.routines) ON.routines[k] = true; ON.recap = true;
const now = Date.now(), r1 = await A.autoTick(env, ON, tg, now);
console.log("\nfirst tick:", JSON.stringify(r1));
ok("first tick posts nothing", sent.length === 0 && r1.sent === 0);
const st1 = JSON.parse(store.get("hb:auto:state"));
ok("first tick saved a baseline", st1.maxId > 0 && st1.wt > 0 && Array.isArray(st1.ties) && st1.sc && st1.sc.last > 0);
const r2 = await A.autoTick(env, ON, tg, now + 60e3);
ok("second tick 1 min later does not look at the chain again", r2.queued === undefined);
/* simulate a backlog of 10 items: caps hold (one post per run, 6 per hour) */
const st = JSON.parse(store.get("hb:auto:state")); st.q = Array.from({ length: 10 }, (_, i) => ({ type: "test", prio: 1, keys: ["t" + i], text: "Test post " + i, at: now })); st.lastWatch = now; store.set("hb:auto:state", JSON.stringify(st));
let n = 0; for (let i = 0; i < 40; i++) n += (await A.autoTick(env, ON, tg, now + 120e3 + i * 120e3)).sent || 0;
ok("hourly cap holds (6 per hour, 1 per 2-minute run) -> " + n + " sent in 80 min", n >= 6 && n <= 12);
ok("test posts went to the configured chat only", sent.every((s) => s.body.chat_id === "-100test"));
console.log("\n" + (fails.length ? fails.length + " FAILED: " + fails.join(", ") : "all checks passed"));
process.exit(fails.length ? 1 : 0);
