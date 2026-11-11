'use strict';
/* Loads the page's js/v2-boot-sync.js so the service and the browser share one merge and one check. */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..');
function mem() { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }; }
let api = null;
function bootSync() {
  if (api) return api;
  const ctx = { window: {}, location: { search: '', href: 'https://xcpets.fun/play.html', pathname: '/play.html' }, localStorage: mem(), sessionStorage: mem(),
    navigator: { hardwareConcurrency: 8 }, document: { currentScript: { src: '' }, scripts: [] }, URLSearchParams, URL, TextEncoder, TextDecoder, crypto: crypto.webcrypto, console,
    fetch: () => Promise.reject(new Error('no')) };
  ctx.window.window = ctx.window; ctx.self = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-boot-sync.js'), 'utf8'), ctx, { filename: 'js/v2-boot-sync.js' });
  api = ctx.window.V2BootSync;
  if (!api || typeof api.mergeSync !== 'function') throw new Error('boot sync did not load');
  return api;
}
function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
function checkOf(rows, hashes, dex) { return sha256(bootSync().checkText(rows, hashes, dex)); }
const PUBLIC = ['https://api.counterparty.io:4000/v2', 'https://api.unspendablelabs.com:4000/v2'];
function upstreams() {
  const env = process.env.XP_UPSTREAMS;
  const list = (env ? String(env).split(',') : PUBLIC).map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
  return list.length ? list : PUBLIC.slice();
}
function hostKind(url) { try { const h = new URL(url).hostname; if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return 'private'; } catch (e) {} return 'public'; }
function scrub(err, bases) { let s = String(err && err.stack || err || ''); (bases || upstreams()).forEach(u => { s = s.split(u).join(hostKind(u)); }); return s.replace(/https?:\/\/\S+/g, '[host]'); }
module.exports = { bootSync, sha256, checkOf, upstreams, hostKind, scrub, PUBLIC, ROOT };
