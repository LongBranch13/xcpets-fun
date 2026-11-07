#!/usr/bin/env node
/* Isolated headless repository regression, not the signed-in box browser.
 * Real main-feed pets/eras; all non-local traffic aborted, no wallet/sign/broadcast.
 * Layout-only fixture groups selected pets into a preview wallet; chain records stay real. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
function chromium(){for(const p of [process.env.PLAYWRIGHT_CORE,'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core','playwright-core']){try{return require(p).chromium}catch(_){}}throw Error('playwright-core unavailable')}
const OUT=process.env.ERA_PREVIEWS||'/workspace/xcpets/previews/era-badge',FILE=path.join(OUT,'replay-fixture.json');
(async()=>{const source=JSON.parse(fs.readFileSync(FILE)),w=JSON.parse(JSON.stringify(source)),ME=w.pets[0].owner;
// Only the screenshot fixture groups public pets under one wallet. Never persisted to game data.
w.pets.forEach(p=>{p.owner=ME;w.byId[p.id]=p});w.byOwner={[ME]:w.pets.map(p=>p.id)};
const kid=w.pets.find(p=>p.parents?.length===2&&p.parents.every(id=>w.byId[id])),rabbit=w.pets.find(p=>p.hatchBlock>=974841);assert(kid&&rabbit,'real family + Rabbit-era pet required');
const base='http://localhost:8827',b=await chromium().launch({executablePath:process.env.CHROME||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']}),report=[];let n=0;
try{for(const width of [1280,390])for(const spec of [{name:'my-pets',url:'/play.html#petsPanel',target:'#petsPanel',badge:'#petsPanel .era-badge'},{name:'pet-card',url:'/pet.html?id='+rabbit.id,target:'#petCard',badge:'#chips .era-badge'},{name:'family',url:'/pet.html?id='+kid.id,target:'#family',badge:'.ftnode .era-badge'},{name:'shop',url:'/shop.html#sell',target:'#shModal .box',badge:'.sh-card .era-badge'}]){
const ctx=await b.newContext({viewport:{width,height:width<500?844:1000},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'}),pg=await ctx.newPage(),errors=[];pg.on('pageerror',e=>errors.push(e.message));
await require('./lib/serve-repo')(pg,{},base);
await pg.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();if(u.pathname==='/js/v2-chain.js')return r.fulfill({contentType:'application/javascript',body:`(()=>{const w=${JSON.stringify(w)},ME=${JSON.stringify(ME)};const S={tip:w.tip,feedTip:w.tip,chainTip:w.tip,verified:true,rows:[{block_index:w.tip,tx_hash:'fixture'}],hashes:{},sel:[],hidden:[],ops:[],balance:1000,dex:{orders:[]}};window.__eraFixture=w;window.V2Mock={KEY:'era-preview',ME,prod:true,NPCS:[],state:()=>S,world:()=>w,peek:()=>w,boot:cb=>cb(),save:()=>{},refresh:cb=>cb&&cb(),onFresh:()=>{},whenFresh:()=>Promise.resolve({ok:true}),burn:()=>{throw Error('PREVIEW: no burns')},adv:()=>{},wipe:()=>{}};})();`});return r.fallback()});
await pg.addInitScript(id=>{window.XCPETS_NO_POLL=1;for(const k of ['xcpets-intro-seen','xcpets-tut-seen','xcpets-v2-rabbit-arrival-seen','xcpets-v2-homer-farewell-seen','xcpets-v2-kek-arrival-seen'])localStorage.setItem(k,'1');localStorage.setItem('xcpets-tut-tips',JSON.stringify({juv:true,adult:true,tokens:true,neglect:true,mythic:true}));localStorage.setItem('xcpets-mypets-pos',String(id));window.__eraNoWallet=true;},rabbit.id);
await pg.goto(base+spec.url,{waitUntil:'load'});
if(spec.name==='shop'){await pg.locator('#shSell').click({timeout:20000});}
try{await pg.waitForSelector(spec.badge+':visible',{timeout:20000});}catch(e){console.log('DEBUG',spec.name,width,errors,await pg.locator('body').innerText());throw e}
await pg.mouse.move(0,0);await pg.waitForTimeout(1200);
// Shop's Sell picker is a pure local modal. This never clicks a mint/list action.
if(spec.name==='shop'&&!(await pg.locator(spec.badge).count()))throw Error('shop badges absent');
assert.deepStrictEqual(errors,[],spec.name+' w'+width+' page errors');n++;
const metrics=await pg.locator(spec.badge).evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect(),art=e.closest('.pet,.pcard,.sh-card,.ftnode')?.querySelector('canvas');const a=art?.getBoundingClientRect();return {text:e.textContent.trim(),era:e.dataset.era,width:r.width,visible:r.width>0&&r.height>0,overlap:!!a&&r.left<a.right&&r.right>a.left&&r.top<a.bottom&&r.bottom>a.top,title:e.title}}));
assert(metrics.some(x=>x.visible),'visible badge '+spec.name);n++;assert(metrics.every(x=>!x.overlap),'no art overlap '+spec.name);n++;assert(metrics.every(x=>x.title.includes('Born in block')),'birth tooltip '+spec.name);n++;
if(spec.name==='my-pets')await pg.locator(spec.badge+':visible').first().scrollIntoViewIfNeeded();else{const target=pg.locator(spec.target);if(await target.count())await target.first().scrollIntoViewIfNeeded();else await pg.locator(spec.badge+':visible').first().scrollIntoViewIfNeeded();}
await pg.screenshot({path:path.join(OUT,spec.name+'-'+width+'.png'),fullPage:false});
if(spec.name==='pet-card'){await pg.evaluate(()=>scrollTo(0,0));const box=await pg.locator('#petCard').boundingBox();await pg.screenshot({path:path.join(OUT,'pet-card-crop-'+width+'.png'),clip:box});}
report.push({surface:spec.name,width,errors,metrics});await ctx.close();
}}finally{await b.close()}
fs.writeFileSync(path.join(OUT,'browser-results.json'),JSON.stringify({checks:n,report,fixture:'Main block '+source.tip+' pets; wallet ownership grouped only in browser layout fixture. No wallet actions or non-local requests.'},null,2));console.log('era-badge-browser-test: '+n+' checks pass');})().catch(e=>{console.error(e);process.exitCode=1});
