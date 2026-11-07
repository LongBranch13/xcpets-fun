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
console.log('era-badge-test: '+n+' checks pass');
