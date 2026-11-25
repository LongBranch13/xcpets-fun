#!/usr/bin/env node
/* SPECIES REGISTRY CHECK (Nov 25 2026, Jake: adding a new pet should be a one-place change). Display only, nothing is signed or sent.
 *
 * js/species-registry.js is the one list of pet species. The display code reads it. This test checks every place that CAN'T read it
 * (the replay rules, the sync server, the Cloudflare HatchBot, the Python sticker maker, per-pet art tables, every page's script tags)
 * and fails with the file to change when a registered species is missing there.
 *
 * A gap that is fine for now goes on the species' registry entry as skip: { <place>: 'why' }, so every known gap is written in one place.
 * Run: node tools/species-registry-test.js           (prints a line per failure; exit 1 if any)
 *      node tools/species-registry-test.js --gaps    (also lists every skip on file, as a to-do list) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const R = require('../js/species-registry.js');
const { load } = require('./lib/load-rules');

let n = 0, fail = 0;
function ok(cond, msg) { n++; if (!cond) { fail++; console.log('FAIL ' + msg); } }
const skipOf = (s, place) => s.skip && s.skip[place];

/* Every place this test checks. need(s) = this species must be there; has(s) = it is. */
const PLACES = {};
function place(key, file, what, need, has) { PLACES[key] = { file, what, need, has }; }

/* ---------------------------------------------------------------- the registry itself */
const KINDS = ['egg', 'community', 'legend', 'oneofone', 'contest'];
const seen = {};
R.LIST.forEach(s => {
  ok(/^[a-z][a-z0-9]{1,15}$/.test(s.id), 'registry: bad id ' + s.id);
  ok(!seen[s.id], 'registry: ' + s.id + ' is listed twice'); seen[s.id] = 1;
  ok(s.name && typeof s.name === 'string', 'registry: ' + s.id + ' has no name');
  ok(KINDS.indexOf(s.kind) >= 0, 'registry: ' + s.id + ' kind must be one of ' + KINDS.join(', '));
  ok(!s.community === (s.kind !== 'community'), 'registry: ' + s.id + ' community: {...} goes with kind community');
  if (s.community) ok(s.emoji, 'registry: community pet ' + s.id + ' needs an emoji (raise tip, Telegram app)');
  if (s.sprite) ok(s.sprite.g && s.sprite.file, 'registry: ' + s.id + ' sprite needs g and file');
  if (s.tap) ok(Array.isArray(s.tap) && s.tap.length && s.tap.every(t => typeof t === 'string' && t), 'registry: ' + s.id + ' tap must be a list of lines');
});
const nos = R.community().map(s => s.community.no);
ok(nos.every((x, i) => x === i + 1), 'registry: community numbers must run 1, 2, 3... (got ' + nos.join(', ') + ')');
R.community().forEach(s => { if (s.community.no >= 2) ok(s.community.mythic === s.id + 'Mythic', 'registry: ' + s.id + ' community.mythic should be ' + s.id + 'Mythic (the rules\' Cold Storage record)'); });

/* ---------------------------------------------------------------- replay rules (self-contained; checked, never edited by this) */
const ctx = load();
require('../hatchbot/art.js').load(ctx); /* the registry, every sprite and the renderer, exactly as HatchBot / share cards / token art load them */
vm.runInContext(rd('js/mythic-sig.js'), ctx, { filename: 'js/mythic-sig.js' });
const V = ctx.V2Rules, PC = ctx.PetCore;
const coreIds = PC.SPECIES.map(s => s.id);
place('petCore', 'js/pet-core.js SPECIES', 'normal egg species (rules file: changing it is a rules change)',
  s => s.kind === 'egg' || s.id === 'nakamoto', s => coreIds.indexOf(s.id) >= 0);
coreIds.forEach(id => ok(R.get(id), 'js/species-registry.js: ' + id + ' is in js/pet-core.js SPECIES but not in the registry'));
place('rulesLabel', 'js/v2-rules.js speciesLabel()', 'the species name the game shows (rules file)',
  () => true, s => V.speciesLabel(s.id) === s.name);
