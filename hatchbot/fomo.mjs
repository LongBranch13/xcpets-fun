/* HatchBot FOMO lines (Nov 24 2026). Jake: "let's have hatchbot create fomo with its posts".
 * One short urgency line is added under HatchBot's automatic posts (hatchbot/auto.js on the Worker and hatchbot/announce.js
 * on GitHub Actions). Hard rule: every line must be TRUE. Lines are built only from live game numbers (community pet care,
 * the chain tip) and from block gates that are already set in js/v2-rules.js. Never invent scarcity, prices or deadlines.
 * When a gate below passes, its line simply stops showing; add new ones here when a new feature gets its block.
 * Pure functions, no fetches: shared by the Worker (ESM) and announce.js (dynamic import). */

/* Community pet Mythic target (COMMUNITY_THRESHOLDS[5] in js/v2-rules.js, never halves). */
export const COMMUNITY_MYTHIC = 6906900;
/* What the current community pet's Mythic gives (js/v2-rules.js RAISER_PRIZES with RAISER_MIN 69 / RAISER_TOP 3, COMMUNITY_HANDOFF).
 * Only pets whose prizes and successor are switched on in the rules belong here. */
export const COMMUNITY = {
  rabbit: { name: "The White Rabbit", prize: "a Golden Carrot \u{1F955}", top: "the Mad Hatter top hat \u{1F3A9}", next: "community pet #7 moves in \u{1F440}" },
};
export const RAISER_MIN = 69;
/* Upcoming switches already set in the rules (block, what opens). Shown only while the block is ahead and within `within` blocks. */
export const SOON = [
  { block: 977440, within: 288, text: "\u{1F3CA} Pool Dip opens in ~{n} blocks ({t}): dunk a pet in Gooby's pool and its breed cooldown is cut in HALF." },
  { block: 979058, within: 2016, text: "\u{1F331} SEASON 1 opens in ~{n} blocks ({t}). Only 690 Season eggs. Ever." },
];

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
function h32(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/* ~10 minutes a block */
export function eta(blocks) { const m = blocks * 10; if (m < 90) return "about " + Math.max(10, Math.round(m / 10) * 10) + " min"; const h = m / 60; if (h < 36) return "about " + Math.round(h) + " hours"; return "about " + Math.round(h / 24) + " days"; }

/** lines(s): every true FOMO line for this moment. s = { tip, cm: { current, fed }, hatched } (any part may be missing). */
export function lines(s) {
  s = s || {}; const out = [], tip = +s.tip || 0, cm = s.cm || {}, C = COMMUNITY[cm.current];
  if (C && cm.fed > 0 && cm.fed < COMMUNITY_MYTHIC) {
    const pct = Math.floor(cm.fed / COMMUNITY_MYTHIC * 100);
    out.push("⏳ " + C.name + " is " + pct + "% of the way to Mythic. Burn " + RAISER_MIN + "+ XCPETS before it gets there = " + C.prize + ". Top 3 raisers also get " + C.top + ".");
    out.push("⏳ " + C.name + " is " + pct + "% to Mythic. When it hits, every burn costs HALF and " + C.next);
    if (pct >= 80) out.push("\u{1F6A8} " + C.name + " is " + pct + "% to Mythic. Last chance to get on the raiser list!");
  }
  if (tip) for (const g of SOON) { const n = g.block - tip; if (n > 0 && n <= g.within) out.push(g.text.replace("{n}", fmt(n)).replace("{t}", eta(n))); }
  if (s.hatched > 0) out.push("\u{1F95A} " + fmt(s.hatched) + " pets hatched so far. Every block, someone else cracks an egg. The next Legendary could be yours.");
  return out;
}
/** line(s, seed): one line, picked by the post's key so lines rotate between posts (and a post always gets the same line). */
export function line(s, seed) { const L = lines(s); return L.length ? L[h32(seed) % L.length] : ""; }
/** add(text, s, seed, max): text + a blank line + one FOMO line, only when it fits under max characters (photo captions: 1024). */
export function add(text, s, seed, max) {
  max = max || 1000; const f = line(s, seed);
  if (!f || !text || text.indexOf(f) >= 0) return text;
  const t = String(text) + "\n\n" + f;
  return t.length <= max ? t : text;
}
