/* Preview ONLY. Not loaded by any game page or replay. */
'use strict';
const PC = require('../js/pet-core.js');
const BG = require('../js/bonus-gear.js');
const fs = require('fs');
const ITEM = {id:'clown-hair',label:'Clown Hair',slot:'head',tier:1,exclusive:false,origin:'peepo',weight:10};
// Palette deliberately excludes orange. Red, yellow, mint, cyan, violet, pink.
const colors=['#ff2a2a','#ffd23f','#5fd35f','#6fe3ff','#8e44d1','#ff8fd0'];
function wig(img,a,stage) {
  // Refit 1107: hug the actual head outline column by column. No floating side curls.
  const ink='#1a1020', W=32;
  const ey=a.eyeL&&a.eyeR?Math.min(a.eyeL[1],a.eyeR[1]):a.eyeL?a.eyeL[1]:a.eyeR?a.eyeR[1]:a.minY+5;
  const eyeTop=(()=>{let t=ey;for(const e of [a.eyeL,a.eyeR])if(e)for(const p of e[2])t=Math.min(t,p[1]);return t;})();
  const limit=eyeTop-2; // last row the wig may touch: one clear row above the eyes
  // head width = silhouette extent on the row just above the eyes
  let hl=99,hr=-1; for(let y=a.minY;y<=limit;y++) for(let x=0;x<W;x++) if(a.isSil(x,y)){hl=Math.min(hl,x);hr=Math.max(hr,x);}
  if(hr<0) return img;
  // keep the wig on the cranium: clamp to the eyes' span so beaks/snouts/arms are not wigged
  const k=stage<2?3:stage<4?4:5;
  if(a.eyeL&&a.eyeR){hl=Math.max(hl,a.eyeL[0]-k);hr=Math.min(hr,a.eyeR[0]+k);}
  else if(a.eyeL||a.eyeR){const e=a.eyeL||a.eyeR;hl=Math.max(hl,e[0]-k-2);hr=Math.min(hr,e[0]+k+2);}
  const top=[]; for(let x=hl;x<=hr;x++){let t=-1;for(let y=0;y<=limit;y++)if(a.isSil(x,y)){t=y;break;}top[x]=t;}
  for(let x=hl;x<=hr;x++) if(top[x]<0) top[x]=top[x-1]>=0?top[x-1]:a.minY;
  // smooth envelope so ears/horn tips get one rounded puff instead of spikes
  const raw=top.slice(); for(let x=hl;x<=hr;x++){let m=raw[x];for(let d=-2;d<=2;d++)if(raw[x+d]!=null&&raw[x+d]>=0)m=Math.min(m,raw[x+d]);top[x]=m;}
  const thick=stage<2?2:stage<4?3:4, cap=stage<2?1:2;
  const mask=new Set(), key=(x,y)=>y*W+x;
  for(let x=hl;x<=hr;x++){
    const bump=((x-hl)%3===1)?1:0; // scalloped curls on the crown
    for(let y=Math.max(1,top[x]-thick-bump);y<=Math.min(limit,raw[x]+cap);y++) mask.add(key(x,y));
  }
  // puff one column past each side, hugging down the temples (stops above the eyes)
  for(const [x,n] of [[hl-1,hl],[hr+1,hr]]){ if(x<1||x>30) continue;
    for(let y=Math.max(1,top[n]-thick+1);y<=limit;y++) mask.add(key(x,y)); }
  function put(x,y,c){if(x<0||x>31||y<0||y>31)return;const q=(y*32+x)*4,h=c.slice(1);img.data[q]=parseInt(h.slice(0,2),16);img.data[q+1]=parseInt(h.slice(2,4),16);img.data[q+2]=parseInt(h.slice(4,6),16);img.data[q+3]=255;}
  // ink outline only on the outside (never over face pixels below the wig)
  for(const k of mask){const x=k%W,y=(k-x)/W;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;
    if(nx<0||nx>31||ny<0||mask.has(key(nx,ny)))continue; if(a.isSil(nx,ny)&&ny<=limit+1)continue; if(ny>limit)continue; put(nx,ny,ink);} }
  const L=hl-1,R=hr+1;
  for(const k of mask){const x=k%W,y=(k-x)/W;put(x,y,colors[Math.max(0,Math.min(5,Math.floor((x-L)*6/(R-L+1))))]);}
  // highlights on curl tips
  for(let x=hl;x<=hr;x++) if((x-hl)%3===1){const y=top[x]-thick-1+1; if(mask.has(key(x,y))) put(x,y,'#ffffff');}
  return img;
}
const out=[];
const SPECIES=(process.env.SPECIES||'peepo,pepe,wojak,doge,chud,bobo,mumu,snibby,dodo,kevin,sarutobi,lenny').split(',');
for(const species of SPECIES) for(let stage=0;stage<=5;stage++) {
 const pet=PC.generate({blockHash:'a'.repeat(64),petId:'clown-preview',blockHeight:974900});
 Object.assign(pet,{species,background:'solid',bgColor:'#14101e',pattern:'none'});
 const sp=PC.SPECIES.find(s=>s.id===species), frames=[];
 for(let f=0;f<4;f++) {
  const opts={stage,frame:f,gearOverride:{}};
  const img=PC.render(pet,opts);
  if(stage){const key=Object.assign({},pet,{bgColor:'#ff00ff'}),eyes=Object.assign({},key,{eyes:'star'});wig(img,BG.anchors(PC.render(key,opts),PC.render(eyes,opts),sp),stage);}
  frames.push(Array.from(img.data));
 }
 out.push({species,stage,frames});
}
fs.writeFileSync(process.argv[2]||'/tmp/clown-hair-frames.json',JSON.stringify({item:ITEM,out}));
module.exports={ITEM,wig};
