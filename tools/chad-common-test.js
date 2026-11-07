'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const {load,row}=require('./lib/load-rules');const c=load(),V=c.V2Rules,P=c.PetCore,G=1000000,bh='a'.repeat(64),H=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
c.document.readyState='loading';c.document.head={appendChild(){}};c.setInterval=()=>0;c.clearInterval=()=>{};
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/v2-render.js'),'utf8'),c);const R=c.V2Render;
P.sha256Hex=H;V._setRareEggsActivation(G);V._setEligB(G);
let n=0;const ok=f=>{f();n++;},same=(a,b)=>assert.strictEqual(JSON.stringify(a),JSON.stringify(b));
const sp=P.SPECIES.find(s=>s.id==='chad');ok(()=>assert(sp&&!sp.glasses&&sp.w===8));ok(()=>assert.strictEqual(sp.small[1].length,14));
let chad=0,chud=0,sample;
for(let i=0;i<10000;i++){const id=H('chad-common-'+i),a=V.hatchArt(bh,id,G);if(a.species==='chad'){chad++;sample=a;const raw=P.generate({blockHash:bh,petId:id,blockHeight:G});ok(()=>same(raw.baseStats,a.baseStats));ok(()=>assert.strictEqual(raw.tierIndex,a.tierIndex));}if(a.species==='chud')chud++;
 if(i<100)ok(()=>assert.notStrictEqual(V.hatchArt(bh,id,G-1).species,'chad'));
}
ok(()=>assert(chad>100&&Math.abs(chad-chud)<6*Math.sqrt(chad+chud)));
const kits=[[],['based-cap','v2-septum-chain','sig-chud-cape','sig-chud-body','energy-can','sig-chud-feet']];
let previews=[];for(let stage=0;stage<6;stage++)for(const gear of kits){const art=Object.assign({},sample,{background:'solid',bgColor:'#202b3a',pattern:'none',eyes:'classic'}),frames=R.framesWith(art,stage,gear,[],0);
 ok(()=>assert.strictEqual(frames.length,4));for(let frame=0;frame<4;frame++){ok(()=>assert.strictEqual(frames[frame].data.length,4096));if(stage>0){const native=P.render(art,{stage,frame,gearOverride:{},withKeys:true});ok(()=>assert(native.keys.filter(k=>k==='pupil').length>=2));ok(()=>assert(native.keys.filter(k=>k==='eye').length>=2));}}
 previews.push({stage,gear,data:Array.from(frames[0].data)});
}
for(const sl of ['head','face','back','hand','body','feet'])for(let tier=0;tier<4;tier++)ok(()=>same(V._pool(sl,'chad',tier),V._pool(sl,'chud',tier)));
const r1=row(G,'chad-owner',100,'pet:hatch'),r2=row(G,'chad-owner',100,'pet:hatch');V._setHalvingActivation(null);V._setFiresaleActivation(null);
const w=V.replay([r1,r2],{[G]:bh},[],{tip:G}),[A,B]=w.pets.filter(p=>p.owner==='chad-owner');A.species='chad';A.art=sample;A.stage=3;B.species='pepe';B.art.species='pepe';B.stage=3;
const kid=V.breedOne(w,A,B,bh,H('chad-breed'),G+1,'chad-owner');ok(()=>assert(kid.species==='chad'||kid.species==='pepe'||V.hybridRoots(kid.species).includes('chad')));ok(()=>assert(!kid.rareHatch&&!kid.art.rareHatch));
let hybridPreviews=[];for(const [other,role]of [['pepe','shape'],['wojak','color'],['wojak','beard']]){
 let plan;for(let i=0;i<1000;i++){let p=V.hybridPlan(H('chad-plan-'+i),'hyb:chad:'+other,G);if(role==='shape'?p.shape==='chad':p.shape===other){plan=p;break;}}
 ok(()=>assert(plan));if(role==='beard')plan.parts=[{sp:'chad',part:'beard'}];
 let art=Object.assign({},sample,{species:plan.shape,hybrid:plan}),fr=R.framesWith(art,3,kits[1],[],0);ok(()=>assert(fr.every(f=>f.data.length===4096)));ok(()=>assert(!plan.parts.some(q=>q.sp==='chad'&&q.part==='glasses')));
 hybridPreviews.push({role,other,plan,data:Array.from(fr[0].data)});
}
if(process.env.CHAD_RENDER_OUT)fs.writeFileSync(process.env.CHAD_RENDER_OUT,JSON.stringify({previews,hybridPreviews}));
console.log('PASS '+n+' Chad ordinary-stat/hatch/stage/gear/hybrid checks; Chad '+chad+', Chud '+chud+' in 10000 hatches');
