'use strict';
// HatchBot fun routines (STAGED, every routine default OFF). Config: config.json "routines": { "<name>": { "enabled": true, ... } }.
// Images come from render.js (site's own canvas code). Captions pass tg.announceViolations (no price words, domains, @mentions)
// before any send. Shared 30 s gap with announce.js/listener via announce-rate.json; per-routine daily caps + quiet hours (CT).
// Existing announce.js fight-result / hatch posts are NOT touched by this file (owner wants every fight result kept).
const fs = require('fs'), path = require('path');
const DEFAULTS = {
  pet_of_day:    { enabled: false, schedule: 'daily 12:00 CT', hour_ct: 12, max_per_day: 1 },
  fight_night:   { enabled: false, schedule: 'daily 20:00 CT (skipped if no fights in 24 h)', hour_ct: 20, max_per_day: 1 },
  fight_photo:   { enabled: false, schedule: 'per fight result, arena still added after announce.js text post', max_per_day: 10, min_gap_min: 10 },
  motel_alert:   { enabled: false, schedule: 'per breed/hatch batch, digest at most every 2 h', max_per_day: 6, min_gap_min: 120 },
  leaderboard:   { enabled: false, schedule: 'weekly Sunday 18:00 CT (Pet Score top 5)', weekday: 0, hour_ct: 18, max_per_day: 1 },
  graveyard:     { enabled: false, schedule: 'daily 09:00 CT digest of deaths / cold storage moves (skip if none)', hour_ct: 9, max_per_day: 1 },
  wizard_countdown: { enabled: false, schedule: 'daily 15:00 CT while Mythic is not reached', hour_ct: 15, max_per_day: 1 }
};
const QUIET = { start: 10, end: 21 }; // waking hours CT; event routines hold until then
const ctParts = d => { const o = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short' }).formatToParts(d).forEach(p => o[p.type] = p.value); return { day: o.year + '-' + o.month + '-' + o.day, hour: +o.hour % 24, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) }; };
function cfgFor(config, name) { return Object.assign({}, DEFAULTS[name], ((config || {}).routines || {})[name] || {}); }
const sp = s => /^hyb3?:/.test(s) ? s.replace(/^hyb3?:/, '').split(':').join(' × ') + ' hybrid' : s;
const name = p => (p.name || 'Pet') + ' #' + p.id;
const CAPTIONS = {
  pet_of_day: f => { const p = f.top[0]; return p && { key: 'potd:' + f.day, pet: p.id, render: ['pet', p.id], text: '🌟 Pet of the Day: ' + name(p) + ', a ' + sp(p.species) + ' with a Pet Score of ' + p.score + '. Give it a wave!' }; },
  fight_night: f => { const fs24 = f.fights.filter(x => x.block > f.tip - 144); if (!fs24.length) return null; const last = fs24[fs24.length - 1];
    return { key: 'fn:' + f.day, render: ['fight', last.id], text: '🥊 Fight Night at X Circus Kekimus: ' + fs24.length + ' fight' + (fs24.length > 1 ? 's' : '') + ' today.\n' + fs24.map(x => '#' + x.winner + ' beat #' + x.loser + (x.spoils ? ' and took ' + x.spoils : '') + (x.streak >= 3 ? ' 🏆 title belt (' + x.streak + ' wins)' : '')).join('\n') + '\nLosers wear a black eye for 72 blocks.' }; },
  fight_photo: f => { const x = f.fights[f.fights.length - 1]; return x && { key: 'fp:' + x.id, render: ['fight', x.id], text: '🥊 #' + x.winner + ' wins in X Circus Kekimus! #' + x.loser + ' gets the black eye.' }; },
  motel_alert: f => { const b = f.bred.filter(p => p.block > f.tip - 36); if (!b.length) return null; const c = b[0];
    return { key: 'motel:' + c.id, render: ['breed', c.id], text: '🥚 New arrival at the No-Tail Motel: ' + name(c) + ' (' + c.species + '), from #' + c.parents[0] + ' × #' + c.parents[1] + (b.length > 1 ? '. Plus ' + (b.length - 1) + ' more eggs checked out.' : '.') }; },
  leaderboard: f => f.top.length && { key: 'lb:' + f.day, render: ['pet', f.top[0].id], text: '🏅 Weekly Pet Score top 5:\n' + f.top.slice(0, 5).map((p, i) => (i + 1) + '. ' + name(p) + ' ' + p.score).join('\n') },
  graveyard: f => (f.graves || []).length ? { key: 'gy:' + f.day, text: '🪦 Graveyard notice: ' + f.graves.map(name).join(', ') + ' passed on. Feed your pets, friends.' } : null,
  wizard_countdown: f => f.wizard && f.wizard.left > 0 ? { key: 'wiz:' + f.day, text: '🧙 Wizard watch: ' + f.wizard.left.toLocaleString('en-US') + ' care points to Mythic.' } : null
};
// Decide what is due. Pure: (config, facts, state, now) -> [{routine, key, text, render}]. state = {sent:{key:t}, perDay:{routine:{day:n}}, last:{routine:t}}
function due(config, facts, state, now = new Date()) {
  const t = ctParts(now), out = [];
  for (const r of Object.keys(DEFAULTS)) {
    const c = cfgFor(config, r); if (c.enabled !== true) continue;
    if (c.hour_ct != null && t.hour !== c.hour_ct) continue;
    if (c.weekday != null && t.wd !== c.weekday) continue;
    if (c.hour_ct == null && (t.hour < QUIET.start || t.hour >= QUIET.end)) continue;
    if (((state.perDay[r] || {})[t.day] || 0) >= c.max_per_day) continue;
    if (c.min_gap_min && state.last[r] && now - state.last[r] < c.min_gap_min * 60e3) continue;
    const item = CAPTIONS[r](Object.assign({ day: t.day }, facts)); if (!item || state.sent[item.key]) continue;
    out.push(Object.assign({ routine: r }, item));
  }
  return out;
}
// Media must be the render made just now for THIS item (renders/<key>.png, written after t0, matching mode).
// Anything else (missing, stale, other key/kind) -> null, so the post goes out text-only instead of with the wrong picture.
const RENDER_MODES = { pet_of_day: 'pet', fight_night: 'fight', fight_photo: 'fight', motel_alert: 'breed', leaderboard: 'pet' };
const mediaName = key => String(key).replace(/\W/g, '_') + '.png';
function checkMedia(item, file, t0) {
  if (!file) return null;
  if (RENDER_MODES[item.routine] !== (item.render || [])[0]) return null;
  if (path.basename(String(file)) !== mediaName(item.key)) return null;
  try { const st = fs.statSync(file); if (!st.isFile() || st.mtimeMs < t0) return null; } catch { return null; }
  return file;
}
// Send one item: caption filter, shared gap, at-most-once, photo if a render exists. deps = { tg, render(args)->file|null, now, dir }
async function sendOne(item, state, deps) {
  const v = deps.tg.announceViolations(item.text); if (v.length) return { status: 'BLOCKED', why: v.join('; ') };
  const rf = path.join(deps.dir, 'announce-rate.json'); const rate = (() => { try { return JSON.parse(fs.readFileSync(rf, 'utf8')); } catch { return { posts: [] }; } })();
  if ((rate.posts || []).some(p => deps.now() - p.t < 30e3)) return { status: 'RATE_LIMITED' };
  const t0 = Date.now() - 1000;
  state.sent[item.key] = deps.now(); // mark first: never double-post
  const t = ctParts(new Date(deps.now())); (state.perDay[item.routine] = state.perDay[item.routine] || {})[t.day] = ((state.perDay[item.routine] || {})[t.day] || 0) + 1; state.last[item.routine] = deps.now();
  const file = item.render ? checkMedia(item, await deps.render(item.render), t0) : null;
  const res = file ? await deps.tg.sendGroupPhoto(deps.tg.XCPETS_GROUP_CHAT_ID, file, item.text) : await deps.tg.sendGroupAnnouncement(deps.tg.XCPETS_GROUP_CHAT_ID, item.text);
  rate.posts = (rate.posts || []).concat([{ t: deps.now(), kind: 'routine:' + item.routine }]).slice(-200); fs.writeFileSync(rf, JSON.stringify(rate));
  return { status: 'POSTED', photo: !!file, message_id: res && res.message_id };
}
module.exports = { checkMedia, mediaName, RENDER_MODES, DEFAULTS, CAPTIONS, due, sendOne, cfgFor, ctParts };
