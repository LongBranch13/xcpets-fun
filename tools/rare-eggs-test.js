/* Local future-rule tests. No network or wallet. */
'use strict';
const assert = require('assert'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const {load, row, fakeHash} = require('./lib/load-rules');
const c=load(),V=c.V2Rules,G=1000000,bh='a'.repeat(64),id=n=>n.toString(16).padStart(64,'0');
const same=(a,b)=>assert.strictEqual(JSON.stringify(a),JSON.stringify(b));
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
let checks=0;function ok(f){f();checks++;}
ok(()=>assert.strictEqual(V.ACTIVATE_RARE_EGGS_BLOCK,974962));
V._setRareEggsActivation(Infinity);
ok(()=>assert.strictEqual(V.rareEggsOn(G),false));
const old=V.hatchArt(bh,id(1),G-1),olde=V.electricArt(bh,id(1),G-1);
V._setRareEggsActivation(G);
ok(()=>same(V.hatchArt(bh,id(1),G-1),old));ok(()=>same(V.electricArt(bh,id(1),G-1),olde));
ok(()=>assert(V.rareEggsOn(G)));ok(()=>assert(!V.rareEggsOn(NaN)));
ok(()=>same(V.rareSeed(bh.toUpperCase(),id(31).toUpperCase()),V.rareSeed(bh,id(31))));
for(const args of [['',id(1)],[bh,'bad'],[bh,id(1)+':-1']])ok(()=>assert.throws(()=>V.rareSeed(...args)));
let off=0;const widths={};for(const [kind,w]of V.RARE_BUCKETS){widths[kind]=w;ok(()=>assert.strictEqual(V.rareBucket(off),kind));ok(()=>assert.strictEqual(V.rareBucket(off+w-1),kind));off+=w;}
ok(()=>assert.strictEqual(V.rareBucket(off),null));ok(()=>assert.strictEqual(V.RARE_D-off,86744575688491));
for(const n of [-1,V.RARE_D,0.5,NaN])ok(()=>assert.throws(()=>V.rareBucket(n)));
// Exact nominal algebra (BigInt), including preservation of the historical lane.
for(const [kind,den]of [['god',77777],['djpepe',3888],['wizard',7777],['kek',7777],...V.RARE_BUCKETS.slice(4).map(([k])=>[k,5439])])ok(()=>assert.strictEqual(776n*BigInt(widths[kind])*BigInt(den),777n*BigInt(V.RARE_D)));
// Native SHA oracle, then use its byte-identical implementation for the large simulation.
const original=c.PetCore.sha256Hex;for(let i=0;i<32;i++)ok(()=>assert.strictEqual(original(id(i)),hash(id(i))));
let calls=0;c.PetCore.sha256Hex=s=>{calls++;return hash(s);};
function oracle(seed,d){let limit=Math.floor(2**48/d)*d;for(let retry=0;;retry++){const n=parseInt(hash(seed+'|XCPETS:v2:rare-hatch-v1:bucket|'+retry).slice(0,12),16);if(n<limit)return n%d;}}
for(let i=0;i<100;i++)ok(()=>assert.strictEqual(V.rareTicket(V.rareSeed(bh,id(i)),'bucket',V.RARE_D),oracle(V.rareSeed(bh,id(i)),V.RARE_D)));
// Explicit rejection: 2^48-1 must retry; accepted zero maps to first bucket.
let seen=[];c.PetCore.sha256Hex=s=>{seen.push(s);return (seen.length===1?'f'.repeat(12):'0'.repeat(12))+'0'.repeat(52);};
ok(()=>assert.strictEqual(V.rareTicket('seed','bucket',V.RARE_D),0));ok(()=>assert(seen[0].endsWith('|0')&&seen[1].endsWith('|1')));
c.PetCore.sha256Hex=s=>{calls++;return hash(s);};
const N=2000000,counts={},vectors={},community=[];let rejections=0;
for(let i=0;i<N;i++){
 const seedid=id(i),is777=parseInt(hash(bh+seedid+'XCPETS:v2:naka777').slice(0,12),16)%777===0;
 if(is777){if(community.length<5)community.push(seedid);continue;}
 const before=calls,t=V.rareTicket(V.rareSeed(bh,seedid),'bucket',V.RARE_D);if(calls-before>1)rejections++;
 const k=V.rareBucket(t);if(k){counts[k]=(counts[k]||0)+1;if(!vectors[k])vectors[k]=seedid;}
}
for(const [k,w]of V.RARE_BUCKETS){const expected=N*776/777*w/V.RARE_D;ok(()=>assert(Math.abs((counts[k]||0)-expected)<6*Math.sqrt(expected)+2,k+' frequency '+counts[k]+' expected '+expected));ok(()=>assert(vectors[k]));}
ok(()=>assert(rejections>0));
// Real naturally found vectors: every outcome through normal and Electric paths.
for(const [kind,seedid]of Object.entries(vectors)){
 const a=V.hatchArt(bh,seedid,G),z=V.electricArt(bh,seedid,G);ok(()=>assert.strictEqual(a.rareHatch.kind,kind));ok(()=>same(a.rareHatch,z.rareHatch));ok(()=>same(V.hatchArt(bh,seedid,G),a));
 ok(()=>assert(!a.contest&&!a.community));
 if(['wizard','kek','djpepe'].includes(kind))ok(()=>assert(a.tierIndex===2||a.tierIndex===3));
 if(kind==='god'){ok(()=>assert.strictEqual(a.species,'starlordkek'));ok(()=>assert.strictEqual(a.tierIndex,3));}
 if(kind==='wrong-egg'){
  ok(()=>assert.notStrictEqual(a.species,a.rareHatch.expected));ok(()=>assert(V.rareOrdinaryPool(a.tierIndex,G).some(q=>q.id===a.species)));
 }
 if(V.RARE_BUCKETS.slice(4).some(([k])=>k===kind)){
  V._setRareEggsActivation(Infinity);const normal=V.hatchArt(bh,seedid,G);V._setRareEggsActivation(G);
  ok(()=>same(a.baseStats,normal.baseStats));ok(()=>assert.strictEqual(a.tierIndex,normal.tierIndex));if(kind!=='wrong-egg')ok(()=>assert.strictEqual(a.species,V.pickTierSpecies(hash(bh+seedid+'XCPETS:v2:tierspecies'),a.tierIndex,G)));
 }
 ok(()=>assert.notStrictEqual(a.species,'nakamoto'));
}
for(const seedid of community){V._setRareEggsActivation(Infinity);const normal=V.hatchArt(bh,seedid,G);V._setRareEggsActivation(G);ok(()=>same(normal,V.hatchArt(bh,seedid,G)));ok(()=>same(normal,V.electricArt(bh,seedid,G)));}
// Validated burns write provenance once; invalid burns and plain burns never create rare pets.
const r=row(G,'rare-test-owner',100,'pet:hatch');r.tx_hash=vectors.god;
V._setHalvingActivation(null);V._setFiresaleActivation(null);
const w=V.replay([r],{[G]:bh},[],{tip:G});
const born=w.pets.filter(p=>p.hatchTx===r.tx_hash);ok(()=>assert.strictEqual(born.length,1));ok(()=>same(born[0].rareHatch,born[0].art.rareHatch));ok(()=>assert(!born[0].contest));ok(()=>assert(w.pets.filter(p=>p.hatchTx!==r.tx_hash).every(p=>!p.rareHatch&&!p.art.rareHatch)));
const bad=Object.assign({},r,{status:'invalid'});ok(()=>assert.strictEqual(V.replay([bad],{[G]:bh},[],{tip:G}).pets.filter(p=>p.hatchTx===r.tx_hash).length,0));
V._setRareEggsActivation(Infinity);const beforeGate=V.replay([r],{[G]:bh},[],{tip:G});ok(()=>assert(!Object.hasOwn(beforeGate.pets.find(p=>p.hatchTx===r.tx_hash),'rareHatch')));ok(()=>assert(!Object.hasOwn(beforeGate.pets.find(p=>p.hatchTx===r.tx_hash).art,'rareHatch')));
// Chad alone joins the ordinary pool; no retired/community/contest species.
for(let t=0;t<4;t++)ok(()=>assert(V.rareOrdinaryPool(t,G).every(q=>q.id==='chad'||V.SPECIES12.some(s=>s.id===q.id))));
V._setRareEggsActivation(G);for(let t=0;t<4;t++){ok(()=>assert(!V.tierPool(t,G-1).some(s=>s.id==='chad')));ok(()=>assert.strictEqual(V.tierPool(t,G).find(s=>s.id==='chad').w,V.tierPool(t,G).find(s=>s.id==='chud').w));}
const out={checks,N,counts,rejections,bh,block:G,vectors};
if(process.env.RARE_AUDIT_OUT)fs.writeFileSync(process.env.RARE_AUDIT_OUT,JSON.stringify(out,null,2));
console.log('PASS '+checks+' rare hatch checks; '+N+' seeds; '+JSON.stringify(counts));
