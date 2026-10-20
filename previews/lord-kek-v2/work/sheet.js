// usage: node sheet.js <kek-sprite.js> <out.json>  (nemes is part of him; Headwear gear is ignored by design)
const K=require(require('path').resolve(process.argv[2]));const CARD=K.KEK_CARD;
const gold={label:'Gold armor',item:'gold-armor',cols:['#ffd23f','#c49a1a']};
const cape={label:'Midnight cape',item:'midnight-cape',cols:['#2b2d5c','#1a1b3a']};
const mug={label:'"Feels good" mug',item:'feels-good-mug',cols:['#ffffff','#c8c8c8']};
const tear={label:'Single tear',item:'single-tear',cols:['#7fd0ff','#3a8fd0']};
const loaf={label:'Brown loafers',item:'brown-loafers',cols:['#8a5a2b','#5e3b1a']};
const band={label:'Gold headband',item:'gold-headband',cols:['#ffd23f','#c49a1a']};
const rows=[
 ['community (blue/gold): no gear',{},{community:true}],
 ['player (red/gold): no gear',{},{}],
 ['community: LORDKEK card (signature)',{hand:CARD},{community:true}],
 ['player: LORDKEK card (signature)',{hand:CARD},{}],
 ['community: live-style gear + headband roll (ignored)',{head:band,body:gold,back:cape,hand:mug,face:tear,feet:loaf},{community:true}],
 ['player: live-style gear + card',{body:gold,back:cape,hand:CARD,face:tear,feet:loaf},{}],
];
const out=rows.map(([name,gear,opts])=>({name,frames:[0,1,2,3,4,5].map(s=>[0,1].map(f=>K.render(s,f,'#2a3a2e',s>0?gear:{},opts).data))}));
require('fs').writeFileSync(process.argv[3],JSON.stringify({out}));
