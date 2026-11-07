#!/usr/bin/env node
/* Display-only era boundaries. Real rule constants; no network or rule mutation. */
'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path'),root=path.resolve(__dirname,'..');
const c=require('./api-feed').context(), C=c.V2Community;
let n=0;function check(x,m){assert(x,m);n++}
const w={tip:974930,community:{returnBlock:971632},wizardMythic:{block:972325},kekMythic:{block:972869},funtrumpMythic:{block:973365},homerMythic:{block:974841}};
const p=b=>({id:123,hatchBlock:b}), era=b=>C.eraOf(w,p(b));
for(const [b,id] of [[970975,'nakamoto'],[971631,'nakamoto'],[971632,'wizard'],[972325,'wizard'],[972395,'wizard'],[972396,'kek'],[972869,'kek'],[972879,'kek'],[972880,'funtrump'],[973364,'funtrump'],[973365,'homer'],[974840,'homer'],[974841,'rabbit'],[974847,'rabbit']])check(era(b)?.id===id,'boundary '+b+' '+id);
check(era(974841).start===974841,'same-block convention is hand-off, not +1 or halving +6');
for(const bad of [null,undefined,NaN,Infinity,-1,0,974930.5,974931])check(C.eraOf(w,p(bad))===null,'unknown or future birth '+bad);
check(C.eraOf(null,p(974841))===null,'no world');check(C.eraOf(w,{...p(974841),community:true})===null,'community pet has no player birth era');
const old=JSON.stringify(w);era(974841);check(JSON.stringify(w)===old,'no world writes');
const incomplete={...w,homerMythic:null};check(C.eraOf(incomplete,p(974841)).id==='homer','no fabricated handoff');
const future={...w,rabbitMythic:{block:975000},penguinMythic:{block:975100},tip:975200};
C.PETS.push({id:'penguin',no:7,name:'PENPEN',rec:'penguinMythic'},{id:'djpepe',no:8,name:'DJ Pepe',rec:'djpepeMythic'});
c.V2Rules.ACTIVATE_PENGUIN_BLOCK=974950;c.V2Rules.ACTIVATE_DJPEPE_BLOCK=975050;
check(C.eraOf(future,p(975000)).id==='penguin','future catalogue transition');check(C.eraOf(future,p(975100)).name==='DJ Pepe','future DJ Pepe without helper edit');
c.V2Rules.ACTIVATE_DJPEPE_BLOCK=null;check(C.eraOf(future,p(975100)).id==='penguin','null gate stays off');
c.V2Rules.ACTIVATE_DJPEPE_BLOCK=975150;check(C.eraOf(future,p(975149)).id==='penguin','delayed future gate honored');check(C.eraOf(future,p(975150)).id==='djpepe','future gate exact block');
C.PETS.splice(-2);
// Render module with the same VM shims as api-feed; no browser/Telegram/wallet.
c.document.readyState='loading';c.setInterval=()=>0;c.setTimeout=()=>0;
vm.runInContext(fs.readFileSync(path.join(root,'js/v2-render.js'),'utf8'),c,{filename:'v2-render.js'});
const html=c.V2Render.eraChip(w,p(974841));check(html.includes('White Rabbit era')&&html.includes('data-era="rabbit"'),'shared renderer label');check(html.includes('974,841')&&html.includes('Looks only'),'birth/help is accessible in title');check(html.includes('<svg')&&!/position:/.test(html),'8-bit icon, no sprite overlay');check(c.V2Render.eraChip(w,p(null))==='','missing birth never guesses');
for(const f of ['js/v2.js','js/v2-pages.js','js/v2-sales.js','js/v2-cemetery-scene.js','js/v2-rugme.js','js/v2-token-gallery.js','js/v2-trait-rank.js'])check(fs.readFileSync(path.join(root,f),'utf8').includes('.eraChip('),'card integration '+f);
for(const f of ['play.html','pet.html','shop.html','templates/game.html']){const t=fs.readFileSync(path.join(root,f),'utf8');check(t.indexOf('js/v2-community.js')<t.indexOf('js/v2-chain.js'),'catalogue before boot '+f)}
// Real sprite pixels, no new art or rule changes. Delayed modules recover on a later render.
check(html.includes('era-pending-icon'),'missing sprite keeps a safe fallback');
for(const name of ['wizard','kek','funtrump','homer','rabbit'])vm.runInContext(fs.readFileSync(path.join(root,'js/'+name+'-sprite.js'),'utf8'),c,{filename:name+'-sprite.js'});
for(const [birth,id] of [[971631,'nakamoto'],[971632,'wizard'],[972396,'kek'],[972880,'funtrump'],[973365,'homer'],[974841,'rabbit']]) {
 const before=JSON.stringify(w),a=c.V2Render.eraChip(w,p(birth));
 check(a.includes('data-era-icon="'+id+'"'),'actual portrait '+id);
 check(a.includes('viewBox="0 0 24 24"')&&a.includes('shape-rendering="crispEdges"'),'native pixel geometry '+id);
 check((a.match(/<path /g)||[]).length>2,'colored existing sprite '+id);
 check(a===c.V2Render.eraChip(w,p(birth)),'stable cached portrait '+id);
 check(before===JSON.stringify(w),'portrait never mutates replay '+id);
}
check(c.V2Render.eraChip(w,p(971632)).includes('#8a4fd8'),'Wizard uses purple community palette');
check(c.V2Render.eraChip(w,p(972396)).includes('#2a4fbf'),'Kek uses community lapis palette');
const realRabbit=c.RabbitSprite;
c.RabbitSprite={draw(){throw Error('late/broken sprite')}};
check(c.V2Render.eraChip(w,p(974841)).includes('era-pending-icon'),'broken sprite cannot break cards');
c.RabbitSprite=realRabbit;
check(c.V2Render.eraChip(w,p(974841)).includes('data-era-icon="rabbit"'),'sprite restoration recovers');
C.PETS.push({id:'djpepe',no:7,name:'DJ Pepe',rec:'djpepeMythic'});
c.V2Rules.ACTIVATE_DJPEPE_BLOCK=975000;
const djWorld={...w,tip:975100,rabbitMythic:{block:975000}};
check(c.V2Render.eraChip(djWorld,p(975001)).includes('era-pending-icon'),'future sprite not yet loaded: graceful');
c.DJPepeSprite={PAL:{f:'#23aabb'},draw(){return Array.from({length:32},(_,y)=>Array.from({length:32},(_,x)=>x===15&&y===8?'f':null))}};
check(c.V2Render.eraChip(djWorld,p(975001)).includes('data-era-icon="djpepe"'),'future mixed-case DJPepeSprite discovered automatically');
check(c.V2Render.eraChip(djWorld,p(975001)).includes('#23aabb'),'future real sprite pixels used, not a substitute');
C.PETS.pop();delete c.DJPepeSprite;
console.log('era-badge-test: '+n+' checks pass');
