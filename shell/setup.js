/* XCPETS Pet Shell setup (shell/index.html), Nov 24 2026. Money plan: "Pet Shell, a numbered run of 21 pet handhelds".
 * Everything happens over one USB cable from this page, in Chrome or Edge on a computer:
 *   1. put the software on (ESP Web Tools flashes shell/firmware/petshell.bin, built by the petshell-firmware workflow)
 *   2. type a wallet ADDRESS (public, never a key) and pick one of its living pets (the published owner pages, like tg/app.js)
 *   3. type the Wi-Fi name and password
 *   4. send: settings + the pet's pixel art for every stage (js/pet-core.js + js/v2-art.js, the same seed -> pixels code the
 *      site uses), as text lines over Web Serial (protocol: petshell/firmware/src/main.cpp "USB setup").
 * The Pet Shell never holds a key and never signs: its feed button shows a QR that opens xcpets.fun with the burn ready
 * (the phone hand-off link of js/handoff.js), and the player's own wallet signs it there. */
(function (root) {
  'use strict';
  var NODE = 'https://node.xcpets.fun';
  var BG565 = 0x0862;              /* the device's background colour, used for see-through pixels */
  var STAGES = 6, FRAMES = 4, SIDE = 32;

  /* ---------------------------------------------------------------- pure helpers (also used by tools/petshell-test.js) */
  /** RGBA (32 x 32) -> 2,048 bytes of RGB565, little endian; see-through pixels become the device background */
  function rgb565(rgba) {
    var out = new Uint8Array(SIDE * SIDE * 2), i, r, g, b, v;
    for (i = 0; i < SIDE * SIDE; i++) {
      r = rgba[i * 4]; g = rgba[i * 4 + 1]; b = rgba[i * 4 + 2];
      v = rgba[i * 4 + 3] < 128 ? BG565 : (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3));
      out[i * 2] = v & 0xff; out[i * 2 + 1] = v >> 8;
    }
    return out;
  }
  function b64(bytes) {
    var s = '', i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  }
  function validAddr(a) { return /^bc1[ac-hj-np-z02-9]{11,87}$/.test(a) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a); }
  function normAddr(a) { a = String(a || '').trim(); return /^bc1/i.test(a) ? a.toLowerCase() : a; }
  /** the text lines the Pet Shell reads, in order: settings, 24 art frames (or none), SAVE */
  function lines(cfg, frames) {
    var out = ['CFG ' + JSON.stringify({ ssid: cfg.ssid, pass: cfg.pass, addr: cfg.addr, pet: cfg.pet, name: String(cfg.name || '').slice(0, 24), num: cfg.num | 0, flip: !!cfg.flip })];
    if (frames) for (var s = 0; s < STAGES; s++) for (var f = 0; f < FRAMES; f++) out.push('ART ' + s + ' ' + f + ' ' + b64(rgb565(frames[s][f])));
    out.push('SAVE');
    return out;
  }
  /** all 6 stages x 4 frames for a pet record from the published files (null when the shared art code can't draw it) */
  function petFrames(p, hashes, PetCore, XcpArt) {
    if (!p || p.community || p.hybrid || /^hyb/.test(String(p.species || ''))) return null;
    var a = p.art && p.art.dna ? p.art : XcpArt.buildArt(p, p.__hs || hashes, PetCore, {}), out = [];
    for (var s = 0; s < STAGES; s++) {
      var fr = PetCore.renderFrames(a, { stage: s, gearOverride: {} });
      if (!fr || fr.length < FRAMES || fr[0].width !== SIDE || fr[0].height !== SIDE) return null;
      out.push(fr.slice(0, FRAMES).map(function (x) { return x.data; }));
    }
    return out;
  }
  var api = { rgb565: rgb565, b64: b64, lines: lines, petFrames: petFrames, validAddr: validAddr, normAddr: normAddr, BG565: BG565 };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.PetShellSetup = api;

  /* ---------------------------------------------------------------- page */
  var D = document, W = window, $ = function (id) { return D.getElementById(id); };
  var S = { folder: null, addr: '', hex: '', page: null, pets: [], next: 1, pages: 0, pick: null, frames: null, artP: null };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function getJson(url, ms) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, ms || 15000);
    return fetch(url, { cache: 'no-cache', signal: ctl.signal }).then(function (r) { clearTimeout(t); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); return r.json(); },
      function (e) { clearTimeout(t); throw e; });
  }
  function sha256(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (d) { return Array.prototype.map.call(new Uint8Array(d), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }); }
  function world() {
    if (S.folder) return Promise.resolve();
    return getJson(NODE + '/xp/v1/world/latest.json', 12000).then(function (l) {
      var p = l && (l.manifest || l.url); if (!p) throw new Error('no world');
      S.folder = (/^https?:/.test(p) ? p : NODE + p).replace(/[^/]+$/, '');
    });
  }
  function loadScript(src) { return new Promise(function (ok, no) { var s = D.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; D.head.appendChild(s); }); }
  function art() {
    if (!S.artP) S.artP = loadScript('../js/pet-core.js?v=e6db15afb2').then(function () { return loadScript('../js/v2-art.js?v=a543bcdc56'); })
      .then(function () { return !!(W.PetCore && W.XcpArt && XcpArt.buildArt); }, function () { return false; });
    return S.artP;
  }
  function living(list) { return (list || []).filter(function (p) { return p && p.id && !p.dead && !p.released; }); }
  var STAGE = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  function say(id, html, bad) { var el = $(id); el.innerHTML = html; el.className = 'msg' + (bad ? ' bad' : ''); el.hidden = !html; }

  function petsByIds(ids) {
    var need = {};
    ids.forEach(function (id) { var nm = ('00000' + Math.floor(id / 2000)).slice(-5); (need[nm] = need[nm] || []).push(id); });
    return Promise.all(Object.keys(need).map(function (nm) {
      return getJson(S.folder + 'view/p/' + nm + '.json', 25000).then(function (pack) {
        var map = pack && pack.pets || {};
        return need[nm].map(function (id) { var q = map[String(id)]; if (!q) return null; q = Object.assign({}, q); q.__hs = pack.hashes || null; return q; }).filter(Boolean);
      });
    })).then(function (g) { return [].concat.apply([], g); });
  }

  function loadWallet() {
    var a = normAddr($('addr').value);
    if (!validAddr(a)) { say('walletMsg', 'That doesn\'t look like a Bitcoin address. Copy it from your wallet (it starts with bc1, 1 or 3).', true); return; }
    S.addr = a; S.pick = null; S.frames = null; paintPick();
    say('walletMsg', 'Loading your pets…');
    $('pets').innerHTML = '';
    world().then(function () { return sha256(a); }).then(function (hex) {
      S.hex = hex;
      return getJson(S.folder + 'view/own/' + hex + '.json');
    }).then(function (pg) {
      S.page = pg; S.pages = pg ? pg.pages || 1 : 0; S.next = 1;
      S.pets = pg ? living(pg.pets).map(function (p) { p.__hs = pg.hashes || null; return p; }) : [];
      if (!pg || !S.pets.length) { say('walletMsg', 'No living pets found for this wallet yet. Hatch one on xcpets.fun first!', true); return; }
      say('walletMsg', (pg.alive || S.pets.length) + ' living pets. Tap the one that lives in your Pet Shell.');
      paintPets(S.pets, true);
    }).catch(function () { say('walletMsg', 'Could not load the published pets right now. Try again in a minute.', true); });
  }
  function more() {
    if (S.next >= S.pages) return;
    var n = S.next++, b = $('morePets'); b.disabled = true;
    getJson(S.folder + 'view/own/' + S.hex + '.' + n + '.json').then(function (pg) {
      if (!pg) return [];
      return pg.pets ? living(pg.pets) : petsByIds(pg.ids || []).then(living);
    }).then(function (add) { S.pets = S.pets.concat(add); paintPets(add, false); })
      .catch(function () { S.next--; })
      .then(function () { b.disabled = false; b.hidden = S.next >= S.pages; });
  }
  function findById() {
    var id = parseInt($('petId').value, 10);
    if (!(id > 0)) return;
    world().then(function () { return petsByIds([id]); }).then(function (l) {
      var p = l[0];
      if (!p || p.dead || p.released) { say('walletMsg', 'Pet #' + id + ' is not alive.', true); return; }
      if (S.addr && p.owner && p.owner !== S.addr) { say('walletMsg', 'Pet #' + id + ' belongs to another wallet.', true); return; }
      if (!S.pets.some(function (q) { return q.id === p.id; })) { S.pets.push(p); paintPets([p], false); }
      choose(p.id);
    });
  }
  function paintPets(list, fresh) {
    var box = $('pets');
    if (fresh) box.innerHTML = '';
    list.forEach(function (p) {
      var b = D.createElement('button'); b.type = 'button'; b.className = 'pet'; b.setAttribute('data-id', p.id);
      b.innerHTML = '<span class="art" data-art="' + p.id + '"></span><b>' + esc(p.name || ('#' + p.id)) + '</b><i>#' + p.id + ' · ' + (STAGE[p.stage | 0] || '') + '</i>';
      b.onclick = function () { choose(p.id); };
      box.appendChild(b);
    });
    $('morePets').hidden = S.next >= S.pages;
    art().then(function (ok) {
      if (!ok) return;
      list.forEach(function (p) {
        var slot = box.querySelector('[data-art="' + p.id + '"]'); if (!slot) return;
        var fr = null; try { fr = petFrames(p, p.__hs, W.PetCore, W.XcpArt); } catch (e) { }
        var cv = D.createElement('canvas'); cv.width = SIDE; cv.height = SIDE;
        if (fr) { var id = cv.getContext('2d').createImageData(SIDE, SIDE); id.data.set(fr[Math.max(0, Math.min(5, p.stage | 0))][0]); cv.getContext('2d').putImageData(id, 0, 0); }
        slot.appendChild(cv);
      });
    });
  }
  function choose(id) {
    var p = S.pets.filter(function (q) { return q.id === id; })[0]; if (!p) return;
    S.pick = p;
    Array.prototype.forEach.call(D.querySelectorAll('.pet'), function (b) { b.classList.toggle('on', +b.getAttribute('data-id') === id); });
    art().then(function (ok) {
      S.frames = null;
      if (ok) try { S.frames = petFrames(p, p.__hs, W.PetCore, W.XcpArt); } catch (e) { S.frames = null; }
      paintPick();
    });
  }
  var anim = 0;
  function paintPick() {
    var p = S.pick, el = $('picked');
    if (!p) { el.innerHTML = '<p class="sub">No pet picked yet.</p>'; return; }
    el.innerHTML = '<canvas id="pickCv" width="32" height="32"></canvas><div><b>' + esc(p.name || ('#' + p.id)) + '</b> #' + p.id +
      '<br><span class="sub">' + (S.frames ? 'Its picture for every stage goes on the Pet Shell, so it grows up on the screen too.' : 'This pet is drawn by the full site only (hybrids and community pets), so the Pet Shell shows a mystery egg for it. Everything else works.') + '</span></div>';
    clearInterval(anim);
    if (S.frames) {
      var cv = $('pickCv'), c = cv.getContext('2d'), i = 0, st = Math.max(0, Math.min(5, p.stage | 0));
      var paint = function () { var id = c.createImageData(SIDE, SIDE); id.data.set(S.frames[st][i++ % FRAMES]); c.putImageData(id, 0, 0); };
      paint(); anim = setInterval(paint, 260);
    }
  }

  /* ---------------------------------------------------------------- Web Serial */
  function send() {
    var cfg = { ssid: $('ssid').value.trim(), pass: $('pass').value, addr: S.addr, pet: S.pick && S.pick.id, name: S.pick && S.pick.name, num: parseInt($('num').value, 10) || 0, flip: $('flip').checked };
    if (!S.pick) return say('sendMsg', 'Pick a pet first (step 2).', true);
    if (!cfg.ssid) return say('sendMsg', 'Type your Wi-Fi name (step 3).', true);
    if (!('serial' in navigator)) return say('sendMsg', 'This browser can\'t talk to USB devices. Use Chrome or Edge on a computer.', true);
    var port, reader, writer, buf = '', waiters = [], all = lines(cfg, S.frames), done = 0;
    var btn = $('sendBtn'); btn.disabled = true;
    function next(ms) {
      return new Promise(function (ok, no) {
        var t = setTimeout(function () { no(new Error('The Pet Shell did not answer. Unplug it, plug it back in and try again.')); }, ms || 6000);
        waiters.push(function (l) { clearTimeout(t); ok(l); });
        flush();
      });
    }
    function flush() { var i; while (waiters.length && (i = buf.indexOf('\n')) >= 0) { var l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l && /^(OK|ERR|PETSHELL|INFO)/.test(l)) waiters.shift()(l); } }
    function pump() { reader.read().then(function (r) { if (r.done) return; buf += new TextDecoder().decode(r.value); flush(); pump(); }, function () { }); }
    function write(l) { return writer.write(new TextEncoder().encode(l + '\n')); }
    function cmd(l, ms) { return write(l).then(function () { return next(ms); }).then(function (r) { if (/^ERR/.test(r)) throw new Error(r.replace(/^ERR\s*/, '')); return r; }); }
    say('sendMsg', 'Pick your Pet Shell in the box that opens (it is called "USB JTAG/serial debug unit" or similar).');
    navigator.serial.requestPort({ filters: [{ usbVendorId: 0x303a }] }).then(function (p) {
      port = p; return port.open({ baudRate: 115200 });
    }).then(function () {
      reader = port.readable.getReader(); writer = port.writable.getWriter(); pump();
      say('sendMsg', 'Saying hello…');
      return cmd('HELLO', 3000).catch(function () { return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { return cmd('HELLO', 5000); }); });
    }).then(function () {
      var chain = Promise.resolve();
      all.forEach(function (l) {
        chain = chain.then(function () { return cmd(l, l === 'SAVE' ? 10000 : 6000); }).then(function () { done++; say('sendMsg', 'Sending… ' + Math.round(100 * done / all.length) + '%'); });
      });
      return chain;
    }).then(function () {
      say('sendMsg', '🎉 Done! Your Pet Shell restarts and shows <b>' + esc(S.pick.name || ('#' + S.pick.id)) + '</b> in a few seconds. You can unplug it.');
    }).catch(function (e) {
      say('sendMsg', esc(e && e.message || 'Something went wrong.') + (e && e.name === 'NotFoundError' ? ' (no Pet Shell was picked)' : ''), true);
    }).then(function () {
      btn.disabled = false;
      try { reader && reader.cancel(); } catch (e) { }
      try { writer && writer.releaseLock(); } catch (e) { }
      setTimeout(function () { try { port && port.close(); } catch (e) { } }, 300);
    });
  }

  function init() {
    if (!('serial' in navigator)) $('noSerial').hidden = false;
    $('loadPets').onclick = loadWallet;
    $('addr').addEventListener('keydown', function (e) { if (e.key === 'Enter') loadWallet(); });
    $('morePets').onclick = more;
    $('findPet').onclick = findById;
    $('sendBtn').onclick = send;
    $('showPass').onchange = function () { $('pass').type = this.checked ? 'text' : 'password'; };
    paintPick();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})(this);
