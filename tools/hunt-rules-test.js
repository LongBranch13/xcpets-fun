/* Local-only hunt revision tests. Private function exposure exists only inside this VM. */
'use strict';
const L = require('./lib/load-rules'), fs = require('fs'), vm = require('vm'), assert = require('assert');
const c = L.load();
vm.runInContext(fs.readFileSync('js/v2-rules.js', 'utf8').replace('cemHuntPlan: cemHuntPlan,', 'testHandle: handle, testEnd: cemEnd, testRaise: cemRaise, cemHuntPlan: cemHuntPlan,'), c);
const V = c.V2Rules, S = L.snap('snap-972901.json'), R = 973450, HB = R + 432, G = HB;
const OW = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const keys = ['vigor','spark','grit','zoom','luck']; let checks = 0;
function ok(v, m) { checks++; assert(v, m); }
function near(a,b,m) { ok(Math.abs(a-b) < 1e-7, m + ': ' + a + ' / ' + b); }
V._setCemeteryActivation(972905); V._setCemeteryPublic(972905);
const raise = L.row(R, SB, 10000, 'pet:seance:18846:' + (4133).toString(32).toUpperCase());
const base = L.run(c,S,[raise],HB);
const clone = o => JSON.parse(JSON.stringify(o));
function world(win) { const w = clone(base); w.byId=Object.fromEntries(w.pets.map(p=>[p.id,p])); const a = w.byId[13], z = w.byId[18846];
 a.owner=OW; a.stage=5; a.dead=false; a.released=null; a.neglected=false; a.fightDays={};
 keys.forEach(k => { a.stats[k]=win ? 500 : 1; z.stats[k]=win ? 1 : 500; z.zombie.death[k]=z.stats[k]; z.zDeath[k]=z.stats[k]; }); z.zombie.keep=1; z.zombie.bonus={}; return w; }
function hunt(w,b,amount=690, id=13) { const r=L.row(b,OW,amount,'pet:fight:'+id+':18846'); w._b=b;
 return V.testHandle(w,r,V.parseTag('pet:fight:'+id+':18846'),amount,L.fakeHash(b),(r,kind,msg,extra) => {const e=Object.assign({block:b,tx:r.tx_hash,kind,msg},extra);w.log.push(e);return e;}); }
