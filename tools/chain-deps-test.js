#!/usr/bin/env node
/* Missing/partial rules must never publish an adapter that can replay or accept burns. No chain or wallet calls. */
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '../js/v2-chain.js'), 'utf8');
let checks = 0;
for (const rules of [undefined, {}, { replay: null }]) {
  let reloads = 0;
  const panel = { textContent: '', children: [], appendChild(x) { this.children.push(x); } };
  const ctx = { window: { V2Rules: rules }, document: { getElementById: () => panel, createElement: () => ({}) }, location: { reload() { reloads++; } } };
  // No storage, timers, network or engine: failing closed must precede every one of them.
  vm.runInNewContext(src, ctx);
  assert.strictEqual(ctx.window.V2Mock, undefined); checks++;
  assert.match(panel.textContent, /Could not load the game rules/); checks++;
  assert.strictEqual(panel.children[0].textContent, 'Retry'); checks++;
  panel.children[0].onclick(); assert.strictEqual(reloads, 1); checks++;
  ctx.document.getElementById = () => null;
  assert.doesNotThrow(() => vm.runInNewContext(src, ctx)); checks++;
}
// Healthy rules still expose the real adapter and the unmodified replay inputs/results.
const expected = { pets: [], tip: 12 }; let args;
const ctx = { window: { V2Rules: { replay(...a) { args = a; return expected; } }, LiveEngine: { RealCore: {} }, addEventListener() {} },
 document: { currentScript: null }, location: { search: '' }, URLSearchParams,
 localStorage: { getItem: () => null }, setInterval: () => 0 };
vm.runInNewContext(src, ctx);
assert.strictEqual(ctx.window.V2Mock.world(), expected); checks++;
assert.strictEqual(args[3].live, ctx.window.LiveEngine.RealCore); checks++;
assert.strictEqual(ctx.window.V2Mock.state().verified, undefined); checks++;
console.log('chain-deps-test: ' + checks + ' checks pass');
