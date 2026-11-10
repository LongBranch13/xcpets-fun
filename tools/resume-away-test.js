#!/usr/bin/env node
/* chores-resume-1110: Continue on "While you were away" did nothing. The away sheet copies the toast's HTML
 * and drops the click handlers offerResume used to hang on that node. Continue and Dismiss must work from the
 * toast and from the sheet, and both must hit the same resumeGo / resumeDrop path as the old toast.
 *   node tools/resume-away-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const v2 = fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8');
const intu = fs.readFileSync(path.join(ROOT, 'js/v2-intuitive.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

ok(/function resumeGo\(\) \{ var o = loadResume\(\); if \(!o \|\| !o\.plans \|\| !o\.plans\.length\) return false; confirmPlans\('Continue: ' \+ \(o\.title \|\| 'burns'\), o\.plans\); return true; \}/.test(v2), 'Continue opens confirmPlans with the saved plans');
ok(/function resumeDrop\(\) \{ saveResume\(null, null\); return true; \}/.test(v2), 'Dismiss drops the saved resume');
ok(/resumeGo: resumeGo, resumeDrop: resumeDrop/.test(v2), 'both actions are on V2UI');
ok(/class="resume">Continue<\/a> · <a href="#" class="resdrop">Dismiss<\/a>/.test(v2), 'the offer still renders Continue and Dismiss');
ok(!/\.resume'\)\.onclick/.test(v2) && !/\.resdrop'\)\.onclick/.test(v2), 'the handlers are not stuck on the toast node');
ok(/a\.resume, a\.resdrop/.test(intu) && /UI\.resumeGo/.test(intu) && /UI\.resumeDrop/.test(intu), 'the away sheet and the toast share one document listener');
ok(/updating pets to the latest block on this device/.test(v2), 'a pet rebuild tells the player it is local');

/* A small DOM: real enough for the away-sheet copy (innerHTML) and for click(). */
function dom() {
  function list(el, sel) { const out = []; (function walk(n) { if (n !== el && n.matches && n.matches(sel)) out.push(n); (n.childNodes || []).forEach(walk); })(el); return out; }
  function matchSimple(el, s) {
    if (!s) return true;
    if (s[0] === '#') return el.id === s.slice(1);
    if (s[0] === '.') return el.classList.contains(s.slice(1));
    const m = /^([a-z0-9]+)?(?:\.([a-z0-9_-]+))?$/i.exec(s);
    if (!m) return false;
    if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && !el.classList.contains(m[2])) return false;
    return true;
  }
  function matchOne(el, s) {
    if (!el || el.nodeType !== 1) return false;
    s = s.trim();
    const attr = /\[([a-z0-9_-]+)(?:="([^"]*)")?\]/i.exec(s);
    const base = s.replace(/\[[^\]]*\]/g, '');
    if (base && !matchSimple(el, base)) return false;
    if (attr) {
      if (!el.hasAttribute(attr[1])) return false;
      if (attr[2] != null && el.getAttribute(attr[1]) !== attr[2]) return false;
    }
    return !!(base || attr);
  }
  function make(tag) {
    const el = { nodeType: 1, tagName: String(tag || 'div').toUpperCase(), id: '', _classes: [], childNodes: [], children: [], parentNode: null, hidden: false, style: {}, dataset: {}, _attr: {}, _html: '', _on: { capture: {}, bubble: {} }, onclick: null };
    el.classList = { add() { for (let i = 0; i < arguments.length; i++) if (el._classes.indexOf(arguments[i]) < 0) el._classes.push(arguments[i]); }, remove() { for (let i = 0; i < arguments.length; i++) el._classes = el._classes.filter(c => c !== arguments[i]); }, contains: c => el._classes.indexOf(c) >= 0, toggle(c) { if (el.classList.contains(c)) { el.classList.remove(c); return false; } el.classList.add(c); return true; } };
    Object.defineProperty(el, 'className', { get() { return el._classes.join(' '); }, set(v) { el._classes = String(v || '').split(/\s+/).filter(Boolean); el._attr.class = el._classes.join(' '); } });
    Object.defineProperty(el, 'textContent', { get() { return el.childNodes.map(n => n.nodeType === 3 ? n.textContent : n.textContent).join(''); }, set(v) { el.childNodes = [{ nodeType: 3, textContent: String(v), parentNode: el }]; el.children = []; } });
    Object.defineProperty(el, 'innerHTML', { get() { return el._html; }, set(v) { el._html = String(v); parse(el, String(v)); } });
    el.matches = sel => String(sel).split(',').some(s => matchOne(el, s));
    el.closest = sel => { for (let n = el; n; n = n.parentNode) if (n.matches && n.matches(sel)) return n; return null; };
    el.setAttribute = (k, v) => { el._attr[k] = String(v); if (k === 'id') el.id = String(v); if (k === 'class') el.className = String(v); };
    el.getAttribute = k => (k in el._attr ? el._attr[k] : null);
    el.hasAttribute = k => k in el._attr;
    el.appendChild = n => { n.parentNode = el; el.childNodes.push(n); if (n.nodeType === 1) el.children.push(n); el._html = serialize(el); if (el._mo && n.nodeType === 1) { const mo = el._mo, node = n; queueMicrotask(() => { try { mo.cb([{ addedNodes: [node], removedNodes: [] }]); } catch (e) {} }); } return n; };
    el.remove = () => { const p = el.parentNode; if (!p) return; p.childNodes = p.childNodes.filter(c => c !== el); p.children = p.childNodes.filter(c => c.nodeType === 1); if (p._html != null) p._html = serialize(p); el.parentNode = null; };
    el.addEventListener = (ev, fn, cap) => { const k = cap ? 'capture' : 'bubble'; (el._on[k][ev] = el._on[k][ev] || []).push(fn); };
    el.querySelector = sel => list(el, sel)[0] || null;
    el.querySelectorAll = sel => list(el, sel);
    el.insertAdjacentElement = (w, n) => el.appendChild(n);
    el.insertAdjacentHTML = (w, h) => { const box = make('div'); box.innerHTML = h; box.childNodes.forEach(n => el.appendChild(n)); };
    el.click = () => dispatch(el);
    el.focus = () => {};
    return el;
  }
  function serialize(el) { return (el.childNodes || []).map(n => { if (n.nodeType === 3) return n.textContent; const attrs = Object.keys(n._attr || {}).map(k => n._attr[k] === '' ? ' ' + k : ' ' + k + '="' + n._attr[k] + '"').join(''); return '<' + n.tagName.toLowerCase() + attrs + '>' + (n.childNodes && n.childNodes.length ? serialize(n) : '') + '</' + n.tagName.toLowerCase() + '>'; }).join(''); }
  function parse(parent, html) {
    parent.childNodes = []; parent.children = [];
    const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|[^<]+/g; const stack = [parent]; let m;
    while ((m = re.exec(html))) {
      if (m[0][0] !== '<') { const t = { nodeType: 3, textContent: m[0], parentNode: stack[stack.length - 1] }; stack[stack.length - 1].childNodes.push(t); continue; }
      if (m[0][1] === '/') { if (stack.length > 1) stack.pop(); continue; }
      const node = make(m[1]); const attrs = m[2] || '';
      attrs.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g, (full, k, v) => { if (k) node.setAttribute(k, v || ''); return ''; });
      stack[stack.length - 1].appendChild(node);
      if (!/\/>$/.test(m[0]) && !/^(br|img|hr|input|meta|link)$/i.test(m[1])) stack.push(node);
    }
  }
  function dispatch(el) {
    const path = []; for (let n = el; n; n = n.parentNode) path.push(n);
    const e = { target: el, preventDefault() { e.defaultPrevented = true; }, stopPropagation() { e.stopped = true; } };
    for (let i = path.length - 1; i >= 0 && !e.stopped; i--) (path[i]._on && path[i]._on.capture.click || []).forEach(fn => fn(e));
    if (!e.stopped && el.onclick) el.onclick(e);
    for (let i = 0; i < path.length && !e.stopped; i++) (path[i]._on && path[i]._on.bubble.click || []).forEach(fn => fn(e));
    return e;
  }
  const doc = make('document'); doc.nodeType = 9;
  const html = make('html'), body = make('body'), head = make('head');
  doc.appendChild(html); html.appendChild(head); html.appendChild(body);
  doc.documentElement = html; doc.body = body; doc.head = head; doc.readyState = 'complete';
  const byId = () => { const m = {}; (function walk(n) { if (n.id) m[n.id] = n; (n.childNodes || []).forEach(walk); })(doc); return m; };
  doc.getElementById = id => byId()[id] || null;
  doc.createElement = make;
  const pets = make('div'); pets.id = 'pets'; body.appendChild(pets);
  const toasts = make('div'); toasts.id = 'toasts'; body.appendChild(toasts);
  return { doc, html, body, toasts, dispatch };
}

