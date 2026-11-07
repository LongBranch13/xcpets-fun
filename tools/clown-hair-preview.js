/* Preview ONLY. Not loaded by any game page or replay. */
'use strict';
const PC = require('../js/pet-core.js');
const BG = require('../js/bonus-gear.js');
const fs = require('fs');
const ITEM = {id:'clown-hair',label:'Clown Hair',slot:'head',tier:1,exclusive:false,origin:'peepo',weight:10};
// Palette deliberately excludes orange. Red, yellow, mint, cyan, violet, pink.
const colors=['#ff2a2a','#ffd23f','#5fd35f','#6fe3ff','#8e44d1','#ff8fd0'];
function wig(img,a,stage) {
  // Use the same gearless silhouette anchors as BonusGear. Keep the eye row clear.
  let sx=0,n=0;
  for(let y=a.minY;y<=a.minY+2;y++) for(let x=0;x<32;x++) if(a.isSil(x,y)){sx+=x;n++;}
  const cx=Math.round(n?sx/n:16), ey=a.eyeL?a.eyeL[1]:a.eyeR?a.eyeR[1]:a.minY+5;
  const y=Math.max(6,a.minY-1), span=stage<2?5:stage<3?7:9;
  const curls=[];
  for(let i=0;i<6;i++) curls.push([Math.round(cx-span+2*span*i/5),y+(i===0||i===5?1:i===1||i===4?-2:-3),i]);
  curls.push([cx-span,y+3,0],[cx+span,y+3,5]);
  function put(x,y,c){if(x<1||x>30||y<0||y>=ey-1)return;let q=(y*32+x)*4;let h=c.slice(1);img.data[q]=parseInt(h.slice(0,2),16);img.data[q+1]=parseInt(h.slice(2,4),16);img.data[q+2]=parseInt(h.slice(4,6),16);img.data[q+3]=255;}
  for(let yy=y-2;yy<=Math.min(a.minY+1,ey-2);yy++) for(let xx=cx-span+1;xx<=cx+span-1;xx++) put(xx,yy,colors[Math.min(5,Math.floor((xx-(cx-span))*6/(2*span+1)))]);
  // Ink scalloped edge followed by inset curls/highlights, not a flat rainbow cap.
  for(const [x,y] of curls)for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(dx*dx+dy*dy<=10)put(x+dx,y+dy,'#1a1020');
  for(const [x,y,c] of curls){for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(dx*dx+dy*dy<=5)put(x+dx,y+dy,colors[c]);put(x-1,y-1,'#ffffff');}
  return img;
}
const out=[];
for(const species of ['peepo','pepe','wojak','doge']) for(let stage=0;stage<=5;stage++) {
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
