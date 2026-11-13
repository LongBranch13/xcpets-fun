/* Share my pet (display only). Pretty link https://xcpets.fun/pet/<id>?ref= (ref is unused, kept for a later invite).
 * One button copies that link and opens an X intent. A second button does the same for Telegram.
 * Sabo #1765 is never described as dead. Does not touch rules, burns, or the feed. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.V2Share = api;
  if (root && root.document) start(root, api);
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var SITE = 'https://xcpets.fun';
  var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  var SABO = 1765;
  function url(id, ref) {
    id = Number(id);
    if (!(id >= 1)) throw new Error('bad pet id');
    var r = ref == null ? '' : String(ref);
    return SITE + '/pet/' + id + '?ref=' + encodeURIComponent(r);
  }
  function xIntent(text, link) { return 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(link); }
  function tgIntent(text, link) { return 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text); }
  function shortAddr(s) { s = String(s || ''); return s.length > 16 ? s.slice(0, 6) + '\u2026' + s.slice(-4) : s; }
  function text(p) {
    p = p || {};
    var tier = p.resurrected ? 'God' : (typeof p.tier === 'number' ? (TIERS[p.tier] || '') : (p.tier || ''));
    var stage = p.stageName || '';
    if (p.dead && Number(p.id) !== SABO) return 'Remembering ' + (p.name || ('#' + p.id)) + ' #' + p.id + ' on XCPETS';
    var bits = [tier, stage].filter(Boolean).join(' ');
    return (p.name || ('Pet #' + p.id)) + ' #' + p.id + (bits ? ' (' + bits + ')' : '') + ' on XCPETS';
  }
  function petId() {
    if (typeof location === 'undefined') return 0;
    var q = 0;
    try { q = Number(new URLSearchParams(location.search).get('id')) || 0; } catch (e) { q = 0; }
    if (q >= 1) return q;
    var m = String(location.pathname || '').match(/\/pet\/(\d+)\/?$/);
    if (m) return Number(m[1]);
    if (typeof window !== 'undefined' && window.__XCPETS_PET_ID >= 1) return Number(window.__XCPETS_PET_ID);
    return 0;
  }
  function refNow() {
    if (typeof location === 'undefined') return '';
    try { var r = new URLSearchParams(location.search).get('ref'); return r == null ? '' : r; } catch (e) { return ''; }
  }
  return { url: url, text: text, xIntent: xIntent, tgIntent: tgIntent, shortAddr: shortAddr, petId: petId, refNow: refNow, SABO: SABO, TIERS: TIERS };
});

function start(root, api) {
  var d = root.document;
  function css() {
    if (d.getElementById('shCss')) return;
    var l = d.createElement('link'); l.id = 'shCss'; l.rel = 'stylesheet'; l.href = '/css/v2-share.css?v=e6db15afb2';
    (d.head || d.documentElement).appendChild(l);
  }
  function world() { try { return root.V2Mock && root.V2Mock.world ? root.V2Mock.world() : null; } catch (e) { return null; } }
  function petOf(id) {
    var w = world(), p = w && w.byId && w.byId[id];
    if (!p) return { id: id, name: '', tier: '', stageName: '' };
    var V = root.V2Rules, stage = '';
    try { stage = V && V.stageLabelOf ? V.stageLabelOf(p) : (p.stageName || ''); } catch (e) { stage = p.stageName || ''; }
    return { id: p.id, name: p.name, tier: p.tier, stageName: stage, dead: !!p.dead && p.id !== api.SABO, resurrected: p.resurrected, owner: p.owner };
  }
  function toast(title, link) {
    var old = d.querySelector('.sh-toast'); if (old) old.remove();
    var t = d.createElement('div'); t.className = 'sh-toast'; t.setAttribute('role', 'status');
    var b = d.createElement('b'); b.textContent = title; t.appendChild(b);
    if (link) { var s = d.createElement('span'); s.className = 'sh-url'; s.textContent = link; t.appendChild(s); }
    d.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 5000);
  }
  function copy(link) {
    function done(ok) { toast(ok ? 'Link copied' : 'Link ready', link); }
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      var timer = setTimeout(function () { fallback(); }, 700);
      root.navigator.clipboard.writeText(link).then(function () { clearTimeout(timer); done(true); }, function () { clearTimeout(timer); fallback(); });
      return;
    }
    fallback();
    function fallback() {
      try {
        var ta = d.createElement('textarea'); ta.value = link; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:8px;top:8px;width:1px;height:1px;opacity:0';
        d.body.appendChild(ta); ta.focus(); ta.select();
        var ok = d.execCommand && d.execCommand('copy'); ta.remove(); done(!!ok);
      } catch (e) { done(false); }
    }
  }
  function go(kind, id, ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var p = petOf(id), link = api.url(p.id, api.refNow()), tx = api.text(p);
    var href = kind === 'tg' ? api.tgIntent(tx, link) : api.xIntent(tx, link);
    root.open(href, '_blank', 'noopener,noreferrer');
    copy(link);
  }
  function row(id, where) {
    var box = d.createElement('div'); box.className = 'sh-row'; box.setAttribute('data-sh', where); box.setAttribute('data-pet', String(id));
    function btn(cls, label, kind) {
      var b = d.createElement('button'); b.type = 'button'; b.className = 'btn sh-btn ' + cls; b.textContent = label;
      b.onclick = function (e) { go(kind, id, e); };
      return b;
    }
    box.appendChild(btn('sh-x', 'Share my pet', 'x'));
    box.appendChild(btn('sh-tg', 'Telegram', 'tg'));
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    return box;
  }
  function place(host, id, where) {
    if (!host || !(id >= 1)) return;
    var cur = host.querySelector('.sh-row[data-sh="' + where + '"]');
    if (cur && cur.getAttribute('data-pet') === String(id)) return;
    if (cur) cur.remove();
    host.appendChild(row(id, where));
  }
  function idIn(text) { var m = /#(\d+)/.exec(text || ''); return m ? +m[1] : 0; }
  function sync() {
    css();
    d.querySelectorAll('.petshare').forEach(function (el) {
      var id = +(el.getAttribute('data-pet') || 0);
      if (id >= 1 && !el.querySelector('.sh-row')) el.insertBefore(row(id, 'page'), el.firstChild);
    });
    var pack = d.getElementById('packBox');
    if (pack && (!pack.classList.contains('on') || pack.classList.contains('gearmode'))) { var gone = d.getElementById('shPack'); if (gone) gone.remove(); }
    if (pack && pack.classList.contains('on') && !pack.classList.contains('gearmode')) {
      var card = pack.querySelector('#packGrid .egg.pkcard, #packGrid .pkcard');
      var pid = idIn(card && card.textContent);
      var slot = d.getElementById('shPack');
      if (pid) {
        if (!slot) { slot = d.createElement('div'); slot.id = 'shPack'; var after = d.getElementById('packAfter'); if (after && after.parentNode) after.parentNode.insertBefore(slot, after); else pack.querySelector('.box').appendChild(slot); }
        place(slot, pid, 'hatch');
      } else if (slot) slot.remove();
    }
    var egg = d.getElementById('eggPop');
    if (egg) { var nm = egg.querySelector('.ep-nm'); place(egg.querySelector('.ep-box') || egg, idIn(nm && nm.textContent), 'breed'); }
    d.querySelectorAll('.la-ov').forEach(function (ov) {
      var k = ov.getAttribute('data-anim') || '';
      if (k !== 'hatch' && k !== 'hatch-bulk' && k !== 'mythic' && k !== 'birth') return;
      var cap = ov.querySelector('.la-cap');
      place(ov, idIn(cap && cap.textContent), k === 'mythic' ? 'mythic' : (k === 'birth' ? 'breed' : 'hatch'));
    });
  }
  function preview() {
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var moment = q.get('moment'); if (moment !== 'hatch' && moment !== 'breed') return;
    var want = +q.get('pet') || 0, n = 0, t = setInterval(function () {
      n++; var w = world(); if (n > 240) { clearInterval(t); return; }
      if (!w || !w.byId) return;
      if (moment === 'hatch' && root.V2RevealPreview) {
        var id = want && w.byId[want] && want !== api.SABO ? want : 0;
        if (!id) { var i; for (i = 0; i < (w.pets || []).length; i++) { var p = w.pets[i]; if (p && !p.dead && !p.released && p.id !== api.SABO && p.art) { id = p.id; break; } } }
        if (id) { clearInterval(t); root.V2RevealPreview([id]); }
      } else if (moment === 'breed' && root.V2Motel && root.V2Motel.eggPop) {
        var kid = want && w.byId[want] && w.byId[want].parents ? w.byId[want] : null;
        if (!kid) { var j; for (j = 0; j < (w.pets || []).length; j++) { var q2 = w.pets[j]; if (q2 && q2.parents && q2.parents.length === 2 && q2.id !== api.SABO) { kid = q2; break; } } }
        if (kid) { clearInterval(t); root.V2Motel.eggPop(w, kid); }
      }
    }, 500);
  }
  css();
  if (d.body) new MutationObserver(function () { sync(); }).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  sync(); preview();
  root.V2Share.row = row; root.V2Share.sync = sync;
}
