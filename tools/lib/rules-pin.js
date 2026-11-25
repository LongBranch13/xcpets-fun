/* RULES PIN (Nov 25 2026). The MD5 of every rule file, in ONE place: tools/fixtures/rules-pin.json.
 * Display-only tests assert "the rules didn't change" against it instead of each keeping its own copy of the hash
 * (about 30 tests used to pin v2-rules.js by hand; every rules PR left most of them stale and CI red for everyone).
 * A rules PR updates tools/fixtures/rules-pin.json (node tools/rules-pin-test.js --write) and CLAUDE.md's "Current MD5" line. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..'), FILE = path.join(ROOT, 'tools', 'fixtures', 'rules-pin.json');
const PIN = JSON.parse(fs.readFileSync(FILE, 'utf8'));
/** pin(rel): the pinned MD5 of a rule file */
function pin(rel) { if (!PIN[rel]) throw new Error('rules-pin: ' + rel + ' is not pinned in tools/fixtures/rules-pin.json'); return PIN[rel]; }
/** md5(rel): the file's MD5 now */
function md5(rel) { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }
module.exports = { pin, md5, PIN, FILE, ROOT };
