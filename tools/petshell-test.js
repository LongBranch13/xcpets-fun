#!/usr/bin/env node
/* Pet Shell (petshell/, shell/): the device's helpers (petshell/firmware/src/logic.h, compiled here with g++) against the site:
 *  - the feed QR link decodes as a phone hand-off code (js/handoff.js format v1: v, a, p:[[tag, amount]]) with the right tag
 *  - sha256 of an address (owner page names) matches node's crypto
 *  - setup.js packs every stage x frame of a real pet (js/pet-core.js) into ART lines the device decodes back to the same bytes
 *  - address checks agree between setup.js and the device; amounts print as plain JSON numbers; the feed streak matches
 *    tools/sync-server/split.js streakAt()
 * No network, no device. Skips (PASS with a note) when g++ is missing. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
let fails = 0, n = 0;
function ok(c, m) { n++; if (c) console.log('PASS ' + m); else { fails++; console.log('FAIL ' + m); } }

const gxx = cp.spawnSync('g++', ['--version']);
if (gxx.status !== 0) { console.log('PASS petshell: g++ not installed, device helper checks skipped'); process.exit(0); }

const tmp = fs.mkdtempSync(path.join(process.env.XCPETS_TEST_TMP || os.tmpdir(), 'ps-'));
const src = path.join(tmp, 'h.cpp'), bin = path.join(tmp, 'h');
fs.writeFileSync(src, `#include "${path.join(ROOT, 'petshell/firmware/src/logic.h')}"
#include <iostream>
#include <sstream>
int main() {
  std::string cmd;
  while (std::cin >> cmd) {
    if (cmd == "sha") { std::string s; std::cin >> s; std::cout << xp::sha256hex(s) << "\\n"; }
    else if (cmd == "link") { std::string a; long id; double amt; long long at; std::cin >> a >> id >> amt >> at; std::cout << xp::feedLink(a, id, amt, at) << "\\n"; }
    else if (cmd == "amt") { double v; std::cin >> v; std::cout << xp::amountText(v) << "\\n"; }
    else if (cmd == "addr") { std::string a; std::cin >> a; std::cout << (xp::validAddr(a) ? 1 : 0) << "\\n"; }
    else if (cmd == "b64") { std::string s; std::cin >> s; std::vector<uint8_t> out(4096); long k = xp::b64decode(s.c_str(), s.size(), out.data(), out.size());
      std::cout << k; for (long i = 0; i < k; i++) { char b[4]; snprintf(b, 4, "%02x", out[i]); std::cout << (i ? "" : " ") << b; } std::cout << "\\n"; }
    else if (cmd == "streak") { long tip; int k; std::cin >> tip >> k; std::vector<long> d(k); for (auto &x : d) std::cin >> x; bool t = false; int s = xp::feedStreak(d, tip, &t); std::cout << s << " " << t << "\\n"; }
    else if (cmd == "shard") { long id; std::cin >> id; std::cout << xp::petShardName(id) << "\\n"; }
    else if (cmd == "batt") { int mv; std::cin >> mv; std::cout << xp::batteryPercent(mv) << "\\n"; }
  }
}
`);
const cc = cp.spawnSync('g++', ['-std=c++17', '-O1', '-Wall', '-o', bin, src], { encoding: 'utf8' });
ok(cc.status === 0, 'logic.h compiles on a computer' + (cc.status ? ': ' + cc.stderr.slice(0, 400) : ''));
if (cc.status !== 0) process.exit(1);
function run(lines) { const r = cp.spawnSync(bin, [], { input: lines.join('\n') + '\n', encoding: 'utf8', maxBuffer: 64 << 20 }); return r.stdout.trim().split('\n'); }

/* 1. sha256 (owner pages are view/own/<sha256(address)>.json) */
const addrs = ['bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD', 'abc', 'x'.repeat(200)];
const sh = run(addrs.map(a => 'sha ' + a));
addrs.forEach((a, i) => ok(sh[i] === crypto.createHash('sha256').update(a).digest('hex'), 'sha256 matches node for ' + a.slice(0, 12)));

