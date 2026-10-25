#!/usr/bin/env node
/* Gift token sends: address validation, send/MPMA compose URLs and compose-result checks (no network). node tools/gift-send-test.js */
const { load } = require('./lib/load-rules');
const c = load(['rjs/wallet.js','rjs/burn-core.js','js/v2-wallet.js']); const W = c.V2Wallet; let f=0; const ok=(x,m)=>{ if(!x){f++;console.log('FAIL',m);} };
const ME='bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', TO='bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
ok(W.validAddr(TO)&&W.validAddr(ME)&&W.validAddr('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')&&W.validAddr('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'),'valid');
ok(!W.validAddr('bc1qxyz')&&!W.validAddr('tb1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')&&!W.validAddr('0xabc')&&!W.validAddr('BC1QAR0'),'invalid');
const A1='A12345678901234567', A2='A12345678901234568';
const u=W._dexUrl('https://api.counterparty.io:4000/v2',ME,{kind:'mpma',assets:[A1,A2],destination:TO},3); 
ok(/compose\/mpma\?assets=A12345678901234567,A12345678901234568&destinations=bc1q[^,]+,bc1q[^&]+&quantities=1,1/.test(u),'mpma url');
const u2=W._dexUrl('https://x/v2',ME,{kind:'send',asset:A1,destination:TO},3); ok(/compose\/send\?destination=.*&asset=A12345678901234567&quantity=1/.test(u2),'send url');
const TXF=require('./lib/txfake.js'); /* structurally real raw txs: the wallet now decodes them before signing */
const raw=TXF.result('mpma',ME,{asset_dest_quant_list:[[A1,TO,1],[A2,TO,1]]},{type:3,bodyHex:'00'.repeat(30)});
ok(W._dexCheck(raw,ME,{kind:'mpma',assets:[A1,A2],destination:TO},3).length===0,'mpma ok');
ok(W._dexCheck({rawtransaction:'00ff',name:'mpma',params:{source:ME,asset_dest_quant_list:[[A1,TO,1],['XCPETS',TO,1]]}},ME,{kind:'mpma',assets:[A1,A2],destination:TO}).length>0,'mpma tamper caught');
ok(W._dexCheck(raw,ME,{kind:'mpma',assets:[A1,'XCPETS'],destination:TO}).length>0,'non-token rejected');
ok(W._dexCheck(TXF.result('send',ME,{asset:A1,quantity:1,destination:TO},{type:2,bodyHex:TXF.sendBody(A1,1)}),ME,{kind:'send',asset:A1,destination:TO},3).length===0,'send ok');
ok(W._dexCheck(TXF.result('send',ME,{asset:A1,quantity:1,destination:TO},{type:2,bodyHex:TXF.sendBody('XCPETS',1)}),ME,{kind:'send',asset:A1,destination:TO},3).length>0,'send raw-tx asset tamper caught');
ok(W._dexCheck({rawtransaction:'00ff',name:'send',params:{source:ME,asset:A1,quantity:1,destination:ME}},ME,{kind:'send',asset:A1,destination:TO}).length>0,'send dest tamper');
ok(W._dexCheck({rawtransaction:'00ff',name:'send',params:{source:ME,asset:A1,quantity:1,destination:ME}},ME,{kind:'send',asset:A1,destination:ME}).length>0,'self send rejected');
console.log('gift-send-test: ' + (f ? f + ' failed' : 'all passed')); process.exit(f ? 1 : 0);
