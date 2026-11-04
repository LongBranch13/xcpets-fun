// feed-countdown-1103: 'Next feed cycle: block N (about X hours)' on My Pets (js/v2-mypets-top.js) and the pet page (js/v2-pages.js). Display only.
const fs = require('fs'), path = require('path'), R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const top = R('js/v2-mypets-top.js'), pg = R('js/v2-pages.js');
const src = top.match(/function nextCycle\(tip\) \{[\s\S]*?\n[^\n]*\}/)[0]; const nextCycle = new Function(src + '; return nextCycle;')();
const a = nextCycle(974448 - 1); t(a.block === 974448 && a.blocks === 1, 'tip 1 before day start');
const b = nextCycle(974448); t(b.block === 974592 && b.blocks === 144 && b.about === '24 hours', 'tip at day start -> next day, 24 hours');
const c = nextCycle(974448 + 138); t(c.block === 974592 && c.about === '1 hour', '6 blocks = 1 hour');
t(nextCycle(0) === null, 'no tip -> nothing');
t(/Next feed cycle: block/.test(top) && /Next feed cycle: block/.test(pg), 'label on both pages');
for (const s of [top, pg]) { const lines = s.split('\n').filter(l => /feed-countdown|Next feed cycle/.test(l)).join('\n'); t(!/\b(price|discount|series)\b/i.test(lines) && !/\d+x\b/.test(lines), 'wording rules'); }
console.log(bad ? 'feed-countdown-test FAIL ' + bad : 'feed-countdown-test ok ' + ok); process.exit(bad ? 1 : 0);
