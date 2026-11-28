/* Speech bubbles stay on top (Nov 28 2026, Jake: "red candles overlap Mort's speech in the cemetery").
 * Hosts' bubbles are painted inside the scene canvas; seasonal decoration (Doom Week stones and fog, Halloween candles, place pennants)
 * are DOM layers over that canvas. V2Sharp.top (js/v2-sharp.js) copies the bubbles onto a canvas above every decoration layer.
 * This test mounts the real Cemetery (Mort), Motel (Gooby) and Rare Room (Captain Dan) scenes at phone and desktop widths, lays a solid
 * red decoration layer (z-index 8, the whole scene) over each one and checks, from a real screenshot, that each bubble's pixels are the
 * bubble's own (cream / ink), not the decoration's red. Before the fix every bubble came out red. */
'use strict';
const fs = require('fs'), path = require('path');
function playwright() { for (const p of [process.env.PW, 'playwright-core', 'playwright']) { if (!p) continue; try { return require(p); } catch (e) { } } throw new Error('playwright not found'); }
function chromePath() { for (const p of [process.env.CHROME, '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']) { if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return p; } return undefined; }
const root = path.resolve(__dirname, '..');
const LIBS = ['pet-core', 'bonus-gear', 'v2-gear', 'v2-fit', 'v2-rules', 'wizard-sprite', 'kek-sprite', 'homer-sprite', 'rabbit-sprite', 'djpepe-sprite', 'contest-sprite', 'v2-looks', 'v2-render', 'v2-sharp', 'v2-zombie-look'];
const SCENES = ['v2-cemetery-scene', 'v2-motel', 'v2-shop'];
const PAGE = '<!doctype html><style>body{background:#131622;color:#fff;font:12px monospace;margin:12px}section{margin:16px 0}' +
  '#cemScene canvas,#motelScene canvas,#shScene canvas{display:block;width:100%;max-width:960px}' +
  '.deco{position:absolute;inset:0;z-index:8;pointer-events:none;background:#ff0000}</style>' +
  '<select id="bA"><option value="1">A</option></select><select id="bB"><option value="2">B</option></select><section id="breedPanel"><div id="motelScene"></div></section><section><div id="shScene"><canvas id="csCanvas" width="320" height="180"></canvas></div><div id="shopScene"></div></section>' +
  '<section><div id="cemScene"></div><div id="cemCard" hidden></div></section>';