place('hybridName', 'js/v2-rules.js hybrid syllables (HYBRID_NAMES / hybridLabel)', 'hybrid names like "Hope" for Homer x Pepe (rules file)',
  s => true, s => { const o = s.id === 'pepe' ? 'wojak' : 'pepe', l = V.hybridLabel('hyb:' + s.id + ':' + o); return !!l && /^[A-Z]/.test(l) && !/undefined/.test(l); }); /* an unknown species' syllable is its raw lowercase id ('starlordkekpe') */

/* ---------------------------------------------------------------- sprites + renderer */
R.LIST.forEach(s => {
  if (!s.sprite) return;
  ok(fs.existsSync(path.join(ROOT, s.sprite.file)), s.id + ': sprite file ' + s.sprite.file + ' is missing');
  const S = ctx[s.sprite.g];
  ok(S, s.id + ': ' + s.sprite.file + ' must define window.' + s.sprite.g);
  if (!S || !s.sprite.draw) return;
  ok(typeof S.draw === 'function' && typeof S.frames === 'function', s.id + ': ' + s.sprite.g + ' needs draw(stage, frame, gear) and frames(stage, bg, gear, opts)');
  let g = null; try { g = S.draw(3, 0, {}); } catch (e) { }
  ok(g && g.length === 32, s.id + ': ' + s.sprite.g + '.draw(3, 0, {}) must return 32 rows');
  if (s.sprite.pal) ok(S[s.sprite.pal], s.id + ': ' + s.sprite.g + '.' + s.sprite.pal + ' (sprite.pal) is missing');
});
/* every species draws as itself through the site's renderer (not the plain fallback egg-pet) */
(function () {
  const Rn = ctx.V2Render; ok(Rn && Rn.petFramesRaw, 'js/v2-render.js did not load');
  if (!Rn || !Rn.petFramesRaw) return;
  const art = sp => Object.assign(PC.generate({ blockHash: 'ab'.repeat(32), petId: 4242, blockHeight: 977000 }), { species: sp, background: 'solid', bgColor: '#202020', pattern: 'none' });
  const pix = sp => { try { const f = Rn.petFramesRaw({ id: 4242, species: sp, stage: 3, tier: 2, art: art(sp), owner: 'x' }, { pets: [], byId: {} }, { noHunger: true }); const a = f && f[0] && (f[0].rareScene || f[0]); return a ? Array.from(a.data).join(',') : null; } catch (e) { return 'ERR ' + e.message; } };
  const plain = pix('zzzunknown');
  R.LIST.forEach(s => { if (s.id === PC.SPECIES[0].id) return; /* an unknown species falls back to the first egg species */ const p = pix(s.id); ok(p && !/^ERR/.test(p), s.id + ': js/v2-render.js petFramesRaw failed: ' + p); ok(p !== plain, s.id + ': js/v2-render.js draws it as a nameless blob (add a sprite to its registry entry, or teach PetCore its body)'); });
})();

/* ---------------------------------------------------------------- display places that keep their own per-pet art */
const FX = ctx.MythSig && ctx.MythSig.FX;
ok(FX, 'js/mythic-sig.js did not load');
R.LIST.forEach(s => { if (s.sig) ok(FX && typeof FX[s.sig] === 'function', s.id + ': Mythic signature "' + s.sig + '" is not an effect in js/mythic-sig.js FX'); });
place('sig', 'js/species-registry.js sig + js/mythic-sig.js FX', 'its own Mythic effect (every pet that isn\'t a normal egg species)',
  s => s.kind !== 'egg', s => !!s.sig);
const CH = ctx.V2ClownHair;
place('clownHair', 'js/v2-clown-hair.js FIT', 'Honk clown hair fitting (else the clown hair just doesn\'t show on it)',
  () => true, s => !!(CH && CH.FIT[s.id]));
