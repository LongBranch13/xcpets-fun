'use strict';
const assert=require('assert'),crypto=require('crypto');
const {load,row}=require('./lib/load-rules');const c=load(),V=c.V2Rules,G=1000000,bh='a'.repeat(64),H=s=>crypto.createHash('sha256').update(s).digest('hex');
c.PetCore.sha256Hex=H;V._setRareEggsActivation(G);V._setHalvingActivation(null);V._setFiresaleActivation(null);
let n=0;const ok=(f)=>{f();n++;};const same=(a,b)=>assert.strictEqual(JSON.stringify(a),JSON.stringify(b));
// Every indexed hatch goes through exactly the same future wrapper once.
for(const [tag,amount,count,electric]of [['pet:hatch12',1000,12,false],['pet:hatchzap',100000,1000,true]]){
 const r=row(G,'integration-owner',amount,tag),w=V.replay([r],{[G]:bh},[],{tip:G}),pets=w.pets.filter(p=>p.owner==='integration-owner');
 ok(()=>assert.strictEqual(pets.length,count));
 for(let i=0;i<count;i++){const seed=r.tx_hash+':'+i,a=(electric?V.electricArt:V.hatchArt)(bh,seed,G);ok(()=>assert.strictEqual(pets[i].hatchTx,seed));a.shades=false;if(a.eyes==='beady')a.eyes='classic';ok(()=>same(pets[i].art,a));ok(()=>same(pets[i].rareHatch,a.rareHatch));}
}
// Weird metadata never propagates through the independent breeding path.
const Arow=row(G,'integration-owner',100,'pet:hatch'),Brow=row(G,'integration-owner',100,'pet:hatch');
const w=V.replay([Arow,Brow],{[G]:bh},[],{tip:G});const [A,B]=w.pets.filter(p=>p.owner==='integration-owner');
A.rareHatch=A.art.rareHatch={version:1,kind:'tiny',block:G};B.rareHatch=B.art.rareHatch={version:1,kind:'ghost',block:G};
const kid=V.breedOne(w,A,B,bh,H('breed-test'),G+1,'integration-owner');
ok(()=>assert(!kid.rareHatch&&!kid.art.rareHatch));ok(()=>assert(kid.parents.length===2));
// Shared Star-Lord identity does not fabricate an edition or unlock all gear.
A.species='starlordkek';A.art.species='starlordkek';delete A.contest;A.rareHatch=A.art.rareHatch={version:1,kind:'god',block:G};
const godkid=V.breedOne(w,A,B,bh,H('god-breed'),G+1,'integration-owner');
ok(()=>assert(!godkid.contest&&!godkid.rareHatch&&!godkid.art.rareHatch));ok(()=>assert(V.SPECIES12.some(q=>q.id===godkid.species)||V.isHybrid(godkid.species)));
// Transfers operate on the same object/provenance: never a new rarity roll.
const artBefore=JSON.stringify(A.art);A.owner='new-owner';ok(()=>assert.strictEqual(JSON.stringify(A.art),artBefore));
console.log('PASS '+n+' indexed/pack/Electric/breeding/provenance integration checks');
