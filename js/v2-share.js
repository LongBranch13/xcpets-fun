/* Share a pet (display only; rebuilt Nov 24 2026). One quiet "Share" button opens a small sheet: Share card (the phone's own
 * share sheet with the card picture, so Telegram or X gets the picture itself), Post on X, Send on Telegram, Save image,
 * Save GIF and Copy link.
 * Link previews: X and Telegram read og:image without running JavaScript, and GitHub Pages cannot make a page per pet, so the
 * shared link is the game server's https://node.xcpets.fun/xp/v1/pet/<id> (tools/sync-server/share.js: preview tags + a
 * 1200x630 card of that pet, then on to pet.html). Until that answers, the link is https://xcpets.fun/pet.html?id=<id>.
 * Why the old buttons failed: their /pet/<id> link was a 404 for every pet but 24 (preview "page not found"), and the
 * picture saves were blob downloads, which iPhones and in-app browsers (Telegram's included) ignore.
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
  function cardUrl(id) { return 'https://node.xcpets.fun/xp/v1/pet/' + Number(id); }
  function pageUrl(id) { return SITE + '/pet.html?id=' + Number(id); }
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
  return { url: url, cardUrl: cardUrl, pageUrl: pageUrl, text: text, xIntent: xIntent, tgIntent: tgIntent, shortAddr: shortAddr, petId: petId, refNow: refNow, SABO: SABO, TIERS: TIERS };
});

function start(root, api) {
  var d = root.document, nav = root.navigator || {};
  function css() {
    if (d.getElementById('shCss')) return;
    var l = d.createElement('link'); l.id = 'shCss'; l.rel = 'stylesheet'; l.href = '/css/v2-share.css?v=sh1124';
    (d.head || d.documentElement).appendChild(l);
  }
  function world() { try { return root.V2Mock && root.V2Mock.world ? root.V2Mock.world() : null; } catch (e) { return null; } }
  function rawPet(id) { var w = world(); return w && w.byId ? w.byId[id] : null; }
  function petOf(id) {
    var p = rawPet(id);
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
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
  }
  function copyText(link, done) {
    function fallback() {
      try {
        var ta = d.createElement('textarea'); ta.value = link; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:8px;top:8px;width:1px;height:1px;opacity:0';
        d.body.appendChild(ta); ta.focus(); ta.select();
        var ok = d.execCommand && d.execCommand('copy'); ta.remove(); done(!!ok);
      } catch (e) { done(false); }
    }
    if (nav.clipboard && nav.clipboard.writeText) { nav.clipboard.writeText(link).then(function () { done(true); }, fallback); return; }
    fallback();
  }
  /* Telegram's own mini app (not the in-app browser): its links and downloads go through Telegram.WebApp */
  function tgApp() { var T = root.Telegram && root.Telegram.WebApp; return T && T.initData ? T : null; }
  /* iPhones and in-app browsers drop <a download> of a blob; there the picture is shown to press and hold instead */
  function canDownload() {
    var ua = String(nav.userAgent || '');
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return false;
    if (/Telegram|FBAN|FBAV|Instagram|Line\/|; wv\)|Twitter/i.test(ua)) return false;
    return !tgApp();
  }
  function fileOf(blob, name, type) { try { return new File([blob], name, { type: type }); } catch (e) { return null; } }
  function canShareFile(f) { try { return !!(f && nav.share && nav.canShare && nav.canShare({ files: [f] })); } catch (e) { return false; } }
  function openUrl(u) { var T = tgApp(); try { if (T) { if (/^https:\/\/t\.me\//.test(u) && T.openTelegramLink) T.openTelegramLink(u); else T.openLink(u); return; } } catch (e) { } root.open(u, '_blank', 'noopener'); }

  /* the card picture: the server's card when it answers (and then the link shows the same picture), else drawn here */
  var probes = {};
  function serverCard(id) {
    if (probes[id]) return probes[id];
    probes[id] = new Promise(function (res) {
      if (!root.fetch) { res(null); return; }
      var ac = root.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ac) ac.abort(); res(null); }, 7000);
      root.fetch(api.cardUrl(id) + '.png', { signal: ac ? ac.signal : undefined, cache: 'no-cache' }).then(function (r) {
        if (!r.ok || !/image\/png/.test(r.headers.get('content-type') || '') || /\/img\/og\.png/.test(r.url || '')) throw new Error('no card');
        return r.blob();
      }).then(function (b) { clearTimeout(t); res(b && b.size ? b : null); }, function () { clearTimeout(t); res(null); });
    });
    probes[id].then(function (b) { if (!b) setTimeout(function () { delete probes[id]; }, 60000); });
    return probes[id];
  }
  function localCard(id) {
    return new Promise(function (res) {
      var S = root.XCPShare, p = rawPet(id);
      if (!S || !S.cardCanvas || !p) { res(null); return; }
      try { S.cardCanvas(p).toBlob(function (b) { res(b || null); }, 'image/png'); } catch (e) { res(null); }
    });
  }
  function gifOf(id) {
    return new Promise(function (res) {
      var S = root.XCPShare, p = rawPet(id);
      if (!S || !S.gifBlob || !p) { res(null); return; }
      try { S.gifBlob(p, function (b) { res(b || null); }); } catch (e) { res(null); }
    });
  }

  var open = null;
  function close() { if (!open) return; var o = open; open = null; if (o.url) setTimeout(function () { URL.revokeObjectURL(o.url); }, 30000); if (o.gifUrl) setTimeout(function () { URL.revokeObjectURL(o.gifUrl); }, 30000); o.el.remove(); d.removeEventListener('keydown', o.key, true); if (o.back) try { o.back.focus(); } catch (e) { } }
  function el(tag, cls, txt) { var e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function sheet(id, back) {
    close(); css();
    var p = petOf(id), st = { id: id, link: api.pageUrl(id), blob: null, server: false, back: back };
    var ov = el('div', 'sh-ov'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Share ' + (p.name || 'pet') + ' #' + id);
    var box = el('div', 'sh-sheet'), head = el('div', 'sh-head');
    head.appendChild(el('span', 'sh-title', 'Share #' + id + (p.name ? ' ' + p.name : '')));
    var x = el('button', 'sh-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = close; head.appendChild(x);
    box.appendChild(head);
    var pic = el('div', 'sh-pic'), img = el('img'); img.alt = 'Pet card for #' + id; pic.appendChild(img); pic.classList.add('loading'); box.appendChild(pic);
    var hint = el('p', 'sh-hint'); hint.hidden = true; box.appendChild(hint);
    var list = el('div', 'sh-list'); box.appendChild(list);
    function act(label, sub, fn, cls) { var b = el('button', 'sh-act' + (cls ? ' ' + cls : '')); b.type = 'button'; b.appendChild(el('b', null, label)); if (sub) b.appendChild(el('small', null, sub)); b.onclick = function (e) { e.stopPropagation(); fn(b); }; list.appendChild(b); return b; }
    var tx = function () { return api.text(p) + (p.dead ? ' 🪦' : ' 🔥') + ' @XCPets'; };
    var native = act('Share card', 'Pick Telegram, X or any app', function () {
      if (!st.blob) { toast('The card is still loading'); return; }
      var f = fileOf(st.blob, 'xcpets-' + id + '.png', 'image/png');
      nav.share({ files: [f], text: tx() + ' ' + st.link }).catch(function (e) { if (e && e.name !== 'AbortError') toast('Could not open sharing. Try Save image.'); });
    }, 'sh-main');
    native.hidden = true;
    act('Post on X', 'The link shows the card', function () { openUrl(api.xIntent(tx(), st.link)); });
    act('Send on Telegram', 'The link shows the card', function () { openUrl(api.tgIntent(tx(), st.link)); });
    act('Save image', null, function () { save(st.blob, 'png'); });
    act('Save GIF', 'Dancing pet', function (b) {
      b.disabled = true; gifOf(id).then(function (g) { b.disabled = false; if (!g) { toast('Could not make the GIF'); return; } save(g, 'gif'); });
    });
    act('Copy link', null, function () { copyText(st.link, function (ok) { toast(ok ? 'Link copied' : 'Copy this link', st.link); }); });
    function save(blob, kind) {
      if (!blob) { toast('The card is still loading'); return; }
      var name = 'xcpets-' + id + '.' + kind, type = kind === 'gif' ? 'image/gif' : 'image/png', T = tgApp();
      if (T && kind === 'png' && st.server && T.downloadFile && T.isVersionAtLeast && T.isVersionAtLeast('8.0')) { try { T.downloadFile({ url: api.cardUrl(id) + '.png', file_name: name }); return; } catch (e) { } }
      if (canDownload()) {
        var u = URL.createObjectURL(blob), a = d.createElement('a'); a.href = u; a.download = name; d.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 10000); toast(kind === 'gif' ? 'GIF saved' : 'Image saved'); return;
      }
      var f = fileOf(blob, name, type);
      if (canShareFile(f)) { nav.share({ files: [f] }).catch(function () { }); return; }
      /* last resort (Telegram's in-app browser, older phones): show it big, press and hold to save */
      if (kind === 'gif') { if (st.gifUrl) URL.revokeObjectURL(st.gifUrl); st.gifUrl = URL.createObjectURL(blob); img.src = st.gifUrl; }
      hint.textContent = 'Press and hold the picture, then Save.'; hint.hidden = false; pic.scrollIntoView && pic.scrollIntoView({ block: 'nearest' });
    }
    ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    d.addEventListener('keydown', key, true);
    d.body.appendChild(ov);
    open = { el: ov, key: key, back: back, url: null }; st.el = ov;
    var me = open;
    try { x.focus(); } catch (e) { }
    serverCard(id).then(function (b) {
      if (b) { st.server = true; st.link = api.cardUrl(id); return b; }
      return localCard(id);
    }).then(function (b) {
      if (open !== me) return;
      st.blob = b; pic.classList.remove('loading');
      if (b) { me.url = URL.createObjectURL(b); img.src = me.url; } else pic.classList.add('none');
      if (b && canShareFile(fileOf(b, 'xcpets-' + id + '.png', 'image/png'))) native.hidden = false;
    });
  }
  function row(id, where) {
    var box = d.createElement('div'); box.className = 'sh-row'; box.setAttribute('data-sh', where); box.setAttribute('data-pet', String(id));
    var b = d.createElement('button'); b.type = 'button'; b.className = 'sh-one'; b.setAttribute('aria-haspopup', 'dialog');
    b.innerHTML = '<span class="sh-ico" aria-hidden="true"></span>Share';
    b.title = 'Share this pet on Telegram or X, or save its card';
    b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); sheet(id, b); };
    box.appendChild(b);
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
  /* smooth (Nov 26 2026): one pass per 60 ms at most. It ran a whole-page scan for every DOM change, synchronously, so a list adding
   * 150 cards or a class flip on each sprite ran it again and again inside the same frame. */
  var syncQ = 0; if (d.body) new MutationObserver(function () { if (!syncQ) syncQ = setTimeout(function () { syncQ = 0; sync(); }, 60); }).observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  sync(); preview();
  root.V2Share.row = row; root.V2Share.sync = sync; root.V2Share.open = sheet; root.V2Share.close = close;
}