const CS = ctx.ContestSprite;
place('crossLook', 'js/contest-sprite.js CROSS_CANON + CROSS_LABEL', 'the colours + tell a Bo Jackson / Rarepigeon cross baby gets from it',
  () => true, s => !!(CS && CS.CROSS && CS.CROSS.CANON[s.id] && CS.CROSS.LABEL[s.id]));

/* ---------------------------------------------------------------- places that can't load the registry */
const split = require('./sync-server/split.js');
place('coldKeys', 'tools/sync-server/split.js COLD_KEYS', 'Cold Storage record in the fast world (server process: reaches the VPS with a server-repair)',
  s => !!(s.community && s.community.mythic), s => split.COLD_KEYS.indexOf(s.id) >= 0);
const worker = rd('hatchbot/worker.js'), wm = /const NAMES = (\{[^}]*\});/.exec(worker);
const WN = wm ? vm.runInNewContext('(' + wm[1] + ')') : {};
ok(wm, 'hatchbot/worker.js: the community NAMES list moved, update this test');
place('hatchbotCold', 'hatchbot/worker.js NAMES', 'HatchBot /burns community pet name (Cloudflare worker, deploys on its own)',
  s => !!(s.community && s.community.mythic), s => !!WN[s.id]);
const py = rd('hatchbot/stickers/make-images.py'), pm = /^SPECIES = (\[.*\])\s*$/m.exec(py);
const STK = pm ? JSON.parse(pm[1]).map(r => r[3]) : [];
ok(pm, 'hatchbot/stickers/make-images.py: the SPECIES list moved, update this test');
place('stickers', 'hatchbot/stickers/make-images.py SPECIES', 'Telegram sticker + emoji packs',
  () => true, s => STK.indexOf(s.id) >= 0);

/* ---------------------------------------------------------------- the other way round: a species somewhere else must be registered */
const rulesSrc = rd('js/v2-rules.js'), lab = /function speciesLabel\(sp\) \{([^\n]*)/.exec(rulesSrc);
ok(lab, 'js/v2-rules.js speciesLabel moved, update this test');
const elsewhere = { 'js/v2-rules.js speciesLabel': lab ? [...lab[1].matchAll(/sp === '([a-z0-9]+)'/g)].map(m => m[1]) : [],
  'js/contest-sprite.js NAMES': (CS && CS.SPECIES) || [], 'tools/sync-server/split.js COLD_KEYS': split.COLD_KEYS, 'hatchbot/worker.js NAMES': Object.keys(WN), 'hatchbot/stickers/make-images.py SPECIES': STK };
Object.keys(elsewhere).forEach(where => elsewhere[where].forEach(id => ok(R.get(id), id + ' is in ' + where + ' but not in js/species-registry.js: add its entry there')));

/* ---------------------------------------------------------------- run every place */
const known = {}; Object.keys(PLACES).forEach(k => { known[k] = 1; });
R.LIST.forEach(s => Object.keys(s.skip || {}).forEach(k => ok(known[k], 'js/species-registry.js: ' + s.id + ' skip.' + k + ' is not a place (places: ' + Object.keys(PLACES).join(', ') + ')')));
const gaps = [];
Object.keys(PLACES).forEach(k => { const P = PLACES[k];
  R.LIST.forEach(s => { if (!P.need(s)) return; let has = false; try { has = P.has(s); } catch (e) { has = false; }
    const why = skipOf(s, k);
    if (why) { gaps.push(s.id + ' · ' + k + ': ' + why); ok(!has, 'js/species-registry.js: ' + s.id + ' skip.' + k + ' can go, ' + P.file + ' has it now'); return; }
    ok(has, s.id + ' is missing from ' + P.file + ' (' + P.what + '). Add it there, or put skip: { ' + k + ': \'why\' } on its registry entry.'); }); });

/* ---------------------------------------------------------------- every page loads the registry + every sprite */
const CONSUMERS = /js\/(?:[a-z0-9-]+-sprite|v2-render|v2-zombie-look|mythic-sig|v2-pet-tap|v2-grinder|v2-pages)\.js/;
const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).concat(['templates/game.html']);
pages.forEach(f => { const h = rd(f), tags = [...h.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1].split('?')[0]);
  const first = tags.findIndex(t => CONSUMERS.test(t)); if (first < 0) return;
  const at = tags.indexOf('js/species-registry.js');
  ok(at >= 0 && at < first, f + ': load js/species-registry.js before ' + tags[first]);
  if (tags.indexOf('js/v2-render.js') >= 0) R.scripts().forEach(sf => ok(tags.indexOf(sf) >= 0, f + ': draws pets but doesn\'t load ' + sf));
  const cs = tags.indexOf('js/contest-sprite.js'); ['js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/jackson-sprite.js'].forEach(d => { const i = tags.indexOf(d); if (cs >= 0 && i >= 0) ok(i < cs, f + ': ' + d + ' must load before js/contest-sprite.js'); });
});
ok(/species-registry\.js/.test(rd('tg/index.html')), 'tg/index.html: load ../js/species-registry.js before app.js');
ok(/js\/species-registry\.js/.test(rd('.github/workflows/server-repair.yml')), '.github/workflows/server-repair.yml: ship js/species-registry.js with hatchbot/art.js (share cards)');

