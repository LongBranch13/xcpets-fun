/* mypets-tok-filter: token group uses V2Rules.deedOf only. No network.
 *   node tools/mypets-tok-filter-test.js */
'use strict';
const fs = require('fs'), path = require('path');
const TF = require(path.join(__dirname, '..', 'js', 'v2-tok-filter.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
function deedOf(w, p) { if (!p || !p.deed || !w.deeds || !w.deeds[p.deed]) return null; var D = w.deeds[p.deed]; return { asset: p.deed, holder: D.holder, ok: D.holder === p.owner }; }
global.V2Rules = { deedOf: deedOf };
const me = 'bc1qme', other = 'bc1qother';
const w = { deeds: { Ayes: { holder: me }, Aaway: { holder: other } }, pets: [] };
function pet(id, deed) { const p = { id: id, owner: me, deed: deed || null }; w.pets.push(p); return p; }
const yes = pet(1, 'Ayes'), away = pet(2, 'Aaway'), none = pet(3, null), minted = pet(4, null);
minted.pendingMint = 'Amade'; /* a made token that was never tied is not a deed */
ok(TF.state(w, yes) === 'yes' && TF.state(w, away) === 'away' && TF.state(w, none) === 'no' && TF.state(w, minted) === 'no', 'deedOf states: held, elsewhere, none, minted-but-not-tied');
ok(TF.state(w, { id: 9, owner: me, deed: 'Agone' }) === 'no', 'a deed the world does not know is not tokenized');
ok(TF.match('', w, none) && TF.match('yes', w, yes) && !TF.match('yes', w, away) && TF.match('away', w, away) && TF.match('no', w, minted), 'filter match');
ok(TF.norm('nope') === '' && TF.norm('yes') === 'yes', 'unknown kind is All');
const c = TF.counts(w, [yes, away, none, minted]);
ok(c.all === 4 && c.yes === 1 && c.away === 1 && c.no === 2, 'counts ' + JSON.stringify(c));
const sorted = [none, away, yes, minted].slice().sort(TF.comparator(w)).map(p => p.id);
ok(sorted.join() === '1,2,3,4', 'tokenized first, you hold it before held elsewhere, then pet # (' + sorted + ')');
const big = []; for (let i = 0; i < 8000; i++) big.push({ id: i + 10, owner: me, deed: i % 5 === 0 ? 'Ayes' : null });
const t0 = Date.now(); TF.counts(w, big); TF.counts(w, big); const ms = Date.now() - t0;
ok(ms < 200, '8,000 pets classified twice stays cheap (' + ms + 'ms)');
const v2 = fs.readFileSync(path.join(__dirname, '..', 'js', 'v2.js'), 'utf8');
ok(/fS === 'tok'/.test(v2) && /noTok/.test(v2) && /\|t' \+ tokKind\(\)/.test(v2) && /fTok/.test(v2), 'v2.js: sort, filter, paging key and control wired');
ok(/fS === 'weird'/.test(v2) && /DS_SORTS = \[\['recent'/.test(v2) && /'weird', 'Weird first'/.test(v2), 'Weird sort on My Pets and the discard pile stays');
['templates/game.html', 'play.html', 'fight.html', 'rare-room.html', 'breed.html', 'raid.html', 'practice.html', 'practice-fight.html', 'practice-rare.html', 'practice-breed.html'].forEach(f => {
  const h = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  ok(/js\/v2-tok-filter\.js\?v=b1b06db385/.test(h) && /id="fTok"/.test(h) && /value="tok">🎟 Tokenized first/.test(h) && /value="away">Token held elsewhere/.test(h), f + ': token filter and Tokenized first sort');
});
console.log('mypets-tok-filter: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
