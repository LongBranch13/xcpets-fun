// Pass 1 (runtime control inventory) + Pass 2 (use every picker option and click every button) on one tree.
// usage: node walk.js <cloneRoot> <tag> <width> [pages...]
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.resolve(process.argv[2]), TAG = process.argv[3], W = +process.argv[4];
const OUT = path.join(__dirname, 'pass2'), ADDR = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', ORIGIN = 'http://localhost:8099';
const ALL = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && f !== '404.html').map(f => f.replace(/\.html$/, ''));
const PAGES = process.argv.slice(5).length ? process.argv.slice(5) : ALL;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const MAXBTN = +(process.env.MAXBTN || 120), FROZEN = Date.parse('2026-11-02T18:00:00-06:00');
const H = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);
const HELP = `window.__W = {
      vis(e){ if(!e||!e.isConnected) return false; const r=e.getBoundingClientRect(); if(!r.width&&!r.height) return false; const s=getComputedStyle(e); return s.visibility!=='hidden'&&s.display!=='none'; },
      skip(e){ return !!(e.closest('#lfDock,.lf-acts,.xcs-ov')); },
      attrs(e){ return [...e.attributes].filter(a=>/^data-|^aria-label$|^name$|^type$|^role$/.test(a.name)).map(a=>a.name+'='+a.value.slice(0,40)).join(' '); },
      key(e){ const t=e.tagName.toLowerCase().replace('xc-select','select'); return t+(e.id?'#'+e.id:'')+'['+__W.attrs(e)+']'+(t==='select'?'':'{'+(e.innerText||e.value||'').replace(/\\s+/g,' ').trim().slice(0,40)+'}'); },
      pickers(){ return [...document.querySelectorAll('select,xc-select')].filter(e=>!__W.skip(e)); },
      pkKey(e,i){ return (e.id?'#'+e.id:'['+__W.attrs(e)+']')+'@'+i; },
      controls(){ const L=[...document.querySelectorAll('select,xc-select,button,a[href],input,textarea,summary,[role=button],[role=tab],[onclick],[data-act],[data-action]')].filter(e=>!__W.skip(e)&&!e.closest('select,xc-select'));
        const m={}; L.forEach(e=>{ let k=__W.key(e).replace(/\\d{3,}/g,'N'); if(e.tagName==='A') k+=' ->'+(e.getAttribute('href')||'').replace(/\\d{3,}/g,'N').slice(0,60); if(/^(SELECT|XC-SELECT)$/.test(e.tagName)) k+=' opts='+[...e.options].length+':'+__W.h([...e.options].map(o=>o.value+'='+o.textContent).join('|')); m[k]=(m[k]||0)+1; }); return m; },
      h(s){ let x=0; for(let i=0;i<s.length;i++) x=(x*31+s.charCodeAt(i))|0; return (x>>>0).toString(16); },
      fp(e){ const labels=new Set(); document.querySelectorAll('select,xc-select').forEach(s=>[...s.options].forEach(o=>labels.add(o.textContent.trim())));
        const host=(e&&(e.closest('section,.panel,[id$=Panel],details,.modal,.box,main')))||document.body;
        const txt=(host.innerText||'').split('\\n').map(l=>l.trim()).filter(l=>l&&!labels.has(l)).join('\\n');
        const pids=[...document.querySelectorAll('[data-pid]')].filter(__W.vis).slice(0,120).map(x=>x.dataset.pid).join(',');
        return { pids:__W.h(pids), npids: pids? pids.split(',').length:0, txt:__W.h(txt), tlen: txt.length, url: location.pathname+location.hash, ls: __W.h(Object.keys(localStorage).sort().map(k=>k+'='+localStorage.getItem(k)).join('|')) }; } };`;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const res = {};
  for (const P of PAGES) {
    const ctx = await b.newContext({ viewport: { width: W, height: W > 500 ? 900 : 844 }, isMobile: W < 500, hasTouch: W < 500, deviceScaleFactor: 1 });
    await ctx.addInitScript(`(()=>{ const T=${FROZEN}; let off=0; const N=Date.now; const s=N(); Date.now=()=>T+(N()-s); Math.random=(()=>{let x=12345;return()=>{x=(x*1103515245+12345)%2147483648;return x/2147483648;};})(); window.open=()=>null; let _ca; Object.defineProperty(window,'V2CemAnim',{configurable:true,get(){return _ca;},set(v){ if(v&&v.watch&&!process_env_cemanim) v.watch=function(){}; _ca=v; }}); })()`.replace('process_env_cemanim', process.env.CEMANIM ? 'true' : 'false'));
    await ctx.addInitScript(HELP);
    const pg = await ctx.newPage(); const errs = []; let dlg = [];
    pg.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 200)));
    pg.on('dialog', d => { dlg.push(d.type() + ':' + d.message().slice(0, 140)); d.dismiss().catch(() => { }); });
    await pg.route(u => u.href.startsWith(ORIGIN + '/'), r => { const p = decodeURIComponent(new URL(r.request().url()).pathname); const f = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ contentType: TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    const url = ORIGIN + '/' + P + '.html?addr=' + ADDR + (/^(pet|verify-pet)$/.test(P) ? '&id=100' : '');
    const load = async () => { try { await pg.goto(url, { waitUntil: 'load', timeout: 90000 }); } catch (e) { errs.push('goto ' + e.message.slice(0, 80)); }
      try { await pg.waitForLoadState('networkidle', { timeout: 40000 }); } catch (e) { }
      await pg.waitForFunction(() => !window.V2UI || (V2UI.world && V2UI.world() && V2UI.world().pets && V2UI.world().pets.length > 100), null, { timeout: 60000 }).catch(() => { }); await pg.waitForTimeout(2500); };
    await load();
    const clearOv = async () => { for (let k = 0; k < 20; k++) { const n = await pg.evaluate(() => [...document.querySelectorAll('.ca-ov')].filter(__W.vis).length).catch(() => 0); if (!n) return; await pg.locator('.ca-ov').first().click({ timeout: 2000, force: true }).catch(() => { }); await pg.waitForTimeout(300); } };
    // ---------- helpers in page ----------

    const T0 = Date.now();
    const R = res[P] = { controls: await pg.evaluate(() => __W.controls()), pickers: [], buttons: [], errors: errs };
    // ---------- pickers ----------
    const plist = await pg.evaluate(() => __W.pickers().map((e, i) => ({ i, k: __W.pkKey(e, i), vis: __W.vis(e), opts: [...e.options].map(o => ({ v: o.value, t: o.textContent.trim(), d: o.disabled })), val: e.value })));
    for (const pk of plist) {
      const n = pk.opts.length; let idx = [...Array(n).keys()];
      const pet = pk.opts.some(o => /^\d+$/.test(o.v) && o.t.includes('#' + o.v));
      if (pet || n > 40) idx = [...new Set([0, 1, Math.floor(n / 2), n - 2, n - 1].filter(i => i >= 0 && i < n))];
      const rec = { k: pk.k, vis: pk.vis, n, start: pk.val, steps: [] };
      for (const i of [...idx, pk.opts.findIndex(o => o.v === pk.val)].filter(i => i >= 0)) {
        const o = pk.opts[i]; if (o.d) { rec.steps.push({ v: o.v, how: 'disabled' }); continue; }
        let how = 'none', ev = 0;
        await clearOv();
        try {
          const ok = await pg.evaluate(([k, ix]) => { const e = __W.pickers()[ix]; if (!e) return false; window.__ev = 0; const f = () => window.__ev++; e.addEventListener('change', f, { once: true }); e.scrollIntoView({ block: 'center', behavior: 'instant' }); return __W.vis(e); }, [pk.k, pk.i]);
          const el = pg.locator('select,xc-select').nth(await pg.evaluate(ix => [...document.querySelectorAll('select,xc-select')].indexOf(__W.pickers()[ix]), pk.i));
          const native = await el.evaluate(e => e.tagName === 'SELECT');
          if (!ok) { await el.evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, o.v); how = 'script(hidden)'; }
          else if (native) { await el.selectOption({ index: i }, { timeout: 5000 }); how = 'ui'; }
          else {
            const chip = el.locator('[role=radio]'); 
            if (await chip.count()) { await chip.nth(i).click({ timeout: 5000 }); how = 'ui-chip'; }
            else { await el.locator('button').first().click({ timeout: 5000 }); await pg.waitForSelector('.xcs-ov', { timeout: 5000 });
              const q = pg.locator('.xcs-ov .xcs-q'); if (await q.count()) { await q.fill(pet ? '#' + o.v : o.t.slice(0, 20)); }
              let row = pg.locator('.xcs-ov .xcs-o').filter({ hasText: o.t.slice(0, 60) });
              for (let m = 0; m < 30 && !(await row.count()); m++) { const more = pg.locator('.xcs-ov .xcs-more'); if (!(await more.count())) break; await more.click(); row = pg.locator('.xcs-ov .xcs-o').filter({ hasText: o.t.slice(0, 60) }); }
              const exact = await row.evaluateAll((rs, t) => rs.findIndex(r => r.innerText.trim() === t), o.t);
              await row.nth(Math.max(0, exact)).click({ timeout: 5000 }); how = 'ui-sheet'; }
          }
          await pg.waitForTimeout(350);
          const after = await pg.evaluate(([ix]) => { const e = __W.pickers()[ix]; return { val: e ? e.value : null, ev: window.__ev, fp: __W.fp(e) }; }, [pk.i]);
          rec.steps.push({ v: o.v, how, val: after.val, ev: after.ev, fp: after.fp, dlg: dlg.splice(0) });
        } catch (e) { rec.steps.push({ v: o.v, how: how + ' ERR ' + String(e.message).split('\n')[0].slice(0, 120) }); await pg.keyboard.press('Escape').catch(() => { }); }
        if (!pg.url().includes('/' + P + '.html')) { rec.steps[rec.steps.length - 1].nav = pg.url().replace(ORIGIN, ''); await load(); }
      }
      R.pickers.push(rec); if (process.env.VERB) console.error('  picker', rec.k, rec.n, rec.steps.map(x => x.how).join(','), ((Date.now() - T0) / 1000).toFixed(0) + 's');
    }
    // ---------- buttons / actions ----------
    await load();
    let blist = await pg.evaluate(() => { const seen = {}, out = []; [...document.querySelectorAll('button,[role=button],summary,[role=tab],[data-act],[data-action]')].filter(e => !__W.skip(e) && !e.closest('select,xc-select') && __W.vis(e) && !e.disabled).forEach(e => { const k = __W.key(e).replace(/\d{3,}/g, 'N'); seen[k] = (seen[k] || 0) + 1; if (seen[k] <= 1) out.push(k); }); return out; });
    R.buttonsTotal = blist.length; blist = blist.slice(0, MAXBTN);
    for (const k of blist) {
      const r = { k };
      await clearOv();
      try {
        const found = await pg.evaluate(k => { const e = [...document.querySelectorAll('button,[role=button],summary,[role=tab],[data-act],[data-action]')].find(e => !__W.skip(e) && !e.closest('select,xc-select') && __W.key(e).replace(/\d{3,}/g, 'N') === k && __W.vis(e) && !e.disabled); if (!e) return false; e.setAttribute('data-wk', '1'); e.scrollIntoView({ block: 'center', behavior: 'instant' }); return true; }, k);
        if (!found) { r.out = 'not-present'; R.buttons.push(r); continue; }
        const before = await pg.evaluate(() => ({ modals: [...document.querySelectorAll('.modal.on,[role=dialog],.on.ov,.xcs-ov,.cs-ov.on')].filter(__W.vis).length, toast: (document.querySelector('#toast,.toast') || {}).innerText || '' }));
        await pg.locator('[data-wk="1"]').first().click({ timeout: 4000, force: true });
        await pg.waitForTimeout(450);
        const after = await pg.evaluate(() => window.__W ? ({ modals: [...document.querySelectorAll('.modal.on,[role=dialog],.on.ov,.xcs-ov,.cs-ov.on')].filter(__W.vis).length, toast: ((document.querySelector('#toast,.toast') || {}).innerText || '').slice(0, 120), url: location.pathname + location.hash }) : { url: location.pathname + location.hash, lost: 1 });
        r.out = { modalDelta: after.modals - before.modals, toast: after.toast !== before.toast ? after.toast : '', url: after.url, dlg: dlg.splice(0) };
        await pg.evaluate(() => { const e = document.querySelector('[data-wk]'); if (e) e.removeAttribute('data-wk'); }).catch(() => { });
        await pg.keyboard.press('Escape').catch(() => { }); await pg.waitForTimeout(100);
      } catch (e) { r.out = 'ERR ' + String(e.message).split('\n')[0].slice(0, 100); }
      R.buttons.push(r);
      if (!pg.url().includes('/' + P + '.html') || !(await pg.evaluate(() => !!window.__W).catch(() => false))) { r.nav = pg.url().replace(ORIGIN, ''); await load(); }
    }
    console.log(TAG, W, P, 'controls', Object.keys(R.controls).length, 'pickers', R.pickers.length, 'buttons', R.buttons.length + '/' + R.buttonsTotal, 'errors', errs.length);
    await ctx.close();
    const fo = path.join(OUT, TAG + '-' + W + '.json'); const prev = fs.existsSync(fo) ? JSON.parse(fs.readFileSync(fo)) : {}; prev[P] = res[P]; fs.writeFileSync(fo, JSON.stringify(prev, null, 1));
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