/* 2. the feed QR link is a valid phone hand-off code */
function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64').toString('utf8'); }
const [link1, link2] = run(['link bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q 4207 12.5 1764000000000', 'link 1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD 77 0 0']);
ok(/^https:\/\/xcpets\.fun\/play\.html#xh=[A-Za-z0-9_-]+$/.test(link1), 'feed link points at play.html#xh=');
const o1 = JSON.parse(unb64u(link1.split('#xh=')[1])), o2 = JSON.parse(unb64u(link2.split('#xh=')[1]));
ok(o1.v === 1 && o1.a === 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q' && o1.at === 1764000000000, 'feed code has version, address and time');
ok(Array.isArray(o1.p) && o1.p.length === 1 && o1.p[0][0] === 'pet:feed:4207' && o1.p[0][1] === 12.5, 'feed code holds one pet:feed:4207 burn of 12.5');
ok(o2.p[0][1] === 1 && !('at' in o2), 'no price known -> amount 1 (the site re-prices), no time -> no at');
ok(link1.length < 192, 'feed link short enough for a big QR (' + link1.length + ' chars)');
/* the real decoder, when js/handoff.js is on this branch */
const HO = path.join(ROOT, 'js/handoff.js');
if (fs.existsSync(HO)) {
  const vm = require('vm'), store = {};
  const win = { localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { hash: '#xh=' + link1.split('#xh=')[1], pathname: '/play.html', search: '' }, history: { replaceState() {} }, document: { getElementById() { return null; }, addEventListener() {}, readyState: 'loading' },
    addEventListener() {}, matchMedia: () => ({ matches: false }), navigator: {}, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64') };
  win.window = win; win.self = win;
  try {
    vm.runInNewContext(fs.readFileSync(HO, 'utf8'), Object.assign(win, { escape, unescape, encodeURIComponent, decodeURIComponent, JSON, Date, Math, Number, String, Array, Object, RegExp, Error }), { filename: 'handoff.js' });
    const got = JSON.parse(store['xcpets-handoff-in'] || 'null');
    ok(got && got.a === o1.a && got.plans && got.plans[0].tag === 'pet:feed:4207' && got.plans[0].amount === 12.5, 'js/handoff.js receive() accepts the device QR');
  } catch (e) { ok(false, 'js/handoff.js runs: ' + e.message); }
} else console.log('PASS js/handoff.js not on this branch yet (PR 219): checked against the documented format only');

/* 3. amounts, addresses, shards, battery */
const am = run(['amt 69', 'amt 0.5', 'amt 1.23456789', 'amt 0.000000014', 'amt -3']);
ok(JSON.stringify(am) === JSON.stringify(['69', '0.5', '1.23456789', '0.00000001', '1']), 'amounts print as JSON numbers with at most 8 decimals: ' + am.join(' '));
const SU = require(path.join(ROOT, 'shell/setup.js'));
const cases = ['bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'bc1BAD', 'hello', '1Il0O', 'bc1pfvkpmllrxyz0234567890acdefghjklmnpqrstuvwxyz'];
const dev = run(cases.map(a => 'addr ' + a));
cases.forEach((a, i) => ok((dev[i] === '1') === SU.validAddr(a), 'address check agrees (' + a.slice(0, 10) + ' -> ' + SU.validAddr(a) + ')'));
ok(run(['shard 4207', 'shard 1999', 'shard 2000'] ).join(',') === '00002,00000,00001', 'pet file names match view/p/<id/2000>');
const bt = run(['batt 4200', 'batt 3800', 'batt 3000']).map(Number);
ok(bt[0] === 100 && bt[1] === 50 && bt[2] === 0, 'battery percent');

/* 4. art: a real pet, every stage and frame, through setup.js and back through the device decoder */
const PC = require(path.join(ROOT, 'js/pet-core.js')), XA = require(path.join(ROOT, 'js/v2-art.js'));
const art = PC.generate({ blockHash: '00000000000000000002a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8', petId: 4207 });
const frames = SU.petFrames({ id: 4207, stage: 3, art: art }, null, PC, XA);
ok(frames && frames.length === 6 && frames.every(s => s.length === 4 && s.every(f => f.length === 32 * 32 * 4)), 'setup.js draws 6 stages x 4 frames of 32 x 32');
ok(SU.petFrames({ id: 9, hybrid: { shape: 'pepe' } }, null, PC, XA) === null && SU.petFrames({ id: 9, community: 1 }, null, PC, XA) === null, 'hybrids and community pets fall back (device shows a mystery egg)');
const L = SU.lines({ ssid: 'Home', pass: 'p"w', addr: 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', pet: 4207, name: 'Frogzilla', num: 7 }, frames);
ok(L.length === 26 && /^CFG /.test(L[0]) && L[25] === 'SAVE', 'setup sends CFG, 24 ART lines, SAVE');
const cfg = JSON.parse(L[0].slice(4));
ok(cfg.pet === 4207 && cfg.pass === 'p"w' && cfg.num === 7 && !('seed' in cfg) && !('key' in cfg), 'settings carry address, pet, Wi-Fi, number (and nothing secret about the wallet)');
ok(L.every(l => l.length < 6000 && l.indexOf('\n') < 0), 'every line fits the device line buffer');
const dec = run(L.slice(1, 25).map(l => 'b64 ' + l.split(' ')[3]));
let same = true;
for (let s = 0, k = 0; s < 6; s++) for (let f = 0; f < 4; f++, k++) {
  const want = Buffer.from(SU.rgb565(frames[s][f])).toString('hex'), got = dec[k].split(' ');
  if (got[0] !== '2048' || got[1] !== want) same = false;
}
ok(same, 'the device decodes every ART line back to the exact 2,048 RGB565 bytes');
const px = SU.rgb565(Uint8Array.from([255, 0, 0, 255].concat(new Array(32 * 32 * 4 - 4).fill(0))));
ok(px[0] === 0x00 && px[1] === 0xf8 && (px[2] | (px[3] << 8)) === SU.BG565, 'RGB565 little endian (red = 0xF800), see-through = device background');

/* 5. feed streak, same rule as tools/sync-server/split.js streakAt() */
function streakAt(fd, tip) { const d0 = Math.floor(tip / 144); let d = fd[d0] ? d0 : d0 - 1, n = 0; while (fd[d]) { n++; d--; } return { sk: n, td: fd[d0] ? 1 : 0 }; }
[[977450, [6787, 6786, 6785]], [977450, [6786, 6785, 6783]], [977450, []], [977450, [6788]]].forEach(([tip, days]) => {
  const fd = {}; days.forEach(d => { fd[d] = 1; });
  const want = streakAt(fd, tip), got = run(['streak ' + tip + ' ' + days.length + ' ' + days.join(' ')])[0].split(' ').map(Number);
  ok(got[0] === want.sk && got[1] === want.td, 'streak ' + days.join(',') + ' at ' + tip + ' = ' + want.sk + (want.td ? ' (fed today)' : ''));
});

/* 6. files the setup page needs */
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'shell/firmware/manifest.json'), 'utf8'));
ok(man.builds && man.builds[0].chipFamily === 'ESP32-S3' && man.builds[0].parts[0].path === 'petshell.bin' && man.builds[0].parts[0].offset === 0, 'firmware manifest: ESP32-S3, one merged image at 0');
const page = fs.readFileSync(path.join(ROOT, 'shell/index.html'), 'utf8');
ok(/esp-web-tools@\d+\.\d+\.\d+\//.test(page) && /setup\.js\?v=/.test(page), 'setup page pins ESP Web Tools and loads setup.js with a cache token');
ok(!/seed phrase[^.]*(type|enter) (it|your)/i.test(page) && /never asks for a seed phrase or private key/i.test(page), 'setup page says it never asks for keys');
const fw = fs.readFileSync(path.join(ROOT, 'petshell/firmware/src/main.cpp'), 'utf8');
ok(!/mnemonic|privkey|private_key|signTransaction|sign\(/i.test(fw), 'firmware has no key or signing code');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? fails + ' failed of ' + n : 'all ' + n + ' passed');
process.exit(fails ? 1 : 0);
