/* Offline rendering of real gated hunt-engine fixtures. No wallet, network, signing or sends. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
function chromium(){for(const p of [process.env.PW,'playwright-core','playwright','/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core']){if(!p)continue;try{return require(p).chromium}catch(e){}}throw new Error('playwright-core not found')}
const ROOT=path.resolve(__dirname,'..'), OUT=process.env.HUNT_PREVIEW_OUT || require('os').tmpdir() + '/hunt-rules-1107';
(async()=>{
 require('child_process').execFileSync(process.execPath,['tools/hunt-rules-test.js'],{cwd:ROOT,stdio:'pipe'});
 const browser=await chromium().launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});let checks=0;
 try {for (const width of [1280,390]) for (const result of ['win','loss']) {
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().startsWith('life anim'))errors.push(m.text());});
  await page.route('http://hunt-rules.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));await page.goto('http://hunt-rules.test/');
  await page.setContent('<html><head></head><body style="margin:0;background:#101722;color:#eee;font:16px monospace"><h1>Pet Cemetery</h1><p>Private rule preview · offline fixture · not live</p></body></html>');
  for(const file of ['css/style.css','css/game.css','css/v2.css','css/hunt-picker.css']) await page.addStyleTag({path:path.join(ROOT,file)});
  for(const file of ['rjs/config.js','rjs/pet-core.js','js/pet-core.js','js/bonus-gear.js','js/v2-gear.js','js/v2-fit.js','js/v2-rules.js','js/v2-render.js','js/v2-zombie-look.js','js/v2-zombies.js','js/v2-life-anim.js','js/v2-hunt-picker.js'])await page.addScriptTag({path:path.join(ROOT,file)});
  const fix=JSON.parse(fs.readFileSync(path.join(OUT,result+'-fixture.json')));
  await page.evaluate(({fix,result})=>{
   const H=fix.event,w=fix.w;w.log=[];w.cem={hunts:[H],altarList:[],grudges:{}};w.fights=[];w.listings=[];
   V2Rules._setHuntRulesActivation(0);window.fixtureWorld=w;
   const events=V2LifeAnim.collect(w,H.by,H.block),ev=events.find(e=>e.kind===(result==='win'?'hunt-won':'hunt-lost'));
   if(!ev||!ev.revised||!!ev.captured!==(result==='win'))throw Error('result collector dropped hunt metadata');
   window.huntEvent=ev; V2LifeAnim.play(ev,{w,still:true});
  },{fix,result});
  const caption=await page.locator('.la-cap').innerText();
  assert.match(caption,result==='win'?/now your zombie.*Feed it Discarded pets/:/No new black eye.*Grudge \+15%.*rematch/);checks++;
  assert(!caption.includes('for good')&&!caption.includes('laid it to rest'));checks++;
  assert(await page.evaluate(()=>{const c=document.querySelector('.la-ov canvas'),r=c.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));checks++;
  await page.screenshot({path:path.join(OUT,`${result==='win'?'win-capture':'loss-grudge'}-${width}.png`)});
  // Render a whole short animation strip from the same production painter.
  for(const f of [0,14,26,38]){await page.evaluate(f=>V2LifeAnim.last.frame(f),f);await page.locator('.la-ov canvas').screenshot({path:path.join(OUT,`${result}-frame-${f}-${width}.png`)});}
  if(result==='loss') {
   await page.evaluate(()=>{
    V2LifeAnim.last.end();const w=fixtureWorld,H=w.cem.hunts[0],A=w.byId[13],Z=w.byId[18846],b=H.block+144;
    w.tip=b-1;A.fightDays={};A.lastFed=b;A.clockFrom=b;Z.zombie.fedAt=b-432;w.cem.grudges['13:18846']=H.grudge;
    window.sent=[];V2HuntPicker.open({w,V:V2Rules,R:V2Render,me:A.owner,zombie:Z.id,block:b,pets:[A],send:(plans,title)=>sent.push({plans,title})});
   });
   await page.click('[data-pick="13"]');assert.match(await page.locator('#huntBody').innerText(),/Win: capture this zombie.*Grudge.*90%.*\+15%/);checks++;
   assert(await page.evaluate(()=>document.querySelector('#huntPicker').scrollWidth<=document.querySelector('#huntPicker').clientWidth));checks++;
   await page.waitForTimeout(700); assert(await page.evaluate(()=>Array.from(document.querySelectorAll('[data-hsprite]')).every(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data).some((v,i)=>i%4===3&&v>0))),'both hunter sprites actually painted');checks++;
   await page.screenshot({path:path.join(OUT,`versus-grudge-${width}.png`)});
   await page.click('[data-ready]');assert.equal(await page.evaluate(()=>sent.length),1);checks++;
   assert(await page.evaluate(()=>sent[0].plans[0].credit>0));checks++;
  }
  assert.deepEqual(errors,[]);checks++;await page.close();
 }
 console.log('hunt-rules-browser-test: PASS '+checks+' checks; real rule fixture result/collector/painter, 1280 and 390, no page errors or overflow');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
