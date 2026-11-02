/* modal-close-test (Nov 1 2026): Esc and a click on the dark background close the multi-burn confirm box through the Cancel handler. Static checks. */
'use strict';
const fs = require('fs'), path = require('path'), s = fs.readFileSync(path.join(__dirname, '..', 'js', 'v2.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
ok(s.includes("$('confirmBox').addEventListener('click', function (e) { if (e.target === $('confirmBox')) $('cfNo').click(); });"), 'backdrop click runs Cancel');
ok(/e\.key === 'Escape' \|\| e\.key === 'Esc'\) && \$\('confirmBox'\)\.classList\.contains\('on'\)\) \$\('cfNo'\)\.click\(\)/.test(s), 'Esc runs Cancel while the box is open');
ok(!/\$\('cfNo'\)\.disabled = true/.test(s), 'Cancel is never disabled, so Esc/backdrop always work');
console.log('modal-close-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
