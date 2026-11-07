/* Offline UI test and honest synthetic-wallet previews; never connects a wallet. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const L = require('./lib/load-rules');
(async () => {
  const scene = fs.readFileSync(path.join(L.ROOT,'js/v2-cemetery-scene.js'),'utf8'); assert(!scene.includes('data-hpick'), 'no hunter dropdown'); assert(scene.includes('window.V2HuntPicker.open'), 'Hunt launches explicit picker');
  const ctx = L.load(), snap = L.snap(), w = L.run(ctx, snap, [], snap.tip), base = w.pets.find(p => p.art && p.stage >= 2 && !p.dead && !p.released && !p.zombie && !p.community);
  assert(base, 'real replay pet for sprite fixture');
  const out = process.env.HUNT_PREVIEW_OUT || '/workspace/xcpets/previews/hunt-picker-1107'; fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--no-sandbox']});
  try {
    for (const width of [1280,390]) {
      const page = await browser.newPage({viewport:{width,height:900}}), errors=[]; page.on('pageerror', e=>errors.push(e.message));
      await page.route('http://hunt-fixture.test/', route => route.fulfill({contentType:'text/html',body:'<html><body></body></html>'})); await page.goto('http://hunt-fixture.test/');
      await page.setContent('<html><head></head><body style="margin:0;background:#101722;color:#eee;font:16px monospace"><h1>Pet Cemetery · offline UI fixture</h1><button id="launch">Hunt</button></body></html>');
      for (const file of ['css/style.css','css/game.css','css/v2.css','css/hunt-picker.css']) await page.addStyleTag({path:path.join(L.ROOT,file)});
      for (const file of ['rjs/config.js','rjs/pet-core.js','js/pet-core.js','js/bonus-gear.js','js/v2-gear.js','js/v2-fit.js','js/v2-rules.js','js/v2-render.js','js/v2-zombie-look.js','js/v2-zombies.js','js/v2-hunt-picker.js']) await page.addScriptTag({path:path.join(L.ROOT,file)});
      await page.evaluate(base => {
        const w={tip:974900,pets:[],byId:{},items:{},wear:{}};
        for(let i=1;i<=2000;i++){const p=JSON.parse(JSON.stringify(base));p.id=i;p.name=i===2000?'Champion':i===1999?'Tiny':'Fighter '+i;p.owner='fixture';p.stats={vigor:10+i%50,spark:12,grit:14,zoom:15,luck:16};if(i===2000)p.stats.vigor=200;p.fixtureWhy=i===1999?'too young':i%17===0?'one battle per pet per 144-block day':i%19===0?'black eye':i%23===0?'pet already has an open challenge':null;w.pets.push(p);w.byId[i]=p;}
        const z=JSON.parse(JSON.stringify(base));z.id=9001;z.name='Feral foe';z.zombie={end:null};z.stats={vigor:50,spark:30,grit:25,zoom:20,luck:10};w.byId[z.id]=z;
        window.sent=[];window.fixture={w,V:{petPower:V2Rules.petPower,cemHuntWhy:(w,id)=>w.byId[id].fixtureWhy,cemHuntPlan:()=>({tag:'pet:fight:2000:9001',amount:172.5})},R:V2Render,me:'fixture',zombie:z.id,block:974901,pets:w.pets,send:(plans,title)=>sent.push({plans,title})};
        document.querySelector('#launch').onclick=()=>V2HuntPicker.open(fixture);
      }, JSON.parse(JSON.stringify(base)));
      await page.click('#launch'); await page.waitForTimeout(600);
      assert.equal(await page.locator('.hunt-card').count(),24);
      assert.equal(await page.locator('.suggested').count(),1);
      assert.match(await page.locator('.suggested').innerText(),/Champion #2000/);
      assert.equal(await page.evaluate(()=>sent.length),0,'no automatic selection or send');
      assert.equal(await page.locator('[data-ready]').count(),0);
      assert(await page.evaluate(()=>document.querySelector('#huntPicker').scrollWidth<=document.querySelector('#huntPicker').clientWidth),'no horizontal overflow');
      await page.screenshot({path:path.join(out,`picker-large-${width}.png`)});
      await page.locator('#huntSearch').fill('#1999'); assert.equal(await page.locator('.hunt-card:disabled').count(),1); assert.match(await page.locator('.hunt-card').innerText(),/too young/);
      await page.screenshot({path:path.join(out,`blocked-${width}.png`)});
      for (const [q,reason] of [['#17','one battle'],['#19','black eye'],['#23','open challenge']]) { await page.locator('#huntSearch').fill(q); assert.match(await page.locator(`[data-pick="${q.slice(1)}"]`).innerText(), new RegExp(reason)); assert(await page.locator(`[data-pick="${q.slice(1)}"]`).isDisabled()); }
      await page.locator('#huntSearch').fill('');await page.click('[data-next]'); assert.match(await page.locator('#huntResults [role=status]').innerText(),/Page 2 of 84/);
      await page.locator('#huntSearch').fill('Champion');await page.click('[data-pick="2000"]');
      assert.equal(await page.locator('.hunt-side').count(),2);assert.match(await page.locator('#huntBody').innerText(),/172.5 XCPETS/);
      await page.waitForTimeout(400);await page.screenshot({path:path.join(out,`versus-${width}.png`)});
      await page.click('[data-back]'); assert.equal(await page.locator('[data-ready]').count(),0);await page.click('[data-pick="2000"]');await page.click('[data-ready]');
      assert.equal(await page.evaluate(()=>sent.length),1);assert.match(await page.evaluate(()=>sent[0].title),/Champion #2000.*172.5 XCPETS/);
      assert.deepEqual(errors,[]);console.log('PASS: '+width+'px, 2,000 pets, pagination/search, blocked reasons, explicit choice, versus, named handoff, no overflow/errors');await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