/* Node tools + tests that run the display code in a vm load the registry too (tools/lib/load-rules.js does it for everyone using it) */
const LOADS_DISPLAY = /runInContext\(fs\.readFileSync\([^;]*(?:v2-render|v2-zombie-look|mythic-sig)\.js|['"](?:\.\.\/)?js\/(?:v2-render|v2-zombie-look|mythic-sig)\.js['"]\s*[,\]]/;
(function walk(dir) { fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach(e => { const f = dir + '/' + e.name;
  if (e.isDirectory()) { if (!/node_modules|snapshots|fixtures/.test(e.name)) walk(f); return; } if (!/\.js$/.test(e.name) || f === 'tools/species-registry-test.js') return;
  const t = rd(f); if (LOADS_DISPLAY.test(t) && !/species-registry/.test(t) && (/addScriptTag/.test(t) /* a browser page has no load-rules */ || (/runInContext/.test(t) && !/lib\/load-rules|hatchbot\/art/.test(t))))
    ok(false, f + ': runs the display code without js/species-registry.js (load it first, or use tools/lib/load-rules.js)'); }); })('tools');
fs.existsSync(path.join(ROOT, 'design')) && (function walk(dir) { fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach(e => { const f = dir + '/' + e.name;
  if (e.isDirectory()) return walk(f); if (!/\.js$/.test(e.name)) return; const t = rd(f);
  if (/runInContext|addScriptTag/.test(t) && LOADS_DISPLAY.test(t) && !/species-registry/.test(t) && !/load-rules/.test(t)) ok(false, f + ': runs js/v2-render.js without js/species-registry.js'); }); })('design');

/* ---------------------------------------------------------------- no hand-kept species lists creep back into the display code */
[['js/v2-zombie-look.js', /OWN = \{ *homer/], ['js/mythic-sig.js', /K = \{ *kek/], ['js/v2-render.js', /COLD_ORDER = \[\[/], ['js/v2-render.js', /LOOK_SPR = \{ *wizard/],
  ['js/v2-render.js', /RAISE_PETS = \{ *groyper/], ['js/v2-pages.js', /COLD_GHOSTS = \{/], ['tg/app.js', /COMM = \{ *groyper/], ['hatchbot/art.js', /EXTRA = \['js\/wizard-sprite/],
  ['tools/token-meta.js', /EXTRA = \['js\/wizard-sprite/]].forEach(([f, re]) => ok(!re.test(rd(f)), f + ': a hand-kept species list is back; read it from js/species-registry.js'));

if (process.argv.includes('--gaps')) { console.log('\nKnown gaps (skip on the registry entries):'); gaps.forEach(g => console.log('  ' + g)); }
console.log((fail ? 'FAIL' : 'ok') + ' species-registry: ' + (n - fail) + '/' + n + ' checks, ' + R.LIST.length + ' species, ' + Object.keys(PLACES).length + ' places, ' + gaps.length + ' known gaps');
process.exit(fail ? 1 : 0);
