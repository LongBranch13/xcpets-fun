const fs=require('fs'),vm=require('vm'),{createCanvas,ImageData}=require('@napi-rs/canvas');
// Offline art regression and optional desktop/phone preview compositor.
// npm install --prefix /tmp/zmeal-canvas @napi-rs/canvas
// NODE_PATH=/tmp/zmeal-canvas/node_modules node tools/zombie-meal-anim-test.js [output-dir]
const path=require('path'), assert=require('assert'), crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const el=()=>({style:{},dataset:{},classList:{add(){},remove(){}},appendChild(){},setAttribute(){},addEventListener(){}});
const document={createElement:t=>t==='canvas'?createCanvas(32,32):el(),getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},head:el(),body:el(),documentElement:el()};
const ctx={MutationObserver:class{observe(){}},console,document,ImageData,Uint8ClampedArray,URLSearchParams,URL,TextEncoder,TextDecoder,location:{search:'',hostname:'localhost',href:'http://localhost/'},navigator:{userAgent:'node'},localStorage:{getItem:()=>null,setItem(){}},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},addEventListener(){},matchMedia:()=>({matches:false}),innerWidth:1280};ctx.window=ctx;ctx.self=ctx;vm.createContext(ctx);
const load=f=>vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),ctx,{filename:f});
for(const f of ['rjs/config.js','rjs/pet-core.js','rjs/game-core.js','rjs/bonus-gear.js','rjs/real-core.js','rjs/chain.js'])load(f);
ctx.LiveEngine={RealCore:ctx.RealCore};
for(const f of ['js/pet-core.js','js/bonus-gear.js','js/v2-gear.js','js/v2-fit.js','js/v2-rules.js','js/block-hashes.js','js/v2-render.js','js/v2-zombie-look.js'])load(f);
let snap=JSON.parse(fs.readFileSync(root+'/tools/snapshots/snap-972901.json'));let w=ctx.V2Rules.replay(snap.rows,Object.assign({},ctx.XCPETS_BLOCK_HASHES,snap.hashes),[],{tip:snap.tip,live:ctx.RealCore});
load('js/v2-cem-anim.js');
const R=ctx.V2Render, original=R.framesWith, originalZ=ctx.V2ZombieLook.transparent;
let calls=[], zcalls=0;
R.framesWith=function(art,stage,ids){calls.push({sp:art.species,stage,ids});return original.apply(this,arguments)};
R.paint=()=>{throw new Error('Card-only paint must never be used for scene sprites')};
ctx.V2ZombieLook.transparent=function(){zcalls++;return originalZ.apply(this,arguments)};
const out=process.argv[2]; if(out)fs.mkdirSync(out,{recursive:true});
const fixtures=[['wojak',5],['doge',4],['dodo',2],['snibby',3]];
const hashes=[]; let checks=0;
for(const [sp,stage] of fixtures){
  const src=w.pets.find(p=>p.art.species===sp);assert(src,sp+' fixture');
  // Synthetic preview stage/gear, not a representation of a player's actual stats.
  const p=Object.assign({},src,{stage,zombie:{raisedAt:1},art:Object.assign({},src.art)});
  const victims=w.pets.filter(v=>v.id!==p.id).slice(0,3);
  const gear={gid:'preview-hat',on:p.id,item:'v2-pepe-buckethat'};
  let world={byId:Object.assign({},w.byId,{[p.id]:p}),items:{preview:gear},tip:w.tip};
  const ev={kind:'zmeal',id:p.id,victims:victims.map(v=>v.id),preview:true};
  const c=createCanvas(640,400);calls=[];ctx.V2CemAnim.paint(c,ev,12,world);
  assert(calls.some(c=>c.sp===sp&&c.stage===stage&&c.ids.includes(gear.item)),'real stage and gear passed');checks++;
  const geared = c.toBuffer('image/png'); hashes.push(crypto.createHash('sha256').update(geared).digest('hex'));
  // Cache invalidates when worn gear changes, when the same pet arrives in a fresh replayed world.
  world=Object.assign({},world,{items:{}});calls=[];ctx.V2CemAnim.paint(c,ev,12,world);
  assert(calls.some(c=>c.sp===sp&&c.ids.length===0),'gear removal invalidates sprite');checks++;
  assert(!geared.equals(c.toBuffer('image/png')),'worn gear changes actual pixels');checks++;
  world=Object.assign({},world,{items:{preview:gear}});
  for(const [width,height,scale] of [[1280,720,5],[390,844,2]]){
    const scene=createCanvas(128*scale,80*scale), poster=createCanvas(width,height),g=poster.getContext('2d');
    const x=(width-scene.width)/2,y=width===390?260:155;
    if(out)fs.mkdirSync(path.join(out,sp+'-'+width+'-frames'),{recursive:true});
    for(let f=0;f<60;f++){
      ctx.V2CemAnim.paint(scene,ev,f,world);
      if(!out)continue;
      g.fillStyle='#0b0918';g.fillRect(0,0,width,height);g.imageSmoothingEnabled=false;
      g.fillStyle='#ffc93c';g.textAlign='center';g.font=(width===390?15:24)+'px monospace';g.fillText('ZOMBIE MEAL',width/2,y-52);
      g.fillStyle='#a7a5be';g.font=(width===390?12:17)+'px monospace';g.fillText(sp.toUpperCase()+' / STAGE '+stage+' / GEAR ON',width/2,y-24);
      g.fillStyle='#000';g.fillRect(x-4,y-4,scene.width+8,scene.height+8);g.drawImage(scene,x,y);
      g.fillStyle='#b9ff9a';g.font=(width===390?12:18)+'px monospace';g.fillText('Discarded pets -> zombie meal',width/2,y+scene.height+32);
      g.fillStyle='#a7a5be';g.font='12px monospace';g.fillText('Art preview - synthetic fixture',width/2,y+scene.height+58);
      const buf=poster.toBuffer('image/png');fs.writeFileSync(path.join(out,sp+'-'+width+'-frames',String(f).padStart(3,'0')+'.png'),buf);
      if([0,12,27,54].includes(f))fs.writeFileSync(path.join(out,sp+'-'+width+'-f'+f+'.png'),buf);
    }
  }
}
assert.strictEqual(new Set(hashes).size,4,'four distinct species silhouettes');checks++;
assert(zcalls>=16,'existing zombie renderer used');checks++;
// The old silhouette generator and permanent error cache are gone.
assert(!fs.readFileSync(root+'/js/v2-cem-anim.js','utf8').includes('function fallback('));checks++;
console.log('PASS '+checks+' checks: real species/stages, worn gear/cache, raw frames despite throwing card painter, canonical zombie pass, distinct species, 60-frame 1280/390 painters.');
