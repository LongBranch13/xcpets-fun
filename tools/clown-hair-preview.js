/* Preview ONLY. Not loaded by any game page or replay. */
'use strict';
const PC = require('../js/pet-core.js');
const BG = require('../js/bonus-gear.js');
const fs = require('fs');
const SPECIAL=Object.fromEntries(['homer','wizard','kek','funtrump','rabbit'].map(id=>[id,require('../js/'+id+'-sprite.js')]));
// Explicit stage fittings: [horizontal shift, vertical shift, width factor, puff factor].
const FIT={
peepo:[[0,0,1,1],[0,0,.96,1],[0,0,.96,1],[0,1,.95,1],[0,1,.95,1]],
pepe:[[0,0,.96,1],[0,0,1,1],[0,0,1,1],[0,1,1,1],[0,1,1,1]],
wojak:[[0,1,.85,1],[0,1,.9,1],[0,1,.9,1],[0,2,.9,.95],[0,2,.9,.95]],
doge:[[-1,1,.85,.9],[-1,1,.9,.95],[-1,1,.9,1],[-1,1,.9,1],[-1,2,.9,1]],
chud:[[0,1,.9,1],[0,1,.9,1],[0,1,.95,1],[0,1,.95,1],[0,2,.95,1]],
bobo:[[0,1,1,1],[0,1,1,1],[0,1,1,1],[0,1,1,1],[0,2,1,1]],
mumu:[[0,1,.9,1],[0,1,.95,1],[0,1,1,1],[0,1,1,1],[0,2,1,1]],
snibby:[[0,1,.85,.9],[0,1,.9,1],[0,1,.95,1],[0,1,1,1],[0,2,1,1]],
dodo:[[-1,0,.9,1],[-1,0,.9,1],[-1,0,.9,1],[-1,1,.9,.9],[-1,1,.9,.85]],
kevin:[[0,1,.95,1],[0,1,1,1],[0,1,1,1],[0,2,1,1],[0,2,1,1]],
sarutobi:[[0,1,1,1],[0,1,1,1],[0,1,1,1],[0,1,1,1],[0,2,1,1]],
lenny:[[0,1,.95,1],[0,1,.95,1],[0,1,1,1],[0,1,1,1],[0,2,1,1]],
homer:[[-2,2,.85,.9],[-2,2,.85,1],[-2,2,.85,.95],[-2,2,.85,.8],[-2,2,.85,.75]],
wizard:[[0,1,.9,1],[0,1,.9,1],[0,1,.9,1],[0,2,.9,1],[0,2,.9,1]],
kek:[[0,1,.9,1],[0,1,.9,1],[0,1,.9,1],[0,2,.9,1],[0,2,.9,1]],
funtrump:[[0,1,.95,1],[0,1,.95,1],[0,1,1,1],[0,2,1,1],[0,2,1,1]],
rabbit:[[0,1,.9,1],[0,1,.9,1],[0,1,.9,1],[0,2,.9,1],[0,2,.9,1]]
};
// Nose-only fittings: [left, top, size] on the actual snout, not the eye midpoint.
// Stage zero remains an unequipped egg. These do not alter any hair anchors.
const NOSE_FIT={
 funtrump:[[17,23,2],[16,21,3],[16,20,3],[16,19,3],[16,19,3]],
 homer:[[20,19,2],[19,17,3],[19,15,3],[19,14,4],[20,13,4]],
 rabbit:[[20,18,2],[20,16,3],[21,14,3],[21,12,4],[21,11,4]],
 wizard:[[17,18,2],[16,16,3],[15,13,3],[15,12,3],[15,12,3]],
 chud:[[15,20,2],[17,20,3],[17,19,3],[18,18,3],[18,18,3]],
 wojak:[[15,21,2],[17,20,3],[17,19,3],[18,18,3],[18,18,3]],
 peepo:[[17,20,2],[17,19,3],[17,17,3],[17,16,3],[17,16,3]]
};
function noseFit(species,stage,frame){
 const q=NOSE_FIT[species]&&NOSE_FIT[species][stage-1];
 if(!q)return null;
 const bob=SPECIAL[species]?(frame===1?-1:0):([0,-1,-1,0][frame]);
 return [q[0],q[1]+bob,q[2]];
}
const ITEM = {id:'clown-hair',label:'Clown Hair',includes:'red clown nose',slot:'head',tier:1,exclusive:false,origin:'peepo',weight:10};
// Honk 1107: matches owner reference (Honk Pepe). Big round rainbow puffs in
// red, yellow, green, blue + a round red clown nose, both in the same item.
// No orange. Each puff: base, shade (lower-right), white glint (upper-left).
const PUFF=[['#ff2a2a','#b3121c'],['#ffd23f','#c99a10'],['#3fcf4f','#21893a'],['#2f7bff','#1b47b8']];
const INK='#1a1020';
function wig(img,a,stage,species) {
  const fit=FIT[species][stage-1];
  const W=32, eyes=[a.eyeL,a.eyeR].filter(Boolean);
  const ey=eyes.length?Math.min(...eyes.map(e=>e[1])):a.minY+5;
  let eyeTop=ey; for(const e of eyes) for(const p of e[2]) eyeTop=Math.min(eyeTop,p[1]);
  // keep-out: every eye pixel and a 1px ring around it
  const keep=new Set(); for(const e of eyes) for(const [x,y] of e[2]) for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++) keep.add((y+dy)*W+x+dx);
  // head span on rows above the eyes, limited to the eyes' span (+margin) so beaks/snouts stay bare
  let hl=99,hr=-1; for(let y=a.minY;y<eyeTop;y++) for(let x=0;x<W;x++) if(a.isSil(x,y)){hl=Math.min(hl,x);hr=Math.max(hr,x);}
  if(hr<0) return img;
  const m=stage<2?3:stage<4?4:5;
  if(eyes.length===2){hl=Math.max(hl,a.eyeL[0]-m);hr=Math.min(hr,a.eyeR[0]+m);}
  else if(eyes.length===1){hl=Math.max(hl,eyes[0][0]-m-2);hr=Math.min(hr,eyes[0][0]+m+2);}
  let headTop=99; for(let x=hl;x<=hr;x++) for(let y=0;y<eyeTop;y++) if(a.isSil(x,y)){headTop=Math.min(headTop,y);break;}
  const R=(stage<2?2.4:stage<4?3.3:4)*fit[3];      // puff radius by stage
  const cx=Math.max(R+2,Math.min(29-R,(hl+hr)/2+fit[0]));
  const ax=Math.min(((hr-hl)/2+R*.55)*fit[2],cx-R-1.5,30.5-cx-R), ay=R*1.05;
  const ecy=Math.max(1.5+ay+R,Math.min(eyeTop-1,headTop+R*1.2)+fit[1]);
  // puff centres on an arc over the head, from one temple to the other, overlapping (spacing ~1.3R)
  const C=[]; const A0=Math.PI*1.08, A1=-0.08*Math.PI; const arc=Math.PI*(ax+ay)/2; const n=Math.max(4,Math.ceil(arc/(R*.88)));
  for(let i=0;i<n;i++){const t=A0+(A1-A0)*i/(n-1); C.push([cx+Math.cos(t)*ax, ecy-Math.sin(t)*ay, i%4]);}
  // lower side puffs bulging out beside the face (reference: big puffs down both cheeks)
  C.push([cx-ax*.9,ecy+R*.35,(species==='dodo'||species==='homer')?0:1]); C.push([cx+ax*.9,ecy+R*.35,2]);
  const own=new Map();
  for(let y=0;y<=30;y++)for(let x=0;x<32;x++){
    const k=y*W+x; const hair=a.hair&&a.hair.has(k); if(keep.has(k)&&!hair) continue; if(!hair&&y>=eyeTop-1&&a.isSil(x,y)) continue; if(!hair&&y>ey+1&&!(species==='kevin'&&y<=(a.hairBottom||ey)+1&&Math.abs(x-cx)>Math.max(2,(hr-hl)/2-1))) continue;
    let best=-1,bd=1e9; C.forEach(([px,py],i)=>{const d=(x+0.5-px)**2+(y+0.5-py)**2; if(d<bd){bd=d;best=i;}});
    const inPuff=bd<=R*R+0.5;
    const inFill=((x+0.5-cx)/ax)**2+((y+0.5-ecy)/ay)**2<=1 && y>=ecy-ay+R*0.5;
    if(!inPuff&&!inFill) continue;
    const [px,py,ci]=C[best]; own.set(k,[ci,x+0.5-px,y+0.5-py,R]);
  }
  function put(x,y,c){if(x<0||x>31||y<0||y>31)return;const q=(y*32+x)*4,h=c.slice(1);img.data[q]=parseInt(h.slice(0,2),16);img.data[q+1]=parseInt(h.slice(2,4),16);img.data[q+2]=parseInt(h.slice(4,6),16);img.data[q+3]=255;}
  // Removing Kevin's grey bob is part of wearing this wig, not a change
  // to Kevin's base art. Re-outline the exposed face rather than colouring
  // the old straight locks rainbow: the replacement stays round and puffy.
  if(a.hair)for(const k of a.hair){const x=k%32,y=k>>5;
    const edge=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>a.isSil(x+dx,y+dy)&&!a.hair.has((y+dy)*32+x+dx));
    put(x,y,edge&&y>=eyeTop-1?INK:'#14101e');
  }
  // Close raster cracks without adding dark seams between the puffs.
  for(let y=0;y<31;y++)for(let x=1;x<31;x++){
    const k=y*W+x;if(own.has(k)||keep.has(k))continue;
    if(own.has(k-1)&&own.has(k+1))own.set(k,own.get(k-1));
  }
  // Pixel rasterisation can leave a 1-2 pixel fringe beyond an eye keep-out.
  // Remove stray fringe; old Kevin side-lock pixels instead join the wig by
  // the shortest eye-safe seam, so no old grey hair survives beneath it.
  const todo=new Set(own.keys()),parts=[];
  while(todo.size){const q=[todo.values().next().value],part=[];todo.delete(q[0]);
    while(q.length){const k=q.pop();part.push(k);
      for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){
        const n=k+dy*32+dx;if(Math.abs(n%32-k%32)<=1&&todo.has(n)){todo.delete(n);q.push(n);}
      }
    }parts.push(part);
  }
  parts.sort((a,b)=>b.length-a.length);
  const main=new Set(parts[0]||[]);
  for(const part of parts.slice(1)){
    if(!part.some(k=>a.hair&&a.hair.has(k))){part.forEach(k=>own.delete(k));continue;}
    const q=part.slice(),prev=new Map(q.map(k=>[k,null]));let end=null;
    while(q.length&&end===null){const k=q.shift();
      for(const d of [-32,-1,1,32]){const n=k+d,x=n%32,y=n>>5;
        if(x<0||x>31||y<0||y>30||Math.abs(x-k%32)>1||keep.has(n)||prev.has(n))continue;
        prev.set(n,k);if(main.has(n)){end=n;break;}q.push(n);
      }
    }
    while(end!==null){if(!own.has(end))own.set(end,own.get(part[0]));main.add(end);end=prev.get(end);}
    part.forEach(k=>main.add(k));
  }
  // Homer's two original scalp curls (and their old Mythic rim) must not
  // float above a wig fitted to his bald dome.
  if(species==='homer'&&own.size){
    for(let y=0;y<eyeTop-2;y++)for(let x=0;x<32;x++)if(!keep.has(y*32+x))put(x,y,'#14101e');
  }
  // outline: outside the union, not on the face
  for(const k of own.keys()){const x=k%W,y=(k-x)/W;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=ny*W+nx;
    if(nx<0||nx>31||ny<0||ny>30||own.has(nk)||keep.has(nk))continue; if(a.isSil(nx,ny)&&ny>=eyeTop-2)continue; put(nx,ny,INK);}}
  for(const [k,[ci,dx,dy,r]] of own){const x=k%W,y=(k-x)/W;
    let c=PUFF[ci][0]; if(dx+dy>r*0.7) c=PUFF[ci][1]; if(r>=3&&dx<-r*0.2&&dy<-r*0.2&&dx>-r*0.75&&dy>-r*0.75&&((x+y)&1)===0) c='#ffffff';
    put(x,y,c);}
  // seams between neighbouring clusters of different colours
  for(const [k,[ci]] of own){const x=k%W,y=(k-x)/W,n=own.get(k+W); if(n&&n[0]!==ci&&R>=3) put(x,y+1,PUFF[n[0]][1]);}
  img.clownHair=[...own.keys()];
  nose(img,a,stage,eyes,ey,put);
  return img;
}
// Round red clown nose: same item as the hair. Face centre between the eyes,
// just below them; one-eyed (side-view) faces get it on the snout front.
function nose(img,a,stage,eyes,ey,put){
  const s=a.noseFit?a.noseFit[2]:(stage<2?2:stage<4?3:4); let eb=ey; for(const e of eyes) for(const p of e[2]) eb=Math.max(eb,p[1]); let nx,ny=eb+1+Math.floor(s/2);
  if(eyes.length===2) nx=Math.round((a.eyeL[0]+a.eyeR[0])/2);
  else if(eyes.length===1){const e=eyes[0]; let x=e[0]; const dir=e[0]<16?-1:1; while(a.isSil(x+dir,ey+1)) x+=dir; nx=x-dir*Math.floor(s/2);}
  else return;
  // shape templates (R=red, D=dark red, W=glint, K=ink)
  const T={2:['RR','RD'],3:['.R.','WRR','.DD'],4:['.RR.','RWRR','RRRD','.DD.']}[s];
  const RED={R:'#ff1f2d',D:'#a80f1a',W:'#ffffff',K:'#ff1f2d'};
  if(s===2){T[0]='RR';T[1]='RD';}
  const ox=a.noseFit?a.noseFit[0]:nx-Math.floor(s/2), oy=a.noseFit?a.noseFit[1]:ny-Math.floor(s/2);
  const eyeSet=new Set(); for(const e of eyes) for(const [x,y] of e[2]) eyeSet.add(y*32+x);
  let dy=0; while(!a.noseFit&&dy<3){let hit=false;for(let y=0;y<s;y++)for(let x=0;x<s;x++) if(T[y][x]!=='.'&&eyeSet.has((oy+dy+y)*32+ox+x))hit=true; if(!hit)break; dy++;}
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){const c=T[y][x]; if(c!=='.'&&(!a.noseFit||!eyeSet.has((oy+dy+y)*32+ox+x))) put(ox+x,oy+dy+y,RED[c]);}
  if(s>=3) for(let y=-1;y<=s;y++)for(let x=-1;x<=s;x++){const inT=y>=0&&x>=0&&y<s&&x<s&&T[y][x]!=='.'; if(inT)continue;
    const nb=[[0,1],[1,0],[0,-1],[-1,0]].some(([u,v])=>{const yy=y+v,xx=x+u;return yy>=0&&xx>=0&&yy<s&&xx<s&&T[yy][xx]!=='.';});
    if(nb&&!eyeSet.has((oy+dy+y)*32+ox+x)) put(ox+x,oy+dy+y,'#3a0a10');}
}
// Offline adapters. None of these functions is loaded on a game page.
function render(species,stage,f,bg='#14101e',hairKey=false){
 const S=SPECIAL[species];if(S)return S.render(stage,f,bg,{},{});
 const pet=PC.generate({blockHash:'a'.repeat(64),petId:'clown-preview',blockHeight:974900});
 Object.assign(pet,{species,background:'solid',bgColor:bg,pattern:'none'});
 const sp=PC.SPECIES.find(s=>s.id===species), old=sp.colors;
 if(hairKey)sp.colors=Object.assign({},old,{'3':'#ff00fe','4':'#ff00fe','5':'#ff00fe'});
 try{return PC.render(pet,{stage,frame:f,gearOverride:{}});}finally{sp.colors=old;}
}
function anchor(species,stage,f){
 const sp=PC.SPECIES.find(s=>s.id===species), S=SPECIAL[species];
 if(!S){
  const pet=PC.generate({blockHash:'a'.repeat(64),petId:'clown-preview',blockHeight:974900});
  Object.assign(pet,{species,background:'solid',bgColor:'#ff00ff',pattern:'none'});
  const a=BG.anchors(PC.render(pet,{stage,frame:f,gearOverride:{}}),PC.render(Object.assign({},pet,{eyes:'star'}),{stage,frame:f===2?0:f,gearOverride:{},openEyes:true}),sp);
  if(species==='kevin'){
    const h=render(species,stage,f,'#14101e',true);a.hair=new Set();
    for(let k=0;k<1024;k++)if(h.data[k*4]===255&&h.data[k*4+1]===0&&h.data[k*4+2]===254)a.hair.add(k);
    a.hairBottom=Math.max(...[...a.hair].map(k=>k>>5));
  }a.noseFit=noseFit(species,stage,f);return a;
 }
 const gf=(species==='homer'||species==='rabbit'||species==='funtrump')&&f===2?0:f;
 const g=S.draw(stage,gf,{}),sil=S.draw(stage,f,{}),pts=[];
 let minY=99,maxY=-1,minX=99,maxX=-1;
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  if(sil[y][x]){minY=Math.min(minY,y);maxY=Math.max(maxY,y);minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
  if((species==='wizard'?g[y][x]==='k':['E','P'].includes(g[y][x]))&&!(species==='kek'&&y<9))pts.push([x,y]);
 }
 const mid=pts.length?(Math.min(...pts.map(p=>p[0]))+Math.max(...pts.map(p=>p[0])))/2:16;
 const eye=p=>p.length?[Math.round(p.reduce((s,q)=>s+q[0],0)/p.length),Math.round(p.reduce((s,q)=>s+q[1],0)/p.length),p]:null;
 return {noseFit:noseFit(species,stage,f),minY,maxY,minX,maxX,eyeL:eye(pts.filter(p=>p[0]<=mid)),eyeR:eye(pts.filter(p=>p[0]>mid)),isSil:(x,y)=>!!(sil[y]&&sil[y][x])};
}
function build(){
 const out=[];
 const speciesList=(process.env.SPECIES||Object.keys(FIT).join(',')).split(',');
 for(const species of speciesList)for(let stage=0;stage<=5;stage++){
  const frames=[],bare=[];
  for(let f=0;f<4;f++){
   const img=render(species,stage,f);bare.push(Array.from(img.data));
   if(stage)wig(img,anchor(species,stage,f),stage,species);
   frames.push(Array.from(img.data));
  }out.push({species,stage,frames,bare});
 }
 fs.writeFileSync(process.argv[2]||'/tmp/clown-hair-frames.json',JSON.stringify({item:ITEM,out}));
}
if(require.main===module)build();
module.exports={ITEM,FIT,wig,nose,render,anchor};
