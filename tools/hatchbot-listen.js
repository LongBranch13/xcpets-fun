#!/usr/bin/env node
/* HatchBot listener for a new Pantheon seat. The site never runs this. The HatchBot server runs it
 * on its timer (the server deploy is separate). It calls tools/hatchbot-pantheon.js.
 *
 * Quiet unless both gates are on:
 *   env    HATCHBOT_PANTHEON=1
 *   config enabled: true     file HATCHBOT_CONFIG (default tools/hatchbot-config.json), key "enabled"
 * Posting also needs config.token and config.chat (or HATCHBOT_TOKEN and HATCHBOT_CHAT).
 *
 * Seen file: HATCHBOT_PANTHEON_SEEN, or $HATCHBOT_DATA/hatchbot-pantheon-seen.json, or var/hatchbot-pantheon-seen.json.
 * Keep that file across deploys. The first enabled run records seats already filled and posts nothing.
 * A seat that appears after that is posted once. The same seat tx is never posted again.
 *   node tools/hatchbot-listen.js     (one pass; sends nothing unless both gates and token and chat are set)
 */
'use strict';
const fs = require('fs'), path = require('path');
const HB = require('./hatchbot-pantheon');
const CONFIG_KEY = 'enabled';
function configPath() { return process.env.HATCHBOT_CONFIG || path.join(__dirname, 'hatchbot-config.json'); }
function seenPath() { return process.env.HATCHBOT_PANTHEON_SEEN || path.join(process.env.HATCHBOT_DATA || path.join(__dirname, '..', 'var'), 'hatchbot-pantheon-seen.json'); }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function readConfig() {
  const file = readJson(configPath()) || {};
  return { enabled: file.enabled === true, token: file.token || process.env.HATCHBOT_TOKEN || null, chat: file.chat || process.env.HATCHBOT_CHAT || null };
}
function readStore(p) { const s = readJson(p); if (!s || s.baseline !== true) return { baseline: false, keys: [] }; return { baseline: true, keys: Array.isArray(s.keys) ? s.keys : [] }; }
function writeStore(p, keys) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify({ baseline: true, keys: keys }) + '\n');
  fs.renameSync(tmp, p);
}
function loadWorld() {
  const { load, snap, run } = require('./lib/load-rules');
  const c = load(), boot = path.join(__dirname, '..', 'api', 'boot.json');
  const S = fs.existsSync(boot) ? JSON.parse(fs.readFileSync(boot, 'utf8')) : snap();
  return run(c, S, [], S.tip);
}
/* run(o): one listener pass. o.w skips the replay. o.store skips the seen file. o.send skips Telegram. */
async function run(o) {
  o = o || {};
  const config = Object.assign(readConfig(), o.config || {});
  if (o.enabled === true) config.enabled = true;
  if (o.enabled === false) config.enabled = false;
  const file = o.seenFile || seenPath();
  const store = o.store || (Array.isArray(o.seen) ? { baseline: true, keys: o.seen } : readStore(file));
  const persist = o.store == null && !Array.isArray(o.seen);
  const result = await HB.tick({ w: o.w || null, enabled: config.enabled === true, store: store, cfg: { enabled: config.enabled === true, token: config.token || null, chat: config.chat || null }, send: o.send, verse: o.verse, title: o.title, species: o.species });
  if (persist && result.reason !== 'disabled') writeStore(file, result.seen || []);
  return result;
}
module.exports = { run, loadWorld, configPath, seenPath, readConfig, CONFIG_KEY, ENV: HB.ENV };
if (require.main === module) {
  run({ w: loadWorld() }).then(r => { console.log(JSON.stringify({ reason: r.reason, posted: r.posted, baselined: r.baselined || [], seen: (r.seen || []).length })); }, e => { console.error(e.stack || e); process.exit(1); });
}
