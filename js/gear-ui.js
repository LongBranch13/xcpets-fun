/* XCPETS gear UI (shared by the real game popup, pet.html and the play-money demo).
 * Free equip/take off: no burn. Gear area (one row per slot, locked slots greyed), thumbnail picker, live preview + Confirm/Cancel.
 * Pure DOM; the caller supplies the data and the actions. */
(function (root, f) { var m = f(); if (typeof module === 'object' && module.exports) module.exports = m; else root.GearUI = m; })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ICON = { band: '🎗️', armor: '🛡️', cape: '🧣', weapon: '⚔️', crown: '👑', face: '😎', back: '🎒', feet: '👟' };
  var LABEL = { band: 'Band', armor: 'Armor', cape: 'Cape', weapon: 'Weapon', crown: 'Crown', face: 'Face', back: 'Back', feet: 'Feet' };
  var BONUS = ['face', 'back', 'feet'], cache = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function paint(cv, img) { if (cv && img) cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), 32, 32), 0, 0); }
  var CSS = '.gearbox{margin:4px auto 0;max-width:440px;font:12px system-ui,sans-serif;text-align:left}.gearbox summary{cursor:pointer;color:#33d6ff;text-align:center;font-weight:600}' +
    '.gearrow{display:flex;align-items:center;gap:6px;padding:2px 4px;border-bottom:1px solid rgba(255,255,255,.08)}.gearrow canvas{width:28px;height:28px;image-rendering:pixelated;border-radius:6px;background:#0b0912;flex:none}' +
    '.gearrow .gs{width:76px;white-space:nowrap;color:#8fb39a;font-weight:600}.gearrow .gn{flex:1;color:#e9fbe9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gearrow.locked{opacity:.45}.gearrow.locked .gn{color:#9aa}' +
    '.gpill{font:700 11px system-ui,sans-serif;padding:2px 10px;min-height:24px;border-radius:999px;border:2px solid #0d1117;box-shadow:2px 2px 0 #000;cursor:pointer;background:#33d6ff;color:#0d1117}' +
    '.gpill.off{background:#b58cff}.gpill.ok{background:#3ddc84}.gpill.no{background:#2a2f3a;color:#e9fbe9}.gpill:hover{filter:brightness(1.12)}.gpill[disabled]{opacity:.4;cursor:not-allowed}' +
    '#gearPick{position:fixed;inset:0;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;z-index:60}#gearPick.on{display:flex}' +
    '#gearPick .gbox{background:#14201a;border:3px solid #3ddc84;border-radius:14px;box-shadow:4px 4px 0 #000;padding:12px 14px;max-width:min(560px,94vw);max-height:92vh;overflow:auto;color:#e9fbe9;font:13px system-ui,sans-serif;text-align:center}' +
    '#gearPick h3{margin:0 0 8px;font-size:16px}#gearPick .ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;margin:6px 0}' +
    '#gearPick .gitem{position:relative;background:#0d1117;border:2px solid #2c3b31;border-radius:10px;padding:4px 2px;cursor:pointer;color:#e9fbe9;font:600 10px system-ui,sans-serif}' +
    '#gearPick .gitem canvas{width:56px;height:56px;image-rendering:pixelated;display:block;margin:0 auto 2px}#gearPick .gitem.sel{border-color:#33d6ff;box-shadow:0 0 0 2px #33d6ff}' +
    '#gearPick .gbadge{position:absolute;top:2px;right:2px;font-size:9px;padding:0 5px;border-radius:99px;background:#ffc93c;color:#0d1117}#gearPick .gbadge.inv{background:#33d6ff}' +
    '#gearPick .gprev{display:flex;gap:14px;justify-content:center;align-items:flex-end;margin:6px 0}#gearPick .gprev canvas{width:112px;height:112px;image-rendering:pixelated;border-radius:10px;border:2px solid #2c3b31}' +
    '#gearPick .gprev .new canvas{border-color:#33d6ff}#gearPick .gprev small{display:block;color:#9fdcb4}#gearPick .gbtns{display:flex;gap:8px;justify-content:center;margin-top:8px}';
  function style() { if (typeof document === 'undefined' || document.getElementById('gearUiCss')) return; var s = document.createElement('style'); s.id = 'gearUiCss'; s.textContent = CSS; document.head.appendChild(s); }
  /** item icon = the item worn by a plain pet of its own species (signature) or the given species. */
  function thumb(PetCore, BonusGear, it, species) {
    var sp = it.species || species || 'pepe', key = it.slot + '|' + it.item + '|' + sp; if (cache[key]) return cache[key];
    var base = PetCore.characterPet(sp, { tier: 'common', bgColor: '#142018' }), go = {}, ex = {};
    if (it.overlay || BONUS.indexOf(it.slot) >= 0) ex[it.slot] = it.item; else go[it.slot] = it.item;
    var fr = PetCore.renderFrames(base, { stage: 3, gearOverride: go }); if (BonusGear && Object.keys(ex).length) BonusGear.decorate(PetCore, base, 3, fr, ex, go);
    return (cache[key] = fr);
  }
  /** pet sprite with a gear map (empty slot = nothing drawn). gear: { slot: {item, overlay} | null } applied on top of the pet's current gear. */
  function wearing(PetCore, BonusGear, art, stage, gearOverride, extraGear, change, cap) {
    var go = Object.assign({}, gearOverride || {}), ex = Object.assign({}, extraGear || {});
    Object.keys(change || {}).forEach(function (sl) { delete go[sl]; delete ex[sl]; var c = change[sl]; if (c) (c.overlay || BONUS.indexOf(sl) >= 0 ? ex : go)[sl] = c.item; });
    var fr = PetCore.renderFrames(art, { stage: stage, gearOverride: go, gearCap: cap }); if (BonusGear && Object.keys(ex).length) BonusGear.decorate(PetCore, art, stage, fr, ex, go);
    return fr;
  }
  /** Gear area: rows = [{slot, locked, item: {label, frames} | null}]. opts.onOff(slot), opts.onEquip(slot), opts.canEdit, opts.open. */
  function area(rows, opts) {
    style(); var d = document.createElement('details'); d.className = 'gearbox'; if (opts.open) d.open = true;
    var worn = rows.filter(function (r) { return r.item; }).length, open = rows.filter(function (r) { return !r.locked; }).length;
    d.innerHTML = '<summary>Gear (' + worn + '/' + open + ' worn)' + (opts.canEdit ? ' · free' : '') + '</summary>' + rows.map(function (r, i) {
      return '<div class="gearrow' + (r.locked ? ' locked' : '') + '"><span class="gs">' + ICON[r.slot] + ' ' + LABEL[r.slot] + '</span><canvas width="32" height="32"></canvas><span class="gn">' +
        (r.locked ? '🔒 locked' + (r.lockNote ? ' · ' + esc(r.lockNote) : '') : r.item ? esc(r.item.label) : '<span style="color:#8a9">empty</span>') + '</span>' +
        (r.locked || !opts.canEdit ? '' : r.item ? '<button type="button" class="gpill off" data-off="' + i + '">Take off</button><button type="button" class="gpill" data-eq="' + i + '">Swap</button>' : '<button type="button" class="gpill" data-eq="' + i + '">Equip</button>') + '</div>'; }).join('');
    var cvs = d.querySelectorAll('canvas'); rows.forEach(function (r, i) { if (r.item && r.item.frames) paint(cvs[i], r.item.frames[0]); else cvs[i].style.visibility = r.locked ? 'hidden' : 'visible'; });
    Array.prototype.forEach.call(d.querySelectorAll('[data-off]'), function (b) { b.onclick = function () { opts.onOff(rows[Number(b.getAttribute('data-off'))].slot); }; });
    Array.prototype.forEach.call(d.querySelectorAll('[data-eq]'), function (b) { b.onclick = function () { opts.onEquip(rows[Number(b.getAttribute('data-eq'))].slot); }; });
    return d;
  }
  var timer = null, lastFocus = null;
  function close() { var m = document.getElementById('gearPick'); if (m) m.classList.remove('on'); clearInterval(timer); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  /** Picker: opts {title, now: frames, items: [{label, frames, badge, inv, swap, preview(): frames}], onConfirm(item), empty}. */
  function pick(opts) {
    style(); var m = document.getElementById('gearPick');
    if (!m) { m = document.createElement('div'); m.id = 'gearPick'; m.className = 'gearpick'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m);
      m.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
        if (e.key !== 'Tab') return; e.stopPropagation(); var f = Array.prototype.filter.call(m.querySelectorAll('button:not([disabled])'), function (x) { return x.offsetParent !== null; }); if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } });
      m.onclick = function (e) { if (e.target === m) close(); }; }
    lastFocus = document.activeElement; var sel = -1;
    m.innerHTML = '<div class="gbox"><h3>' + esc(opts.title) + '</h3>' + (opts.items.length ? '<div class="ggrid">' + opts.items.map(function (it, i) {
      return '<button type="button" class="gitem" data-i="' + i + '" title="' + esc(it.label) + '"><canvas width="32" height="32"></canvas>' + esc(it.label) + (it.badge ? '<span class="gbadge' + (it.inv ? ' inv' : '') + '">' + esc(it.badge) + '</span>' : '') + '</button>'; }).join('') + '</div>'
      : '<p style="color:#9aa">' + esc(opts.empty || 'No item fits.') + '</p>') +
      '<div class="gprev" hidden><div><canvas width="32" height="32" class="g0"></canvas><small>Now</small></div><div class="new"><canvas width="32" height="32" class="g1"></canvas><small class="gl">With</small></div></div>' +
      '<p class="gnote" style="font-size:11px;color:#9fdcb4;margin:4px 0">Free, no burn. Saved on this device; other viewers see the pet\'s rolled gear.</p>' +
      '<div class="gbtns"><button type="button" class="gpill ok gyes" disabled>Confirm</button><button type="button" class="gpill no gno">Cancel</button></div></div>';
    var cv = m.querySelectorAll('.gitem canvas'); opts.items.forEach(function (it, i) { paint(cv[i], it.frames[0]); });
    var c0 = m.querySelector('.g0'), c1 = m.querySelector('.g1'), f = 0, nf = opts.now, pf = null;
    clearInterval(timer); timer = setInterval(function () { f++; if (nf) paint(c0, nf[f % nf.length]); if (pf) paint(c1, pf[f % pf.length]); }, 280);
    Array.prototype.forEach.call(m.querySelectorAll('.gitem'), function (b) { b.onclick = function () {
      sel = Number(b.getAttribute('data-i')); var it = opts.items[sel];
      Array.prototype.forEach.call(m.querySelectorAll('.gitem'), function (x) { x.classList.toggle('sel', x === b); });
      pf = it.preview(); m.querySelector('.gprev').hidden = false; paint(c0, nf[0]); paint(c1, pf[0]);
      m.querySelector('.gl').textContent = 'With ' + it.label + (it.swap ? ' (swap)' : ''); m.querySelector('.gyes').disabled = false; }; });
    m.querySelector('.gyes').onclick = function () { if (sel < 0) return; var it = opts.items[sel]; close(); opts.onConfirm(it); };
    m.querySelector('.gno').onclick = close;
    m.classList.add('on'); setTimeout(function () { var b = m.querySelector('.gitem') || m.querySelector('.gno'); if (b) b.focus(); }, 0);
  }
  return { ICON: ICON, LABEL: LABEL, BONUS: BONUS, thumb: thumb, wearing: wearing, area: area, pick: pick, close: close, isOpen: function () { var m = typeof document !== 'undefined' && document.getElementById('gearPick'); return !!(m && m.classList.contains('on')); } };
});
