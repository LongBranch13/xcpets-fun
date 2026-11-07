'use strict';
const assert=require('assert'), fs=require('fs'),path=require('path'),crypto=require('crypto');
const {load}=require('./lib/load-rules');
const c=load(['js/wizard-sprite.js','js/kek-sprite.js','js/funtrump-sprite.js','js/homer-sprite.js','js/rabbit-sprite.js','js/djpepe-sprite.js','js/viking-sprite.js','js/contest-sprite.js']);
c.document.readyState='loading';c.document.head={appendChild(){}};c.setInterval=()=>0;c.clearInterval=()=>{};require('vm').runInContext(fs.readFileSync(path.join(__dirname,'../js/v2-render.js'),'utf8'),c);
const V=c.V2Rules,R=c.V2Render,G=1000000,bh='a'.repeat(64),id=n=>n.toString(16).padStart(64,'0');
c.PetCore.sha256Hex=s=>crypto.createHash('sha256').update(String(s)).digest('hex');V._setRareEggsActivation(G);
const manifest={block:G,bh,outcomes:{}};let checks=0;function ok(f){f();checks++;}
let vectors=process.env.RARE_VECTOR_FILE&&JSON.parse(fs.readFileSync(process.env.RARE_VECTOR_FILE)).vectors;
if(!vectors){vectors={};for(let i=0;Object.keys(vectors).length<11;i++){const q=id(i);if(parseInt(c.PetCore.sha256Hex(bh+q+'XCPETS:v2:naka777').slice(0,12),16)%777===0)continue;const k=V.rareBucket(V.rareTicket(V.rareSeed(bh,q),'bucket',V.RARE_D));if(k&&!vectors[k])vectors[k]=q;}}
let gearIDs=['beanie','sunglasses','hoodie'];
for(const [kind,seed]of Object.entries(vectors)){
 const art=V.hatchArt(bh,seed,G), out=[];
 for(let stage=0;stage<=5;stage++){
  const p={id:42,art,species:art.species,stage,hatchBlock:G,rareHatch:art.rareHatch}, w={items:{},tip:G,byId:{42:p}};
  const fr=R.petFramesRaw(p,w,{noHunger:true});
  ok(()=>assert(fr.length>=4));for(const f of fr){ok(()=>assert.strictEqual(f.data.length,4096));ok(()=>assert(f.data.some(n=>n>0)));if(f.rareScene)ok(()=>assert.strictEqual(f.rareScene.data.length,16384));}
  const native=fr[0].rareScene||fr[0];out.push({stage,width:native.width||32,height:native.height||32,data:Array.from(native.data),thumbnail:Array.from(fr[0].data),control:Array.from(R.petFramesRaw(Object.assign({},p,{art:Object.assign({},art,{rareHatch:null})}),w,{noHunger:true})[0].data)});
  const gear=V.GEAR_BY_ID;const usable=Object.values(gear).filter(g=>g&&g.id&&g.slot).slice(0,3);
  for(let j=0;j<usable.length;j++){const g=usable[j];w.items['g'+j]={gid:'g'+j,item:g.id,slot:g.slot,tier:0,on:42,owner:'preview'};}
  const dressed=R.petFramesRaw(p,w,{noHunger:true});ok(()=>assert(dressed.every(f=>f.data.length===4096)));
 }
 manifest.outcomes[kind]={seed,art:{species:art.species,tier:art.tierIndex,rareHatch:art.rareHatch},stages:out};
}
// Pixel-level contracts, not merely nonempty frame buffers.
const ghost=manifest.outcomes.ghost.stages[3].data;ok(()=>assert(ghost.some((v,i)=>i%4===3&&v===97)));ok(()=>assert(ghost.some((v,i)=>i%4===3&&v===255)));
const inv=manifest.outcomes.inverted.stages[3],ic=inv.control;let neg=0;
for(let i=0;i<4096;i+=4)if(inv.data[i]===255-ic[i]&&inv.data[i+1]===255-ic[i+1]&&inv.data[i+2]===255-ic[i+2]&&inv.data[i+3]===ic[i+3])neg++;
ok(()=>assert(neg>20));
for(const kind of ['tiny','backwards'])ok(()=>assert.notStrictEqual(JSON.stringify(manifest.outcomes[kind].stages[3].data),JSON.stringify(manifest.outcomes[kind].stages[3].control)));
const directArt=V.hatchArt(bh,vectors.giant,G),direct=R.framesWith(directArt,3,[],[],0)[0];ok(()=>assert(direct.rareScene&&direct.rareScene.width===64));
// Native size difference is represented by an explicit scene, not an overflow or malformed frame.
ok(()=>assert.strictEqual(manifest.outcomes.giant.stages[3].width,64));ok(()=>assert.strictEqual(manifest.outcomes['two-headed'].stages[3].width,64));
// A God shell is not a contest award or resurrection state.
const god=V.hatchArt(bh,vectors.god,G);ok(()=>assert(!god.contest&&!god.resurrected&&!god.god));
if(process.env.RARE_RENDER_OUT)fs.writeFileSync(process.env.RARE_RENDER_OUT,JSON.stringify(manifest));
console.log('PASS '+checks+' outcome/stage/frame/gear rendering assertions');