function boot(ui) {
  const D = dom();
  const calls = { go: 0, drop: 0, reoffer: 0, pending: true, fight: [], breed: [], cem: [] };
  const win = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: '', pathname: '/play.html', hash: '', href: 'https://xcpets.fun/play.html', hostname: 'xcpets.fun' },
    navigator: { userAgent: 'node' },
    document: D.doc,
    V2UI: Object.assign({ ME: 'bc1qresume000000000000000000000000000' }, ui, {
      resumeGo() { calls.go++; return true; }, resumeDrop() { calls.drop++; calls.pending = false; return true; },
      resumePending() { return calls.pending; }, resumeReoffer() { calls.reoffer++; return true; },
      replayFight(id) { calls.fight.push(String(id)); }, replayBreed(id) { calls.breed.push(String(id)); }, replayCem(k) { calls.cem.push(String(k)); }
    }),
    setTimeout: (fn) => { if (typeof fn === 'function') queueMicrotask(fn); return 0; },
    clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    MutationObserver: function (cb) { this.cb = cb; this.observe = t => { t._mo = this; }; this.disconnect = () => {}; },
    Event: function (t) { this.type = t; }, URLSearchParams, matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}, removeEventListener() {}, getComputedStyle: () => ({})
  };
  win.window = win; win.self = win; win.globalThis = win;
  D.doc.defaultView = win;
  const ctx = vm.createContext(win);
  vm.runInContext(intu, ctx, { filename: 'js/v2-intuitive.js' });
  return { D, calls, IPQ: ctx.IPQ };
}

