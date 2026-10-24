/* player-qol 2026-10-24: wallet stays connected across page loads / tab focus (silent xcp_accounts, no popup), tracks lock/unlock/disconnect,
 * status pill with one-tap reconnect, and stores only the provider kind + public address. Run: python3 -m http.server 8099 in the repo root. */
const { chromium } = require('playwright-core');
const ADDR = 'bc1qtestaddressxxxxxxxxxxxxxxxxxxxxxxxxxx';
const HARNESS = '<!doctype html><html><head><meta charset="utf-8"></head><body><script src="rjs/config.js"></script><script src="rjs/wallet.js"></script><script src="rjs/burn-core.js"></script><script src="js/v2-wallet.js"></script></body></html>';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const pg = await b.newPage(); const res = []; const ok = (n, c, x) => res.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  pg.on('pageerror', e => res.push('FAIL pageerror ' + e.message));
  await pg.route('http://localhost:8099/zz-wallet-persist.html', r => r.fulfill({ contentType: 'text/html', body: HARNESS }));
  await pg.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 404, body: '' }));
  await pg.addInitScript(ADDR => { const W = window.__W = { calls: [], acc: [ADDR], h: {} };
    window.xcpwallet = { on(e, f) { (W.h[e] = W.h[e] || []).push(f); }, request(a) { W.calls.push(a.method);
      if (a.method === 'xcp_accounts') return Promise.resolve(W.acc.slice());
      if (a.method === 'xcp_requestAccounts') { W.acc = [ADDR]; return Promise.resolve({ accounts: [ADDR] }); }
      if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet'); return Promise.resolve(null); } };
    W.fire = (e, v) => (W.h[e] || []).forEach(f => f(v)); }, ADDR);
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const pill = () => ev(() => { const p = document.getElementById('xwPill'); return p && !p.hidden ? p.className + '|' + p.textContent : 'none'; });
  // fresh browser, never connected: no pill, no popup
  await pg.goto('http://localhost:8099/zz-wallet-persist.html'); await wait(900);
  let c = await ev(() => __W.calls); ok('no popup on load', !c.includes('xcp_requestAccounts'), JSON.stringify(c));
  ok('already-approved wallet attaches silently on first load', await ev(() => V2Wallet.status()) === 'on');
  // reload with the remembered connection: silent attach, pill green
  await pg.reload(); await wait(900); c = await ev(() => __W.calls);
  ok('reload: silent reconnect via xcp_accounts', c.includes('xcp_accounts') && !c.includes('xcp_requestAccounts'), JSON.stringify(c));
  ok('status on after reload', await ev(() => V2Wallet.status()) === 'on'); ok('pill connected', /^on\|Wallet connected/.test(await pill()), await pill());
  ok('current() = address', await ev(() => V2Wallet.current()) === ADDR);
  // lock -> pill locked with Unlock, unlock -> on
  await ev(() => { __W.acc = []; __W.fire('accountsChanged', []); }); await wait(50);
  ok('lock shows locked + Unlock', /^locked\|.*Unlock/.test(await pill()), await pill());
  await ev(() => { __W.acc = [__W.acc[0] || 'bc1qtestaddressxxxxxxxxxxxxxxxxxxxxxxxxxx']; __W.fire('accountsChanged', ['bc1qtestaddressxxxxxxxxxxxxxxxxxxxxxxxxxx']); }); await wait(50);
  ok('unlock back to on', await ev(() => V2Wallet.status()) === 'on');
  // disconnect -> off; provider forgotten
  await ev(() => { __W.acc = []; __W.fire('disconnect'); }); await wait(50);
  ok('disconnect event -> no wallet', await ev(() => V2Wallet.current()) == null);
  // tab comes back after the user reconnected in the extension: focus re-attaches silently
  await ev(() => { __W.acc = ['bc1qtestaddressxxxxxxxxxxxxxxxxxxxxxxxxxx']; __W.calls = []; }); await wait(2100);
  await ev(() => window.dispatchEvent(new Event('focus'))); await wait(400);
  c = await ev(() => __W.calls); ok('focus re-attaches without popup', await ev(() => V2Wallet.status()) === 'on' && !c.includes('xcp_requestAccounts'), JSON.stringify(c));
  // one-tap reconnect from the pill
  await ev(() => { __W.acc = []; __W.fire('accountsChanged', []); }); await wait(50);
  await pg.click('#xwRe'); await wait(300); ok('pill Unlock reconnects', await ev(() => V2Wallet.status()) === 'on', await pill());
  // nothing secret stored
  const ls = await ev(() => Object.keys(localStorage).map(k => k + '=' + localStorage.getItem(k)));
  ok('localStorage holds only provider kind + public address', ls.every(x => !/priv|seed|mnemonic|wif|xprv|secret|signature|proof/i.test(x)), JSON.stringify(ls));
  ok('provider remembered', ls.some(x => x === 'xcpets-v2-wallet-provider=xcpwallet'));
  await b.close(); console.log(res.join('\n')); const f = res.filter(x => !x.startsWith('PASS')).length;
  console.log('wallet-persist-test: ' + (res.length - f) + '/' + res.length + ' pass'); process.exit(f ? 1 : 0);
})();
