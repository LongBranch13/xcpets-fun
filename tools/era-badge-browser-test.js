#!/usr/bin/env node
/* Isolated headless repository regression, not the signed-in box browser.
 * Real main-feed pets/eras; all non-local traffic aborted, no wallet/sign/broadcast.
 * Layout-only fixture groups selected pets into a preview wallet; chain records stay real. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
function chromium(){for(const p of [process.env.PLAYWRIGHT_CORE,'/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core','playwright-core']){try{return require(p).chromium}catch(_){}}throw Error('playwright-core unavailable')}
const OUT=process.env.ERA_PREVIEWS||require('os').tmpdir()+'/era-badge',FILE=path.join(OUT,'replay-fixture.json');
function fixture(){
  if(fs.existsSync(FILE))return JSON.parse(fs.readFileSync(FILE,'utf8'));
  const F=require('../js/pets-feed.js'),doc=F.expand(JSON.parse(fs.readFileSync(path.join(__dirname,'../api/pets.json'),'utf8')));
  const by={}; doc.pets.forEach(p=>{by[p.id]=p});
  const rabbit=doc.pets.find(p=>p.bornBlock>=974841&&p.status==='alive');
  const kid=doc.pets.find(p=>p.parents&&p.parents.length===2&&p.parents.every(id=>by[id])&&p.status==='alive');
  const ids=new Set([rabbit&&rabbit.id,kid&&kid.id].concat(kid?kid.parents:[]));
  doc.pets.filter(p=>p.status==='alive').slice(0,80).forEach(p=>ids.add(p.id));
  const crypto=require('crypto');
  const pets=[...ids].filter(Boolean).map(id=>by[id]).filter(Boolean).map(p=>{const dna=crypto.createHash('sha256').update('era-badge:'+p.id).digest('hex');return {id:p.id,owner:p.owner,name:p.name,species:p.species,stage:p.stage,stageName:p.stageName,hatchBlock:p.bornBlock,hatchTx:'feed'+p.id,parents:p.parents||[],tier:p.tier,dna:dna,art:{species:p.species,dna:dna,pattern:'solid',eyes:'classic',background:'solid',bgColor:'#2a3a2e'},dead:p.status==='dead',stats:p.stats||{vigor:1,spark:1,grit:1,zoom:1,luck:1},care:p.care||0,status:p.status,hungry:false,capacity:4,openSlots:[],children:[]};});
  const byId={}; pets.forEach(p=>{byId[p.id]=p});
  return {tip:doc.blockHeight,pets,byId};
}
(async()=>{fs.mkdirSync(OUT,{recursive:true});const source=fixture(),w=JSON.parse(JSON.stringify(source)),ME=w.pets[0].owner;
// Only the screenshot fixture groups public pets under one wallet. Never persisted to game data.
w.pets.forEach(p=>{p.owner=ME;w.byId[p.id]=p});w.byOwner={[ME]:w.pets.map(p=>p.id)};
w.items=w.items||{};w.itemList=w.itemList||[];w.log=w.log||[];w.wear=w.wear||{};w.fights=w.fights||[];w.listings=w.listings||[];w.deeds=w.deeds||{};w.wagmi=w.wagmi||{};w.spins=w.spins||{};w.breedReqs=w.breedReqs||[];
w.community=w.community||{burned:0,feeders:{},leaderboard:[],petName:'Nakamoto',petRole:'',petStageName:'Egg',wizardStage:0,current:'nakamoto',returnBlock:971632};
w.cem=w.cem||{altars:{},hunts:[],grudges:{}};
const kid=w.pets.find(p=>p.parents?.length===2&&p.parents.every(id=>w.byId[id])),rabbit=w.pets.find(p=>p.hatchBlock>=974841);assert(kid&&rabbit,'real family + Rabbit-era pet required');
const base='http://localhost:8827',b=await chromium().launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']}),report=[];let n=0;
try{for(const width of [1280,390])for(const spec of [{name:'my-pets',url:'/play.html#petsPanel',target:'#petsPanel',badge:'#petsPanel .era-badge'},{name:'pet-card',url:'/pet.html?id='+rabbit.id,target:'#petCard',badge:'#chips .era-badge'},{name:'family',url:'/pet.html?id='+kid.id,target:'#family',badge:'.ftnode .era-badge'},{name:'shop',url:'/shop.html#sell',target:'#shModal .box',badge:'.sh-card .era-badge'}]){
const ctx=await b.newContext({viewport:{width,height:width<500?844:1000},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'}),pg=await ctx.newPage(),errors=[];pg.on('pageerror',e=>errors.push(e.stack||e.message));
const chainBody='(()=>{const w='+JSON.stringify(w)+',ME='+JSON.stringify(ME)+';const S={tip:w.tip,feedTip:w.tip,chainTip:w.tip,verified:true,rows:[{block_index:w.tip,tx_hash:"fixture"}],hashes:{},sel:[],hidden:[],ops:[],balance:1000,dex:{orders:[]}};window.__eraFixture=w;window.V2Mock={KEY:"era-preview",ME:ME,prod:true,NPCS:[],state:function(){return S},world:function(){return w},peek:function(){return w},boot:function(cb){if(cb)cb()},save:function(){},refresh:function(cb){if(cb)cb()},onFresh:function(){},whenFresh:function(){return Promise.resolve({ok:true})},burn:function(){throw Error("PREVIEW: no burns")},adv:function(){},wipe:function(){}};})();\n';
await require('./lib/serve-repo')(pg,{'/js/v2-chain.js':chainBody},base);
await pg.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();return r.fallback()});
await pg.addInitScript(id=>{window.XCPETS_NO_POLL=1;for(const k of ['xcpets-intro-seen','xcpets-tut-seen','xcpets-v2-rabbit-arrival-seen','xcpets-v2-homer-farewell-seen','xcpets-v2-kek-arrival-seen'])localStorage.setItem(k,'1');localStorage.setItem('xcpets-tut-tips',JSON.stringify({juv:true,adult:true,tokens:true,neglect:true,mythic:true}));localStorage.setItem('xcpets-mypets-pos',String(id));window.__eraNoWallet=true;},rabbit.id);
await pg.goto(base+spec.url,{waitUntil:'load'});
if(spec.name==='shop'){await pg.locator('#shSell').click({timeout:20000});}
try{await pg.waitForSelector(spec.badge+':visible',{timeout:20000});}catch(e){console.log('DEBUG',spec.name,width,errors,await pg.locator('body').innerText());throw e}
await pg.mouse.move(0,0);await pg.waitForTimeout(1200);
// Shop's Sell picker is a pure local modal. This never clicks a mint/list action.
if(spec.name==='shop'&&!(await pg.locator(spec.badge).count()))throw Error('shop badges absent');
assert.deepStrictEqual(errors,[],spec.name+' w'+width+' page errors');n++;
const metrics=await pg.locator(spec.badge).evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect(),art=e.closest('.pet,.pcard,.sh-card,.ftnode')?.querySelector('canvas');const a=art?.getBoundingClientRect();return {text:e.textContent.trim(),era:e.dataset.era,width:r.width,visible:r.width>0&&r.height>0,overlap:!!a&&r.left<a.right&&r.right>a.left&&r.top<a.bottom&&r.bottom>a.top,title:e.title,icon:e.querySelector('.era-pet-icon')?.dataset.eraIcon,iconWidth:e.querySelector('.era-pet-icon')?.getBoundingClientRect().width,viewBox:e.querySelector('.era-pet-icon')?.getAttribute('viewBox'),crisp:e.querySelector('.era-pet-icon')?.getAttribute('shape-rendering')}}));
assert(metrics.some(x=>x.visible),'visible badge '+spec.name);n++;assert(metrics.every(x=>!x.overlap),'no art overlap '+spec.name);n++;assert(metrics.every(x=>x.title.includes('Born in block')),'birth tooltip '+spec.name);n++;
assert(metrics.filter(x=>x.visible).every(x=>x.icon===x.era),'correct community pet portraits '+spec.name);n++;assert(metrics.filter(x=>x.visible).every(x=>x.iconWidth===24&&x.viewBox==='0 0 24 24'&&x.crisp==='crispEdges'),'native crisp pixels '+spec.name);n++;
if(spec.name==='my-pets')await pg.locator(spec.badge+':visible').first().scrollIntoViewIfNeeded();else{const target=pg.locator(spec.target);if(await target.count())await target.first().scrollIntoViewIfNeeded();else await pg.locator(spec.badge+':visible').first().scrollIntoViewIfNeeded();}
await pg.screenshot({path:path.join(OUT,spec.name+'-'+width+'.png'),fullPage:false});
if(spec.name==='pet-card'){await pg.evaluate(()=>scrollTo(0,0));const box=await pg.locator('#petCard').boundingBox();await pg.screenshot({path:path.join(OUT,'pet-card-crop-'+width+'.png'),clip:box});}
await pg.locator(spec.badge+':visible').first().screenshot({path:path.join(OUT,'era-icon-crop-'+spec.name+'-'+width+'.png')});
if(spec.name==='my-pets'&&width===1280){
 await pg.evaluate(()=>{const g=document.createElement('section');g.id='eraIconGallery';g.style.cssText='display:flex;align-items:center;gap:14px;width:max-content;padding:20px;background:#101820;';const w=V2Mock.world(),seen={};w.pets.forEach(p=>{const e=V2Community.eraOf(w,p);if(e&&!seen[e.id]){seen[e.id]=1;g.insertAdjacentHTML('beforeend',V2Render.eraChip(w,p));}});document.body.appendChild(g);});
 await pg.locator('#eraIconGallery').screenshot({path:path.join(OUT,'era-icons-native.png')});
 await pg.locator('#eraIconGallery').evaluate(e=>e.remove());
}
report.push({surface:spec.name,width,errors,metrics});await ctx.close();
}}finally{await b.close()}
fs.writeFileSync(path.join(OUT,'browser-results.json'),JSON.stringify({checks:n,report,fixture:'Main block '+source.tip+' pets; wallet ownership grouped only in browser layout fixture. No wallet actions or non-local requests.'},null,2));console.log('era-badge-browser-test: '+n+' checks pass');})().catch(e=>{console.error(e);process.exitCode=1});
