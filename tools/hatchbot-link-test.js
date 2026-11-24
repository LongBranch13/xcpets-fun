#!/usr/bin/env node
/* HatchBot /link (opt-in wallet <-> Telegram links, Nov 24 2026): hatchbot/verify-sig.mjs + hatchbot/link.js.
 * 1) signature checker: the official BIP-322 vectors (P2WPKH, Taproot) and fresh BIP-137 signatures for 1.../3.../bc1q... addresses,
 *    plus every way a wrong message, wrong address or junk must fail;
 * 2) the whole flow against a mock Telegram and an in-memory D1: /link (private and group), POST /link, /unlink, /players (team only),
 *    /tell, expired codes, bad signatures, a wallet moving to the account that proved it last.
 * Installs hatchbot's three crypto libraries (npm ci in hatchbot/) when they are missing. Sends nothing anywhere. */
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const HB = path.join(__dirname, '..', 'hatchbot');
if (!fs.existsSync(path.join(HB, 'node_modules', '@noble', 'curves'))) cp.execSync('npm ci --no-audit --no-fund', { cwd: HB, stdio: 'ignore' });
const fails = []; const ok = (c, name) => { console.log((c ? 'PASS ' : 'FAIL ') + name); if (!c) fails.push(name); };

/* a tiny D1 stand-in that understands exactly the statements hatchbot/link.js uses */
function mockD1() {
  const links = new Map(), codes = new Map();
  const run = (sql, a) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('SELECT wallet FROM links WHERE tg_id = ?')) return { results: [...links.values()].filter((r) => r.tg_id === a[0]).sort((x, y) => x.at - y.at).map((r) => ({ wallet: r.wallet })) };
    if (s.startsWith('DELETE FROM link_codes WHERE exp < ? OR tg_id = ?')) { for (const [k, r] of codes) if (r.exp < a[0] || r.tg_id === a[1]) codes.delete(k); return {}; }
    if (s.startsWith('INSERT INTO link_codes')) { codes.set(a[0], { code: a[0], tg_id: a[1], chat_id: a[2], username: a[3], first_name: a[4], exp: a[5] }); return {}; }
    if (s.startsWith('SELECT * FROM link_codes WHERE code = ?')) return codes.get(a[0]) || null;
    if (s.startsWith('DELETE FROM link_codes WHERE code = ?')) { codes.delete(a[0]); return {}; }
    if (s.startsWith('SELECT tg_id FROM links WHERE wallet = ?')) { const r = links.get(a[0]); return r ? { tg_id: r.tg_id } : null; }
    if (s.startsWith('INSERT OR REPLACE INTO links')) { links.set(a[0], { wallet: a[0], tg_id: a[1], username: a[2], first_name: a[3], at: a[4], how: a[5] }); return {}; }
    if (s.startsWith('DELETE FROM links WHERE wallet = ? AND tg_id = ?')) { const r = links.get(a[0]); if (r && r.tg_id === a[1]) links.delete(a[0]); return {}; }
    if (s.startsWith('SELECT * FROM links ORDER BY at')) return { results: [...links.values()].sort((x, y) => x.at - y.at) };
    throw new Error('mock D1 does not know: ' + s);
  };
  return { links, codes, prepare: (sql) => ({ bind: (...a) => ({ first: async () => run(sql, a), all: async () => run(sql, a), run: async () => run(sql, a) }) }) };
}