ok(V.huntRulesGate() === 975006, 'shipped gate is block 975006');
ok(!V.huntRulesOn(975005) && V.huntRulesOn(975006), 'on from the shipped block');
V._setHuntRulesActivation(null);
ok(V.huntRulesGate() === Infinity, 'a null gate is off');
for (const b of [0,G-1,G,G+1,1e9]) ok(!V.huntRulesOn(b), 'off gate never activates');
V._setHuntRulesActivation(G);
ok(!V.huntRulesOn(G-1) && V.huntRulesOn(G), 'exact gate');
{
 const w=world(false), before=clone(w.byId[13].stats); hunt(w,G);
 const H=w.cem.hunts.at(-1), q=V.huntQuote(w,13,18846,G);
 ok(H.revised && !H.won, 'loss revised'); ok(!w.byId[13].blackEyeUntil,'no new black eye');
 ok(q.stacks===1 && q.bonus===5 && q.until===G+432,'loss gives one stack for 432 blocks');
 near(q.credit,172.5,'quarter actual burn credited'); near(q.amount,q.base-172.5,'rematch amount');
 ok(JSON.stringify(before)===JSON.stringify(w.byId[13].stats),'Grudge never changes stored stats');
 near(H.snapA.stats.vigor,1,'first attempt no bonus'); near(H.snapB.stats.vigor,450,'feral weakness snapshot only');
 ok(w.byId[18846].stats.vigor===500,'weakness never changes stored stats');
 ok(V.huntQuote(w,13,18846,G+431).bonus===5 && V.huntQuote(w,13,18846,G+432).bonus===0,'exact expiry');
 ok(V.huntQuote(w,13,18846,G-1).credit===0,'credit cannot apply before loss block');
 const plan=V.cemHuntPlan(w,13,18846,G+144);near(plan.amount,V.huntQuote(w,13,18846,G+144).amount,'plan includes credit');near(V.planAmount(w,{tag:plan.tag,amount:690},G+144).amount,plan.amount,'send builder preserves quote');
 ok(V.sendBlock(w,{tag:plan.tag,amount:plan.amount-0.00000001},G+143,{me:OW}).includes('below hunt cost'),'send guard rejects insufficient rematch payment');
 ok(V.sendBlock(w,plan,G+143,{me:OW})===null,'send guard accepts exact rematch payment');
 ok(V.huntQuote(w,1,18846,G).credit===0,'credit not wallet-wide');
 ok(V.huntQuote(w,13,18845,G).bonus===0,'bonus not zombie-wide');
 const a=w.byId[13]; a.owner='new'; ok(!V.huntGrudge(w,13,18846,G),'transfer invalidates'); a.owner=OW; a.lastGot=G;
 ok(!V.huntGrudge(w,13,18846,G),'transfer back invalidates'); delete a.lastGot;
 w.byId[18846].lastGot=G;ok(!V.huntGrudge(w,13,18846,G),'zombie custody change invalidates');w.byId[18846].lastGot=R;
 w.byId[18846].zombie.gen++; ok(!V.huntGrudge(w,13,18846,G),'new rise invalidates'); w.byId[18846].zombie.gen--;
 const beforeCount=w.cem.hunts.length; hunt(w,G+1,q.amount); ok(w.cem.hunts.length===beforeCount,'daily limit retained');
 // Stay feral through several chain days without test clock expiry.
 for (let i=1;i<=4;i++) { let b=G+i*144; w.byId[18846].zombie.fedAt=b-432; let cost=V.huntQuote(w,13,18846,b).amount;
  const prev=V.huntQuote(w,13,18846,b); let e=hunt(w,b,cost-0.00000001); ok(e.kind==='rejected','one sat underpaid rejected');
  ok(V.huntQuote(w,13,18846,b).credit===prev.credit,'rejected attempt does not consume credit');
  e=hunt(w,b,cost); ok(e.kind==='hunt','exact rematch cost accepted'); const h=w.cem.hunts.at(-1);
  ok(h.grudge.stacks===Math.min(3,i+1),'stack cap three'); near(h.snapA.stats.vigor,1+Math.min(3,i)*0.05,'Grudge applied only to fight');
  near(h.grudge.credit,Math.floor((cost/4+1e-10)*1e8)/1e8,'next loss credit is quarter actually paid');
 }
 const huntPrev = process.env.HUNT_PREVIEW_OUT || require('os').tmpdir() + '/hunt-rules-1107';
 fs.mkdirSync(huntPrev,{recursive:true});
 fs.writeFileSync(huntPrev + '/loss-fixture.json',JSON.stringify({w:{tip:G,pets:[w.byId[13],w.byId[18846]],byId:{13:w.byId[13],18846:w.byId[18846]},items:{},wear:{}},event:w.cem.hunts.at(-1)}));
}
{
 const w=world(true), a=w.byId[13], z=w.byId[18846]; const oldStats=clone(z.stats); z.deed='TOKEN'; w.deeds.TOKEN={holder:SB,petId:z.id};
 const bag={gid:'huntBag',owner:SB,on:null,bag:z.id,item:'cap',tier:0}; w.items.huntBag=bag; w.bags=w.bags||{};w.bags[z.id]=['huntBag']; w.lookCopies={huntCopy:{at:z.id,holder:SB,id:'test'}};w.lookOwners={[z.id]:SB};
 const gear={gid:'huntGear',owner:SB,on:z.id,bag:null,item:'cap',tier:0}; w.items.huntGear=gear; w.itemList.push(gear);
 hunt(w,G); const H=w.cem.hunts.at(-1);
 ok(H.won && H.captured && V.isZ(z) && !z.dead && !z.feral,'win captures living zombie, not grave');
 ok(z.owner===OW && H.zOwner===SB && z.lastGot===G,'winner owns zombie with history');
 ok(z.zombie.fedAt===G && H.feedBy===G+432 && H.crumbleAt===G+864,'capture grants feeding window');
 ok(!z.deed && z.keepsake==='TOKEN' && w.deeds.TOKEN.untied===G,'old token detached not transferred');
 ok(gear.owner===SB && gear.on===null,'old gear stays with old owner');ok(bag.owner===SB && bag.bag===null,'bagged gear also stays with old owner');ok(w.lookCopies.huntCopy.holder===SB && w.lookCopies.huntCopy.at===null,'cosmetic copies stay with old owner');
 ok(H.spin===1,'first win spin retained'); ok(!!H.steal,'existing first-win 2% retained');
 ok(keys.every(k=>z.stats[k]===oldStats[k]),'capture preserves full zombie stats');
 const listed={status:'open',petId:z.id,seller:SB,give:'TOKEN',expire:G+100};ok(V.saleState(w,listed,G)==='void','old listing cannot sell captured pet');
 ok(/already risen/.test(V.cemGraveWhy(w,z,SB,G+432)||''),'original owner cannot raise captured zombie');
 ok(/own zombie/.test(V.cemHuntWhy(w,13,z.id,OW,G+432)||''),'cannot hunt own capture');
 fs.writeFileSync((process.env.HUNT_PREVIEW_OUT || require('os').tmpdir() + '/hunt-rules-1107') + '/win-fixture.json',JSON.stringify({w:{tip:G,pets:[a,z],byId:{13:a,18846:z},items:{},wear:{}},event:H}));
 const dustWorld=clone(w);dustWorld.byId=Object.fromEntries(dustWorld.pets.map(p=>[p.id,p]));const dustZ=dustWorld.byId[z.id];V.testEnd(dustWorld,dustZ,'dust',G+1);ok(/dust/.test(V.cemGraveWhy(dustWorld,dustZ,OW,G+999)||''),'capture never makes failed Resurrection dust revivable');
 V.testEnd(w,z,'crumble',G+864);
 ok(z.zRest && z.zRest.owner===OW && z.zRest.until===G+1296,'later rest belongs to current captor');
 ok(/only its owner/.test(V.cemGraveWhy(w,z,SB,G+1296)||''),'old owner cannot reclaim');
 ok(/opens at block/.test(V.cemGraveWhy(w,z,OW,G+1295)||''),'three-day rest enforced');
 ok(V.cemGraveWhy(w,z,OW,G+1296)===null,'owner can seance at exact cooldown');
 const gr=V.cemGraves(w,G+1296,{text:String(z.id)})[0];ok(gr.state==='resting' && gr.raisable && gr.restOwner===OW && gr.restUntil===G+1296,'grave finder shows correct rest eligibility');near(V.cemPreview(w,z,[w.byId[4428]],[],G+1296).times,1,'re-raise preview matches fresh stats');
 // Raise through the actual consensus seance path, consuming an eligible offering.
 const off=w.byId[4428]; Object.assign(off,{lastFed:G+1296,clockFrom:G+1296,dead:false,deathBlock:null,released:null,owner:OW,care:100,tier:2});
 ok(!!off,'eligible offering fixture');
 if (off) { const tag='pet:seance:'+z.id+':'+off.id.toString(32).toUpperCase(),r=L.row(G+1296,OW,10000,tag);
  // Legacy instant seance path, which calls the exact same cemRaise shared by block-end seances.
  V._setSeanceRaisesActivation && V._setSeanceRaisesActivation(Infinity);
  V.testHandle(w,r,V.parseTag(tag),10000,L.fakeHash(G+1296),(r,kind,msg)=>({kind,msg}));
  // Directly finish if the shipped block-end seance mode is active.
  const A=w.cem.altars[z.id]; if (A && A.status==='open') V.testRaise(w,A,G+1296,r.tx_hash,null,null,OW);
  ok(V.isZ(z) && z.owner===OW,'rested zombie re-raised'); ok(z.zombie.keep===1,'fresh at one times death stats');
  ok(keys.every(k=>z.stats[k]===z.zDeath[k]),'offerings do not add power on re-raise');
 }
}
{
 const w=world(true); hunt(w,G); const H=w.cem.hunts.at(-1), z=w.byId[18846];
 // A separate zombie, same wallet/day, still captured but no second spin.
 z.owner=SB; z.zombie.fedAt=G-432; w.byId[13].fightDays={}; hunt(w,G);
 ok(w.cem.hunts.at(-1).captured && !w.cem.hunts.at(-1).spin,'capture every win, spin once per wallet/day');
}
{
 V._setHuntRulesActivation(Infinity); const w=world(false); hunt(w,G); ok(w.byId[13].blackEyeUntil===G+72,'old loss penalty with gate off');
 const w2=world(true); hunt(w2,G); const z=w2.byId[18846]; ok(z.graveState==='hunted' && !z.zombie,'old win lays to rest');
 ok(/for good/.test(V.cemGraveWhy(w2,z,SB,G+432)||''),'old hunted remains permanent with gate off');
 V._setHuntRulesActivation(G+1);
 ok(/opens/.test(V.cemGraveWhy(w2,z,SB,G+431)||''),'historically hunted cooldown readable without new fields');
 ok(!V.cemGraveWhy(w2,z,SB,G+432),'historically hunted owner may return after cooldown');
}
{
 V._setHuntRulesActivation(G); const row=L.row(G,OW,10000,'pet:fight:13:18846'),w=L.run(c,S,[raise,row],G);
 ok(w.cem.hunts.length===1 && w.cem.hunts[0].revised,'whole burn replay routes into new hunt rules');
 V._setHuntRulesActivation(Infinity); const old=L.run(c,S,[raise,row],G);ok(!old.cem.hunts[0].revised && !old.cem.grudges,'same burns keep historical semantics with gate off');
}
console.log('hunt-rules-test: PASS '+checks+' checks');
