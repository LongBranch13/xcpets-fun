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
      const body = '**From:** ' + clean(b.name) + ' in the XCPETS Telegram group, ' + b.at + '\n\n' + clean(b.text) + (b.quoted ? '\n\n> ' + clean(b.quoted).split('\n').join('\n> ') : '') + (b.photo ? '\n\n_(They replied to a photo; ask in Telegram for the screenshot.)_' : '') + '\n\n<sub>Logged by HatchBot /bug</sub>';
      const ir = await gh('/issues', { title, body, labels: ['player-bug'] });
      if (!ir.ok) { console.log('issue failed ' + ir.status + ' for ' + k); continue; }
      made++;
    }
    await cf('/' + ns.id + '/values/' + encodeURIComponent(k), { method: 'DELETE' });
  }
  console.log('bug inbox: ' + made + ' new issue(s)');
})().catch(e => { console.log('bug inbox failed: ' + (e && e.message)); });
