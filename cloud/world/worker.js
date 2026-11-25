/* XCPETS world copy (Nov 25 2026, owner: "is there a better or cheaper way to serve the game"). A Cloudflare Worker over an R2
 * bucket that holds a copy of the published pet world, so pages keep loading pets when the game server (node.xcpets.fun) is down
 * or its world falls behind. It serves the same paths as the server:
 *   GET /xp/v1/world/latest.json             the newest world copied here ("manifest" is an absolute URL on this Worker)
 *   GET /xp/v1/world/<rsig>/latest.json      the newest world for one rules signature
 *   GET /xp/v1/world/<rsig>/<tip>/<file>     one file of that world (manifest, parts, view/..., graves/...)
 *   GET /status                              what is here (kept worlds)
 * Storage (bucket binding WORLD): one world = one pack (w/<rsig>/<tip>.pack: every file gzipped, back to back) plus its index
 * (w/<rsig>/<tip>.txt: one "<file path> <offset> <length>" line per file). A file is one ranged read of the pack. Every world file
 * carries its tip, so worlds share no bytes; a pack keeps a new world at 2 writes instead of ~7,000 (R2's free tier is 1 million
 * writes a month). The index is searched as text, never parsed, to stay inside the free plan's 10 ms of CPU per request.
 * Writes (/m/...) need the X-Mirror-Key header (secret MIRROR_KEY, set by .github/workflows/world-copy.yml). The world is public
 * data; nothing secret is stored here. */
const RSIG = /^r[0-9a-f]{32}$/, TIP = /^\d{1,9}$/;
const REL = /^(?:[A-Za-z0-9_-]+\/){0,3}[A-Za-z0-9_.-]+\.json$/;
const KEEP_PER_RSIG = 3, KEEP_RSIGS = 2;
const CORS = { "Access-Control-Allow-Origin": "*" };
const JSON_H = Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS);

