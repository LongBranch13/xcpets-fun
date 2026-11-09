#!/usr/bin/env node
/* Rewrite a legacy object-shaped api/pets.json into the columnar v2 file (js/pets-feed.js).
 * Used by the Pages workflow so a publish is small even if the committed file is still the old shape.
 *   node tools/pets-pack.js --compact api/pets.json
 * Prints before and after byte sizes. Does not talk to the chain and does not sign anything. */
'use strict';
const fs = require('fs'), path = require('path');
const F = require('../js/pets-feed.js');
const A = process.argv.slice(2);
const i = A.indexOf('--compact');
if (i < 0 || !A[i + 1]) { console.error('usage: node tools/pets-pack.js --compact FILE'); process.exit(2); }
const file = path.resolve(A[i + 1]);
const before = fs.readFileSync(file);
const doc = JSON.parse(before);
const exp = F.expand(doc);
const text = F.stringify(exp.pets, exp.blockHeight);
const again = F.expand(JSON.parse(text));
if (again.pets.length !== exp.pets.length) throw new Error('compact round-trip count ' + again.pets.length + ' != ' + exp.pets.length);
fs.writeFileSync(file, text);
console.log('pets.json ' + before.length + ' -> ' + Buffer.byteLength(text) + ' bytes (' + exp.pets.length + ' pets, block ' + exp.blockHeight + ')');
