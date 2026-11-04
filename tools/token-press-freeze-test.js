// token-press-freeze-1103 [pt2796u]: Token Press / List pickers must page their cards (a 7,365-pet wallet froze the page ~20 s).
'use strict';
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', 'v2-sales.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const body = name => { const i = s.indexOf('function ' + name + '('); return i < 0 ? '' : s.slice(i, s.indexOf('\n  function ', i + 10)); };
const per = /var PICK_PER = (\d+);/.exec(s);
ok(per && +per[1] > 0 && +per[1] <= 60, 'PICK_PER set and <= 60');
ok(/function pickPages\(/.test(s) && /list\.slice\(n, n \+ PICK_PER\)/.test(s), 'pickPages slices one page at a time');
for (const f of ['pressPick', 'sellPick']) {
  const b = body(f);
  ok(b.length > 0, f + ' found');
  ok(/pickPages\(mine,/.test(b), f + ' uses pickPages');
  ok(!/mine\.map\(/.test(b), f + ' does not render every pet at once');
}
console.log('token-press-freeze-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