function json(body, status, cache) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({}, JSON_H, { "Cache-Control": cache || "no-store" }) });
}
async function getJson(env, key) { const o = await env.WORLD.get(key); if (!o) return null; try { return JSON.parse(await o.text()); } catch (e) { return null; } }
async function putJson(env, key, v) { await env.WORLD.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } }); }
function same(a, b) { a = String(a || ""); b = String(b || ""); if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function safeRel(rel) { return REL.test(rel) && !rel.split("/").some(s => s === "." || s === ".."); }
function absolute(latest, origin) {
  if (!latest) return null;
  const out = Object.assign({}, latest);
  if (out.manifest && !/^https?:/.test(out.manifest)) out.manifest = origin + out.manifest;
  out.copy = 1;
  return out;
}
const packKey = (rsig, tip) => "w/" + rsig + "/" + tip + ".pack";
const idxKey = (rsig, tip) => "w/" + rsig + "/" + tip + ".txt";

/* a few world indexes stay in memory per isolate (each is ~0.5 MB of text) */
const IDX = new Map();
async function indexOf(env, rsig, tip) {
  const k = idxKey(rsig, tip);
  if (IDX.has(k)) return IDX.get(k);
  const o = await env.WORLD.get(k); if (!o) return null;
  const t = "\n" + (await o.text());
  IDX.set(k, t); while (IDX.size > 4) IDX.delete(IDX.keys().next().value);
  return t;
}
/* -> { offset, length } or null */
function lookup(text, rel) {
  const i = text.indexOf("\n" + rel + " "); if (i < 0) return null;
  const end = text.indexOf("\n", i + 1), m = /^(\d+) (\d+)$/.exec(text.slice(i + rel.length + 2, end < 0 ? undefined : end));
  return m ? { offset: +m[1], length: +m[2] } : null;
}
/* "<rel> <offset> <length>" lines, back to back from 0 -> { n, size } or { bad } */
function checkIndex(text) {
  const lines = String(text).split("\n").filter(Boolean); let at = 0;
  for (const l of lines) {
    const m = /^(\S+) (\d+) (\d+)$/.exec(l);
    if (!m || !safeRel(m[1]) || +m[2] !== at || !(+m[3] > 0)) return { bad: l.slice(0, 80) };
    at += +m[3];
  }
  return { n: lines.length, size: at };
}

async function serveFile(req, env, rsig, tip, rel) {
  const idx = await indexOf(env, rsig, tip);
  const at = idx && lookup(idx, rel);
  if (!at) return json({ v: 1, error: "not here" }, 404, "public, max-age=30");
  const o = await env.WORLD.get(packKey(rsig, tip), { range: at });
  if (!o || !o.body) return json({ v: 1, error: "missing" }, 404, "no-store");
  const immutable = !/(^|\/)manifest\.json$/.test(rel);
  const h = Object.assign({}, JSON_H, { "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=60", ETag: '"' + rsig.slice(1, 9) + "-" + tip + "-" + at.offset + '"' });
  if (req.method === "HEAD") { o.body.cancel(); return new Response(null, { headers: h }); }
  if (/\bgzip\b/.test(req.headers.get("accept-encoding") || "")) {
    h["Content-Encoding"] = "gzip";
    return new Response(o.body, { headers: h, encodeBody: "manual" });
  }
  return new Response(o.body.pipeThrough(new DecompressionStream("gzip")), { headers: h });
}

/* the kept worlds: [{ rsig, tip, at }] */
async function keepList(env) { const k = await getJson(env, "keep.json"); return Array.isArray(k) ? k : []; }
function prune(list) {
  const bySig = new Map();
  list.forEach(w => { if (!bySig.has(w.rsig)) bySig.set(w.rsig, []); bySig.get(w.rsig).push(w); });
  const newest = s => Math.max(...bySig.get(s).map(w => w.at));
  const sigs = Array.from(bySig.keys()).sort((a, b) => newest(b) - newest(a));
  const keep = [], drop = [];
  sigs.forEach((s, i) => { bySig.get(s).sort((a, b) => b.tip - a.tip).forEach((w, j) => { (i < KEEP_RSIGS && j < KEEP_PER_RSIG ? keep : drop).push(w); }); });
  keep.sort((a, b) => a.at - b.at);
  return { keep, drop };
}

async function write(req, env, p) {
  if (!env.MIRROR_KEY || !same(req.headers.get("x-mirror-key"), env.MIRROR_KEY)) return json({ v: 1, error: "no" }, 403);
  let m = /^\/m\/w\/(r[0-9a-f]{32})\/(\d{1,9})\.(pack|txt)$/.exec(p);
  if (req.method === "PUT" && m) {
    /* a published world never changes under its address (pages cache its files forever) */
    if ((await keepList(env)).some(w => w.rsig === m[1] && w.tip === +m[2])) return json({ v: 1, error: "already published" }, 409);
    if (m[3] === "txt") {
      const text = await req.text(), c = checkIndex(text);
      if (c.bad || !c.n || !lookupOk(text)) return json({ v: 1, error: "bad index " + (c.bad || "(no manifest.json)") }, 400);
      const pack = await env.WORLD.head(packKey(m[1], m[2]));
      if (!pack || pack.size !== c.size) return json({ v: 1, error: "pack size " + (pack ? pack.size : "missing") + " vs index " + c.size }, 400);
      await env.WORLD.put(idxKey(m[1], m[2]), text, { httpMetadata: { contentType: "text/plain" } });
      IDX.delete(idxKey(m[1], m[2]));
      return json({ v: 1, ok: true, n: c.n, size: c.size });
    }
    if (!req.body) return json({ v: 1, error: "empty" }, 400);
    const o = await env.WORLD.put(packKey(m[1], m[2]), req.body, { httpMetadata: { contentType: "application/octet-stream" } });
    return json({ v: 1, ok: true, size: o ? o.size : null });
  }
  if (req.method === "POST" && p === "/m/publish") {
    const b = await req.json();
    if (!b || !RSIG.test(b.rsig || "") || !TIP.test(String(b.tip))) return json({ v: 1, error: "rsig/tip" }, 400);
    const idx = await indexOf(env, b.rsig, b.tip);
    if (!idx || !lookup(idx, "manifest.json")) return json({ v: 1, error: "no index" }, 400);
    const latest = { v: 1, rsig: b.rsig, tip: +b.tip, manifest: "/xp/v1/world/" + b.rsig + "/" + b.tip + "/manifest.json", builtAt: String(b.builtAt || new Date().toISOString()).slice(0, 40), source: String(b.source || "copy").slice(0, 40) };
    /* the per-rules pointer first, so latest.json never names a world whose own pointer is missing (same order as the server) */
    const own = await getJson(env, "r/" + b.rsig + "/latest.json");
    if (!own || !(own.tip > latest.tip)) await putJson(env, "r/" + b.rsig + "/latest.json", latest);
    const cur = await getJson(env, "latest.json");
    if (!cur || cur.rsig !== latest.rsig || !(cur.tip > latest.tip)) await putJson(env, "latest.json", latest);
    const list = (await keepList(env)).filter(w => !(w.rsig === latest.rsig && w.tip === latest.tip));
    list.push({ rsig: latest.rsig, tip: latest.tip, at: Date.now() });
    const { keep, drop } = prune(list);
    await putJson(env, "keep.json", keep);
    const sigsLeft = new Set(keep.map(w => w.rsig));
    for (const w of drop) {
      await env.WORLD.delete([idxKey(w.rsig, w.tip), packKey(w.rsig, w.tip)]); IDX.delete(idxKey(w.rsig, w.tip));
      if (!sigsLeft.has(w.rsig)) await env.WORLD.delete("r/" + w.rsig + "/latest.json");
    }
    return json({ v: 1, ok: true, latest, kept: keep.length, dropped: drop.length });
  }
  return json({ v: 1, error: "not found" }, 404);
}
function lookupOk(text) { return !!lookup("\n" + text, "manifest.json"); }

const worker = {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: Object.assign({ "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Max-Age": "86400" }, CORS) });
    try {
      if (p.indexOf("/m/") === 0) return await write(req, env, p);
      if (req.method !== "GET" && req.method !== "HEAD") return json({ v: 1, error: "read only" }, 405);
      if (p === "/xp/v1/world/latest.json") return json(absolute(await getJson(env, "latest.json"), url.origin) || { v: 1, ready: false }, 200, "public, max-age=5");
      let m = /^\/xp\/v1\/world\/(r[0-9a-f]{32})\/latest\.json$/.exec(p);
      if (m) { const l = absolute(await getJson(env, "r/" + m[1] + "/latest.json"), url.origin); return l ? json(l, 200, "public, max-age=5") : json({ v: 1, ready: false }, 404, "public, max-age=5"); }
      m = /^\/xp\/v1\/world\/(r[0-9a-f]{32})\/(\d{1,9})\/(.+)$/.exec(p);
      if (m && safeRel(m[3])) return await serveFile(req, env, m[1], m[2], m[3]);
      if (p === "/status" || p === "/") return json({ v: 1, what: "XCPETS world copy", code: env.CODE || "", latest: await getJson(env, "latest.json"), kept: await keepList(env) }, 200, "no-store");
      return json({ v: 1, error: "not found" }, 404, "public, max-age=60");
    } catch (e) {
      return json({ v: 1, error: "failed" }, 500);
    }
  }
};
export default worker;
export { prune, absolute, lookup, checkIndex, REL };
