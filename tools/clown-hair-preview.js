/* Preview ONLY. Not loaded by any game page or replay. */
'use strict';
const PC = require('../js/pet-core.js');
const BG = require('../js/bonus-gear.js');
const fs = require('fs');
const ITEM = {id:'clown-hair',label:'Clown Hair',includes:'red clown nose',slot:'head',tier:1,exclusive:false,origin:'peepo',weight:10};
// Honk 1107: matches owner reference (Honk Pepe). Big round rainbow puffs in
// red, yellow, green, blue + a round red clown nose, both in the same item.
// No orange. Each puff: base, shade (lower-right), white glint (upper-left).
const PUFF=[['#ff2a2a','#b3121c'],['#ffd23f','#c99a10'],['#3fcf4f','#21893a'],['#2f7bff','#1b47b8']];
const INK='#1a1020';
function wig(img,a,stage) {
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
  const R=stage<2?2.2:stage<4?3.2:4.2;      // puff radius by stage
  const cx=(hl+hr)/2, ax=(hr-hl)/2+R*0.9, ay=R*1.6, ecy=Math.min(eyeTop-1,headTop+R*1.2);
  // puff centres on an arc over the head, from one temple to the other, overlapping (spacing ~1.3R)
  const C=[]; const A0=Math.PI*1.08, A1=-0.08*Math.PI; const arc=Math.PI*(ax+ay)/2; const n=Math.max(4,Math.round(arc/(R*1.25)));
  for(let i=0;i<n;i++){const t=A0+(A1-A0)*i/(n-1); C.push([cx+Math.cos(t)*ax, ecy-Math.sin(t)*ay, i%4]);}
  // lower side puffs bulging out beside the face (reference: big puffs down both cheeks)
  C.push([hl-R*0.5,ecy+R*0.9,1]); C.push([hr+1+R*0.5,ecy+R*0.9,2]);
  const own=new Map();
  for(let y=0;y<=30;y++)for(let x=0;x<32;x++){
    const k=y*W+x; if(keep.has(k)) continue; if(y>=eyeTop-1&&a.isSil(x,y)) continue; if(y>ey+1) continue;
    let best=-1,bd=1e9; C.forEach(([px,py],i)=>{const d=(x+0.5-px)**2+(y+0.5-py)**2; if(d<bd){bd=d;best=i;}});
    const inPuff=bd<=R*R+0.5;
    const inFill=((x+0.5-cx)/ax)**2+((y+0.5-ecy)/ay)**2<=1 && y>=ecy-ay+R*0.5;
    if(!inPuff&&!inFill) continue;
    const [px,py,ci]=C[best]; own.set(k,[ci,x+0.5-px,y+0.5-py,R]);
  }
  function put(x,y,c){if(x<0||x>31||y<0||y>31)return;const q=(y*32+x)*4,h=c.slice(1);img.data[q]=parseInt(h.slice(0,2),16);img.data[q+1]=parseInt(h.slice(2,4),16);img.data[q+2]=parseInt(h.slice(4,6),16);img.data[q+3]=255;}
  // outline: outside the union, not on the face
  for(const k of own.keys()){const x=k%W,y=(k-x)/W;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=ny*W+nx;
    if(nx<0||nx>31||ny<0||ny>30||own.has(nk)||keep.has(nk))continue; if(a.isSil(nx,ny)&&ny>=eyeTop-2)continue; put(nx,ny,INK);}}
  for(const [k,[ci,dx,dy,r]] of own){const x=k%W,y=(k-x)/W;
    let c=PUFF[ci][0]; if(dx+dy>r*0.7) c=PUFF[ci][1]; if(r>=3&&dx<-r*0.2&&dy<-r*0.2&&dx>-r*0.75&&dy>-r*0.75&&((x+y)&1)===0) c='#ffffff';
    put(x,y,c);}
  // seams between neighbouring clusters of different colours
  for(const [k,[ci]] of own){const x=k%W,y=(k-x)/W,n=own.get(k+W); if(n&&n[0]!==ci&&R>=3) put(x,y+1,PUFF[n[0]][1]);}
  nose(img,a,stage,eyes,ey,put);
  return img;
}
// Round red clown nose: same item as the hair. Face centre between the eyes,
// just below them; one-eyed (side-view) faces get it on the snout front.
function nose(img,a,stage,eyes,ey,put){
  const s=stage<2?2:stage<4?3:4; let eb=ey; for(const e of eyes) for(const p of e[2]) eb=Math.max(eb,p[1]); let nx,ny=eb+1+Math.floor(s/2);
  if(eyes.length===2) nx=Math.round((a.eyeL[0]+a.eyeR[0])/2);
  else if(eyes.length===1){const e=eyes[0]; let x=e[0]; const dir=e[0]<16?-1:1; while(a.isSil(x+dir,ey+1)) x+=dir; nx=x-dir*Math.floor(s/2);}
  else return;
  // shape templates (R=red, D=dark red, W=glint, K=ink)
  const T={2:['RR','RD'],3:['.R.','WRR','.DD'],4:['.RR.','RWRR','RRRD','.DD.']}[s];
  const RED={R:'#ff1f2d',D:'#a80f1a',W:'#ffffff',K:'#ff1f2d'};
  if(s===2){T[0]='RR';T[1]='RD';}
  const ox=nx-Math.floor(s/2), oy=ny-Math.floor(s/2)+ (s>=3?0:0);
  const eyeSet=new Set(); for(const e of eyes) for(const [x,y] of e[2]) eyeSet.add(y*32+x);
  let dy=0; while(dy<3){let hit=false;for(let y=0;y<s;y++)for(let x=0;x<s;x++) if(T[y][x]!=='.'&&eyeSet.has((oy+dy+y)*32+ox+x))hit=true; if(!hit)break; dy++;}
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){const c=T[y][x]; if(c!=='.') put(ox+x,oy+dy+y,RED[c]);}
  if(s>=3) for(let y=-1;y<=s;y++)for(let x=-1;x<=s;x++){const inT=y>=0&&x>=0&&y<s&&x<s&&T[y][x]!=='.'; if(inT)continue;
    const nb=[[0,1],[1,0],[0,-1],[-1,0]].some(([u,v])=>{const yy=y+v,xx=x+u;return yy>=0&&xx>=0&&yy<s&&xx<s&&T[yy][xx]!=='.';});
    if(nb&&!eyeSet.has((oy+dy+y)*32+ox+x)) put(ox+x,oy+dy+y,'#3a0a10');}
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
module.exports={ITEM,wig,nose};
