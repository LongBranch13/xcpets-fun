/* Play-test robot (Nov 25 2026, Jake: "I've tried and tried to find all the bugs but there are just too many, it's overwhelming").
 * Plays the game like a player, on a phone-sized and a desktop-sized screen, against the local rig (tools/playtest/rig.js: the real
 * world from api/boot.json + a pretend chain), with a pretend XCP Wallet that records burns and never signs anything:
 * opens the game, checks every price against a full replay of the rules (tools/playtest/oracle.js), hatches one egg and a pack,
 * lets the block land and waits for the eggs to show up like a player would, selects all + discards + cancels at scale, feeds,
 * opens the Grinder, a pet page, gifts, and walks the other places (Fight, Breed, Raid, Cemetery, Spam City, Pantheon, Rankings...).
 * Fails on: freezes (a main-thread task over --freeze ms, default 1000), script errors, a price that differs from the rules,
 * a pop-up that never opens, a button that does nothing, a burn result that never shows, and layout problems inside open sheets
 * (tools/layout-check/audit.js when present).
 *
 *   node tools/playtest/rig.js &          (prints "ready")
 *   node tools/playtest/run.js [--sizes phone,desktop] [--flows hatch,select] [--wallet addr|biggest] [--out previews/playtest] [--shots]
 *
 * Known, accepted findings: tools/playtest/allow.txt (any part of "flow | size | kind | detail"). Exit 1 on anything else. */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const ROOT = path.resolve(__dirname, '../..');
const BASE = opt('--base', 'http://127.0.0.1:8080').replace(/\/+$/, ''), SYNC = opt('--sync', 'http://127.0.0.1:8125').replace(/\/+$/, '');
const OUT = path.resolve(ROOT, opt('--out', 'previews/playtest')), SHOTS = A.includes('--shots');
const FREEZE = +opt('--freeze', 1000);
/* the first paint of a page builds the whole wallet (2,000+ pets) once; it may hold the page up to 2 s. Every press after that: 1 s. */
const FREEZE_LOAD = +opt('--freeze-load', 2000);
/* The wallet the robot plays (--wallet): a real wallet with about 2,000 living pets and 12,000 graves, the size of a keen player.
 * Evan's wallet grew to 40,000+ living pets on Nov 25 2026 (Shock Boxes) and every step's timing became a coin toss; it runs as the
 * separate 'big wallet' job (--wallet evan), which reports but does not block a merge. */
const WALLETS = { keen: 'bc1pd8pantl2vmvdf5uvtvvn0r3xnnuxvp0wln8xmlxqmykxfnte3mwqmes2ut', evan: 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd' };
const EVAN = WALLETS.keen;
const sizes = opt('--sizes', 'phone,desktop').split(',').filter(s => L.SIZES[s]);
const only = opt('--flows', '') ? opt('--flows').split(',') : null;
const report = [];
let FLOW = '', SIZE = '';
function problem(kind, detail) { report.push({ flow: FLOW, size: SIZE, kind, detail: String(detail).slice(0, 3000) }); console.log('   ✗ ' + kind + ': ' + String(detail).slice(0, 200)); }
function ok(msg) { console.log('   ✓ ' + msg); }
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-6 * Math.max(1, Math.abs(b));
const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 });
function getJson(u) { return new Promise((res) => require('http').get(u, r => { let s = ''; r.on('data', d => { s += d; }); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { res(null); } }); }).on('error', () => res(null))); }
async function truth(me) { const t = await getJson(SYNC + '/_t/truth?me=' + encodeURIComponent(me)); if (!t || t.error) throw new Error('referee failed: ' + (t && t.error)); return t; }

/* What froze? With --why-freeze (or PT_PROF=1) every page load is sampled (Chrome's profiler, 1 ms) and a freeze report names
 * the busiest functions during the long stretches of work, e.g. "draw v2-petdex.js:116 1200ms". */
const WHY = A.includes('--why-freeze') || !!process.env.PT_PROF;
function busiest(profile, budget) {
  const byId = {}, par = {}; profile.nodes.forEach(n => { byId[n.id] = n; (n.children || []).forEach(c => { par[c] = n.id; }); });
  const idle = id => byId[id].callFrame.functionName === '(idle)';
  const runs = []; let cur = null;
  profile.samples.forEach((id, i) => { const dt = (profile.timeDeltas[i] || 0) / 1000; if (idle(id)) { if (cur && cur.ms >= budget * 0.6) runs.push(cur); cur = null; return; } (cur = cur || { ms: 0, ids: [] }).ms += dt; cur.ids.push([id, dt]); });
  if (cur && cur.ms >= budget * 0.6) runs.push(cur);
  const incl = {};
  runs.forEach(r => r.ids.forEach(([id, dt]) => { const seen = new Set(); for (let x = byId[id]; x; x = byId[par[x.id]]) { const cf = x.callFrame; if (!cf.url && !/^\((program|garbage collector)\)$/.test(cf.functionName)) continue; const k = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop().split('?')[0] + ':' + (cf.lineNumber + 1); if (!seen.has(k)) { seen.add(k); incl[k] = (incl[k] || 0) + dt; } } }));
  return Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + Math.round(v) + 'ms').join(', ');
}

