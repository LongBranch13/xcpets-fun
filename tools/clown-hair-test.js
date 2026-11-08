/* Offline art-only regression checks. */
'use strict';
const assert=require('assert/strict'),C=require('./clown-hair-preview');
let count=0;
for(const sp of Object.keys(C.FIT))for(let stage=1;stage<=5;stage++)for(let f=0;f<4;f++){
 const tag=`${sp}/${stage}/${f}`,a=C.anchor(sp,stage,f),img=C.render(sp,stage,f),bare=img.data.slice();
 C.wig(img,a,stage,sp);
 assert(img.clownHair&&img.clownHair.length,tag+' missing wig');
 const u=new Set(img.clownHair),q=[u.values().next().value];u.delete(q[0]);
 while(q.length){const k=q.pop();for(const d of [-32,-1,1,32]){const n=k+d;if(Math.abs(n%32-k%32)<=1&&u.has(n)){u.delete(n);q.push(n);}}}
 assert.equal(u.size,0,tag+' separated puff pixels');
 assert(!img.clownHair.some(k=>(k>>5)===0||k%32===0||k%32===31),tag+' clipped wig');
 for(const e of [a.eyeL,a.eyeR].filter(Boolean))for(const [x,y]of e[2]){
  const k=(y*32+x)*4;assert.deepEqual(img.data.slice(k,k+3),bare.slice(k,k+3),tag+' covered eye');
 }
 if(a.hair)for(const h of a.hair){const k=h*4;assert.notDeepEqual(img.data.slice(k,k+3),bare.slice(k,k+3),tag+' original Kevin hair remains');}
 const again=C.render(sp,stage,f);C.wig(again,C.anchor(sp,stage,f),stage,sp);
 assert.deepEqual(img.data,again.data,tag+' nondeterministic pixels');count++;
}
console.log('PASS '+count+' fitted frames: touching puffs, no clipping, clear eyes, Kevin replacement, deterministic pixels');
