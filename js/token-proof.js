/* token-proof (Oct 24 2026): one pre-mint check shared by every pet-token mint path (Spam City Sell, Token Press, pet card Tokenize).
 * A pet token's on-chain description is only the URL https://xcpets.fun/t/<id>.json; the Proof of Pet (name, stats, verified tie, the
 * 128x128 Proof of Pet badge PNG) lives in that file, written by tools/token-meta.js in the api-feed workflow. So before a wallet window opens:
 *   1) planWhy: the issuance must be the canonical pet token (numeric asset, qty 1, indivisible, locked, description = V2Rules.deedDesc(id), <= 52 bytes);
 *   2) serviceWhy: the token proof writer must be current (api/token-meta-state.json lastBlock within MAX_LAG blocks of the tip), else the new
 *      token would show no image and no proof in wallets/explorers. Either failure blocks the mint with a clear message.
 * fixPlan (gated off, FIX_ON = false): design for a holder-signed description update. This file never signs and never sends.
 * Node: require('./token-proof.js'). Browser: window.TokenProof. */
(function (root) {
  'use strict';
  var MAX_LAG = 36, DESC_MAX = 52, FIX_ON = false;
  function bytes(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length; }
  /** planWhy(id, plan, V2Rules) -> null when the mint carries the full proof link, else the reason (string). */
  function planWhy(id, plan, V) {
    if (!plan || plan.kind !== 'issuance') return 'the token plan is missing';
    var want = V && V.deedDesc ? V.deedDesc(id) : null;
    if (!want) return 'the proof link for #' + id + ' could not be built';
    if (plan.description !== want) return 'the token description must be the Proof of Pet link ' + want;
    if (bytes(plan.description) > DESC_MAX) return 'the proof link is too long for a token description';
    if (Number(plan.quantity) !== 1 || plan.divisible !== false || plan.lock !== true) return 'a pet token must be 1 unit, indivisible and locked';
    if (V.deedOk && !V.deedOk(plan.asset)) return 'the token name ' + plan.asset + ' is not a free numeric pet token name';
    return null; }
  /** serviceWhy(state {lastBlock}, tip) -> null when the Proof of Pet writer is current, else the reason. */
  function serviceWhy(state, tip) {
    var lb = state && Number(state.lastBlock), t = Number(tip);
    if (!lb) return "the Proof of Pet service could not be checked, so your token would have no picture or proof yet. Please try again in a few minutes";
    if (t && t - lb > MAX_LAG) return 'the Proof of Pet service is catching up (last update block ' + lb + ', now ' + t + '), so your token would show no picture or proof yet. Please try again a little later';
    return null; }
  /** fixPlan(id, info {asset, description, issuer, owner}, me, V) -> {needed, why, plan?}. Design only (FIX_ON false = never offered).
   *  On-chain the proof is the URL; when it is already right, the fix is off-chain (refresh t/<id>.json + .png), no signature. Only a token whose
   *  description is not the pet's link needs a description update, and only its issuer (the holder's own wallet) can sign that. */
  function fixPlan(id, info, me, V) {
    if (!info || !info.asset) return { needed: false, why: 'no token' };
    var want = V.deedDesc(id);
    if (V.deedDescOk ? V.deedDescOk(info.description, id) : info.description === want) return { needed: false, why: 'description already links the Proof of Pet; the picture and proof refresh off-chain' };
    if (!FIX_ON) return { needed: true, why: 'Fix my token proof is not switched on yet' };
    if (!me || (info.issuer || info.owner) !== me) return { needed: true, why: 'only the token issuer can sign a description update' };
    return { needed: true, why: null, plan: { kind: 'issuance', asset: info.asset, quantity: 0, divisible: false, lock: false, description: want, petId: id, label: 'Fix the token proof for #' + id } }; }
  var API = { planWhy: planWhy, serviceWhy: serviceWhy, fixPlan: fixPlan, MAX_LAG: MAX_LAG, FIX_ON: FIX_ON };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TokenProof = API;
})(this);