/* ------------------------------------------------------------------ a player's hands */
function hands(pg) {
  let cdp = null;
  const H = {
    pg,
    async open(page) {
      const t0 = Date.now();
      if (WHY) { try { if (!cdp) { cdp = await pg.context().newCDPSession(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); } await cdp.send('Profiler.stop').catch(() => {}); await cdp.send('Profiler.start'); } catch (e) { cdp = null; } }
      pg.__robotNav = Date.now(); /* the robot's own page change: a script it cuts off mid-load is not the page's fault (see 'pageerror' below) */
      await pg.goto(BASE + '/' + page, { waitUntil: 'domcontentloaded', timeout: 90000 });
      /* petdex.html paints once the wallet's pets are in (js/v2-petdex.js waits for them): on a 40,000-pet wallet a busy runner took longer than
       * the 2 s + pop-up wait and the robot read the empty frame (Nov 27 2026, '542 characters') */
      const game = /^(play|fight|breed|rare-room|raid|cemetery|shop|pet|petdex)\.html/.test(page);
      if (game && !(await L.worldReady(pg, 180000))) { problem('no-world', page + ': the pets never loaded (3 min)'); return false; }
      await pg.waitForTimeout(game ? 3500 : 2000);
      const s = (Date.now() - t0) / 1000; if (s > 30) problem('slow-load', page + ' took ' + s.toFixed(0) + ' s to show pets'); else ok(page + ' loaded in ' + s.toFixed(1) + ' s');
      return true;
    },
    /* close what a player would close first: the welcome / arrival / farewell scenes, life scenes ("tap to skip"), the "while you
     * were away" box reveal (Later keeps the eggs in the pill) and Coach Peepo's tips. Pop-ups open one after another on a
     * returning wallet, so it keeps going until nothing new shows for a moment. Never touches the Sign & burn sheet. */
    async dismiss(ms) {
      const until = Date.now() + (ms || 0);
      for (let i = 0; i < 24; i++) {
        const hit = await pg.evaluate(() => {
          const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 2 && r.height > 2 && c.display !== 'none' && c.visibility !== 'hidden'; };
          const la = document.querySelector('.la-ov'); if (la) { la.click(); return 'life scene'; }
          const WORDS = /^\s*(Skip|Got it|Close|✕|×|OK|Later|Not now|Continue)\s*$/i;
          const boxes = [...document.querySelectorAll('.reveal.on, .tut-tip, [role=dialog]')].filter(e => e.id !== 'confirmBox' && !e.closest('#confirmBox') && vis(e));
          for (const box of boxes) { const btn = [...box.querySelectorAll('button')].find(x => WORDS.test(x.textContent || '') && vis(x) && !x.disabled); if (btn) { btn.click(); return (box.id || box.className) + ': ' + btn.textContent.trim(); } }
          return '';
        }).catch(() => '');
        if (!hit) { if (Date.now() >= until) break; await pg.waitForTimeout(1000); continue; }
        await pg.waitForTimeout(600);
      }
    },
    /* is a scene, box reveal or dialog (never the Sign & burn sheet) on screen right now? */
    async scene() { return pg.evaluate(() => [...document.querySelectorAll('.reveal.on, .la-ov, .tut-tip, [role=dialog]')].some(e => e.id !== 'confirmBox' && !e.closest('#confirmBox') && e.getBoundingClientRect().width > 2 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden')).catch(() => false); },
    /* press a visible button by its words (regex) or css, like a finger would. Returns false (and reports) when there is none. */
    async press(what, why, opts) {
      opts = opts || {};
      const loc = typeof what === 'string' && /^[#.\[]/.test(what) ? pg.locator(what) : pg.locator('button, a, [role=button], summary, label').filter({ hasText: what });
      const el = loc.filter({ visible: true }).first();
      if (!(await el.count())) { if (!opts.quiet) problem('missing-button', (why || String(what)) + ': no visible button'); return false; }
      await el.evaluate(n => n.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {}); /* a thumb brings a button to the middle of the screen */
      const t = await now(pg); H.from = pg.url();
      /* heartbeat: the page writes the time every 200 ms, so if the press opens another page the robot can still tell whether the old one
       * froze before it left (sessionStorage outlives the page change in the same tab) */
      await pg.evaluate(() => { clearInterval(window.__ptBeat); try { sessionStorage.setItem('pt-beatmax', '0'); } catch (e) {} let last = 0; const b = () => { const t = Date.now(); try { if (last && t - last > +sessionStorage.getItem('pt-beatmax')) sessionStorage.setItem('pt-beatmax', String(t - last)); sessionStorage.setItem('pt-beat', String(t)); } catch (e) {} last = t; }; b(); window.__ptBeat = setInterval(b, 200); }).catch(() => {});
      /* something popped up in front (a fight replay, Coach Peepo)? a player closes it first, then presses again */
      let pressed = false;
      /* did the tap land? The browser robot's click also waits for the page it opens, so a slow page change (or a page busy after the
       * tap) makes click() time out although the tap went through. A capture listener notes each tap in sessionStorage: a tap that
       * landed, a page that changed, or a page too busy to answer right after the tap counts as pressed (freezes() then judges the wait). */
      const t0tap = Date.now();
      /* Nov 26 2026: only a real tap (isTrusted: the robot's own finger, never a page's or dismiss()'s el.click()) on THIS button counts.
       * Any click used to count, so a Close pressed by dismiss() could pass for the button's tap and hide a button that really was blocked. */
      await el.evaluate(n => { document.querySelectorAll('[data-pt-press]').forEach(x => x.removeAttribute('data-pt-press')); n.setAttribute('data-pt-press', '1'); }).catch(() => {});
      await pg.evaluate(() => { if (window.__ptTap) return; window.__ptTap = 1; document.addEventListener('click', (e) => { try { if (e.isTrusted && e.target && e.target.closest && e.target.closest('[data-pt-press]')) sessionStorage.setItem('pt-tap', String(Date.now())); } catch (x) {} }, true); }).catch(() => {});
      const landed = async () => { if (pg.url() !== H.from) return true; const v = await Promise.race([pg.evaluate(() => +sessionStorage.getItem('pt-tap') || 0).catch(() => 0), new Promise(r => setTimeout(() => r(-1), 1500))]); return v === -1 || v >= t0tap; };
      /* a tap that is reported 'covered' can still have landed earlier: on a 40,000-pet page an earlier tap is handled seconds late and opens
       * its own sheet over the button (Gift several pets: 'covered by #gfBox', the very picker it opened). Only a recorded real tap on this
       * button counts then; a busy page alone does not. */
      const tapped = async () => { const v = await Promise.race([pg.evaluate(() => +sessionStorage.getItem('pt-tap') || 0).catch(() => 0), new Promise(r => setTimeout(() => r(0), 1500))]); return v >= t0tap; };
      const tap = async (o) => { try { await el.click(o); return true; } catch (e) { if (/intercepts pointer events/.test(e.message) ? await tapped() : await landed()) return true; throw e; } };
      const onTop = () => el.evaluate(n => { const r = n.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === n || n.contains(t)); }).catch(() => false);
      try { await tap({ timeout: 2500 }); pressed = true; } catch (e0) { await H.dismiss(2500); await pg.waitForTimeout(400); }
      /* a button that wobbles (the hatch buttons wiggle) never counts as 'stable' to the browser robot, but a finger taps it fine:
       * if nothing covers its middle, tap it there */
      if (!pressed && await onTop()) { try { await tap({ force: true, timeout: 2500 }); pressed = true; } catch (e1) {} }
      /* scenes can come one after another (a life scene after an arrival): close again and look once more */
      if (!pressed) { await H.dismiss(3000); if (await onTop()) { try { await tap({ force: true, timeout: 2500 }); pressed = true; } catch (e2) {} } }
      /* a big wallet can put scenes up one after another (fight replays, a hatch box, an arrival) while the list redraws under them:
       * close them again and tap once more, up to 3 times, before calling the button blocked (a player would keep closing them too) */
      for (let k = 0; k < 3 && !pressed; k++) { if (!(await H.scene())) break; await H.dismiss(4000); await el.evaluate(n => n.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {});
        if (await onTop()) { try { await tap({ force: true, timeout: 2500 }); pressed = true; } catch (e3) {} } }
      /* a scene can also arrive late (the hatch scene plays when a 40,000-pet page notices new eggs, ~30 s in): one more close and tap */
      if (!pressed) { try { await tap({ timeout: 5000 }); pressed = true; } catch (e4) { if (await H.scene()) { await H.dismiss(4000); await el.evaluate(n => n.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {}); } } }
      try { if (!pressed) await tap({ timeout: 5000 }); } catch (e) { const by = (e.message.match(/<[^>]+>(?: from <[^>]+> subtree)? intercepts pointer events/g) || []).pop(); await H.shot('blocked');
        const top = await el.evaluate(n => { const r = n.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!t) return ''; const c = t.closest('[id]'); return (t.tagName + '.' + String(t.className).slice(0, 40) + (c ? ' in #' + c.id : '') + ' "' + (t.innerText || '').replace(/\s+/g, ' ').slice(0, 50) + '"'); }).catch(() => '');
        problem('button-blocked', (why || String(what)) + ': ' + (by ? 'covered by ' + (top || by) : e.message.split('\n')[0])); return false; }
      await pg.waitForTimeout(opts.wait || 900);
      await H.freezes(t, why || String(what));
      return true;
    },
    async freezes(since, what, budget) {
      let ms = await L.responsive(pg, 10000);
      /* the press opened another page (Open ▸ -> pet.html): the old page stops answering while the browser swaps pages, which on a slow
       * machine with a 40,000-pet wallet can take longer than 10 s. That is a page change, not a freeze: wait for the new page (30 s) and
       * ask it instead. A page that never leaves, or a new page that does not answer within 10 s, is still a freeze. */
      if (ms < 0 && H.from) { const t1 = Date.now(); while (Date.now() - t1 < 30000 && pg.url() === H.from) await pg.waitForTimeout(500);
        if (pg.url() !== H.from) { await pg.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {}); ms = await L.responsive(pg, 10000); if (ms >= 0) ok(what + ': opened ' + pg.url().replace(/^.*\//, '') + ' (the page change took over 10 s)'); } }
      /* the heartbeat's longest gap (and, if the press opened another page, the old page's last beat vs the moment the new page started):
       * over 10 s means the page froze, even if it then answered or left */
      const beat = () => pg.evaluate(() => ({ last: +sessionStorage.getItem('pt-beat') || 0, max: +sessionStorage.getItem('pt-beatmax') || 0, t0: performance.timeOrigin, now: Date.now() })).catch(() => null);
      if (H.from) { let hb = await beat(); if (!hb) { await pg.waitForTimeout(1000); await pg.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {}); hb = await beat(); } /* the page was swapped under the question: ask the new one */
        const moved = pg.url() !== H.from;
        const gap = hb && hb.last ? Math.round(Math.max(hb.max, (moved ? hb.t0 : hb.now) - hb.last)) : 0;
        if (gap > 10000) { problem('freeze', what + ': the page froze for ' + (gap / 1000).toFixed(1) + ' s' + (moved ? ' before the next page opened' : '')); return; } }
      if (ms < 0) { problem('freeze', what + ': the page stopped answering for 10 s'); return; }
      const long = (await L.longSince(pg, since)).filter(x => x.ms > (budget || FREEZE));
      if (long.length) problem('freeze', what + ': page froze for ' + Math.max(...long.map(x => x.ms)) + ' ms');
      if (long.length && cdp) { try { const { profile } = await cdp.send('Profiler.stop'); console.log('     busiest while frozen: ' + busiest(profile, budget || FREEZE)); await cdp.send('Profiler.start'); } catch (e) {} }
    },
    /* a player's page finishes its background check (the newest blocks + this wallet's pets) within a few seconds of opening */
    async settled() { const t0 = Date.now(); for (let i = 0; i < 30; i++) { if (await pg.evaluate(() => { const S = V2Mock.state(); return !!(S.verified || S.viewChecked || !S.view); }).catch(() => true)) break; await pg.waitForTimeout(2000); }
      const s = (Date.now() - t0) / 1000; if (s > 45) problem('slow-check', 'the page took ' + s.toFixed(0) + ' s to finish checking the newest blocks'); },
    /* calm(): wait like a player for a big wallet to finish arriving before touching it (Nov 26 2026). On Evan's 40,000-pet wallet My Pets
     * keeps growing for a while after the first paint (owner pages arrive in batches: 40,190 -> 40,366), and a press in that stretch
     * measured the loading, not the button (Select 'froze' 1.3 s, Cancel 'lost' pets that had only just arrived). Waits until the list
     * size holds still for 3 looks in a row and the page ran no long task for 1.5 s (up to 90 s), then closes any scene that came up
     * meanwhile. A list that never stops changing is reported, so a real loading loop is still caught. */
    async calm(what) { const t0 = Date.now(); let last = -1, same = 0, n = -1;
      while (Date.now() - t0 < 90000) { await pg.waitForTimeout(1500);
        const s = await pg.evaluate(() => { let n = -1; try { n = V2UI.mine(V2Mock.world()).length; } catch (e) {} const L = (window.__pt && window.__pt.long) || [], end = L.length ? Math.max(...L.map(x => x.at + x.ms)) : 0; return { n, quiet: performance.now() - end > 1500 }; }).catch(() => null);
        if (!s) { same = 0; continue; } n = s.n; same = (s.n === last && s.quiet) ? same + 1 : 0; last = s.n; if (same >= 2) break; }
      const secs = (Date.now() - t0) / 1000; if (same < 2) problem('never-settles', (what || 'My Pets') + ': the pet list kept changing or the page kept working for 90 s (' + n + ' pets)'); else if (secs > 6) ok((what || 'My Pets') + ': list settled at ' + n + ' pets after ' + secs.toFixed(0) + ' s');
      if (await H.scene()) await H.dismiss(3000); return n; },
    async sheet() { return pg.evaluate(() => { const c = document.getElementById('confirmBox'); return c && c.classList.contains('on') ? { title: (document.getElementById('cfTitle') || {}).textContent || '', amt: (document.getElementById('cfAmt') || {}).textContent || '', body: (document.getElementById('cfBody') || {}).innerText || '' } : null; }); },
    async openSheets() { return pg.evaluate(() => [...document.querySelectorAll('.reveal.on, [aria-modal=true], [role=dialog]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none'; }).map(e => e.id || String(e.className).split(' ')[0])); },
    /* a small floating pill (wallet, new pets) over the page is fine while the page scrolls under it, like a pinned bar (the audit's sticky rule) */
    async layout(where) { const a = await L.audit(pg); const scrolls = await pg.evaluate(() => document.scrollingElement.scrollHeight > innerHeight + 80).catch(() => false);
      a.filter(x => !(scrolls && x.kind === 'control-covered' && /#(xwPill|hatchTray)\b/.test(x.detail || '')) && /off-screen|out-of-view|too-tall|covered|wider/.test(x.kind)).slice(0, 4).forEach(x => problem('layout', where + ': ' + x.kind + ' ' + x.where + ' ' + x.detail)); },
    async cancel() { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(300); const s = await H.sheet(); if (s) await pg.click('#cfNo', { timeout: 2000 }).catch(() => {}); await pg.waitForTimeout(300);
      await pg.evaluate(() => { document.querySelectorAll('.reveal.on').forEach(e => e.classList.remove('on')); }).catch(() => {}); },
    async shot(name) { if (SHOTS || name === 'blocked') await pg.screenshot({ path: path.join(OUT, FLOW + '-' + SIZE + '-' + name + '.png') }).catch(() => {}); },
    async burns() { return L.burns(pg); },
    async sign(why) { const t = await now(pg); await L.clearBurns(pg); if (!(await H.press('#cfYes', why + ': Sign & burn', { wait: 1500 }))) return []; let b = [];
      for (let i = 0; i < 20; i++) { b = await H.burns(); const done = await pg.evaluate(() => /sent from|✓/.test((document.getElementById('pgt') || {}).textContent || '')); if (done) break; await pg.waitForTimeout(500); }
      await H.freezes(t, why + ' signing'); return b; },
  };
  return H;
}
async function now(pg) { return L.now(pg); }

/* ------------------------------------------------------------------ the flows */
/* in the page: did the hatch reveal of the new eggs start? the egg-crack scene, the box reveal, or a new count on the pill */
const NEW_REVEAL = `window.newReveal = function (tb) {
  if (document.querySelector('.la-ov[data-anim^="hatch"]')) return 'egg-crack scene';
  var pk = document.getElementById('packBox'); if (pk && pk.classList.contains('on')) return 'box reveal';
  var t = document.querySelector('#hatchTray .htn'); if (t && t.textContent !== tb) return 'pill: ' + t.textContent;
  return null; };`;
const FLOWS = {};

/* the game opens, the numbers match a full replay, the Fire Sale / prices are right */
FLOWS.open = async (H, T) => {
  if (!(await H.open('play.html'))) return;
  const away = await H.pg.evaluate(() => !!document.querySelector('#ipAway, .ip-away, #returnBox.on, .returnov'));
  ok('away card or bell: ' + away);
  await H.dismiss(8000); await H.settled(); await H.calm('before counting'); await H.shot('open');
  const s = await H.pg.evaluate(() => { const w = V2Mock.world(); const t = (id) => ((document.getElementById(id) || {}).textContent || '');
    return { mine: V2UI.mine(w).length, alive: V2UI.mine(w).filter(p => !p.dead).length, sale: !!document.querySelector('.fs-banner, #fsBanner, .firesale, [data-firesale]') || /FIRE SALE/i.test(document.body.innerText.slice(0, 20000)),
      hatch: t('hatchBtn'), dozen: t('dozenBtn'), kase: t('caseBtn'), zap: t('zapBtn'), feed: t('cfeedBtn'), tip: V2Mock.state().tip, wtip: w.tip }; });
  const listed = T.me.alive - (T.me.hdAlive || 0);
  if (T.me.listed != null && s.alive !== T.me.listed) problem('wrong-count', 'My Pets shows ' + s.alive + ' living pets, the full replay has ' + T.me.listed);
  else ok('My Pets count ' + s.alive);
  if (!!T.sale !== !!s.sale) problem('fire-sale', 'Fire Sale is ' + (T.sale ? 'ON' : 'off') + ' in the rules but the page ' + (s.sale ? 'shows' : 'does not show') + ' it');
  else ok('Fire Sale banner ' + (s.sale ? 'shown' : 'not shown') + ' (rules agree)');
  const num = (txt) => { const m = String(txt).match(/\(([\d,.]+)\)?\s*$/) || String(txt).match(/([\d,]+(?:\.\d+)?)\s*\)?\s*$/); return m ? Number(m[1].replace(/,/g, '')) : NaN; };
  [['hatch', s.hatch, T.costs.hatch], ['dozen', s.dozen, T.costs.hatch12], ['case', s.kase, T.costs.hatch144], ['zap', s.zap, T.costs.hatchzap]].forEach(([k, txt, want]) => {
    if (!txt) return problem('missing-button', k + ' button not on the page');
    const got = num(txt), dp = ((String(txt).match(/\.(\d+)\D*$/) || [])[1] || '').length; /* a short label may round (2.67 for 2.67375) */
    if (!near(got, want) && !(dp && dp < 8 && near(got, Math.round(want * Math.pow(10, dp)) / Math.pow(10, dp)))) problem('wrong-price', k + ' button says ' + txt.trim() + ', the rules charge ' + fmt(want) + ' at the next block'); else ok(k + ' price ' + fmt(got));
  });
  void listed;
};

/* hatch one egg and a pack: the sheet opens, the burn is the rules' price, then the block lands and the eggs show up without a reload */
FLOWS.hatch = async (H, T, ctx) => {
  if (!(await H.open('play.html'))) return;
  await H.dismiss(8000);
  const got = [];
  for (const [btn, tag, want] of [['#hatchBtn', 'pet:hatch', T.costs.hatch], ['#dozenBtn', 'pet:hatch12', T.costs.hatch12]]) {
    if (!(await H.press(btn, 'hatch ' + tag))) continue;
    const sh = await H.sheet(); if (!sh) { problem('no-sheet', btn + ' did not open the Sign & burn sheet'); continue; }
    await H.layout('hatch sheet');
    const b = await H.sign('hatch ' + tag);
    const x = b.find(q => q.tag === tag);
    if (!x) { problem('no-burn', 'pressing Sign for ' + tag + ' sent nothing to the wallet (' + JSON.stringify(b).slice(0, 120) + ')'); continue; }
    if (!near(x.amount, want)) problem('wrong-price', tag + ' burned ' + fmt(x.amount) + ', the rules charge ' + fmt(want)); else ok(tag + ' asked the wallet for ' + fmt(x.amount) + ' (rules agree)');
    got.push(x);
    await H.pg.waitForTimeout(2500); await H.cancel();
  }
  if (!got.length || ctx.size !== ctx.first) return; /* the pretend chain moves once per run */
  /* a player sits on the page: let it finish its own background work first (the burn check), so the block below is news to it */
  for (let i = 0; i < 24; i++) { if (await H.pg.evaluate(() => !!(V2Mock.state().verified || V2Mock.state().viewChecked))) break; await H.pg.waitForTimeout(5000); }
  /* the egg reveal of THIS block must be new: close what is already up (the away reveal goes to the pill) and note the pill */
  await H.dismiss(8000);
  await H.pg.evaluate(NEW_REVEAL);
  const trayBefore = await H.pg.evaluate(() => ((document.querySelector('#hatchTray .htn') || {}).textContent || ''));
  /* the block lands with both burns in it (same block, like a player double-pressing) */
  const blk = await L.post(SYNC, '/_t/block', { burns: got.map(x => ({ source: ctx.me, tag: x.tag, qty: x.amount })) });
  ctx.mined.push(blk.tip); ok('mined block ' + blk.tip + ' with ' + got.length + ' hatch burns (' + 13 * got.length / 2 + ' eggs expected)');
  const want = got.reduce((a, x) => a + (x.tag === 'pet:hatch12' ? 12 : 1), 0);
  const t0 = Date.now(); let seen = 0, pop = null;
  for (let i = 0; i < 36; i++) { /* a player waits ~3 minutes on the page */
    await H.pg.waitForTimeout(5000);
    /* count the eggs of THIS block (hatchBlock = the mined block), not 'my pets now minus before': a 40,000-pet wallet's list can still be
     * growing when 'before' is read (Nov 27 2026, CI: +163 at 5 s while the eggs came at 31-37 s), which ended the wait early */
    const s = await H.pg.evaluate(([tb, b]) => ({ n: V2UI.mine(V2Mock.world()).filter(p => !p.dead && p.hatchBlock === b).length, pop: newReveal(tb) }), [trayBefore, blk.tip]).catch(() => ({ n: 0, pop: null }));
    seen = s.n; if (s.pop) pop = s.pop;
    if (process.env.PLAYTEST_TRACE) console.log('     t+' + Math.round((Date.now() - t0) / 1000) + ' s: ' + s.n + ' eggs, ' + JSON.stringify(await H.pg.evaluate(() => window.V2Held && V2Held.why ? V2Held.why() : null).catch(() => null)));
    if (seen >= want) break;
  }
  /* the eggs crack open first (a few seconds of animation), then the box reveal opens */
  for (let i = 0; i < 12 && seen >= want && !pop; i++) { await H.pg.waitForTimeout(2500); pop = await H.pg.evaluate(newRevealSrc => newReveal(newRevealSrc), trayBefore).catch(() => null);
    if (process.env.PLAYTEST_TRACE) console.log('     t+' + Math.round((Date.now() - t0) / 1000) + ' s: ' + JSON.stringify(await H.pg.evaluate(() => window.V2Held && V2Held.why ? V2Held.why() : null).catch(() => null))); }
  const secs = Math.round((Date.now() - t0) / 1000);
  if (seen < want) problem('result-never-shows', 'hatched ' + want + ' eggs; after the block landed the page still showed ' + Math.max(0, seen) + ' of them after ' + secs + ' s on the page (no reload)');
  else ok(want + ' new eggs showed up ' + secs + ' s after the block' + (pop ? ' (' + pop + ')' : ''));
  if (!pop) { const why = await H.pg.evaluate(() => ({ open: [...document.querySelectorAll('.reveal.on, .la-ov, .tut-tip')].map(e => e.id || e.className), tray: (document.querySelector('#hatchTray') || {}).innerText || '', held: window.V2Held ? V2Held.list() : null, why: window.V2Held && V2Held.why ? V2Held.why() : null })).catch(() => ({}));
    problem('no-reveal', 'no hatch reveal pop-up or pill appeared for the new eggs (' + JSON.stringify(why).slice(0, 900) + ')');
    /* late or never? keep watching a minute more and say which */
    let late = null; for (let i = 0; i < 12 && !late; i++) { await H.pg.waitForTimeout(5000); late = await H.pg.evaluate(src => newReveal(src), trayBefore).catch(() => null); if (late) ok('the reveal came late: ' + late + ' ' + (secs + 5 * (i + 1)) + ' s after the block'); }
    if (!late) { const w2 = await H.pg.evaluate(() => window.V2Held && V2Held.why ? V2Held.why() : null).catch(() => null); ok('still no reveal a minute later: ' + JSON.stringify(w2).slice(0, 900)); } }
  await H.shot('landed');
  /* and after a reload */
  await H.pg.reload({ waitUntil: 'domcontentloaded' }); await L.worldReady(H.pg, 180000);
  let n2 = 0; const t1 = Date.now();
  for (let i = 0; i < 24; i++) { await H.pg.waitForTimeout(5000); n2 = await H.pg.evaluate((b) => V2UI.mine(V2Mock.world()).filter(p => !p.dead && p.hatchBlock === b).length, blk.tip); if (n2 >= want) break; }
  ok('after reload: ' + Math.round((Date.now() - t1) / 1000) + ' s to settle');
  if (n2 < want) problem('result-never-shows', 'even after a reload the page shows ' + n2 + ' of the ' + want + ' new eggs'); else ok('after a reload: all ' + want + ' new eggs listed');
};

/* Select all -> Discard selected -> Cancel: no freeze at thousands of pets, nothing lost */
FLOWS.select = async (H) => {
  if (!(await H.open('play.html'))) return;
  await H.dismiss(8000); await H.settled();
  const n0 = await H.calm('before Select');
  if (!(await H.press('#mpcSelBtn', 'Select button', { quiet: true })) && !(await H.press(/☑️ Select|^Select$/, 'Select button'))) return;
  if (!(await H.press('#selAll', 'Select all'))) return;
  const sel = await H.pg.evaluate(() => V2UI.S().sel.length);
  if (!sel) problem('select-all', 'Select all selected nothing'); else ok('Select all picked ' + sel + ' of ' + n0 + ' pets');
  await H.shot('selected');
  const t0 = Date.now();
  if (await H.press(/Discard selected/, 'Discard selected', { wait: 2500 })) {
    const sheets = await H.openSheets(); const sh = await H.sheet(), dlg = H.pg.__lastDialog && H.pg.__lastDialog.at >= t0 ? H.pg.__lastDialog : null;
    /* starred pets are never discarded (owner): when every picked pet is starred the game says so in a toast instead of asking */
    const note = await H.pg.evaluate(() => [...document.querySelectorAll('#toasts > *')].map(e => e.innerText).filter(t => /Skipped|never discarded|Discarded|Undo/i.test(t)).pop() || '').catch(() => '');
    if (dlg) ok('discard asks first (browser box)');
    else if (!sheets.length && !sh && note) ok('discard answered: ' + note.replace(/\s+/g, ' ').slice(0, 100));
    else if (!sheets.length && !sh) problem('no-sheet', 'Discard selected opened nothing');
    else { ok('discard asks first: ' + (sh ? sh.title.slice(0, 80) : sheets.join(','))); await H.layout('discard sheet'); }
    if (sh && !/forever|permanent|cannot come back|can't come back/i.test(sh.title + sh.body)) problem('discard-warning', 'the discard sheet does not say it is permanent');
    await H.shot('discard');
    await H.cancel();
  }
  await H.press(/Select none/, 'Select none', { quiet: true });
  const n1 = await H.pg.evaluate(() => V2UI.mine(V2Mock.world()).length);
  /* fewer = lost; more = pets that arrived meanwhile (a block landed, a late owner page), not a loss */
  if (n1 < n0) problem('pets-lost', 'after Cancel My Pets went from ' + n0 + ' to ' + n1); else ok('Cancel kept all ' + n0 + ' pets' + (n1 > n0 ? ' (' + (n1 - n0) + ' more arrived meanwhile)' : ''));
  const burnt = await H.burns(); if (burnt.length) problem('unexpected-burn', 'a burn was sent without pressing Sign: ' + burnt.map(b => b.tag).join(','));
};

/* feeding: the one-burn "Do it all" (Daily chores), then Feed selected; the chores burn lands and the referee counts who really ate */
FLOWS.feed = async (H, T, ctx) => {
  if (!(await H.open('play.html'))) return;
  await H.dismiss(8000); await H.settled(); await H.calm('before feeding');
  let land = null;
  for (const [what, why] of [[/Do it all in one burn|Daily chores/i, 'Do it all in one burn'], [/Feed hungry|Feed all hungry/i, 'Feed the hungry pets']]) {
    if (!(await H.press(what, why, { wait: 2500, quiet: true }))) { ok(why + ': button not offered right now'); continue; }
    let sh = await H.sheet();
    if (!sh) { const sheets = await H.openSheets(); if (sheets.length) { /* a chooser first: press its main button */ await H.press(/Feed|Burn|Go|Do it/i, why + ' (inside ' + sheets[0] + ')', { wait: 2000, quiet: true }); sh = await H.sheet(); } }
    if (!sh) { problem('no-sheet', why + ' did not reach the Sign & burn sheet'); await H.cancel(); continue; }
    await H.layout(why + ' sheet');
    const says = Number(((sh.body.match(/feeding ([\d,]+) pets/) || sh.body.match(/feed ([\d,]+) pets?/) || [])[1] || '0').replace(/,/g, ''));
    const b = await H.sign(why);
    /* Nov 25 2026: a big wallet's chores are more burns than the wallet sends unconfirmed at once (Evan: 8 burns, 6 sent, the last 2 after
     * the first confirm). The sheet's total covers all 8; the promise for THIS landing is the pets the sent burns name. */
    const named = b.length ? await H.pg.evaluate(({ tags, me }) => { try { const V = window.V2Rules, w = V2Mock.world(), nb = (w.tip || 0) + 1; let n = 0;
      for (const g of tags) { const fr = /^pet:dc:\d+:/.test(g) ? 'pet:fr:' + g.split(':').slice(3).join(':') : g, t = V.parseTag(fr); if (!t) return null;
        if (t.action === 'feedr') n += V.feedRunsIds(w, me, t, nb).length; else if (t.action === 'feed') n += 1; else if (t.action === 'feedm' || t.action === 'feedl') n += t.ids.length; else if (!/^pet:dc:\d+$/.test(g)) return null; }
      return n; } catch (e) { return null; } }, { tags: b.map(x => x.tag), me: ctx.me }) : null;
    if (b.length && says && !land) land = { b, says: named != null && named < says ? named : says, why: why + (named != null && named < says ? ' (' + b.length + ' burns sent now, naming ' + fmt(named) + ' of the ' + fmt(says) + ' pets)' : '') };
    if (!b.length) problem('no-burn', why + ': Sign sent nothing'); else {
      const bad = b.filter(x => !(x.amount > 0) || !/^pet:/.test(x.tag)); if (bad.length) problem('bad-burn', why + ': ' + JSON.stringify(bad[0]));
      ok(why + ': ' + b.length + ' burn(s), ' + fmt(b.reduce((a, x) => a + x.amount, 0)) + ' XCPETS: ' + b.slice(0, 3).map(x => x.tag).join(' '));
    }
    await H.pg.waitForTimeout(2000); await H.cancel();
  }
  /* the burn lands: every pet the sheet promised must really eat (the rules refuse discarded pets, zombies...) */
  if (land && ctx.size === ctx.first) {
    const blk = await L.post(SYNC, '/_t/block', { burns: land.b.map(x => ({ source: ctx.me, tag: x.tag, qty: x.amount })) }); ctx.mined.push(blk.tip);
    const T2 = await truth(ctx.me); ctx.T = T2;
    const paid = land.b.reduce((a, x) => a + x.amount, 0), burnt = T2.me.burned - T.me.burned;
    if (T2.me.fedAtTip < land.says) problem('paid-for-nothing', land.why + ': the sheet said it feeds ' + fmt(land.says) + ' pets for ' + fmt(paid) + ' XCPETS, but when the burn landed the rules fed only ' + fmt(T2.me.fedAtTip));
    else ok(land.why + ' landed: ' + fmt(T2.me.fedAtTip) + ' pets ate, ' + fmt(burnt) + ' XCPETS burned');
  }
};

/* the Grinder opens on screen, its filter works, GRIND reaches the sheet */
FLOWS.grinder = async (H) => {
  if (!(await H.open('play.html#grinder'))) return;
  await H.dismiss(8000);
  let on = await H.pg.evaluate(() => { const g = document.querySelector('.mgr-bg, #mgr, [class*=grind]'); if (!g) return null; const r = g.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; });
  if (!on) { await H.pg.evaluate(() => window.V2Grinder && V2Grinder.open()); await H.pg.waitForTimeout(1500); on = await H.pg.evaluate(() => { const g = document.querySelector('.mgr-bg, #mgr, [class*=grind]'); if (!g) return null; const r = g.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; }); }
  if (!on) return problem('no-sheet', 'the Grinder never opened');
  if (on.top > 900 || on.top < -50) problem('off-screen', 'the Grinder opened ' + on.top + ' px down the page');
  else ok('Grinder open on screen');
  await H.layout('Grinder'); await H.shot('grinder');
  const t = await now(H.pg);
  const go = H.pg.locator('button').filter({ hasText: /GRIND/i }).filter({ visible: true }).first();
  if (await go.count()) { await go.click({ timeout: 5000 }).catch(e => problem('button-blocked', 'GRIND: ' + e.message.split('\n')[0])); await H.pg.waitForTimeout(2500); await H.freezes(t, 'GRIND');
    const sh = await H.sheet(); if (sh) ok('GRIND → Sign sheet: ' + sh.amt); else ok('GRIND pressed (no sheet: ' + (await H.openSheets()).join(',') + ')'); }
  else ok('no GRIND button (no pets to grind)');
  await H.cancel();
};

/* a pet page opens and its buttons answer */
FLOWS.petpage = async (H) => {
  if (!(await H.open('play.html'))) return;
  await H.dismiss(8000); await H.calm('before Open');
  if (!(await H.press(/Open ▸/, 'Open a pet', { wait: 2000 }))) return;
  const sheets = await H.openSheets(); if (!sheets.length && !/pet\.html/.test(H.pg.url())) problem('no-sheet', 'Open ▸ on a pet card opened nothing'); else ok('pet page: ' + (sheets.join(',') || H.pg.url()));
  await H.layout('pet page'); await H.shot('pet');
  await H.cancel();
};

/* gifts: the picker opens */
FLOWS.gift = async (H) => {
  if (!(await H.open('play.html'))) return;
  await H.dismiss(8000); await H.calm('before Gift');
  if (!(await H.press('#gfMany', 'Gift several pets', { wait: 2000, quiet: true }))) return ok('gift button not on this screen');
  const sheets = await H.openSheets(); if (!sheets.length) problem('no-sheet', 'Gift several pets opened nothing'); else ok('gift picker: ' + sheets.join(','));
  await H.layout('gift picker'); await H.cancel();
};

/* every other place: opens, shows its main content, no errors, no freeze */
const PLACES = [
  ['index.html', /hatch|play|pets/i], ['fight.html', /fight|battle|arena/i], ['breed.html', /breed|motel/i], ['raid.html', /raid|boss|attack/i],
  ['cemetery.html', /grave|zombie|cemetery/i], ['shop.html', /shop|spam city|listing/i], ['pantheon.html', /god|pantheon|mythic/i], ['ranking.html', /rank|top|score/i],
  ['rare-room.html', /rare|gear|roll/i], ['petdex.html', /petdex|species/i], ['pet.html?id=42', /#42|pet/i], ['live.html', /live|burn|hatch/i],
];
FLOWS.places = async (H) => {
  for (const [page, want] of PLACES) {
    const t0 = Date.now();
    if (!(await H.open(page))) continue;
    await H.dismiss(8000);
    const s = await H.pg.evaluate(() => ({ text: document.body.innerText.length, words: document.body.innerText.slice(0, 40000) }));
    if (s.text < 400 || !want.test(s.words)) { problem('empty-page', page + ' shows almost nothing (' + s.text + ' characters: ' + JSON.stringify(s.words.slice(0, 300)) + ')');
      /* late or never? look again for 30 s and say which */
      let n = 0, t1 = Date.now(); for (let i = 0; i < 15; i++) { await H.pg.waitForTimeout(2000); const s2 = await H.pg.evaluate(() => ({ text: document.body.innerText.length, words: document.body.innerText.slice(0, 40000) })).catch(() => null); if (s2 && s2.text >= 400 && want.test(s2.words)) { n = s2.text; break; } }
      ok(n ? page + ' filled in late: ' + n + ' characters ' + ((Date.now() - t1) / 1000).toFixed(0) + ' s after the first look' : page + ' still empty 30 s later'); } else ok(page + ' content ok (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
    await H.freezes(0, page + ' load', FREEZE_LOAD);
  }
  /* Pantheon on fast pages used to be empty */
  if (await H.open('pantheon.html')) {
    const gods = await H.pg.evaluate(() => document.querySelectorAll('canvas').length);
    if (gods < 1) problem('empty-page', 'Pantheon shows no pets'); else ok('Pantheon draws ' + gods + ' pictures');
  }
};

/* ------------------------------------------------------------------ main */
/* tools/playtest-hands-test.js loads this file for hands() alone (a player's hands on small made-up pages, no rig) */
if (require.main !== module) module.exports = { hands, report };
else (async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let allow = []; try { allow = fs.readFileSync(path.join(__dirname, 'allow.txt'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && s[0] !== '#'); } catch (e) {}
  let me = opt('--wallet', EVAN); if (WALLETS[me]) me = WALLETS[me];
  console.log('referee: replaying the whole chain with the rules (about a minute)…');
  let T = await truth(me);
  console.log('referee: block ' + T.tip + ', ' + T.pets + ' pets, wallet ' + me.slice(0, 10) + '… has ' + T.me.alive + ' living, ' + T.me.dead + ' dead, ' + T.me.zombies + ' zombies; Fire Sale ' + (T.sale ? 'ON' : 'off'));
  const browser = await L.chromium().launch(Object.assign({ args: ['--no-sandbox', '--disable-dev-shm-usage'] }, process.env.CHROME ? { executablePath: process.env.CHROME } : {}));
  const ctx = { me, mined: [], first: sizes[0] };
  for (const size of sizes) {
    SIZE = size; ctx.size = size;
    for (const name of Object.keys(FLOWS)) {
      if (only && !only.includes(name)) continue;
      FLOW = name; console.log('\n▶ ' + name + ' (' + size + ')');
      const cx = await L.newContext(browser, size, { me, sync: SYNC, base: BASE, wallet: true });
      const pg = await cx.newPage();
      /* Nov 26 2026: 'Cannot read properties of undefined (reading 'esc') @ v2-pages.js:9' on one CI run: v2-pages.js ran without
       * js/v2-render.js. A game script whose download is cut off (ERR_ABORTED: the page is being left or reloaded) lets the scripts after
       * it run without it. The robot used to ignore cut-off downloads and report only the confusing error that followed. Now every game
       * script that did not arrive is remembered, and an error right after one names it: when the robot itself was opening the next page
       * it is noted (the page was going away), otherwise (the page reloaded itself while loading, or a download really failed) it fails. */
      const cut = []; pg.on('requestfailed', r => { const u = r.url(); if (/\.js(\?|$)/.test(u) && u.startsWith(BASE)) cut.push({ at: Date.now(), u: u.replace(BASE + '/', '').replace(/\?.*$/, ''), why: (r.failure() || {}).errorText || '' }); });
      pg.on('pageerror', e => { const f = FLOW, z = SIZE, at = Date.now(), msg = String(e.message || e).slice(0, 160) + ' @ ' + String(e.stack || '').split('\n').slice(1, 30).map(x => x.trim().replace(/\?v=[^:]+/, '').replace(BASE + '/', '')).join(' < ');
        setTimeout(() => { const gone = cut.filter(c => c.at >= at - 8000 && c.at <= at + 500), F0 = FLOW, Z0 = SIZE; FLOW = f; SIZE = z;
          const robot = pg.__robotNav && Math.abs(pg.__robotNav - at) < 4000 && gone.length && gone.every(c => /ERR_ABORTED/.test(c.why));
          if (robot) ok('a script error while the robot opened the next page (' + gone.map(c => c.u).join(', ') + ' cut off): ' + msg.slice(0, 100));
          else problem('script-error', msg + (gone.length ? ' (after ' + gone.map(c => c.u + ' ' + c.why).join(', ') + ')' : ''));
          FLOW = F0; SIZE = Z0; }, 1500); });
      pg.on('crash', () => problem('crash', 'the tab crashed'));
      /* a game script that never arrived explains the 'X is not defined' that follows it */
      pg.on('requestfailed', r => { const u = r.url(), why = (r.failure() || {}).errorText || ''; if (/\.js(\?|$)/.test(u) && u.startsWith(BASE) && !/ERR_ABORTED/.test(why)) problem('script-load-failed', u.replace(BASE + '/', '') + ' did not load (' + why + ')'); });
      pg.on('response', r => { const u = r.url(); if (/\.js(\?|$)/.test(u) && u.startsWith(BASE) && r.status() >= 400) problem('script-load-failed', u.replace(BASE + '/', '') + ' answered ' + r.status()); });
      /* native confirm()/alert(): a player reads it and presses Cancel (the robot never confirms a native dialog); long ones are reported */
      pg.on('dialog', d => { const m = d.message(); pg.__lastDialog = { at: Date.now(), m }; ok('browser dialog (' + d.type() + '): ' + m.slice(0, 100).replace(/\s+/g, ' ')); if (m.length > 600) problem('dialog-wall', 'a ' + d.type() + ' box with ' + m.length + ' characters of text: ' + m.slice(0, 120).replace(/\s+/g, ' ')); d.dismiss().catch(() => {}); });
      const t0 = Date.now();
      try { await FLOWS[name](hands(pg), T, ctx); } catch (e) { problem('robot-error', e.message.split('\n')[0]); }
      console.log('   (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
      await cx.close();
      if (ctx.mined.length && T.tip < ctx.mined[ctx.mined.length - 1]) { T = ctx.T && ctx.T.tip === ctx.mined[ctx.mined.length - 1] ? ctx.T : await truth(me); }
    }
  }
  await new Promise(r => setTimeout(r, 1800)); /* a script error is judged 1.5 s after it happens (see 'pageerror') */
  await browser.close();
  const keyOf = r => [r.flow, r.size, r.kind, r.detail].join(' | ');
  const fresh = report.filter(r => !allow.some(a => keyOf(r).includes(a)));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log('\n' + report.map(r => (fresh.includes(r) ? 'FAIL  ' : 'known ') + keyOf(r)).join('\n'));
  console.log('playtest: ' + report.length + ' problem(s), ' + fresh.length + ' not on the known list');
  process.exit(fresh.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