(async () => {
  const V = await import(path.join(HB, 'verify-sig.mjs'));
  const L = await import(path.join(HB, 'link.js'));
  const { secp256k1 } = await import(path.join(HB, 'node_modules/@noble/curves/secp256k1.js'));
  const { sha256 } = await import(path.join(HB, 'node_modules/@noble/hashes/sha256.js'));
  const { ripemd160 } = await import(path.join(HB, 'node_modules/@noble/hashes/ripemd160.js'));
  const { base64, bech32, createBase58check } = await import(path.join(HB, 'node_modules/@scure/base/lib/esm/index.js'));
  const b58 = createBase58check(sha256), h160 = (b) => ripemd160(sha256(b)), cat = (...a) => Uint8Array.from(a.flatMap((x) => [...x]));

  /* 1) official BIP-322 vectors */
  const W = 'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l', T = 'bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3';
  const HW = 'AkcwRAIgZRfIY3p7/DoVTty6YZbWS71bc5Vct9p9Fia83eRmw2QCICK/ENGfwLtptFluMGs2KsqoNSk89pO7F29zJLUx9a/sASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI=';
  const EMPTY = 'AkcwRAIgM2gBAQqvZX15ZiysmKmQpDrG83avLIT492QBzLnQIxYCIBaTpOaD20qRlEylyxFSeEA2ba9YOixpX8z46TSDtS40ASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI=';
  const TR = 'AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ==';
  ok(V.verifyMessage(W, 'Hello World', HW).ok, 'BIP-322 P2WPKH "Hello World" vector');
  ok(V.verifyMessage(W, '', EMPTY).ok, 'BIP-322 P2WPKH empty-message vector');
  ok(V.verifyMessage(W.toUpperCase(), 'Hello World', HW).ok === true, 'upper-case bech32 address reads the same');
  ok(!V.verifyMessage(W, 'Hello World!', HW).ok, 'P2WPKH: another message fails');
  ok(!V.verifyMessage(W, 'Hello World', EMPTY).ok, 'P2WPKH: a signature of another message fails');
  ok(V.verifyMessage(T, 'Hello World', TR).ok, 'BIP-322 Taproot "Hello World" vector');
  ok(!V.verifyMessage(T, 'Hello World.', TR).ok, 'Taproot: another message fails');
  ok(!V.verifyMessage('bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', 'Hello World', TR).ok, 'Taproot: another address fails');

  /* 2) BIP-137 (classic 65-byte) signatures, made here */
  const magic = (m) => { const b = Buffer.from(m, 'utf8'); return sha256(sha256(cat(Buffer.from('\x18Bitcoin Signed Message:\n'), [b.length], b))); };
  const priv = sha256(Buffer.from('xcpets link test key'));
  const sign137 = (m, head0) => { const s = secp256k1.sign(magic(m), priv); return base64.encode(cat([head0 + s.recovery], s.toCompactRawBytes())); };
  const pubC = secp256k1.getPublicKey(priv, true), pubU = secp256k1.getPublicKey(priv, false);
  const p2pkhC = b58.encode(cat([0], h160(pubC))), p2pkhU = b58.encode(cat([0], h160(pubU)));
  const p2sh = b58.encode(cat([5], h160(cat([0, 20], h160(pubC))))), p2wpkh = bech32.encode('bc', [0].concat(bech32.toWords(h160(pubC))));
  const M = L.linkMessage('ABCD2345');
  ok(V.verifyMessage(p2pkhC, M, sign137(M, 31)).ok, 'BIP-137: Legacy 1... address, compressed key (XCP Wallet, Casa Tookan)');
  ok(V.verifyMessage(p2pkhU, M, sign137(M, 27)).ok, 'BIP-137: Legacy 1... address, uncompressed key (old imported WIF)');
  ok(!V.verifyMessage(p2pkhU, M, sign137(M, 31)).ok, 'BIP-137: compressed signature does not prove the uncompressed address');
  ok(V.verifyMessage(p2sh, M, sign137(M, 35)).ok, 'BIP-137: 3... P2SH-SegWit (header 35, Trezor)');
  ok(V.verifyMessage(p2wpkh, M, sign137(M, 39)).ok, 'BIP-137: bc1q... (header 39, Trezor)');
  ok(V.verifyMessage(p2wpkh, M, sign137(M, 31)).ok, 'BIP-137: bc1q... with header 31 (Electrum style)');
  ok(!V.verifyMessage(p2pkhC, L.linkMessage('ABCD2346'), sign137(M, 31)).ok, 'BIP-137: another code fails');
  ok(!V.verifyMessage(W, M, sign137(M, 31)).ok, 'BIP-137: another address fails');
  ok(!V.verifyMessage('1BoatSLRHtKNngkdXEeobR76b53LETtpyT', M, 'not base64!').ok, 'junk signature fails');
  ok(!V.verifyMessage('tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l', 'Hello World', HW).ok, 'testnet address refused');
  ok(!V.verifyMessage('hello', 'x', HW).ok, 'not an address refused');

  /* 3) the flow */
  const sent = [], tg = async (env, method, body) => { sent.push({ method, body }); return { ok: true, json: async () => ({ ok: true, result: method === 'getChatAdministrators' ? [{ status: 'creator', user: { id: 777 } }] : { message_id: 1 } }) }; };
  const last = () => sent[sent.length - 1];
  const env = { DB: mockD1(), TELEGRAM_CHAT_ID: '-100group' };
  const replies = [], files = [];
  const D = (msg) => ({ tg, botUsername: async () => 'HatchBot_test', host: 'hatchbot.example.workers.dev', petCounter: async () => (a) => (a === p2pkhC ? 2200 : 0),
    reply: async (t) => { replies.push(t); return null; }, sendFile: async (e, chat, name, text, cap) => { files.push({ chat, name, text, cap }); } });
  const pm = (id, extra) => Object.assign({ message_id: 5, chat: { id, type: 'private' }, from: { id, first_name: 'Evan', username: 'evan_x' } }, extra || {});
  const post = (o) => L.linkPost(new Request('https://hatchbot.example.workers.dev/link', { method: 'POST', body: JSON.stringify(o) }), env, { tg, petCounter: D().petCounter });

  await L.cmdLink(env, { message_id: 9, chat: { id: -100, type: 'supergroup' }, from: { id: 42 } }, D());
  ok(/private/.test(last().body.text) && /t\.me\/HatchBot_test\?start=link/.test(JSON.stringify(last().body.reply_markup)) && env.DB.codes.size === 0, '/link in the group: points to the private chat, makes no code');
  await L.cmdLink(env, pm(42), D());
  const btn = last().body.reply_markup.inline_keyboard[0][0].url, code = /#c=([A-Z2-9]{8})&h=hatchbot\.example\.workers\.dev$/.exec(btn);
  ok(!!code && btn.startsWith('https://xcpets.fun/link.html#'), '/link in private: one-time code and a button to xcpets.fun/link.html');
  ok(/free/.test(last().body.text) && /never shown on the site/.test(last().body.text) && /\/unlink/.test(last().body.text), '/link says it is free, private and removable');
  const C = code[1];
  let r = await post({ c: C, a: p2pkhC, s: sign137(L.linkMessage('ZZZZ2345'), 31) });
  ok(r.status === 400 && env.DB.links.size === 0, 'a signature of another code is refused, nothing saved');
  ok(r.headers.get('access-control-allow-origin') === 'https://xcpets.fun', 'answers only xcpets.fun pages (CORS)');
  r = await post({ c: C, a: p2pkhC, s: sign137(L.linkMessage(C), 31), w: 'Casa Tookan' });
  let j = await r.json();
  ok(r.status === 200 && j.ok && j.pets === 2200 && env.DB.links.get(p2pkhC).tg_id === '42' && env.DB.links.get(p2pkhC).username === 'evan_x', 'a good signature links the wallet to that Telegram account');
  ok(/Linked!/.test(last().body.text) && /2,200 pets/.test(last().body.text) && last().body.chat_id === '42', 'the player hears it in Telegram');
  ok(env.DB.codes.size === 0, 'the code is used up');
  r = await post({ c: C, a: p2pkhC, s: sign137(L.linkMessage(C), 31) });
  ok(r.status === 410, 'a used code cannot be replayed');
  env.DB.codes.set('OLDC2345', { code: 'OLDC2345', tg_id: '42', chat_id: '42', exp: Date.now() - 1 });
  r = await post({ c: 'OLDC2345', a: p2wpkh, s: sign137(L.linkMessage('OLDC2345'), 39) });
  ok(r.status === 410 && !env.DB.links.has(p2wpkh), 'an expired code is refused');
  r = await post({ c: 'bad', a: p2pkhC, s: 'x' }); ok(r.status === 400, 'a broken code is refused');

  /* the wallet moves to whoever proves it last, and the old account is told */
  await L.cmdLink(env, pm(43, { from: { id: 43, first_name: 'Jacob' } }), D());
  const C2 = /#c=([A-Z2-9]{8})/.exec(last().body.reply_markup.inline_keyboard[0][0].url)[1];
  await post({ c: C2, a: p2pkhC, s: sign137(L.linkMessage(C2), 31) });
  ok(env.DB.links.get(p2pkhC).tg_id === '43' && sent.some((x) => x.body.chat_id === '42' && /another Telegram account/.test(x.body.text)), 'a wallet re-proved by another account moves there and the old account is told');

  /* /bug wallet lookup and /unlink */
  ok((await L.walletsOf(env, 43)).join() === p2pkhC && (await L.walletsOf(env, 42)).length === 0, 'walletsOf (used by /bug) lists the player\'s linked wallets');
  replies.length = 0; await L.cmdUnlink(env, pm(43), '', D());
  ok(env.DB.links.size === 0 && /Removed/.test(replies[0]), '/unlink removes the link');
  replies.length = 0; await L.cmdUnlink(env, pm(43), '', D()); ok(/No wallet is linked/.test(replies[0]), '/unlink with nothing linked says so');

  /* team commands */
  await L.cmdLink(env, pm(42), D()); const C3 = /#c=([A-Z2-9]{8})/.exec(last().body.reply_markup.inline_keyboard[0][0].url)[1];
  await post({ c: C3, a: p2pkhC, s: sign137(L.linkMessage(C3), 31), w: 'XCP Wallet' });
  replies.length = 0; files.length = 0;
  ok((await L.cmdPlayers(env, pm(42), '', D())) === null && !files.length && !replies.length, '/players is silent for a player');
  ok((await L.cmdTell(env, pm(42), p2pkhC + ' hi', D())) === null, '/tell is silent for a player');
  await L.cmdPlayers(env, pm(777), '', D());
  ok(files.length === 1 && files[0].text.split('\n')[1].startsWith(p2pkhC + ',@evan_x,Evan,2200,') && /Private/.test(files[0].cap), '/players: the group creator gets the private CSV');
  const envA = Object.assign({}, env, { HATCHBOT_ADMIN_IDS: '555, 556' });
  files.length = 0; await L.cmdPlayers(envA, pm(556), '', D()); ok(files.length === 1, '/players: HATCHBOT_ADMIN_IDS works too');
  replies.length = 0; await L.cmdPlayers(env, pm(777), '@Evan_X', D()); ok(replies[0].startsWith(p2pkhC) && /2,200 pets/.test(replies[0]), '/players @name finds the wallet');
  replies.length = 0; await L.cmdPlayers(env, pm(777), p2pkhC.slice(-5), D()); ok(replies[0].startsWith(p2pkhC), '/players <end of wallet> finds it');
  replies.length = 0; await L.cmdTell(env, pm(777), p2pkhC.slice(0, 8) + ' Your zombies are back, reload My Pets.', D());
  const dm = sent.filter((x) => x.body.chat_id === '42').pop();
  ok(/message from the XCPETS team/.test(dm.body.text) && /zombies are back/.test(dm.body.text) && /^\u2705 Sent to @evan_x/.test(replies[0]), '/tell sends the player a private message and confirms');
  ok(L.okHost('hatchbot.abc-1.workers.dev') && L.okHost('bot.xcpets.fun') && !L.okHost('evil.com') && !L.okHost('hatchbot.x.workers.dev.evil.com'), 'the page only talks to HatchBot hosts');

  /* the page, the worker wiring and the reporter */
  const page = fs.readFileSync(path.join(__dirname, '..', 'link.html'), 'utf8');
  ok(page.includes("'XCPETS HatchBot link code ' + code + '. Signing is free and spends nothing.'") && L.linkMessage('X') === 'XCPETS HatchBot link code X. Signing is free and spends nothing.', 'link.html signs exactly the message the worker checks');
  ok(/noindex/.test(page) && !/signAndBroadcast|compose/.test(page), 'link.html only signs a message: no burn, no transaction');
  const wk = fs.readFileSync(path.join(HB, 'worker.js'), 'utf8');
  ok(/"\/link", "\/unlink", "\/players", "\/tell"/.test(wk) && /url\.pathname === "\/link" && req\.method === "POST"/.test(wk) && /walletsOf\(env, who\)/.test(wk), 'worker: commands, POST /link and the /bug wallet are wired');
  const ER = require('./build-err-report.js');
  ok(/W\.XcpCount=function\(w,ph\)\{go\(\{k:'wallet',w:/.test(ER.JS), 'page reporter: anonymous wallet-app count (name + phone/desktop only)');
  ok(/countWallet\(L\)/.test(fs.readFileSync(path.join(__dirname, '..', 'js', 'v2-wallet.js'), 'utf8')), 'v2-wallet counts a connect once per day');

  console.log(fails.length ? '\n' + fails.length + ' FAILED' : '\nall passed');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
