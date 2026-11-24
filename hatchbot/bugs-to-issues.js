#!/usr/bin/env node
/* HatchBot /bug reports -> GitHub issues (Nov 22 2026). Run by .github/workflows/hatchbot.yml every 10 minutes.
 * Reads reports the worker saved in the Cloudflare KV namespace 'hatchbot-bugs' (keys 'bug:<time>:<msg>'), opens one GitHub
 * issue per report (label 'player-bug', first name only, no Telegram ids), then deletes the key. Quiet when secrets are missing.
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GITHUB_TOKEN, GITHUB_REPOSITORY. */
'use strict';
const CF = process.env.CLOUDFLARE_API_TOKEN, ACC = process.env.CLOUDFLARE_ACCOUNT_ID, GH = process.env.GITHUB_TOKEN, REPO = process.env.GITHUB_REPOSITORY;
const cf = (p, o) => fetch('https://api.cloudflare.com/client/v4/accounts/' + ACC + '/storage/kv/namespaces' + p, Object.assign({ headers: { Authorization: 'Bearer ' + CF } }, o || {}));
const gh = (p, body) => fetch('https://api.github.com/repos/' + REPO + p, { method: 'POST', headers: { Authorization: 'Bearer ' + GH, 'content-type': 'application/json', accept: 'application/vnd.github+json' }, body: JSON.stringify(body) });
(async () => {
  if (!CF || !ACC || !GH || !REPO) { console.log('bug inbox: not set up, skipping'); return; }
  const ns = ((await (await cf('?per_page=100')).json()).result || []).find(n => n.title === 'hatchbot-bugs');
  if (!ns) { console.log('bug inbox: no KV namespace yet (deploy hatchbot-worker first)'); return; }
  const keys = ((await (await cf('/' + ns.id + '/keys?prefix=bug:&limit=100')).json()).result || []).map(k => k.name).sort();
  await gh('/labels', { name: 'player-bug', color: 'd73a4a', description: 'Reported by a player with /bug in Telegram' }).catch(() => {});
  let made = 0;
  for (const k of keys) {
    const r = await cf('/' + ns.id + '/values/' + encodeURIComponent(k)); if (!r.ok) continue;
    let b; try { b = JSON.parse(await r.text()); } catch (e) { b = null; }
    if (b) {
      const clean = s => String(s || '').replace(/@/g, '@​');
      const title = '🐞 ' + clean(b.text || b.quoted).replace(/\s+/g, ' ').slice(0, 80);
      const body = '**From:** ' + clean(b.name) + ' in the XCPETS Telegram group, ' + b.at + (Array.isArray(b.wallets) && b.wallets.length ? '\n**Linked wallet' + (b.wallets.length > 1 ? 's' : '') + ' (the player linked it with /link and agreed it is shown here):** ' + b.wallets.map(w => '`' + String(w).replace(/[^A-Za-z0-9]/g, '') + '`').join(', ') : '') + '\n\n' + clean(b.text) + (b.quoted ? '\n\n> ' + clean(b.quoted).split('\n').join('\n> ') : '') + (b.photo ? '\n\n_(They replied to a photo; ask in Telegram for the screenshot.)_' : '') + '\n\n<sub>Logged by HatchBot /bug</sub>';
      const ir = await gh('/issues', { title, body, labels: ['player-bug'] });
      if (!ir.ok) { console.log('issue failed ' + ir.status + ' for ' + k); continue; }
      made++;
    }
    await cf('/' + ns.id + '/values/' + encodeURIComponent(k), { method: 'DELETE' });
  }
  console.log('bug inbox: ' + made + ' new issue(s)');
  /* Page error digest (owner Nov 22 2026): the worker keeps one key per error per UTC day ('err:<day>:<sig>'). Each finished day becomes
   * ONE issue labelled 'page-errors' (most frequent first), then its keys are deleted. No wallets, query strings or IPs are ever stored. */
  const today = new Date().toISOString().slice(0, 10), ek = [];
  for (let cur = ''; ;) { const j = await (await cf('/' + ns.id + '/keys?prefix=err:&limit=1000' + (cur ? '&cursor=' + encodeURIComponent(cur) : ''))).json();
    (j.result || []).forEach(k => ek.push(k.name)); cur = j.result_info && j.result_info.cursor; if (!cur) break; }
  const days = {}; ek.forEach(k => { const d = k.split(':')[1]; if (d && d < today) (days[d] = days[d] || []).push(k); });
  /* anonymous wallet-app counts (keys 'wal:<day>:<app>|<phone|desktop>', worker walletCount) join the same daily issue */
  const wk = [], wal = {};
  for (let cur = ''; ;) { const j = await (await cf('/' + ns.id + '/keys?prefix=wal:&limit=1000' + (cur ? '&cursor=' + encodeURIComponent(cur) : ''))).json();
    (j.result || []).forEach(k => wk.push(k.name)); cur = j.result_info && j.result_info.cursor; if (!cur) break; }
  for (const k of wk) { const d = k.split(':')[1]; if (!d || d >= today) continue; const r = await cf('/' + ns.id + '/values/' + encodeURIComponent(k)); if (!r.ok) continue;
    (wal[d] = wal[d] || {})[k.split(':').slice(2).join(':')] = +(await r.text()) || 0; days[d] = days[d] || []; }
  if (Object.keys(days).length) await gh('/labels', { name: 'page-errors', color: 'fbca04', description: 'Daily digest of errors players hit on xcpets.fun pages' }).catch(() => {});
  for (const d of Object.keys(days).sort()) {
    const rows = [];
    for (const k of days[d]) { const r = await cf('/' + ns.id + '/values/' + encodeURIComponent(k)); if (!r.ok) continue; try { rows.push(JSON.parse(await r.text())); } catch (e) { } }
    rows.sort((a, b) => (b.n || 0) - (a.n || 0));
    const total = rows.reduce((t, r) => t + (r.n || 0), 0), esc = s => String(s || '').replace(/@/g, '@​').replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').replace(/`/g, "'");
    const body = 'Errors players\' browsers hit on xcpets.fun on **' + d + '** (UTC), most frequent first. Counts are at least this many (repeats within 10 minutes may be folded).\n\n' +
      '| Times | Kind | Message | Where | Build | Pages | First / last seen |\n|---:|---|---|---|---|---|---|\n' +
      rows.slice(0, 60).map(r => '| ' + (r.n || 1) + ' | ' + esc(r.k) + ' | `' + esc(r.m).slice(0, 200) + '` | ' + esc(r.f) + ':' + (r.l | 0) + ':' + (r.c | 0) + ' | ' + esc(r.b) + ' | ' + (r.pages || []).map(esc).join(' ') + ' | ' + esc(r.first).slice(11, 16) + ' / ' + esc(r.last).slice(11, 16) + ' |').join('\n') +
      (rows.length > 60 ? '\n\n_' + (rows.length - 60) + ' rarer errors left out._' : '') + '\n\n<sub>Collected by the HatchBot worker from the page error reporter (tools/build-err-report.js)</sub>';
    const wd = wal[d] || {}, wt = Object.keys(wd).reduce((t, k) => t + wd[k], 0);
    const wtxt = wt ? '\n\n### Which wallet players connected with (anonymous, once per browser per day)\n\n| Wallet | Phone | Desktop |\n|---|---:|---:|\n' +
      [...new Set(Object.keys(wd).map(k => k.split('|')[0]))].sort().map(w => '| ' + esc(w) + ' | ' + (wd[w + '|phone'] || 0) + ' | ' + (wd[w + '|desktop'] || 0) + ' |').join('\n') : '';
    if (rows.length || wt) { const ir = await gh('/issues', { title: '🧯 Page errors ' + d + ': ' + rows.length + ' kind(s), ' + total + ' report(s)' + (wt ? ', ' + wt + ' wallet connect(s)' : ''), body: (rows.length ? body : 'No page errors this day.') + wtxt, labels: ['page-errors'] });
      if (!ir.ok) { console.log('error digest failed ' + ir.status + ' for ' + d); continue; } }
    for (const k of days[d].concat(wk.filter(k => k.split(':')[1] === d))) await cf('/' + ns.id + '/values/' + encodeURIComponent(k), { method: 'DELETE' });
    console.log('error digest: ' + d + ', ' + rows.length + ' kind(s)');
  }
})().catch(e => { console.log('bug inbox failed: ' + (e && e.message)); });
