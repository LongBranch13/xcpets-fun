# Hunt revision — private, inactive preview

Owner selected A, C and D on Nov 7, 2026 at 8:59 AM CST, and floated capture: “if you beat the zombie you take it Maybe?” This is a preview, not approval to activate capture or deploy any rules. `ACTIVATE_HUNT_RULES_BLOCK = Infinity`.

## Implemented behavior after the future gate

- **Grudge replaces the new hunt-loss black eye.** Each loss adds 5% to all five fight-snapshot stats against that same zombie, up to three stacks (15%). Stored pet stats never change. The last loss refreshes the entire pair's expiry to 432 blocks later (three chain days), exclusive at the expiry block. Existing injuries from before the gate or other battles are not erased.
- **Rematch credit:** one quarter of the actual XCPETS burned on a losing attempt, rounded down to eight decimals. It is a reduced requirement for the next valid hunt by this hunter against this zombie, not a refund, payment, or transferable token balance. Credit and Grudge share their expiry. A valid rematch consumes the old credit; a further loss creates a new credit equal to one quarter of what was actually paid, not the unreduced requirement. Rejections consume nothing. Credit used is capped at the then-current full hunt requirement minus one token unit (0.00000001 XCPETS); any excess is forfeited on use, not carried forward. A halving or temporary burn multiplier is evaluated at the rematch block.
- Pair records are bound to the hunter and zombie IDs, both owners and acquisition blocks, and the zombie's rise generation. Transfer (even away and back), a new rise, or expiry invalidates old benefits. No wallet-wide or cross-pet credits.
- **Feral weakness:** a hunted feral zombie fights with 90% of each snapshot stat. Stored stats, death stats, feeding growth, and later fights are not weakened permanently.
- **Capture on every win:** the hunter's wallet owns the same zombie, not a newly hatched or resurrected pet. Its full stored zombie stats and growth remain. Capture resets its hunger clock to the capture block: feed it Discarded pets before 432 more blocks, or it becomes feral; at 864 blocks without a meal it crumbles. Capture eats no offering and does not cure the zombie.
- The original owner receives no token payment, spin, replacement pet, or compensation in this preview. Their worn and bagged gear and wallet cosmetic copies come off the zombie and stay theirs. A tied token cannot be moved by game replay: it is detached as a keepsake, using the existing seance convention. Its holder keeps the token, but it no longer controls the captured pet. Old listings become void. Pending old-owner interactions must still pass the existing ownership guards.
- Keep the existing **first winning hunt per wallet per 144-block chain day**: one saved spin plus the existing 2% stat gain (and existing lifetime limit/badge counters). There is no extra gear roll or bounty. Later wins still capture, but do not pay another daily spin/stat reward.
- Keep **one battle per hunter per 144-block chain day**, shared with ordinary battles, existing Juvenile-or-older eligibility and open-challenge checks. There is no new per-wallet capture cap. The UI still requires tapping an explicit hunter card; suggested is never selected automatically.

## Capture and D: bringing it back

A captured zombie is not laid to rest. The original owner cannot seance it back or claim a second copy. Ownership follows the capture.

If that captured zombie later crumbles from hunger or is released back to its grave, its owner **at that later rest** may seance it after another 432 blocks. The fresh zombie starts at exactly **1 times its original death stats**, with no carried meal/bonus power. Normal seance burn and offering eligibility/minimums still apply; offerings are Sacrificed even though they do not add starting power on this fresh return. A subsequent normal raise has the usual rules unless another capture/rest occurs.

Historically hunted graves also become owner-raisable after the future gate and 432 blocks since their recorded hunt. No historical fields or past fight results are rewritten. Failed Resurrection still makes permanent dust; halos and other permanent exclusions are unchanged.

The grave finder shows the rest deadline, only offers the ready owner's raise button, and previews 1 times death stats rather than a misleading offering-powered boost.

## Decisions still needed before activation

1. Is capture definitely the win reward? The owner's “Maybe?” is not go-live approval.
2. Should the original owner receive compensation beyond getting their gear/cosmetics back? No payout is built.
3. Should captures have a wallet daily cap, and should rematches keep using the shared one-battle-per-pet daily allowance? Current preview preserves the existing allowance, with capture on every win.
4. Is detaching a tied token as a keepsake acceptable, or should tokenized zombies be protected from capture? No token is ever signed or moved here.
5. Confirm the fresh hunger window, owner-at-rest rights, inclusion of historical hunted graves, and normal Sacrificed offerings on a fresh 1 times return.
6. Confirm single-use actual-payment credit, shared 432-block expiry/refresh and invalidation on custody changes. No credit is a refund or an on-chain transfer.

## Integration and evidence

Own worktree `/workspace/wt-hunt-rules-1107`, branch `hunt-rules-1107`, from current `origin/main` 681f67bb with private rare build 4d9c9f1b and approved hunt picker 9c12b096 merged as ancestors. Main's era UI and new native-sprite APIs are both retained. No primary working files or port 8841 touched. No push, deployment, public post, X/Telegram action, transaction or signature.

Tests: `tools/hunt-rules-test.js`, `tools/hunt-rules-browser-test.js`, existing cemetery/picker/era/rare regression tests, plus three gate-off replay comparisons. Result fixtures deliberately scale normal replay pet stats to force both outcomes; they are not an owner's burn or a claim about real fight odds. Browser previews exercise the actual result collector, production painter/caption and explicit picker at 1280 and 390 widths. Files and evidence are under `/workspace/xcpets/previews/hunt-rules-1107/`. The complete suite and a deployed live smoke have not been claimed green or run as part of this preview.

Before any later activation, merge then-current main while retaining its approved active rare gate (this private base still has that gate off), obtain the owner's final decisions and explicit go-live, set the new hunt gate at fresh tip plus six, rerun safety/replay checks, and perform the normal single-lane deployment and long-timeout live smoke. None of those release actions is authorized by this preview.