function flush() { return new Promise(r => setTimeout(r, 20)); }
function toastHtml() { return '⏸️ 4 burns from an unfinished run (Daily chores) were not sent. <a href="#" class="resume">Continue</a> · <a href="#" class="resdrop">Dismiss</a>'; }

(async () => {
  /* away sheet: the toast is copied as HTML, so the anchors have no onclick, and Continue / Dismiss still run */
  { const { D, calls } = boot();
    ok(D.html.classList.contains('ip-hold'), 'a returning player holds toasts for the away sheet');
    const t = D.doc.createElement('div'); t.className = 'toast'; t.innerHTML = toastHtml();
    D.toasts.appendChild(t);
    await flush();
    ok(!t.parentNode, 'the held toast is taken off the stack');
    const chip = D.doc.getElementById('ipAway');
    ok(!!chip, 'the away chip is shown');
    chip.click();
    const sheet = D.doc.getElementById('ipSheet');
    const cont = sheet && sheet.querySelector('a.resume'), drop = sheet && sheet.querySelector('a.resdrop');
    ok(!!cont && !!drop, 'the sheet shows Continue and Dismiss');
    ok(!cont.onclick && !drop.onclick, 'the copied links have no node handler (that was the bug)');
    ok(/Daily chores/.test(sheet.textContent), 'the sheet keeps the Daily chores resume');
    cont.click();
    ok(calls.go === 1 && calls.drop === 0, 'sheet Continue calls resumeGo once (' + calls.go + ')');
    ok(sheet.hidden === true, 'Continue closes the away sheet so the confirm box is the one on screen'); }
  { const { D, calls } = boot();
    const t = D.doc.createElement('div'); t.className = 'toast'; t.innerHTML = toastHtml();
    D.toasts.appendChild(t);
    await flush();
    D.doc.getElementById('ipAway').click();
    D.doc.getElementById('ipSheet').querySelector('a.resdrop').click();
    ok(calls.drop === 1 && calls.go === 0, 'sheet Dismiss calls resumeDrop and not Continue');
    D.doc.getElementById('ipAway').click();
    ok(!D.doc.getElementById('ipSheet').querySelector('a.resume'), 'after Dismiss the sheet does not offer a dead Continue'); }

  /* Replay links copied into the sheet still play. Skip all / X put the saved run back as a live offer instead of trapping it. */
  { const { D, calls } = boot();
    calls.pending = true;
    const t = D.doc.createElement('div'); t.className = 'toast'; t.innerHTML = 'Fight 3 result. <a href="#" data-replay="3">▶ Replay</a>';
    const tb = D.doc.createElement('div'); tb.className = 'toast'; tb.innerHTML = 'Breed. <a href="#" data-breplay="9">▶ Replay</a>';
    D.toasts.appendChild(t); D.toasts.appendChild(tb);
    await flush();
    D.doc.getElementById('ipAway').click();
    const sheet = D.doc.getElementById('ipSheet');
    sheet.querySelector('a[data-replay]').click();
    sheet.querySelector('a[data-breplay]').click();
    ok(calls.fight.join() === '3' && calls.breed.join() === '9', 'sheet Replay calls the fight and breed actions (' + calls.fight + ' / ' + calls.breed + ')');
    const t2 = D.doc.createElement('div'); t2.className = 'toast'; t2.innerHTML = '<a href="#" data-cemreplay="raise:abc">▶ Replay</a>';
    D.html.classList.remove('ip-hold');
    D.toasts.appendChild(t2);
    await flush();
    t2.querySelector('a[data-cemreplay]').click();
    ok(calls.cem.join() === 'raise:abc', 'toast cemetery Replay still runs'); }
  { const { D, calls } = boot();
    calls.pending = true;
    const t = D.doc.createElement('div'); t.className = 'toast'; t.innerHTML = toastHtml();
    D.toasts.appendChild(t);
    await flush();
    D.doc.getElementById('ipAwayX').click();
    ok(calls.drop === 0 && calls.reoffer === 1, 'Skip all does not forget the run; it offers Continue again (' + calls.reoffer + ')');
    const { D: D2, calls: c2 } = boot();
    c2.pending = true;
    const t3 = D2.doc.createElement('div'); t3.className = 'toast'; t3.innerHTML = toastHtml();
    D2.toasts.appendChild(t3);
    await flush();
    D2.doc.getElementById('ipAway').click();
    D2.doc.getElementById('ipSheet').querySelector('.ip-sh-x').click();
    ok(c2.drop === 0 && c2.reoffer === 1, 'the sheet X offers Continue again instead of leaving a dead link'); }

  /* toast: the same listener, while the offer is still a toast */
  { const { D, calls } = boot();
    D.html.classList.remove('ip-hold');
    const t = D.doc.createElement('div'); t.className = 'toast'; t.innerHTML = toastHtml();
    D.toasts.appendChild(t);
    await flush();
    ok(t.parentNode === D.toasts, 'without the hold, the toast stays');
    const cont = t.querySelector('a.resume');
    ok(!cont.onclick, 'the toast link also has no private handler');
    cont.click();
    ok(calls.go === 1 && calls.drop === 0, 'toast Continue calls resumeGo');
    ok(!t.parentNode, 'toast Continue removes the toast');
    const t2 = D.doc.createElement('div'); t2.className = 'toast'; t2.innerHTML = toastHtml();
    D.toasts.appendChild(t2);
    await flush();
    t2.querySelector('a.resdrop').click();
    ok(calls.drop === 1 && calls.go === 1, 'toast Dismiss calls resumeDrop and not Continue');
    ok(!t2.parentNode, 'toast Dismiss removes the toast'); }

  console.log('resume-away-test: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL error', e && e.stack); process.exit(1); });