(async () => {
  const P = playwright(), exe = chromePath();
  const browser = await P.chromium.launch(Object.assign({ headless: true, args: ['--no-sandbox'] }, exe ? { executablePath: exe } : {}));
  const fails = []; let checked = 0;
  try {
    for (const width of [390, 1280]) {
      const pg = await browser.newPage({ viewport: { width, height: 1400 }, reducedMotion: 'reduce' }), errors = [];
      pg.on('pageerror', e => errors.push(e.message));
      await pg.route('**/*', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
      await pg.goto('http://scene-top.local/');
      await pg.evaluate(() => { window.__raf = []; window.requestAnimationFrame = f => { __raf.push(f); return 1; }; window.__flush = () => { const q = __raf.splice(0); q.forEach(f => { try { f(performance.now()); } catch (e) { } }); }; window.cancelAnimationFrame = () => { }; });
      for (const f of LIBS) await pg.addScriptTag({ content: fs.readFileSync(path.join(root, 'js/' + f + '.js'), 'utf8') });
      await pg.evaluate(() => { window.world = { items: {}, itemList: [], tip: 977900, byId: {}, pets: [], fights: [], breedReqs: [], breedLog: [] };
        window.V2UI = { ME: 'audit', world: () => world, mine: () => [], S: () => ({ tip: 977900, sel: [], ops: [] }), esc: s => String(s), render() { }, toast() { }, tip: 977900 }; window.V2Mock = { world: () => world }; });
      for (const f of SCENES) await pg.addScriptTag({ content: fs.readFileSync(path.join(root, 'js/' + f + '.js'), 'utf8') });
      const hosts = await pg.evaluate(() => {
        const out = {};
        try { V2CemeteryScene.mount(world, []); V2CemeteryScene._state().say = 'Shh. They are sleeping.'; V2CemeteryScene._select(null); } catch (e) { out.err = 'cemetery: ' + e.message; }
        try { V2Motel.render(world); } catch (e) { out.err = (out.err || '') + ' motel: ' + e.message; }
        try { V2Shop.render(world); } catch (e) { out.err = (out.err || '') + ' shop: ' + e.message; }
        /* the decoration goes in AFTER the scenes, as Doom Week / Halloween do, then every scene draws one more frame */
        ['cemScene', 'motelScene', 'shScene', 'shopScene'].forEach(id => { const b = document.getElementById(id); if (!b) return; if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; const d = document.createElement('div'); d.className = 'deco'; b.appendChild(d); });
        try { V2CemeteryScene._select(null); } catch (e) { }
        try { V2Motel.render(world); } catch (e) { }
        try { V2Shop.render(world); } catch (e) { }
        __flush(); __flush();
        return out;
      });
      if (hosts.err) fails.push(width + 'px: ' + hosts.err);
      /* where each bubble is: the scene canvas's own cream (#fff8e1) pixels, read from the canvas, so the check does not trust the fix's bookkeeping */
      for (const [who, sel] of [['Mort', '#cemScene canvas:not(.scene-top)'], ['Gooby', '#motelScene canvas:not(.scene-top)'], ['Captain Dan', '#shopScene canvas:not(.scene-top)']]) {
        const box = await pg.evaluate((sel) => { const c = document.querySelector(sel); if (!c) return null; c.scrollIntoView(); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 248 && d[i + 2] === 225) { const p = i / 4, x = p % c.width, y = (p / c.width) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
          if (x1 < 0) return null; const R = c.getBoundingClientRect(), k = R.width / c.width; return { x: R.left + x0 * k, y: R.top + y0 * k, w: (x1 - x0 + 1) * k, h: (y1 - y0 + 1) * k, cw: c.width, ch: c.height, bx: x0, by: y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1, sel }; }, sel);
        if (!box) { fails.push(width + 'px: ' + who + "'s speech bubble was not drawn"); continue; }
        const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.max(1, Math.ceil(box.w)), height: Math.max(1, Math.ceil(box.h)) };
        const png = await pg.screenshot({ clip }); if (process.env.SHOTS) fs.writeFileSync(path.join(process.env.SHOTS, who.replace(/ /g, '') + '-' + width + '.png'), png);
        const red = await pg.evaluate(async ({ b64, box, clip }) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
          const tx = t.getContext('2d'); tx.drawImage(img, 0, 0); const sd = tx.getImageData(0, 0, t.width, t.height).data;
          const c = document.querySelector(box.sel), cd = c.getContext('2d').getImageData(box.bx, box.by, box.bw, box.bh).data, R = c.getBoundingClientRect(), k = R.width / c.width, sx = img.width / clip.width;
          let cream = 0, n = 0; for (let y = 0; y < box.bh; y++) for (let x = 0; x < box.bw; x++) { const i = (y * box.bw + x) * 4; if (!(cd[i] === 255 && cd[i + 1] === 248 && cd[i + 2] === 225)) continue;
            const px = Math.floor(((R.left + (box.bx + x + 0.5) * k) - clip.x) * sx), py = Math.floor(((R.top + (box.by + y + 0.5) * k) - clip.y) * sx); if (px < 0 || py < 0 || px >= t.width || py >= t.height) continue;
            const j = (py * t.width + px) * 4; cream++; if (sd[j] > 200 && sd[j + 1] < 90 && sd[j + 2] < 90) n++; }
          return cream ? n / cream : 1; }, { b64: png.toString('base64'), box, clip });
        checked++;
        if (red > 0.02) fails.push(width + 'px: ' + who + "'s speech bubble is covered by the decoration layer (" + Math.round(red * 100) + '% of it red)');
      }
      if (errors.length) fails.push(width + 'px page errors: ' + errors.slice(0, 3).join(' | '));
      await pg.close();
    }
  } finally { await browser.close(); }
  if (fails.length) { console.error('scene-top-test: FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('scene-top-test: ok (' + checked + ' bubbles above the decoration at phone and desktop widths)');
})().catch(e => { console.error(e); process.exit(1); });
