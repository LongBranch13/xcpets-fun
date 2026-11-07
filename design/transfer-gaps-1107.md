# Transfer gaps (transfer-gaps-1107) — preview only, gate OFF

Owner OK: "yeah" 9:25 AM CT Nov 7 2026. Gate `ACTIVATE_TRANSFER_GAPS_BLOCK = Infinity` in js/v2-rules.js (off). Not pushed, not deployed.

What changes once the gate is set:
1. **Old challenges no longer follow a sold pet.** When a pet changes owner (token send, dispenser, DEX trade, shop sale), any open challenge or Tag Team fight it is in is called off ("fight N was called off: #ID changed owner"). A daily fight already spent on it stays spent.
2. **Two moves in one block.** If a pet token is credited more than once in the same block, the pet goes to whoever holds the token at the end of that block (ordered by tx_index, then credit_index), so the pet and the token always end up with the same owner. A token that goes out and back in one block does not move the pet.
3. **Stale pages (UI, not gated).** The browser's replay cache now notices new token credits and destructions (js/v2-chain.js inSig), so a page shows the new owner without waiting for the next block.

Checks: replay SAME on 971786, 972883, 972901 vs origin/main; tools/transfer-gaps-test.js 15/0; pet-gift, pet-sales, sale-carry pass (known lines only).
