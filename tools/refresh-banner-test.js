#!/usr/bin/env node
/* refresh-banner-1103: the 'New chain activity since your last visit' Refresh bar came back after every reload (owner report Nov 3 2026).
 * Fix A: the bar compares the burn rows + the sale data of the tokens this browser read (not the sale-data JSON length).
 * Fix B: the saved copy keeps the shallow (< 6 deep) block hashes for its stale render only (never written to the final-hash cache). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'v2-chain.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error(name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const ctx = { S: {} }; vm.createContext(ctx);
vm.runInContext(['fnv', 'rowsKey', 'dexKey', 'dexSet', 'newActivity', 'shallowOf', 'lastHashes', 'finalHashes'].map(grab).join('\n'), ctx);
const rows = [{ tx_hash: 'a', block_index: 10 }, { tx_hash: 'b', block_index: 20 }];
const iss = A => ({ asset: A, description: 'https://xcpets.fun/t/1.json', block_index: 5 }), cr = A => ({ asset: A, quantity: 1, address: 'x' });
const dexL = { issuances: [iss('A1'), iss('A2')], credits: [cr('A1'), cr('A2')], destructions: [], orders: [{ give_asset: 'A1', get_asset: 'XCP', tx_hash: 'o1' }], matches: [] };
const dexF = { issuances: [iss('A1'), iss('A2'), iss('A9')], credits: [cr('A1'), cr('A2'), cr('A9')], destructions: [], orders: dexL.orders.slice(), matches: [] };
ctx.S = { rows: rows.slice(), dex: dexL }; const was = vm.runInContext('rowsKey()', ctx);
ok(vm.runInContext('newActivity', ctx)(was, dexF) === false, 'feed copy with extra pet tokens only (same rows, same sales for the tokens read) = no bar');
ok(vm.runInContext('newActivity', ctx)(was, dexL) === false, 'identical data = no bar');
ctx.S.rows = rows.concat([{ tx_hash: 'c', block_index: 30 }]); ok(vm.runInContext('newActivity', ctx)(was, dexL) === true, 'new burn row = bar');
ctx.S.rows = [rows[0], { tx_hash: 'z', block_index: 20 }]; ok(vm.runInContext('newActivity', ctx)(was, dexL) === true, 'changed burn row (same count) = bar');
ctx.S.rows = rows.slice(); ctx.S.dex = Object.assign({}, dexL, { orders: dexL.orders.concat([{ give_asset: 'A2', get_asset: 'XCP', tx_hash: 'o2' }]) });
ok(vm.runInContext('newActivity', ctx)(was, dexF) === true, 'new order on a token read here = bar');
ctx.S.dex = Object.assign({}, dexL, { credits: [cr('A1'), { asset: 'A2', quantity: 1, address: 'y' }] }); ok(vm.runInContext('newActivity', ctx)(was, dexL) === true, 'token changed hands = bar');
ctx.S.dex = Object.assign({}, dexL, { issuances: dexL.issuances.concat([iss('A3')]), credits: dexL.credits.concat([cr('A3')]) }); ok(vm.runInContext('newActivity', ctx)(was, dexL) === true, 'new pet token read here = bar');
ctx.S.dex = dexL; ok(vm.runInContext('newActivity', ctx)(was, null) === true, 'sale data appeared = bar');
const sh = vm.runInContext('shallowOf', ctx)({ 90: 'h90', 94: 'h94', 95: 'h95', 100: 'h100', 101: 'h101' }, 100);
ok(JSON.stringify(Object.keys(sh)) === '["95","100"]', 'shallowOf keeps only blocks within 6 of the tip (not above it)');
ok(JSON.stringify(vm.runInContext('finalHashes', ctx)(sh, 100)) === '{}', 'shallow hashes are never final (never saved to the hash cache)');
ok(vm.runInContext('lastHashes', ctx)({ shallow: sh }) === sh && vm.runInContext('lastHashes', ctx)({}) === null && vm.runInContext('lastHashes', ctx)({ shallow: {} }) === null, 'lastHashes: copy hashes or null (old copies unchanged)');
ok(/shallow: S\.verified \? shallowOf\(S\.hashes, S\.tip\) : null/.test(src), 'only a verified read stores shallow hashes in the saved copy');
ok((src.match(/applyStale\(last, lastHashes\(last\)\)/g) || []).length === 3 && !/applyStale\(last, null\)/.test(src), 'every saved-copy boot passes its shallow hashes');
ok(/var wasRows = rowsKey\(\), wasDex = S\.dex \|\| null;[\s\S]{0,200}if \(newActivity\(wasRows, wasDex\)\) \{ staleBar\('New chain activity since your last visit\.', false\)/.test(src), 'revalidate bar uses newActivity');
ok(/function sigOf\(\) \{ return S\.rows\.length \+ '\|' \+ JSON\.stringify\(S\.dex \|\| null\)\.length; \}/.test(src) && /function whenRead\(\) \{[^\n]*var was = sigOf\(\);/.test(src), 'burn check (whenRead) still uses sigOf unchanged');
console.log('refresh-banner-test: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
