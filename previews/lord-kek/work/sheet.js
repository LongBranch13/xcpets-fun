// usage: node sheet.js <kek-sprite.js> <out.json>
const K=require(require('path').resolve(process.argv[2]));const NM=K.NEMES;
const gold={label:'Gold armor',item:'gold-armor',cols:['#ffd23f','#c49a1a']};
const cape={label:'Midnight cape',item:'midnight-cape',cols:['#2b2d5c','#1a1b3a']};
const mug={label:'"Feels good" mug',item:'feels-good-mug',cols:['#ffffff','#c8c8c8']};
const tear={label:'Single tear',item:'single-tear',cols:['#7fd0ff','#3a8fd0']};
const loaf={label:'Brown loafers',item:'brown-loafers',cols:['#8a5a2b','#5e3b1a']};
const band={label:'Gold headband',item:'gold-headband',cols:['#ffd23f','#c49a1a']};
const crook={label:'Crook of Kek',item:'kek-crook',cols:['#ffd23f','#2a4fbf']};
const rows=[
 ['community: Nemes only (card look)',{head:NM},{community:true}],
 ['player (red nemes): Nemes only',{head:NM},{}],
 ['community: Nemes + live-style gear',{head:NM,body:gold,back:cape,hand:mug,face:tear,feet:loaf},{community:true}],
 ['player: Nemes + live-style gear',{head:NM,body:gold,back:cape,hand:mug,face:tear,feet:loaf},{}],
 ['community: headband rolled (nemes off) + Crook',{head:band,body:gold,hand:crook,feet:loaf},{community:true}],
 ['bare sprite (no gear)',{},{community:true}],
];
const out=rows.map(([name,gear,opts])=>({name,frames:[0,1,2,3,4,5].map(s=>[0,1].map(f=>K.render(s,f,'#2a3a2e',s>0||gear.head===NM?gear:{},opts).data))}));
let minY=99,maxY=0;for(const o of [{community:true},{}])for(let s=0;s<6;s++)for(let f=0;f<4;f++){const g=K.draw(s,f,{head:NM},o);for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(g[y][x]){minY=Math.min(minY,y);maxY=Math.max(maxY,y)}}
require('fs').writeFileSync(process.argv[3],JSON.stringify({out}));console.log('rows used',minY,maxY);
