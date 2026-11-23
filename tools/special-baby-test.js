// Special-baby note at Gooby's check-in (js/v2-easy-flows.js specialNote). Offline: a real snapshot plus fake future burns; nothing is signed.
// A player bred Rarepigeon x Star-Lord Kek and got a Snibby (Nov 23 2026). The note must say before the burn what the rules will do:
// one special parent -> the partner's species; two special parents -> a random normal species (or the special mix look once that rule is live).
// Replays api/boot.json the way the server's world builder does (tools/sync-server/snapshot.js, with the dex), so the pets are the live ones.
// node tools/special-baby-test.js [--boot api/boot.json]   (two full replays, ~2 GB memory each)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { row } = require('./lib/load-rules.js'), S = require('./sync-server/snapshot');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), bootF = A.indexOf('--boot') >= 0 ? A[A.indexOf('--boot') + 1] : path.join(ROOT, 'api/boot.json');
const boot = JSON.parse(fs.readFileSync(bootF, 'utf8'));
function knownHashes() { const x = { window: {} }; x.window.window = x.window; x.self = x.window; vm.createContext(x); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), x); return x.window.XCPETS_BLOCK_HASHES || x.XCPETS_BLOCK_HASHES || {}; }
const fakeHash = b => require('crypto').createHash('sha256').update('fake-block-' + b).digest('hex');
function world(extra, tip) { const ctx = S.workerFns(), H = Object.assign({}, knownHashes(), boot.hashes); (extra || []).forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  return { c: ctx, w: S.replayWorld(ctx, boot.rows.concat(extra || []), H, tip, boot.dex || null) }; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const src = fs.readFileSync(path.join(ROOT, 'js/v2-easy-flows.js'), 'utf8');
const m = /  function specialNote\([\s\S]*?\n    return '<div class="ez-roles ez-spx"[^\n]*\n/.exec(src);
ok(!!m, 'specialNote found in js/v2-easy-flows.js');
const tip = boot.tip, W0 = world([], tip), c = W0.c, V = c.V2Rules, w = W0.w;
vm.runInContext('var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;" }[c]; }); };\n' + m[0] + '\nwindow.__sn = specialNote;', c);
const note = c.__sn, txt = h => h.replace(/<[^>]+>/g, '');

const live = p => p && !p.dead && !p.released;
const RP = w.pets.find(p => p.species === 'rarepigeon'), SL = w.pets.filter(p => p.species === 'starlordkek');
const plain = w.pets.find(p => live(p) && p.species === 'pepe' && p.stage >= 3);
ok(!!RP && SL.length >= 2 && !!plain, 'snapshot has Rarepigeon, two Star-Lord Keks and an adult Pepe');
const b = tip + 1;
ok(note(plain, plain, b) === '', 'two normal pets: no note');
const one = txt(note(RP, plain, b));
ok(/BABY SPECIES: PEPE/.test(one) && /Rarepigeon is a special/.test(one), 'Rarepigeon x Pepe: baby is a Pepe [' + one.slice(0, 90) + ']');
ok((V.crossOn(b) ? /Pepe Pigeon/ : /./).test(one), 'Rarepigeon x Pepe: names the Pepe Pigeon look when crosses are on');
const pair = txt(note(RP, SL[0], b)), mix = V.specialPairOf && V.specialPairOn && V.specialPairOn(b);
if (mix) ok(/SPECIAL MIX: STAR-LORD PIGEON/.test(pair) && /random normal species/.test(pair), 'Rarepigeon x Star-Lord Kek (mix live): Star-Lord Pigeon [' + pair.slice(0, 90) + ']');
else ok(/SURPRISE BABY/.test(pair) && /random normal species/.test(pair) && /not a hybrid/.test(pair), 'Rarepigeon x Star-Lord Kek: surprise random normal species, not a hybrid [' + pair.slice(0, 90) + ']');
const twin = txt(note(SL[0], SL[1], b));
ok(/SURPRISE BABY/.test(twin) && /not another Star-Lord Kek/.test(twin), 'Star-Lord x Star-Lord: random normal species, not another Star-Lord [' + twin.slice(0, 80) + ']');

// the rules agree: a real Rarepigeon x Star-Lord Kek breed in the replay gives a plain species (before any mix rule) and never a contest species
const owner = RP.owner, sl = SL.find(p => p.owner === owner) || SL[0];
let bAt = tip + 2; for (let k = 0; k < 1500 && (V.breedable(RP, bAt) || V.breedable(sl, bAt)); k++) bAt++;
const tags = sl.owner === owner ? [row(bAt, owner, V.costAt(w, V.breedCost(bAt), bAt), 'pet:breed:' + RP.id + ':' + sl.id)] : [];
if (tags.length) { const W2 = world(tags, bAt + 3), c2 = W2.c, w2 = W2.w, lg = w2.log.filter(x => x.tx === tags[0].tx_hash && /Egg #\d+/.test(x.msg || '')).pop(), kid = lg ? w2.byId[+/Egg #(\d+)/.exec(lg.msg)[1]] : null;
  if (!kid) console.log('SKIP replay breed at ' + bAt + ': ' + JSON.stringify(w2.log.filter(x => x.tx === tags[0].tx_hash).map(x => x.msg)) + ' ' + (c2.V2Rules.breedable(w2.byId[RP.id], bAt) || c2.V2Rules.breedable(w2.byId[sl.id], bAt) || ''));
  else { ok(!V.isContestSp(kid.species) && !V.isHybrid(kid.species), 'replayed Rarepigeon x Star-Lord Kek baby is a plain species: ' + kid.species);
    const want = c2.V2Rules.specialPairOn && c2.V2Rules.specialPairOn(bAt);
    ok(want ? !!(kid.art.cross && kid.art.cross.col === 'starlordkek' && kid.art.cross.body === 'rarepigeon') : !kid.art.cross, 'baby look matches the note (' + (kid.art.cross ? c2.V2Rules.crossLabel(kid.art.cross) : 'no cross') + ')'); } }
else console.log('SKIP replay breed (Rarepigeon and a Star-Lord Kek are in different wallets)');
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
